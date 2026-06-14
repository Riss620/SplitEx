import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { calculateGroupBalances } from '../services/balanceEngine';

export const getDashboardSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    // Fetch user groups
    const memberships = await prisma.groupMembership.findMany({
      where: { userId, deletedAt: null, group: { deletedAt: null } },
      include: { group: true },
    });

    const groupIds = memberships.map((m) => m.groupId);

    // 1. Calculate user net balance across all active groups
    let netBalance = 0;
    const groupSummaries = [];

    for (const m of memberships) {
      // Calculate group balance
      const { balances } = await calculateGroupBalances(m.groupId);
      
      // Calculate settlements adjustments
      const settlements = await prisma.settlement.findMany({
        where: { groupId: m.groupId, deletedAt: null },
      });

      const userBalanceInfo = balances.find((b) => b.userId === userId);
      let groupNet = userBalanceInfo ? userBalanceInfo.net : 0;

      // Adjust group net by recorded settlements
      settlements.forEach((s) => {
        const amt = Number(s.amount);
        if (s.fromUserId === userId) {
          groupNet += amt; // paid out
        }
        if (s.toUserId === userId) {
          groupNet -= amt; // received
        }
      });

      netBalance += groupNet;
      groupSummaries.push({
        groupId: m.group.id,
        name: m.group.name,
        net: Number(groupNet.toFixed(2)),
      });
    }

    // 2. Fetch all expenses in user groups (for total expenditures KPI)
    const expenses = await prisma.expense.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const totalSpentInGroups = await prisma.expense.aggregate({
      where: { groupId: { in: groupIds }, deletedAt: null },
      _sum: { amount: true },
    });

    // 3. Recent settlements in user groups
    const recentSettlements = await prisma.settlement.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 4. Admin statistics (Import history, anomalies, audit logs)
    let adminStats = null;
    let recentActivities = [];

    if (role === 'Admin') {
      const totalImports = await prisma.importSession.count({ where: { deletedAt: null } });
      const totalAnomalies = await prisma.importAnomaly.count({ where: { deletedAt: null } });
      const warningAnomalies = await prisma.importAnomaly.count({
        where: { severity: 'WARNING', deletedAt: null },
      });
      const errorAnomalies = await prisma.importAnomaly.count({
        where: { severity: 'ERROR', deletedAt: null },
      });

      adminStats = {
        totalImports,
        totalAnomalies,
        warningAnomalies,
        errorAnomalies,
      };

      // Fetch global recent audit logs
      recentActivities = await prisma.auditLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    } else {
      // Members only see their own audit log activity
      recentActivities = await prisma.auditLog.findMany({
        where: { userId },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    }

    res.status(200).json({
      success: true,
      summary: {
        netBalance: Number(netBalance.toFixed(2)),
        totalExpensesInInr: Number((totalSpentInGroups._sum.amount || 0).toFixed(2)),
        groupSummaries,
        recentExpenses: expenses,
        recentSettlements,
        adminStats,
        recentActivities,
      },
    });
  } catch (err) {
    next(err);
  }
};
