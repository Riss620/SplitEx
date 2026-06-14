import csv from 'csv-parser';
import { Readable } from 'stream';
import { prisma } from '../config/db';
import { SplitType, AnomalyAction, ImportStatus } from '../types/prismaEmulated';
import { splitExpenseAmount } from './balanceEngine';
import { logger } from '../config/logger';

export interface CsvRow {
  Date?: string;
  Description?: string;
  Amount?: string;
  Currency?: string;
  PaidBy?: string;
  SplitType?: string;
  Participants?: string;
  SplitValues?: string;
  IsSettlement?: string;
}

export interface AnomalyInfo {
  rowNumber: number;
  anomalyType: string;
  description: string;
  severity: 'WARNING' | 'ERROR';
  suggestedAction: string;
}

const parseCsvString = (csvText: string): Promise<CsvRow[]> => {
  return new Promise((resolve, reject) => {
    const results: CsvRow[] = [];
    const stream = Readable.from(csvText);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

/**
 * Runs validation and anomaly detection on parsed CSV rows.
 */
export const validateAndDetectAnomalies = async (
  rows: CsvRow[],
  groupId: string
): Promise<{ anomalies: AnomalyInfo[]; rowsToImport: any[] }> => {
  const anomalies: AnomalyInfo[] = [];
  const rowsToImport: any[] = [];

  // Fetch group memberships & details to validate timelines and users
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId, deletedAt: null },
    include: { user: true },
  });

  const memberEmails = new Set(memberships.map((m) => m.user.email.toLowerCase()));
  const memberNames = new Set(memberships.map((m) => m.user.name.toLowerCase()));
  
  // Maps to look up user ID from email or name
  const userMap = new Map<string, { id: string; name: string; email: string }>();
  memberships.forEach((m) => {
    userMap.set(m.user.email.toLowerCase(), m.user);
    userMap.set(m.user.name.toLowerCase(), m.user);
  });

  const findUser = (identifier: string) => {
    const clean = identifier.trim().toLowerCase();
    return userMap.get(clean);
  };

  // Process rows
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2; // CSV headers are line 1, so data starts at line 2

    // Check for Malformed CSV Row (Rule 1)
    if (!row.Date || !row.Description || !row.Amount || !row.PaidBy) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Malformed CSV Row',
        description: 'Row is missing required columns (Date, Description, Amount, PaidBy).',
        severity: 'ERROR',
        suggestedAction: 'Fix row columns and formatting.',
      });
      continue;
    }

    const description = row.Description.trim();
    const amountStr = row.Amount.trim();
    const paidByStr = row.PaidBy.trim();
    const dateStr = row.Date.trim();
    const currencyStr = (row.Currency || 'INR').trim().toUpperCase();
    const splitTypeStr = (row.SplitType || 'EQUAL').trim().toUpperCase();
    const participantsStr = row.Participants || '';
    const splitValuesStr = row.SplitValues || '';
    const isSettlementStr = (row.IsSettlement || 'FALSE').trim().toUpperCase();

    // Check Data Type Mismatch / Invalid Numbers (Rule 2)
    const amount = Number(amountStr);
    if (isNaN(amount)) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Data Type Mismatch',
        description: `Amount '${amountStr}' is not a numeric value.`,
        severity: 'ERROR',
        suggestedAction: 'Replace with a valid number.',
      });
      continue;
    }

    // Missing Amount (Rule 3)
    if (!amountStr) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Missing Amount',
        description: 'Row is missing an amount.',
        severity: 'ERROR',
        suggestedAction: 'Specify a valid amount.',
      });
      continue;
    }

    // Negative / Zero Amount (Rule 4)
    if (amount <= 0) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Negative Amount',
        description: `Amount ${amount} must be greater than zero.`,
        severity: 'ERROR',
        suggestedAction: 'Change amount to a positive number.',
      });
      continue;
    }

    // Invalid Date Format (Rule 5)
    const transactionDate = new Date(dateStr);
    if (isNaN(transactionDate.getTime())) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Invalid Date',
        description: `Date '${dateStr}' is invalid. Use YYYY-MM-DD.`,
        severity: 'ERROR',
        suggestedAction: 'Correct the date formatting.',
      });
      continue;
    }

    // Unsupported Currency (Rule 6)
    if (currencyStr !== 'INR' && currencyStr !== 'USD') {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Unsupported Currency',
        description: `Currency '${currencyStr}' is unsupported. Only INR and USD are allowed.`,
        severity: 'ERROR',
        suggestedAction: 'Convert amounts or set currency to INR/USD.',
      });
      continue;
    }

    // Unknown User - Payer (Rule 7)
    const payer = findUser(paidByStr);
    if (!payer) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Unknown User',
        description: `Payer '${paidByStr}' is not recognized in group memberships.`,
        severity: 'ERROR',
        suggestedAction: 'Ensure user is registered and added to the group first.',
      });
      continue;
    }

    // Resolve active date boundary of the Payer
    const payerMembership = memberships.find((m) => m.userId === payer.id);
    if (payerMembership) {
      if (transactionDate < payerMembership.joinedAt) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Expense Before Member Joined',
          description: `Payer '${payer.name}' paid before joining date (${payerMembership.joinedAt.toISOString().slice(0, 10)}).`,
          severity: 'WARNING',
          suggestedAction: 'Adjust transaction date or membership timeline.',
        });
      }
      if (payerMembership.leftAt && transactionDate > payerMembership.leftAt) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Expense After Member Left',
          description: `Payer '${payer.name}' paid after leaving date (${payerMembership.leftAt.toISOString().slice(0, 10)}).`,
          severity: 'WARNING',
          suggestedAction: 'Adjust transaction date or membership timeline.',
        });
      }
    }

    // Parse participants list
    const participantNames = participantsStr.split(';').map((p) => p.trim()).filter(Boolean);
    const participantUsers: typeof payer[] = [];
    let unknownParticipantFound = false;

    for (const name of participantNames) {
      const u = findUser(name);
      if (!u) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Unknown User',
          description: `Participant '${name}' is not recognized in group memberships.`,
          severity: 'ERROR',
          suggestedAction: 'Invite participant to the group before importing.',
        });
        unknownParticipantFound = true;
        break;
      }
      participantUsers.push(u);
    }

    if (unknownParticipantFound) continue;

    // Validate splits and timeline boundaries for all participants
    let dateTimelineAnomalies = false;
    participantUsers.forEach((user) => {
      const membership = memberships.find((m) => m.userId === user.id);
      if (membership) {
        if (transactionDate < membership.joinedAt) {
          anomalies.push({
            rowNumber: rowNum,
            anomalyType: 'Expense Before Member Joined',
            description: `Participant '${user.name}' split is dated before they joined (${membership.joinedAt.toISOString().slice(0, 10)}).`,
            severity: 'WARNING',
            suggestedAction: 'Exclude participant from this split or shift transaction date.',
          });
          dateTimelineAnomalies = true;
        }
        if (membership.leftAt && transactionDate > membership.leftAt) {
          anomalies.push({
            rowNumber: rowNum,
            anomalyType: 'Expense After Member Left',
            description: `Participant '${user.name}' split is dated after they left (${membership.leftAt.toISOString().slice(0, 10)}).`,
            severity: 'WARNING',
            suggestedAction: 'Exclude participant from this split or shift transaction date.',
          });
          dateTimelineAnomalies = true;
        }
      }
    });

    // Validate split values
    let prismaSplitType: SplitType = SplitType.EQUAL;
    if (splitTypeStr === 'EXACT') prismaSplitType = SplitType.EXACT;
    else if (splitTypeStr === 'PERCENTAGE') prismaSplitType = SplitType.PERCENTAGE;
    else if (splitTypeStr === 'WEIGHTED') prismaSplitType = SplitType.WEIGHTED;

    const splitValues = splitValuesStr.split(';').map((v) => Number(v.trim())).filter((v) => !isNaN(v));

    if (prismaSplitType !== SplitType.EQUAL && splitValues.length !== participantUsers.length) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'Split Mismatch',
        description: `Split type '${splitTypeStr}' requires matching number of values, but got ${splitValues.length} values for ${participantUsers.length} participants.`,
        severity: 'ERROR',
        suggestedAction: 'Specify split value for every participant.',
      });
      continue;
    }

    // Split Mismatch verification (e.g. sums matching totals)
    if (prismaSplitType === SplitType.EXACT) {
      const sumExact = splitValues.reduce((s, v) => s + v, 0);
      if (Math.abs(sumExact - amount) > 0.05) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Split Mismatch',
          description: `Exact split sum of ${sumExact} does not match total amount ${amount}.`,
          severity: 'ERROR',
          suggestedAction: 'Correct the individual split values.',
        });
        continue;
      }
    } else if (prismaSplitType === SplitType.PERCENTAGE) {
      const sumPercent = splitValues.reduce((s, v) => s + v, 0);
      if (Math.abs(sumPercent - 100) > 0.05) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Split Mismatch',
          description: `Percentage split sum of ${sumPercent}% does not match 100%.`,
          severity: 'ERROR',
          suggestedAction: 'Adjust percentages to sum to exactly 100%.',
        });
        continue;
      }
    }

    // Check for duplicate settlements
    const isSettlement = isSettlementStr === 'TRUE';
    if (isSettlement) {
      // Must have exactly one participant
      if (participantUsers.length !== 1) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Malformed CSV Row',
          description: 'A Settlement row must specify exactly one participant (receiver).',
          severity: 'ERROR',
          suggestedAction: 'Correct the participants list.',
        });
        continue;
      }

      const receiver = participantUsers[0];

      // Check DB for duplicate settlement (within 24h)
      const dayStart = new Date(transactionDate.getTime() - 12 * 60 * 60 * 1000);
      const dayEnd = new Date(transactionDate.getTime() + 12 * 60 * 60 * 1000);

      const dbDupSettlement = await prisma.settlement.findFirst({
        where: {
          groupId,
          fromUserId: payer.id,
          toUserId: receiver.id,
          amount,
          createdAt: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
      });

      if (dbDupSettlement) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Duplicate Settlement',
          description: `A duplicate settlement of ${amountStr} ${currencyStr} from ${payer.name} to ${receiver.name} already exists.`,
          severity: 'WARNING',
          suggestedAction: 'Merge or discard this duplicate.',
        });
      }
    } else {
      // Standard Expense Check: Settlement Logged As Expense (Rule 8)
      // If description contains "settle" or "payment" or isSettlement is FALSE but there is only 1 participant and name equals split
      const lowerDesc = description.toLowerCase();
      if (
        (lowerDesc.includes('settle') || lowerDesc.includes('pay back') || lowerDesc.includes('refund')) &&
        participantUsers.length === 1
      ) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Settlement Logged As Expense',
          description: `Description '${description}' looks like a settlement transaction.`,
          severity: 'WARNING',
          suggestedAction: 'Re-import as settlement instead of shared expense.',
        });
      }

      // Check DB for duplicate expense (Rule 9)
      const dayStart = new Date(transactionDate.getTime() - 12 * 60 * 60 * 1000);
      const dayEnd = new Date(transactionDate.getTime() + 12 * 60 * 60 * 1000);

      const dbDupExpense = await prisma.expense.findFirst({
        where: {
          groupId,
          description,
          amount,
          paidById: payer.id,
          createdAt: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
      });

      if (dbDupExpense) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'Duplicate Expense',
          description: `An expense with description '${description}' and amount ${amount} by ${payer.name} already exists in the database.`,
          severity: 'WARNING',
          suggestedAction: 'Merge or ignore this row.',
        });
      }
    }

    // If no critical errors, cache it for possible imports
    const errors = anomalies.filter((a) => a.rowNumber === rowNum && a.severity === 'ERROR');
    if (errors.length === 0) {
      rowsToImport.push({
        rowNum,
        date: transactionDate,
        description,
        amount,
        currency: currencyStr,
        payerId: payer.id,
        splitType: prismaSplitType,
        isSettlement,
        participants: participantUsers.map((u, pIdx) => ({
          userId: u.id,
          value: prismaSplitType === SplitType.EQUAL ? undefined : splitValues[pIdx],
        })),
      });
    }
  }

  return { anomalies, rowsToImport };
};

