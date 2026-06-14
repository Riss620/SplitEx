import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';
import { SplitType } from '../types/prismaEmulated';
import { splitExpenseAmount } from '../services/balanceEngine';

export const createExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, description, amount, currency, originalAmount, originalCurrency, exchangeRate, paidById, splitType, notes, date, participants } = req.body;

    if (!groupId || !description || !amount || !paidById || !splitType || !participants || !participants.length) {
      throw new CustomError('Missing required fields', 400);
    }

    const group = await prisma.group.findUnique({ where: { id: groupId, deletedAt: null } });
    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    const expenseDate = date ? new Date(date) : new Date();

    // Verify payer and participants are active on the expense date
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId, deletedAt: null },
    });

    const verifyActive = (userId: string, name: string) => {
      const m = memberships.find((memb) => memb.userId === userId);
      if (!m) {
        throw new CustomError(`User ${name} is not a member of this group`, 400);
      }
      if (expenseDate < m.joinedAt) {
        throw new CustomError(`User ${name} was not active on the expense date (joined later on ${m.joinedAt.toISOString().slice(0, 10)})`, 400);
      }
      if (m.leftAt && expenseDate > m.leftAt) {
        throw new CustomError(`User ${name} was not active on the expense date (left earlier on ${m.leftAt.toISOString().slice(0, 10)})`, 400);
      }
    };

    // Verify payer
    const payerUser = await prisma.user.findUnique({ where: { id: paidById } });
    verifyActive(paidById, payerUser?.name || paidById);

    // Verify participants and split amounts
    const participantIds = participants.map((p: any) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: participantIds } },
    });

    participantIds.forEach((id: string) => {
      const u = users.find((x) => x.id === id);
      verifyActive(id, u?.name || id);
    });

    // Run math split engine
    const splitResult = splitExpenseAmount(Number(amount), splitType as SplitType, participants);

    // Check sum match for exact/percentage
    if (splitType === SplitType.EXACT) {
      const sum = participants.reduce((s: number, p: any) => s + (p.value || 0), 0);
      if (Math.abs(sum - Number(amount)) > 0.05) {
        throw new CustomError(`Exact split sum (${sum}) must equal expense amount (${amount})`, 400);
      }
    } else if (splitType === SplitType.PERCENTAGE) {
      const sum = participants.reduce((s: number, p: any) => s + (p.value || 0), 0);
      if (Math.abs(sum - 100) > 0.05) {
        throw new CustomError(`Percentage splits must sum to exactly 100%, currently: ${sum}%`, 400);
      }
    }

    // Database transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          groupId,
          description,
          amount: Number(amount),
          currency: currency || 'INR',
          originalAmount: Number(originalAmount || amount),
          originalCurrency: originalCurrency || currency || 'INR',
          exchangeRate: Number(exchangeRate || 1.0),
          paidById,
          splitType: splitType as SplitType,
          notes,
          createdAt: expenseDate,
        },
      });

      await tx.expenseParticipant.createMany({
        data: splitResult.map((r) => ({
          expenseId: newExpense.id,
          userId: r.userId,
          amount: r.amount,
          percentage: r.percentage,
          weight: r.weight,
        })),
      });

      return newExpense;
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPENSE_CREATED',
        entityType: 'Expense',
        entityId: expense.id,
        details: JSON.stringify({ description, amount }),
      },
    });

    res.status(201).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
};

export const getExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.query;

    const whereClause: any = { deletedAt: null };
    if (groupId) {
      whereClause.groupId = String(groupId);
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        participants: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, expenses });
  } catch (err) {
    next(err);
  }
};

export const getExpenseById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        participants: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!expense) {
      throw new CustomError('Expense not found', 404);
    }

    res.status(200).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
};

export const updateExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { description, amount, currency, originalAmount, originalCurrency, exchangeRate, paidById, splitType, notes, date, participants } = req.body;

    const existingExpense = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existingExpense) {
      throw new CustomError('Expense not found', 404);
    }

    const expenseDate = date ? new Date(date) : existingExpense.createdAt;

    // Check membership dates
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: existingExpense.groupId, deletedAt: null },
    });

    const verifyActive = (userId: string, name: string) => {
      const m = memberships.find((memb) => memb.userId === userId);
      if (!m) {
        throw new CustomError(`User ${name} is not a member of this group`, 400);
      }
      if (expenseDate < m.joinedAt) {
        throw new CustomError(`User ${name} was not active on the expense date (joined later on ${m.joinedAt.toISOString().slice(0, 10)})`, 400);
      }
      if (m.leftAt && expenseDate > m.leftAt) {
        throw new CustomError(`User ${name} was not active on the expense date (left earlier on ${m.leftAt.toISOString().slice(0, 10)})`, 400);
      }
    };

    const targetPayer = paidById || existingExpense.paidById;
    const payerUser = await prisma.user.findUnique({ where: { id: targetPayer } });
    verifyActive(targetPayer, payerUser?.name || targetPayer);

    let splitResult: { userId: string; amount: number; percentage?: number; weight?: number }[] = [];
    if (participants && participants.length) {
      const participantIds = participants.map((p: any) => p.userId);
      const users = await prisma.user.findMany({ where: { id: { in: participantIds } } });
      participantIds.forEach((pid: string) => {
        const u = users.find((x) => x.id === pid);
        verifyActive(pid, u?.name || pid);
      });

      const targetAmount = amount !== undefined ? Number(amount) : Number(existingExpense.amount);
      const targetSplitType = splitType || existingExpense.splitType;
      splitResult = splitExpenseAmount(targetAmount, targetSplitType as SplitType, participants);
    }

    const updatedExpense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id },
        data: {
          description: description || existingExpense.description,
          amount: amount !== undefined ? Number(amount) : existingExpense.amount,
          currency: currency || existingExpense.currency,
          originalAmount: originalAmount !== undefined ? Number(originalAmount) : existingExpense.originalAmount,
          originalCurrency: originalCurrency || existingExpense.originalCurrency,
          exchangeRate: exchangeRate !== undefined ? Number(exchangeRate) : existingExpense.exchangeRate,
          paidById: targetPayer,
          splitType: (splitType as SplitType) || existingExpense.splitType,
          notes: notes !== undefined ? notes : existingExpense.notes,
          createdAt: expenseDate,
        },
      });

      if (participants && participants.length) {
        // Soft delete old splits
        await tx.expenseParticipant.updateMany({
          where: { expenseId: id },
          data: { deletedAt: new Date() },
        });

        // Insert new ones
        await tx.expenseParticipant.createMany({
          data: splitResult.map((r) => ({
            expenseId: id,
            userId: r.userId,
            amount: r.amount,
            percentage: r.percentage,
            weight: r.weight,
          })),
        });
      }

      return exp;
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPENSE_UPDATED',
        entityType: 'Expense',
        entityId: id,
        details: JSON.stringify({ amount: updatedExpense.amount }),
      },
    });

    res.status(200).json({ success: true, expense: updatedExpense });
  } catch (err) {
    next(err);
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!expense) {
      throw new CustomError('Expense not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.expenseParticipant.updateMany({
        where: { expenseId: id },
        data: { deletedAt: new Date() },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPENSE_DELETED',
        entityType: 'Expense',
        entityId: id,
        details: JSON.stringify({ amount: expense.amount }),
      },
    });

    res.status(200).json({ success: true, message: 'Expense successfully soft-deleted' });
  } catch (err) {
    next(err);
  }
};
