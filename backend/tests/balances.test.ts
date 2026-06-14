import { calculateGroupBalances } from '../src/services/balanceEngine';
import { prisma } from '../src/config/db';

jest.mock('../src/config/db', () => ({
  prisma: {
    groupMembership: {
      findMany: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
    },
  },
}));

describe('Shared Expenses App - Group Balance Calculator & Audit Trace', () => {
  const mockGroupId = 'group-1';
  
  const mockMemberships = [
    {
      userId: 'aisha-id',
      joinedAt: new Date('2026-06-01T00:00:00.000Z'),
      leftAt: null,
      user: { id: 'aisha-id', name: 'Aisha' },
    },
    {
      userId: 'rohan-id',
      joinedAt: new Date('2026-06-01T00:00:00.000Z'),
      leftAt: null,
      user: { id: 'rohan-id', name: 'Rohan' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.groupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);
  });

  test('should calculate balances and populate correct traces under basic splits', async () => {
    const mockExpenses = [
      {
        id: 'expense-1',
        description: 'Aisha bought Groceries',
        amount: 100.00,
        originalAmount: 100.00,
        originalCurrency: 'INR',
        paidById: 'aisha-id',
        paidBy: { id: 'aisha-id', name: 'Aisha' },
        createdAt: new Date('2026-06-02T12:00:00.000Z'),
        participants: [
          { userId: 'aisha-id', amount: 50.00, user: { id: 'aisha-id', name: 'Aisha' } },
          { userId: 'rohan-id', amount: 50.00, user: { id: 'rohan-id', name: 'Rohan' } },
        ],
      },
      {
        id: 'expense-2',
        description: 'Rohan paid Electricity',
        amount: 200.00,
        originalAmount: 200.00,
        originalCurrency: 'INR',
        paidById: 'rohan-id',
        paidBy: { id: 'rohan-id', name: 'Rohan' },
        createdAt: new Date('2026-06-03T10:00:00.000Z'),
        participants: [
          { userId: 'aisha-id', amount: 100.00, user: { id: 'aisha-id', name: 'Aisha' } },
          { userId: 'rohan-id', amount: 100.00, user: { id: 'rohan-id', name: 'Rohan' } },
        ],
      },
    ];

    (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

    const summary = await calculateGroupBalances(mockGroupId);

    // Assert balances calculations
    expect(summary.balances).toHaveLength(2);
    
    const aishaBal = summary.balances.find((b) => b.userId === 'aisha-id');
    const rohanBal = summary.balances.find((b) => b.userId === 'rohan-id');

    expect(aishaBal).toBeDefined();
    expect(rohanBal).toBeDefined();

    // Aisha paid 100. Aisha owed 50 + 100 = 150. Net = -50.
    expect(aishaBal?.paid).toBe(100);
    expect(aishaBal?.owed).toBe(150);
    expect(aishaBal?.net).toBe(-50);

    // Rohan paid 200. Rohan owed 50 + 100 = 150. Net = +50.
    expect(rohanBal?.paid).toBe(200);
    expect(rohanBal?.owed).toBe(150);
    expect(rohanBal?.net).toBe(50);

    // Assert traceability map structure
    expect(summary.traceability['aisha-id']).toHaveLength(2);
    expect(summary.traceability['rohan-id']).toHaveLength(2);

    const aishaTrace1 = summary.traceability['aisha-id'][0];
    expect(aishaTrace1).toMatchObject({
      expenseId: 'expense-1',
      title: 'Aisha bought Groceries',
      originalAmount: 100,
      userShareInInr: 50,
      userPaidInInr: 100,
      netImpactInInr: 50, // 100 paid - 50 share
    });

    const aishaTrace2 = summary.traceability['aisha-id'][1];
    expect(aishaTrace2).toMatchObject({
      expenseId: 'expense-2',
      title: 'Rohan paid Electricity',
      originalAmount: 200,
      userShareInInr: 100,
      userPaidInInr: 0,
      netImpactInInr: -100, // 0 paid - 100 share
    });
  });

  test('should support cases where the payer is not a participant in the expense', async () => {
    // Aisha pays ₹100 but only Rohan consumes it (e.g. Aisha buys a gift/item solely for Rohan)
    const mockExpenses = [
      {
        id: 'expense-3',
        description: 'Gift for Rohan',
        amount: 100.00,
        originalAmount: 100.00,
        originalCurrency: 'INR',
        paidById: 'aisha-id',
        paidBy: { id: 'aisha-id', name: 'Aisha' },
        createdAt: new Date('2026-06-04T12:00:00.000Z'),
        participants: [
          { userId: 'rohan-id', amount: 100.00, user: { id: 'rohan-id', name: 'Rohan' } },
        ],
      },
    ];

    (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

    const summary = await calculateGroupBalances(mockGroupId);

    const aishaBal = summary.balances.find((b) => b.userId === 'aisha-id');
    const rohanBal = summary.balances.find((b) => b.userId === 'rohan-id');

    // Aisha paid 100, owed 0. Net = +100
    expect(aishaBal?.paid).toBe(100);
    expect(aishaBal?.owed).toBe(0);
    expect(aishaBal?.net).toBe(100);

    // Rohan paid 0, owed 100. Net = -100
    expect(rohanBal?.paid).toBe(0);
    expect(rohanBal?.owed).toBe(100);
    expect(rohanBal?.net).toBe(-100);

    // Trace checks
    expect(summary.traceability['aisha-id'][0]).toMatchObject({
      expenseId: 'expense-3',
      userShareInInr: 0,
      userPaidInInr: 100,
      netImpactInInr: 100,
    });
    expect(summary.traceability['rohan-id'][0]).toMatchObject({
      expenseId: 'expense-3',
      userShareInInr: 100,
      userPaidInInr: 0,
      netImpactInInr: -100,
    });
  });
});