/**
 * Executes a full CSV file import session and returns report statistics.
 */
export const importCsvContent = async (
  csvContent: string,
  groupId: string,
  createdById: string,
  fileName: string
) => {
  const parsedRows = await parseCsvString(csvContent);
  const { anomalies, rowsToImport } = await validateAndDetectAnomalies(parsedRows, groupId);

  const errorsCount = anomalies.filter((a) => a.severity === 'ERROR').length;
  const warningsCount = anomalies.filter((a) => a.severity === 'WARNING').length;

  // Create an Import Session in DB
  const importSession = await prisma.importSession.create({
    data: {
      fileName,
      status: errorsCount > 0 || warningsCount > 0 ? ImportStatus.PENDING_APPROVAL : ImportStatus.COMPLETED,
      rowsProcessed: parsedRows.length,
      rowsImported: 0, // Will be filled once approved or completed
      warningsCount,
      errorsCount,
      createdById,
    },
  });

  // Store anomalies
  if (anomalies.length > 0) {
    await prisma.importAnomaly.createMany({
      data: anomalies.map((a) => ({
        importSessionId: importSession.id,
        anomalyType: a.anomalyType,
        rowNumber: a.rowNumber,
        description: a.description,
        severity: a.severity,
        suggestedAction: a.suggestedAction,
        finalAction: AnomalyAction.PENDING,
      })),
    });
  }

  // If there are zero errors AND zero warnings, we can auto-import all clean data immediately
  if (errorsCount === 0 && warningsCount === 0 && rowsToImport.length > 0) {
    await executeDataImport(rowsToImport, groupId, importSession.id, createdById);
    
    // Update session status to COMPLETED
    await prisma.importSession.update({
      where: { id: importSession.id },
      data: { status: ImportStatus.COMPLETED, rowsImported: rowsToImport.length },
    });
  }

  return {
    sessionId: importSession.id,
    rowsProcessed: parsedRows.length,
    anomaliesCount: anomalies.length,
    errorsCount,
    warningsCount,
  };
};

