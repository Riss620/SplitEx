/**
 * SplitEx — Database Seed Script
 * ================================
 * Populates the MySQL database with realistic test data matching
 * the business scenario from the assignment spec:
 *
 * Flatmates: Aisha (Admin), Rohan, Priya, Meera, Dev, Sam
 * - Meera moved out end of March 2024
 * - Sam joined mid-April 2024
 * - Dev only participated in trip expenses
 *
 * Run: npx ts-node prisma/seed.ts
 *      OR: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Starting SplitEx seed...\n');

  // ─── 1. Clean existing data ──────────────────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.importAnomaly.deleteMany();
  await prisma.importSession.deleteMany();
  await prisma.expenseParticipant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.exchangeRate.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓  Cleared existing records');

  // ─── 2. Create Users ─────────────────────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const defaultHash = await bcrypt.hash('password123', salt);

  const aisha = await prisma.user.create({
    data: {
      name: 'Aisha',
      email: 'aisha@splitex.com',
      passwordHash: defaultHash,
      role: 'Admin',
    },
  });

  const rohan = await prisma.user.create({
    data: {
      name: 'Rohan',
      email: 'rohan@splitex.com',
      passwordHash: defaultHash,
      role: 'Member',
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: 'Priya',
      email: 'priya@splitex.com',
      passwordHash: defaultHash,
      role: 'Member',
    },
  });

  const meera = await prisma.user.create({
    data: {
      name: 'Meera',
      email: 'meera@splitex.com',
      passwordHash: defaultHash,
      role: 'Member',
    },
  });

  const dev = await prisma.user.create({
    data: {
      name: 'Dev',
      email: 'dev@splitex.com',
      passwordHash: defaultHash,
      role: 'Member',
    },
  });

  const sam = await prisma.user.create({
    data: {
      name: 'Sam',
      email: 'sam@splitex.com',
      passwordHash: defaultHash,
      role: 'Member',
    },
  });

  console.log(`✓  Created 6 users (Aisha/Admin, Rohan, Priya, Meera, Dev, Sam)`);
  console.log(`   All passwords: password123`);

  // ─── 3. Create Groups ────────────────────────────────────────────────────
  const flatmatesGroup = await prisma.group.create({
    data: {
      name: 'Flatmates 2024',
      description: 'Shared flat expenses for 2024. Main household group.',
      createdById: aisha.id,
    },
  });

  const tripGroup = await prisma.group.create({
    data: {
      name: 'Goa Trip April 2024',
      description: 'Weekend trip to Goa. Dev joined specifically for this.',
      createdById: aisha.id,
    },
  });

  console.log(`✓  Created 2 groups: "${flatmatesGroup.name}", "${tripGroup.name}"`);

  // ─── 4. Group Memberships (Temporal — the key constraint) ────────────────
  // Flatmates group — joined Jan 1 2024
  await prisma.groupMembership.create({
    data: {
      groupId: flatmatesGroup.id,
      userId: aisha.id,
      joinedAt: new Date('2024-01-01'),
    },
  });

  await prisma.groupMembership.create({
    data: {
      groupId: flatmatesGroup.id,
      userId: rohan.id,
      joinedAt: new Date('2024-01-01'),
    },
  });

  await prisma.groupMembership.create({
    data: {
      groupId: flatmatesGroup.id,
      userId: priya.id,
      joinedAt: new Date('2024-01-01'),
    },
  });

  // Meera moved out at end of March — leftAt is set
  await prisma.groupMembership.create({
    data: {
      groupId: flatmatesGroup.id,
      userId: meera.id,
      joinedAt: new Date('2024-01-01'),
      leftAt: new Date('2024-03-31'),
    },
  });

  // Sam joined in mid-April — joinedAt is set later
  await prisma.groupMembership.create({
    data: {
      groupId: flatmatesGroup.id,
      userId: sam.id,
      joinedAt: new Date('2024-04-15'),
    },
  });

  // Trip group — Dev participates only here
  await prisma.groupMembership.create({
    data: {
      groupId: tripGroup.id,
      userId: aisha.id,
      joinedAt: new Date('2024-04-01'),
    },
  });

  await prisma.groupMembership.create({
    data: {
      groupId: tripGroup.id,
      userId: rohan.id,
      joinedAt: new Date('2024-04-01'),
    },
  });

  await prisma.groupMembership.create({
    data: {
      groupId: tripGroup.id,
      userId: priya.id,
      joinedAt: new Date('2024-04-01'),
    },
  });

  await prisma.groupMembership.create({
    data: {
      groupId: tripGroup.id,
      userId: dev.id,
      joinedAt: new Date('2024-04-01'),
    },
  });

  console.log(`✓  Created memberships:`);
  console.log(`   Flatmates: Aisha (Jan), Rohan (Jan), Priya (Jan), Meera (Jan→Mar31), Sam (Apr15)`);
  console.log(`   Goa Trip:  Aisha, Rohan, Priya, Dev`);

  // ─── 5. Exchange Rates ───────────────────────────────────────────────────
  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      fromCurrency: 'USD',
      toCurrency: 'INR',
      rate: 83.50,
      effectiveDate: new Date('2024-01-01'),
      source: 'manual_seed',
      createdById: aisha.id,
    },
  });

  await prisma.exchangeRate.create({
    data: {
      fromCurrency: 'USD',
      toCurrency: 'INR',
      rate: 83.92,
      effectiveDate: new Date('2024-04-01'),
      source: 'manual_seed',
      createdById: aisha.id,
    },
  });

  console.log(`✓  Created exchange rates: USD→INR = 83.50 (Jan), 83.92 (Apr)`);

  // ─── 6. Expenses — Flatmates Group ───────────────────────────────────────

  // January expenses (Meera is active)
  const exp1 = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'January Rent',
      amount: 40000,
      currency: 'INR',
      originalAmount: 40000,
      originalCurrency: 'INR',
      exchangeRate: 1.0,
      paidById: aisha.id,
      splitType: 'EQUAL',
      category: 'Rent',
      createdAt: new Date('2024-01-05'),
    },
  });

  // Split equally among all 4 active in Jan (Aisha, Rohan, Priya, Meera)
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp1.id, userId: aisha.id, amount: 10000 },
      { expenseId: exp1.id, userId: rohan.id, amount: 10000 },
      { expenseId: exp1.id, userId: priya.id, amount: 10000 },
      { expenseId: exp1.id, userId: meera.id, amount: 10000 },
    ],
  });

  // USD expense — grocery in USD
  const usdRate = 83.50;
  const exp2 = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'Amazon Grocery Order (USD)',
      amount: Number((120 * usdRate).toFixed(2)), // 10020 INR
      currency: 'INR',
      originalAmount: 120,
      originalCurrency: 'USD',
      exchangeRate: usdRate,
      paidById: rohan.id,
      splitType: 'EQUAL',
      category: 'Groceries',
      createdAt: new Date('2024-02-12'),
    },
  });

  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp2.id, userId: aisha.id, amount: Number((10020 / 4).toFixed(2)) },
      { expenseId: exp2.id, userId: rohan.id, amount: Number((10020 / 4).toFixed(2)) },
      { expenseId: exp2.id, userId: priya.id, amount: Number((10020 / 4).toFixed(2)) },
      { expenseId: exp2.id, userId: meera.id, amount: Number((10020 / 4).toFixed(2)) },
    ],
  });

  // March expense — Meera's last month
  const exp3 = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'Electricity Bill March',
      amount: 3600,
      currency: 'INR',
      originalAmount: 3600,
      originalCurrency: 'INR',
      exchangeRate: 1.0,
      paidById: priya.id,
      splitType: 'EQUAL',
      category: 'Utilities',
      createdAt: new Date('2024-03-10'),
    },
  });

  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp3.id, userId: aisha.id, amount: 900 },
      { expenseId: exp3.id, userId: rohan.id, amount: 900 },
      { expenseId: exp3.id, userId: priya.id, amount: 900 },
      { expenseId: exp3.id, userId: meera.id, amount: 900 },
    ],
  });

  // May expense — Meera gone, Sam joined (April 15 so valid)
  const exp4 = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'May Rent',
      amount: 45000,
      currency: 'INR',
      originalAmount: 45000,
      originalCurrency: 'INR',
      exchangeRate: 1.0,
      paidById: aisha.id,
      splitType: 'EQUAL',
      category: 'Rent',
      createdAt: new Date('2024-05-01'),
    },
  });

  // Sam is active (joined Apr 15). Meera is excluded. 4 active: Aisha, Rohan, Priya, Sam
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp4.id, userId: aisha.id, amount: 11250 },
      { expenseId: exp4.id, userId: rohan.id, amount: 11250 },
      { expenseId: exp4.id, userId: priya.id, amount: 11250 },
      { expenseId: exp4.id, userId: sam.id, amount: 11250 },
    ],
  });

  // Percentage split expense
  const exp5 = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'Internet Bill May (room-based percentage)',
      amount: 2000,
      currency: 'INR',
      originalAmount: 2000,
      originalCurrency: 'INR',
      exchangeRate: 1.0,
      paidById: rohan.id,
      splitType: 'PERCENTAGE',
      category: 'Utilities',
      notes: 'Aisha has master room (40%), others 20% each',
      createdAt: new Date('2024-05-05'),
    },
  });

  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp5.id, userId: aisha.id, amount: 800, percentage: 40 },
      { expenseId: exp5.id, userId: rohan.id, amount: 400, percentage: 20 },
      { expenseId: exp5.id, userId: priya.id, amount: 400, percentage: 20 },
      { expenseId: exp5.id, userId: sam.id, amount: 400, percentage: 20 },
    ],
  });

  console.log(`✓  Created 5 flatmate expenses (INR, USD, EQUAL, PERCENTAGE)`);

  // ─── 7. Expenses — Trip Group ─────────────────────────────────────────────
  const exp6 = await prisma.expense.create({
    data: {
      groupId: tripGroup.id,
      description: 'Hotel Booking Goa',
      amount: 12000,
      currency: 'INR',
      originalAmount: 12000,
      originalCurrency: 'INR',
      exchangeRate: 1.0,
      paidById: dev.id,
      splitType: 'EQUAL',
      category: 'Accommodation',
      createdAt: new Date('2024-04-20'),
    },
  });

  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp6.id, userId: aisha.id, amount: 3000 },
      { expenseId: exp6.id, userId: rohan.id, amount: 3000 },
      { expenseId: exp6.id, userId: priya.id, amount: 3000 },
      { expenseId: exp6.id, userId: dev.id, amount: 3000 },
    ],
  });

  // USD expense for trip
  const tripRate = 83.92;
  const exp7 = await prisma.expense.create({
    data: {
      groupId: tripGroup.id,
      description: 'Flight Tickets (USD)',
      amount: Number((200 * tripRate).toFixed(2)),
      currency: 'INR',
      originalAmount: 200,
      originalCurrency: 'USD',
      exchangeRate: tripRate,
      paidById: aisha.id,
      splitType: 'EQUAL',
      category: 'Transport',
      createdAt: new Date('2024-04-18'),
    },
  });

  const tripShare = Number(((200 * tripRate) / 4).toFixed(2));
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp7.id, userId: aisha.id, amount: tripShare },
      { expenseId: exp7.id, userId: rohan.id, amount: tripShare },
      { expenseId: exp7.id, userId: priya.id, amount: tripShare },
      { expenseId: exp7.id, userId: dev.id, amount: tripShare },
    ],
  });

  console.log(`✓  Created 2 trip expenses (hotel INR, flights USD)`);

  // ─── 8. Sample Settlement ────────────────────────────────────────────────
  await prisma.settlement.create({
    data: {
      groupId: flatmatesGroup.id,
      fromUserId: rohan.id,
      toUserId: aisha.id,
      amount: 5000,
      currency: 'INR',
      status: 'PAID',
      notes: 'Partial payment towards January rent',
      createdAt: new Date('2024-02-01'),
    },
  });

  console.log(`✓  Created 1 sample settlement (Rohan paid Aisha ₹5000)`);

  // ─── 9. Audit Logs ───────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        userId: aisha.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: aisha.id,
        details: JSON.stringify({ email: 'aisha@splitex.com', role: 'Admin' }),
      },
      {
        userId: aisha.id,
        action: 'GROUP_CREATED',
        entityType: 'Group',
        entityId: flatmatesGroup.id,
        details: JSON.stringify({ name: 'Flatmates 2024' }),
      },
      {
        userId: aisha.id,
        action: 'MEMBER_ADDED',
        entityType: 'GroupMembership',
        entityId: flatmatesGroup.id,
        details: JSON.stringify({ addedUser: 'Meera', joinedAt: '2024-01-01' }),
      },
      {
        userId: aisha.id,
        action: 'MEMBER_REMOVED',
        entityType: 'GroupMembership',
        entityId: flatmatesGroup.id,
        details: JSON.stringify({ removedUser: 'Meera', leftAt: '2024-03-31', reason: 'Moved out' }),
      },
      {
        userId: aisha.id,
        action: 'EXPENSE_CREATED',
        entityType: 'Expense',
        entityId: exp1.id,
        details: JSON.stringify({ description: 'January Rent', amount: 40000 }),
      },
      {
        userId: aisha.id,
        action: 'EXCHANGE_RATE_UPDATED',
        entityType: 'ExchangeRate',
        entityId: exchangeRate.id,
        details: JSON.stringify({ from: 'USD', to: 'INR', rate: 83.50 }),
      },
    ],
  });

  console.log(`✓  Created 6 audit log entries`);

  // ─── 10. Summary ─────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          SplitEx Seed Complete ✓                        ║
╠══════════════════════════════════════════════════════════╣
║  Users (password: password123):                         ║
║    aisha@splitex.com    — Admin                         ║
║    rohan@splitex.com    — Member                        ║
║    priya@splitex.com    — Member                        ║
║    meera@splitex.com    — Member (left Mar 31)          ║
║    dev@splitex.com      — Member (trip group only)      ║
║    sam@splitex.com      — Member (joined Apr 15)        ║
╠══════════════════════════════════════════════════════════╣
║  Groups: Flatmates 2024, Goa Trip April 2024            ║
║  Expenses: 7 (5 flatmates + 2 trip)                     ║
║  Exchange Rates: USD→INR: 83.50 (Jan), 83.92 (Apr)     ║
║  Settlements: 1                                         ║
╚══════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
