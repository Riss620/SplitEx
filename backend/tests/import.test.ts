import { validateAndDetectAnomalies, CsvRow } from '../src/services/importService';
import { prisma } from '../src/config/db';
import { SplitType } from '../src/types/prismaEmulated';

jest.mock('../src/config/db', () => ({
  prisma: {
    groupMembership: {
      findMany: jest.fn(),
    },
    settlement: {
      findFirst: jest.fn(),
    },
    expense: {
      findFirst: jest.fn(),
    },
  },
}));

describe('Shared Expenses App - CSV Import & Anomaly Detection Logic', () => {
  const mockGroupId = 'group-1';
  const mockMemberships = [
    {
      userId: 'aisha-id',
      joinedAt: new Date('2026-06-01T00:00:00.000Z'),
      leftAt: null,
      user: {
        id: 'aisha-id',
        name: 'Aisha',
        email: 'aisha@example.com',
      },
    },
    {
      userId: 'rohan-id',
      joinedAt: new Date('2026-06-05T00:00:00.000Z'),
      leftAt: null,
      user: {
        id: 'rohan-id',
        name: 'Rohan',
        email: 'rohan@example.com',
      },
    },
    {
      userId: 'priya-id',
      joinedAt: new Date('2026-06-10T00:00:00.000Z'),
      leftAt: new Date('2026-06-20T00:00:00.000Z'),
      user: {
        id: 'priya-id',
        name: 'Priya',
        email: 'priya@example.com',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.groupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);
    (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.expense.findFirst as jest.Mock).mockResolvedValue(null);
  });

  test('should validate clean expense row successfully with zero anomalies', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Groceries supermarket purchase',
        Amount: '1200',
        Currency: 'INR',
        PaidBy: 'Aisha',
        SplitType: 'EQUAL',
        Participants: 'Aisha; Rohan',
        IsSettlement: 'FALSE',
      },
    ];

    const { anomalies, rowsToImport } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(0);
    expect(rowsToImport).toHaveLength(1);
    expect(rowsToImport[0]).toMatchObject({
      description: 'Groceries supermarket purchase',
      amount: 1200,
      currency: 'INR',
      payerId: 'aisha-id',
      splitType: SplitType.EQUAL,
      isSettlement: false,
    });
    expect(rowsToImport[0].participants).toHaveLength(2);
    expect(rowsToImport[0].participants[0].userId).toBe('aisha-id');
    expect(rowsToImport[0].participants[1].userId).toBe('rohan-id');
  });

  test('should catch Malformed CSV Row anomalies when required columns are missing', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Incomplete row',
        Amount: '',
        PaidBy: '',
      },
    ];

    const { anomalies, rowsToImport } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(rowsToImport).toHaveLength(0);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      rowNumber: 2,
      anomalyType: 'Malformed CSV Row',
      severity: 'ERROR',
    });
  });

  test('should catch Data Type Mismatch when amount is not a number', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Dinner',
        Amount: 'abc-xyz',
        PaidBy: 'Aisha',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Data Type Mismatch',
      severity: 'ERROR',
    });
  });

  test('should catch Negative Amount anomaly when amount is zero or negative', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Negative item',
        Amount: '-50',
        PaidBy: 'Aisha',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Negative Amount',
      severity: 'ERROR',
    });
  });

  test('should catch Invalid Date format anomaly', async () => {
    const rows: CsvRow[] = [
      {
        Date: 'not-a-valid-date',
        Description: 'Lunch',
        Amount: '450',
        PaidBy: 'Aisha',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Invalid Date',
      severity: 'ERROR',
    });
  });

  test('should catch Unsupported Currency anomaly', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Taxi fare in Euros',
        Amount: '25',
        Currency: 'EUR',
        PaidBy: 'Aisha',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Unsupported Currency',
      severity: 'ERROR',
    });
  });

  test('should catch Unknown User anomaly for both payer and participants', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Drink',
        Amount: '150',
        PaidBy: 'UnknownPayer',
        Participants: 'Aisha',
      },
      {
        Date: '2026-06-12',
        Description: 'Snack',
        Amount: '80',
        PaidBy: 'Aisha',
        Participants: 'UnknownRoommate',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Unknown User',
      severity: 'ERROR',
    });
    expect(anomalies[1]).toMatchObject({
      anomalyType: 'Unknown User',
      severity: 'ERROR',
    });
  });

  test('should catch Expense Before Member Joined temporal anomaly', async () => {
    // Rohan joined on June 5th, so he cannot pay on June 3rd
    const rows: CsvRow[] = [
      {
        Date: '2026-06-03',
        Description: 'Early electricity bill',
        Amount: '1800',
        PaidBy: 'Rohan',
        Participants: 'Aisha; Rohan',
      },
    ];

    const { anomalies, rowsToImport } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Expense Before Member Joined',
      severity: 'WARNING',
    });
    expect(anomalies[1]).toMatchObject({
      anomalyType: 'Expense Before Member Joined',
      severity: 'WARNING',
    });
    // WARNING doesn't prevent imports, so rowsToImport should still contain it
    expect(rowsToImport).toHaveLength(1);
  });

  test('should catch Expense After Member Left temporal anomaly', async () => {
    // Priya left on June 20th, so she cannot participate on June 22nd
    const rows: CsvRow[] = [
      {
        Date: '2026-06-22',
        Description: 'Late dynamic bills',
        Amount: '900',
        PaidBy: 'Aisha',
        Participants: 'Aisha; Priya',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Expense After Member Left',
      severity: 'WARNING',
    });
  });

  test('should catch Split Mismatch for non-matching Exact sums', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Exact split test',
        Amount: '500',
        PaidBy: 'Aisha',
        SplitType: 'EXACT',
        Participants: 'Aisha; Rohan',
        SplitValues: '200; 250', // Sum is 450, amount is 500
      },
    ];

    const { anomalies, rowsToImport } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Split Mismatch',
      severity: 'ERROR',
    });
    expect(rowsToImport).toHaveLength(0);
  });

  test('should catch Split Mismatch for non-matching Percentage sums', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Percent split test',
        Amount: '1000',
        PaidBy: 'Aisha',
        SplitType: 'PERCENTAGE',
        Participants: 'Aisha; Rohan',
        SplitValues: '40; 50', // Sum is 90% instead of 100%
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Split Mismatch',
      severity: 'ERROR',
    });
  });

  test('should detect Settlement Logged As Expense warning', async () => {
    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Settle up with Priya',
        Amount: '600',
        PaidBy: 'Aisha',
        SplitType: 'EQUAL',
        Participants: 'Priya',
        IsSettlement: 'FALSE',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Settlement Logged As Expense',
      severity: 'WARNING',
    });
  });

  test('should detect Duplicate Settlement warnings', async () => {
    (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({
      id: 'settlement-db-id',
    });

    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Settle Rohan',
        Amount: '800',
        PaidBy: 'Rohan',
        SplitType: 'EQUAL',
        Participants: 'Aisha',
        IsSettlement: 'TRUE',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Duplicate Settlement',
      severity: 'WARNING',
    });
  });

  test('should detect Duplicate Expense warnings', async () => {
    (prisma.expense.findFirst as jest.Mock).mockResolvedValue({
      id: 'expense-db-id',
    });

    const rows: CsvRow[] = [
      {
        Date: '2026-06-12',
        Description: 'Coffee beans purchase',
        Amount: '350',
        PaidBy: 'Aisha',
        SplitType: 'EQUAL',
        Participants: 'Aisha; Rohan',
        IsSettlement: 'FALSE',
      },
    ];

    const { anomalies } = await validateAndDetectAnomalies(rows, mockGroupId);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      anomalyType: 'Duplicate Expense',
      severity: 'WARNING',
    });
  });
});
