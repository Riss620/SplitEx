import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';
import { validateAndDetectAnomalies, executeDataImport, CsvRow } from '../services/importService';
import csv from 'csv-parser';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { AnomalyAction, ImportStatus } from '../types/prismaEmulated';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

export const uploadAndProcessCsv = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { csvContent, groupId, fileName } = req.body;

    if (!csvContent || !groupId || !fileName) {
      throw new CustomError('Missing required fields: csvContent, groupId, fileName', 400);
    }

    const group = await prisma.group.findUnique({ where: { id: groupId, deletedAt: null } });
    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    const parsedRows = await parseCsvString(csvContent);
    const { anomalies, rowsToImport } = await validateAndDetectAnomalies(parsedRows, groupId);

    const errorsCount = anomalies.filter((a) => a.severity === 'ERROR').length;
    const warningsCount = anomalies.filter((a) => a.severity === 'WARNING').length;

    // Create session in PENDING_APPROVAL
    const session = await prisma.importSession.create({
      data: {
        fileName,
        status: errorsCount > 0 || warningsCount > 0 ? ImportStatus.PENDING_APPROVAL : ImportStatus.COMPLETED,
        rowsProcessed: parsedRows.length,
        rowsImported: 0,
        warningsCount,
        errorsCount,
        createdById: req.user!.id,
      },
    });

    // Write CSV content to disk for later retrieval
    const filePath = path.join(UPLOADS_DIR, `${session.id}.csv`);
    fs.writeFileSync(filePath, csvContent);

    // Save anomalies to database
    if (anomalies.length > 0) {
      await prisma.importAnomaly.createMany({
        data: anomalies.map((a) => ({
          importSessionId: session.id,
          anomalyType: a.anomalyType,
          rowNumber: a.rowNumber,
          description: a.description,
          severity: a.severity,
          suggestedAction: a.suggestedAction,
          finalAction: AnomalyAction.PENDING,
        })),
      });
    }

    // Auto-import if perfectly clean
    if (errorsCount === 0 && warningsCount === 0 && rowsToImport.length > 0) {
      await executeDataImport(rowsToImport, groupId, session.id, req.user!.id);
      await prisma.importSession.update({
        where: { id: session.id },
        data: { rowsImported: rowsToImport.length },
      });
      // Delete temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const savedAnomalies = await prisma.importAnomaly.findMany({
      where: { importSessionId: session.id },
    });

    res.status(200).json({
      success: true,
      session,
      anomalies: savedAnomalies,
    });
  } catch (err) {
    next(err);
  }
};

export const getImportSessions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.importSession.findMany({
      where: { deletedAt: null },
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, sessions });
  } catch (err) {
    next(err);
  }
};

export const getImportSessionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const session = await prisma.importSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { name: true, email: true } },
        anomalies: true,
      },
    });

    if (!session) {
      throw new CustomError('Session not found', 404);
    }

    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

export const resolveAnomaly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // Action can be: MERGE, KEEP, IGNORE

    const anomaly = await prisma.importAnomaly.findUnique({
      where: { id },
    });

    if (!anomaly) {
      throw new CustomError('Anomaly not found', 404);
    }

    if (anomaly.severity === 'ERROR') {
      throw new CustomError('Blocker errors cannot be resolved or imported; they must be fixed in the source CSV.', 400);
    }

    let prismaAction: AnomalyAction = AnomalyAction.RESOLVED;
    if (action === 'MERGE') prismaAction = AnomalyAction.MERGED;
    else if (action === 'KEEP') prismaAction = AnomalyAction.KEPT_BOTH;
    else if (action === 'IGNORE') prismaAction = AnomalyAction.IGNORED;

    const updated = await prisma.importAnomaly.update({
      where: { id },
      data: {
        finalAction: prismaAction,
        reviewerId: req.user!.id,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DUPLICATE_APPROVED',
        entityType: 'ImportAnomaly',
        entityId: id,
        details: JSON.stringify({ action: prismaAction }),
      },
    });

    res.status(200).json({ success: true, anomaly: updated });
  } catch (err) {
    next(err);
  }
};

