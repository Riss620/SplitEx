import { prisma } from '../config/db';
import { SplitType } from '../types/prismaEmulated';
import { Decimal } from '@prisma/client/runtime/library';

export interface ParticipantBreakdown {
  userId: string;
  name: string;
  paid: number;
  owed: number;
  net: number;
}

export interface ExpenseTrace {
  expenseId: string;
  title: string;
  date: Date;
  paidBy: { id: string; name: string };
  originalAmount: number;
  originalCurrency: string;
  amountInInr: number;
  userShareInInr: number;
  userPaidInInr: number;
  netImpactInInr: number;
}

export interface GroupBalanceSummary {
  balances: ParticipantBreakdown[];
  traceability: {
    [userId: string]: ExpenseTrace[];
  };
}

/**
 * Computes net balances for all members in a group and builds a detailed audit trace for transparency.
 */
export const calculateGroupBalances = async (groupId: string): Promise<GroupBalanceSummary> => {
  // Fetch group details, members, and all non-deleted expenses with participants
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId, deletedAt: null },
    include: { user: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    include: {
      paidBy: true,
      participants: {
        where: { deletedAt: null },
        include: { user: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const memberMap = new Map<string, string>(); // userId -> name
  memberships.forEach((m) => {
    memberMap.set(m.user.id, m.user.name);
  });

  // Keep track of user cumulative sums
  const userPaidMap = new Map<string, number>();
  const userOwedMap = new Map<string, number>();
  const traceabilityMap: { [userId: string]: ExpenseTrace[] } = {};

  // Initialize maps for all group members (historical and current)
  memberships.forEach((m) => {
    userPaidMap.set(m.userId, 0);
    userOwedMap.set(m.userId, 0);
    traceabilityMap[m.userId] = [];
  });

  // Process each expense
  expenses.forEach((expense) => {
    const amountInr = Number(expense.amount);
    const originalAmt = Number(expense.originalAmount);
    const paidByUserId = expense.paidById;

    // Track payment
    if (userPaidMap.has(paidByUserId)) {
      userPaidMap.set(paidByUserId, (userPaidMap.get(paidByUserId) || 0) + amountInr);
    }

    // Process participant shares
    expense.participants.forEach((part) => {
      const owedInr = Number(part.amount);
      const participantUserId = part.userId;

      if (userOwedMap.has(participantUserId)) {
        userOwedMap.set(participantUserId, (userOwedMap.get(participantUserId) || 0) + owedInr);
      }

      // Record trace for this participant
      if (traceabilityMap[participantUserId]) {
        traceabilityMap[participantUserId].push({
          expenseId: expense.id,
          title: expense.description,
          date: expense.createdAt,
          paidBy: { id: expense.paidBy.id, name: expense.paidBy.name },
          originalAmount: originalAmt,
          originalCurrency: expense.originalCurrency,
          amountInInr: amountInr,
          userShareInInr: owedInr,
          userPaidInInr: participantUserId === paidByUserId ? amountInr : 0,
          netImpactInInr: (participantUserId === paidByUserId ? amountInr : 0) - owedInr,
        });
      }
    });

    // Handle when the payer themselves is NOT a participant, but paid (paidBy has a trace entry)
    const isPayerParticipant = expense.participants.some(p => p.userId === paidByUserId);
    if (!isPayerParticipant && traceabilityMap[paidByUserId]) {
      traceabilityMap[paidByUserId].push({
        expenseId: expense.id,
        title: expense.description,
        date: expense.createdAt,
        paidBy: { id: expense.paidBy.id, name: expense.paidBy.name },
        originalAmount: originalAmt,
        originalCurrency: expense.originalCurrency,
        amountInInr: amountInr,
        userShareInInr: 0,
        userPaidInInr: amountInr,
        netImpactInInr: amountInr,
      });
    }
  });

  // Construct final balances list
  const balances: ParticipantBreakdown[] = [];
  userPaidMap.forEach((paid, userId) => {
    const owed = userOwedMap.get(userId) || 0;
    balances.push({
      userId,
      name: memberMap.get(userId) || 'Unknown User',
      paid: Number(paid.toFixed(2)),
      owed: Number(owed.toFixed(2)),
      net: Number((paid - owed).toFixed(2)),
    });
  });

  return {
    balances,
    traceability: traceabilityMap,
  };
};

/**
 * Helper to compute participant splits locally before saving to DB
 */
export const splitExpenseAmount = (
  amount: number,
  splitType: SplitType,
  participants: { userId: string; value?: number }[] // value represents exact amt, percentage, or weight
): { userId: string; amount: number; percentage?: number; weight?: number }[] => {
  if (!participants.length) return [];

  let result: { userId: string; amount: number; percentage?: number; weight?: number }[] = [];

  switch (splitType) {
    case SplitType.EQUAL: {
      const share = amount / participants.length;
      // Handle rounding error at the end
      let cumulative = 0;
      participants.forEach((p, idx) => {
        let currentShare = Number(share.toFixed(2));
        if (idx === participants.length - 1) {
          currentShare = Number((amount - cumulative).toFixed(2));
        }
        cumulative = Number((cumulative + currentShare).toFixed(2));
        result.push({ userId: p.userId, amount: currentShare });
      });
      break;
    }
    case SplitType.EXACT: {
      let sum = 0;
      participants.forEach((p) => {
        const exactAmt = p.value || 0;
        sum += exactAmt;
        result.push({ userId: p.userId, amount: exactAmt });
      });
      // Allow minor check inside caller, or throw if doesn't match total
      break;
    }
    case SplitType.PERCENTAGE: {
      let cumulative = 0;
      participants.forEach((p, idx) => {
        const pct = p.value || 0;
        let share = (amount * pct) / 100;
        let currentShare = Number(share.toFixed(2));
        if (idx === participants.length - 1) {
          // Verify sum equals total if percentage splits sum to 100%
          const pctSum = participants.reduce((s, x) => s + (x.value || 0), 0);
          if (Math.abs(pctSum - 100) < 0.01) {
            currentShare = Number((amount - cumulative).toFixed(2));
          }
        }
        cumulative = Number((cumulative + currentShare).toFixed(2));
        result.push({ userId: p.userId, amount: currentShare, percentage: pct });
      });
      break;
    }
    case SplitType.WEIGHTED: {
      const totalWeight = participants.reduce((sum, p) => sum + (p.value || 0), 0);
      if (totalWeight <= 0) {
        throw new Error('Total weight must be positive');
      }

      let cumulative = 0;
      participants.forEach((p, idx) => {
        const weight = p.value || 0;
        let share = amount * (weight / totalWeight);
        let currentShare = Number(share.toFixed(2));
        if (idx === participants.length - 1) {
          currentShare = Number((amount - cumulative).toFixed(2));
        }
        cumulative = Number((cumulative + currentShare).toFixed(2));
        result.push({ userId: p.userId, amount: currentShare, weight });
      });
      break;
    }
  }

  return result;
};
