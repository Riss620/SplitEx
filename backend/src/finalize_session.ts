import { prisma } from './config/db';
import { validateAndDetectAnomalies, executeDataImport } from './services/importService';
import { AnomalyAction, ImportStatus } from './types/prismaEmulated';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Readable } from 'stream';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const parseCsvString = (csvText: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(csvText);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

async function run() {
  console.log('🚀 Finalizing Import Session...');

  // 1. Get Flatmates 2024 group
  const group = await prisma.group.findFirst({
    where: { name: 'Flatmates 2024', deletedAt: null },
  });
  if (!group) {
    console.error('❌ Group Flatmates 2024 not found');
    return;
  }
  const groupId = group.id;
  console.log(`✓ Group found: ${group.name} (${groupId})`);

  // 2. Get Aisha admin user to act as actor
  const aisha = await prisma.user.findFirst({
    where: { email: 'aisha@splitex.com' },
  });
  if (!aisha) {
    console.error('❌ Aisha user not found');
    return;
  }

  // 3. Find latest pending import session
  const session = await prisma.importSession.findFirst({
    where: { status: ImportStatus.PENDING_APPROVAL },
    include: { anomalies: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!session) {
    console.log('ℹ️ No pending import sessions found. Checking if one was already completed.');
    const completed = await prisma.importSession.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (completed) {
      console.log(`Latest session ID: ${completed.id}, Status: ${completed.status}, Imported Rows: ${completed.rowsImported}`);
    }
    return;
  }
  console.log(`✓ Session found: ID ${session.id}, File: ${session.fileName}`);

  // 4. Resolve any pending warning anomalies as MERGED (since user clicked Merge in UI)
  const pendingWarnings = session.anomalies.filter(
    (a) => a.severity === 'WARNING' && a.finalAction === AnomalyAction.PENDING
  );
  if (pendingWarnings.length > 0) {
    console.log(`Resolving ${pendingWarnings.length} pending warnings to MERGED...`);
    for (const a of pendingWarnings) {
      await prisma.importAnomaly.update({
        where: { id: a.id },
        data: {
          finalAction: AnomalyAction.MERGED,
          reviewerId: aisha.id,
          resolvedAt: new Date(),
        },
      });
    }
  }

  // Reload session anomalies
  const updatedAnomalies = await prisma.importAnomaly.findMany({
    where: { importSessionId: session.id },
  });

  // 5. Read CSV content from uploads directory
  const filePath = path.join(UPLOADS_DIR, `${session.id}.csv`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ CSV source file not found at ${filePath}`);
    return;
  }

  const csvContent = fs.readFileSync(filePath, 'utf8');
  const parsedRows = await parseCsvString(csvContent);
  const { rowsToImport } = await validateAndDetectAnomalies(parsedRows, groupId);

  // Exclude rows where warning anomaly was MERGED or IGNORED
  const finalRowsToImport = rowsToImport.filter((row) => {
    const rowAnomalies = updatedAnomalies.filter((a) => a.rowNumber === row.rowNum);
    const skipRow = rowAnomalies.some(
      (a) => a.finalAction === AnomalyAction.IGNORED || a.finalAction === AnomalyAction.MERGED
    );
    return !skipRow;
  });

  console.log(`Parsed rows count: ${parsedRows.length}`);
  console.log(`Clean rows count (no errors): ${rowsToImport.length}`);
  console.log(`Rows to import after applying warning resolutions: ${finalRowsToImport.length}`);

  // 6. Ingest data
  await executeDataImport(finalRowsToImport, groupId, session.id, aisha.id);

  // 7. Update session status
  await prisma.importSession.update({
    where: { id: session.id },
    data: {
      status: ImportStatus.COMPLETED,
      rowsImported: finalRowsToImport.length,
      reviewedById: aisha.id,
      reviewedAt: new Date(),
    },
  });

  // 8. Delete temporary file
  fs.unlinkSync(filePath);
  console.log(`✓ Successfully finalized session ${session.id}!`);
}

run()
  .catch((err) => console.error('❌ Error during script execution:', err))
  .finally(() => prisma.$disconnect());