export const finalizeImportSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: sessionId } = req.params;
    const { groupId } = req.body;

    const session = await prisma.importSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      include: { anomalies: true },
    });

    if (!session) {
      throw new CustomError('Session not found', 404);
    }

    if (session.status !== ImportStatus.PENDING_APPROVAL) {
      throw new CustomError('This session is already finalized or failed', 400);
    }

    // Check if there are unresolved anomalies
    const pendingAnomalies = session.anomalies.filter((a) => a.finalAction === AnomalyAction.PENDING);
    if (pendingAnomalies.length > 0) {
      throw new CustomError(`Cannot finalize session: there are ${pendingAnomalies.length} pending anomalies to review.`, 400);
    }

    // Read the CSV file content from uploads
    const filePath = path.join(UPLOADS_DIR, `${session.id}.csv`);
    if (!fs.existsSync(filePath)) {
      throw new CustomError('CSV source file not found on disk. Finalization aborted.', 500);
    }

    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsedRows = await parseCsvString(csvContent);
    const { rowsToImport } = await validateAndDetectAnomalies(parsedRows, groupId);

    // Apply reviewer decisions:
    // Rows to import lists rows with no errors.
    // For each row in rowsToImport, check if it had a warning anomaly.
    // If it did, inspect its resolved action. If action is IGNORED or MERGED, exclude it from active imports.
    const finalRowsToImport = rowsToImport.filter((row) => {
      // Find anomalies associated with this row number in this session
      const rowAnomalies = session.anomalies.filter((a) => a.rowNumber === row.rowNum);
      
      // If any warning was IGNORED or MERGED, skip this row
      const skipRow = rowAnomalies.some(
        (a) => a.finalAction === AnomalyAction.IGNORED || a.finalAction === AnomalyAction.MERGED
      );
      
      return !skipRow;
    });

    // Run import inside db transactions
    await executeDataImport(finalRowsToImport, groupId, session.id, req.user!.id);

    // Update session status to COMPLETED
    const updatedSession = await prisma.importSession.update({
      where: { id: session.id },
      data: {
        status: ImportStatus.COMPLETED,
        rowsImported: finalRowsToImport.length,
      },
    });

    // Delete temp CSV file
    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      session: updatedSession,
      importedCount: finalRowsToImport.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/imports/:id/report
 * Returns a structured import report for a given session.
 */
export const getImportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const session = await prisma.importSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { name: true, email: true } },
        anomalies: {
          include: { reviewer: { select: { name: true, email: true } } },
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!session) throw new CustomError('Import session not found', 404);

    const errorRows = new Set(
      session.anomalies.filter((a) => a.severity === 'ERROR').map((a) => a.rowNumber)
    );

    const report = {
      sessionId: session.id,
      fileName: session.fileName,
      status: session.status,
      uploadedBy: session.createdBy,
      uploadedAt: session.createdAt,
      reviewedAt: session.reviewedAt,
      summary: {
        rowsProcessed: session.rowsProcessed,
        rowsImported: session.rowsImported,
        rowsRejected: errorRows.size,
        warningsCount: session.warningsCount,
        errorsCount: session.errorsCount,
        totalAnomalies: session.anomalies.length,
      },
      anomalies: session.anomalies.map((a) => ({
        id: a.id,
        rowNumber: a.rowNumber,
        type: a.anomalyType,
        severity: a.severity,
        description: a.description,
        suggestedAction: a.suggestedAction,
        finalAction: a.finalAction,
        reviewer: a.reviewer,
        resolvedAt: a.resolvedAt,
      })),
    };

    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/imports/:id/report/csv
 * Downloads the import report as a CSV file.
 */
export const downloadImportReportCsv = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const session = await prisma.importSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { name: true, email: true } },
        anomalies: {
          include: { reviewer: { select: { name: true } } },
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!session) throw new CustomError('Import session not found', 404);

    const lines: string[] = [
      'Row Number,Anomaly Type,Severity,Description,Suggested Action,Final Action,Reviewer,Resolved At',
      ...session.anomalies.map((a) =>
        [
          a.rowNumber,
          `"${a.anomalyType}"`,
          a.severity,
          `"${a.description.replace(/"/g, '""')}"`,
          `"${a.suggestedAction.replace(/"/g, '""')}"`,
          a.finalAction,
          a.reviewer ? `"${a.reviewer.name}"` : 'N/A',
          a.resolvedAt ? a.resolvedAt.toISOString() : 'N/A',
        ].join(',')
      ),
    ];

    const csvContent = [
      `# SplitEx Import Report`,
      `# File: ${session.fileName}`,
      `# Uploaded: ${session.createdAt.toISOString()}`,
      `# Status: ${session.status}`,
      `# Rows Processed: ${session.rowsProcessed} | Imported: ${session.rowsImported} | Warnings: ${session.warningsCount} | Errors: ${session.errorsCount}`,
      '',
      ...lines,
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="splitex-import-report-${session.id.slice(0, 8)}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