/**
 * Performs actual database operations to insert clean expenses/settlements.
 */
export const executeDataImport = async (
  cleanRows: any[],
  groupId: string,
  sessionId: string,
  actorId: string
) => {
  for (const row of cleanRows) {
    // Check if the group has a default exchange rate seeded
    let rate = 1.0;
    if (row.currency === 'USD') {
      const dbRate = await prisma.exchangeRate.findFirst({
        where: { fromCurrency: 'USD', toCurrency: 'INR', deletedAt: null },
        orderBy: { effectiveDate: 'desc' },
      });
      rate = dbRate ? Number(dbRate.rate) : 83.50; // default backup
    }

    const convertedAmount = row.currency === 'USD' ? row.amount * rate : row.amount;

    if (row.isSettlement) {
      const receiver = row.participants[0];
      await prisma.settlement.create({
        data: {
          groupId,
          fromUserId: row.payerId,
          toUserId: receiver.userId,
          amount: convertedAmount,
          currency: 'INR', // base system currency
          status: 'PENDING',
          createdAt: row.date,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'SETTLEMENT_RECORDED',
          entityType: 'Settlement',
          details: JSON.stringify({ amount: convertedAmount, session: sessionId }),
        },
      });
    } else {
      // Calculate individual shares in INR
      const shares = splitExpenseAmount(convertedAmount, row.splitType, row.participants);

      const expense = await prisma.expense.create({
        data: {
          groupId,
          description: row.description,
          amount: convertedAmount,
          currency: 'INR',
          originalAmount: row.amount,
          originalCurrency: row.currency,
          exchangeRate: rate,
          paidById: row.payerId,
          splitType: row.splitType,
          createdAt: row.date,
        },
      });

      await prisma.expenseParticipant.createMany({
        data: shares.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage,
          weight: s.weight,
        })),
      });

      await prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'EXPENSE_CREATED',
          entityType: 'Expense',
          entityId: expense.id,
          details: JSON.stringify({ description: row.description, amount: convertedAmount, session: sessionId }),
        },
      });
    }
  }
};
