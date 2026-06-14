/**
 * SplitEx API Router
 * ===================
 * All routes require authentication (JWT Bearer token via cookie).
 * Role-based authorization applied at specific admin-only endpoints.
 *
 * Route groups:
 *   /dashboard  — Dashboard summary
 *   /users      — User management (Admin)
 *   /groups     — Group CRUD + membership
 *   /expenses   — Expense CRUD
 *   /settlements — Settlement recording + suggestions
 *   /imports    — CSV import + anomaly review
 *   /anomalies  — Anomaly resolution
 *   /audit-logs — Immutable event trail (Admin)
 *   /exchange-rates — Currency rate management (Admin write, all read)
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../types/prismaEmulated';

// Controllers
import {
  createGroup,
  getGroups,
  getGroupById,
  addMember,
  removeMember,
  archiveGroup,
} from '../controllers/group';

import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from '../controllers/expense';

import {
  recordSettlement,
  getSettlements,
  getSettlementSuggestions,
} from '../controllers/settlement';

import {
  uploadAndProcessCsv,
  getImportSessions,
  getImportSessionById,
  resolveAnomaly,
  finalizeImportSession,
  getImportReport,
  downloadImportReportCsv,
} from '../controllers/import';

import { getAuditLogs } from '../controllers/audit';
import { getDashboardSummary } from '../controllers/dashboard';
import { getExchangeRates, createExchangeRate, getLatestRate } from '../controllers/exchangeRate';
import { getAllUsers, getUserById } from '../controllers/user';

const router = Router();

// All routes below require a valid JWT
router.use(authenticate as any);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard/summary', getDashboardSummary as any);

// ─── USERS (Admin-managed) ───────────────────────────────────────────────────
router.get('/users', authorize([Role.Admin]) as any, getAllUsers as any);
router.get('/users/:id', getUserById as any);

// ─── GROUPS ──────────────────────────────────────────────────────────────────
router.post('/groups', createGroup as any);
router.get('/groups', getGroups as any);
router.get('/groups/:id', getGroupById as any);
router.post('/groups/:id/members', authorize([Role.Admin]) as any, addMember as any);
router.delete('/groups/:id/members', authorize([Role.Admin]) as any, removeMember as any);
router.delete('/groups/:id', authorize([Role.Admin]) as any, archiveGroup as any);
router.get('/groups/:groupId/settlement-suggestions', getSettlementSuggestions as any);

// ─── EXPENSES ────────────────────────────────────────────────────────────────
router.post('/expenses', createExpense as any);
router.get('/expenses', getExpenses as any);
router.get('/expenses/:id', getExpenseById as any);
router.put('/expenses/:id', updateExpense as any);
router.delete('/expenses/:id', authorize([Role.Admin]) as any, deleteExpense as any);

// ─── SETTLEMENTS ─────────────────────────────────────────────────────────────
router.post('/settlements', recordSettlement as any);
router.get('/settlements', getSettlements as any);

// ─── CSV IMPORT ──────────────────────────────────────────────────────────────
router.post('/imports', authorize([Role.Admin]) as any, uploadAndProcessCsv as any);
router.get('/imports', getImportSessions as any);
router.get('/imports/:id', getImportSessionById as any);
router.post('/imports/:id/finalize', authorize([Role.Admin]) as any, finalizeImportSession as any);
router.get('/imports/:id/report', getImportReport as any);
router.get('/imports/:id/report/csv', downloadImportReportCsv as any);

// ─── ANOMALY RESOLUTION ───────────────────────────────────────────────────────
router.put('/anomalies/:id/resolve', authorize([Role.Admin]) as any, resolveAnomaly as any);

// ─── AUDIT LOGS (Admin only) ─────────────────────────────────────────────────
router.get('/audit-logs', authorize([Role.Admin]) as any, getAuditLogs as any);

// ─── EXCHANGE RATES ───────────────────────────────────────────────────────────
router.get('/exchange-rates', getExchangeRates as any);
router.get('/exchange-rates/latest', getLatestRate as any);
router.post('/exchange-rates', authorize([Role.Admin]) as any, createExchangeRate as any);

export default router;
