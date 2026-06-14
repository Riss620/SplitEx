import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';
import { calculateGroupBalances } from '../services/balanceEngine';
import { generateMinimalSettlements } from '../services/settlementEngine';

export const recordSettlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, fromUserId, toUserId, amount, currency } = req.body;

    if (!groupId || !fromUserId || !toUserId || !amount) {
      throw new CustomError('Missing required fields', 400);
    }

    const group = await prisma.group.findUnique({ where: { id: groupId, deletedAt: null } });
    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    // Verify members
    const members = await prisma.groupMembership.findMany({
      where: { groupId, userId: { in: [fromUserId, toUserId] }, deletedAt: null },
    });

    if (members.length !== 2 && fromUserId !== toUserId) {
      throw new CustomError('Both parties must be members of the group', 400);
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId,
        amount: Number(amount),
        currency: currency || 'INR',
        status: 'PAID', // Direct logging registers it as paid
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SETTLEMENT_RECORDED',
        entityType: 'Settlement',
        entityId: settlement.id,
        details: JSON.stringify({ amount, fromUserId, toUserId }),
      },
    });

    res.status(201).json({ success: true, settlement });
  } catch (err) {
    next(err);
  }
};

export const getSettlements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.query;

    const whereClause: any = { deletedAt: null };
    if (groupId) {
      whereClause.groupId = String(groupId);
    }

    const settlements = await prisma.settlement.findMany({
      where: whereClause,
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, settlements });
  } catch (err) {
    next(err);
  }
};

export const getSettlementSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.group.findUnique({ where: { id: groupId, deletedAt: null } });
    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    // 1. Calculate cumulative net balances from expenses
    const { balances } = await calculateGroupBalances(groupId);

    // 2. Fetch recorded settlements to adjust the net balances
    const settlements = await prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
    });

    // Adjust balances by payments: if A pays B, then A's net increases (+), and B's net decreases (-)
    const adjustedBalances = balances.map((b) => {
      let net = b.net;
      settlements.forEach((s) => {
        const amt = Number(s.amount);
        if (s.fromUserId === b.userId) {
          net += amt; // they paid out, reducing what they owe
        }
        if (s.toUserId === b.userId) {
          net -= amt; // they received, reducing what they are owed
        }
      });
      return {
        userId: b.userId,
        name: b.name,
        net: Number(net.toFixed(2)),
      };
    });

    // 3. Solve optimized transfers
    const suggestions = generateMinimalSettlements(adjustedBalances);

    res.status(200).json({
      success: true,
      balances: adjustedBalances,
      suggestions,
    });
  } catch (err) {
    next(err);
  }
};
