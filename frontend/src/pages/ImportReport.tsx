import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import {
  FileText,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  BarChart2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type AnomalyEntry = {
  id: string;
  rowNumber: number;
  type: string;
  severity: 'WARNING' | 'ERROR';
  description: string;
  suggestedAction: string;
  finalAction: string;
  reviewer: { name: string; email: string } | null;
  resolvedAt: string | null;
};

type ImportReport = {
  sessionId: string;
  fileName: string;
  status: string;
  uploadedBy: { name: string; email: string };
  uploadedAt: string;
  reviewedAt: string | null;
  summary: {
    rowsProcessed: number;
    rowsImported: number;
    rowsRejected: number;
    warningsCount: number;
    errorsCount: number;
    totalAnomalies: number;
  };
  anomalies: AnomalyEntry[];
};

// Severity badge
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  if (severity === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/20">
        <XCircle className="h-3 w-3" />
        ERROR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      <AlertTriangle className="h-3 w-3" />
      WARNING
    </span>
  );
};

// Action badge
const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-secondary text-muted-foreground border-border',
    RESOLVED: 'bg-primary/15 text-primary border-primary/20',
    MERGED: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    KEPT_BOTH: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    IGNORED: 'bg-secondary text-muted-foreground border-border line-through',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[action] || styles.PENDING}`}
    >
      {action}
    </span>
  );
};

export const ImportReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['importReport', id],
    queryFn: () => apiRequest(`/imports/${id}/report`),
  });

  const report: ImportReport | undefined = data?.report;

  const handleDownloadCsv = () => {
    window.open(`${API_URL}/imports/${id}/report/csv`, '_blank');
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    // Dynamically import jsPDF to avoid blocking render
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('SplitEx — Import Report', 14, 18);

    // Meta info
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`File: ${report.fileName}`, 14, 28);
    doc.text(`Status: ${report.status}`, 14, 34);
    doc.text(`Uploaded by: ${report.uploadedBy.name} (${report.uploadedBy.email})`, 14, 40);
    doc.text(`Uploaded at: ${new Date(report.uploadedAt).toLocaleString('en-IN')}`, 14, 46);

    // Summary Box
    doc.setFillColor(240, 240, 255);
    doc.rect(14, 52, 270, 28, 'F');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const s = report.summary;
    doc.text(`Rows Processed: ${s.rowsProcessed}`, 20, 62);
    doc.text(`Rows Imported: ${s.rowsImported}`, 70, 62);
    doc.text(`Rows Rejected: ${s.rowsRejected}`, 120, 62);
    doc.text(`Warnings: ${s.warningsCount}`, 170, 62);
    doc.text(`Errors: ${s.errorsCount}`, 220, 62);
    doc.text(`Total Anomalies: ${s.totalAnomalies}`, 20, 74);

    // Table headers
    let y = 90;
    doc.setFontSize(8);
    doc.setFillColor(60, 60, 80);
    doc.rect(14, y - 5, 270, 8, 'F');
    doc.setTextColor(255, 255, 255);
    ['Row', 'Type', 'Severity', 'Description', 'Final Action', 'Reviewer'].forEach((h, i) => {
      doc.text(h, 16 + i * 45, y);
    });

    doc.setTextColor(40, 40, 40);
    report.anomalies.forEach((a, idx) => {
      y += 8;
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 255);
        doc.rect(14, y - 5, 270, 8, 'F');
      }
      doc.setFontSize(7);
      doc.text(String(a.rowNumber), 16, y);
      doc.text(a.type.slice(0, 18), 61, y);
      doc.text(a.severity, 106, y);
      doc.text(a.description.slice(0, 40), 151, y);
      doc.text(a.finalAction, 196, y);
      doc.text(a.reviewer?.name || 'N/A', 241, y);
    });

    doc.save(`splitex-report-${report.sessionId.slice(0, 8)}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-24 text-destructive">
        <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-semibold">Failed to load import report.</p>
        <Link to="/import" className="text-primary underline text-sm mt-2 inline-block">
          ← Back to Import
        </Link>
      </div>
    );
  }

  const { summary } = report;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/import"
            className="p-2 bg-secondary/60 hover:bg-secondary rounded-xl text-muted-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Import Report
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5 font-mono">{report.fileName}</p>
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Meta info row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-card border border-border p-4 rounded-xl glass-panel">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Status</p>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
              report.status === 'COMPLETED'
                ? 'bg-primary/15 text-primary'
                : report.status === 'PENDING_APPROVAL'
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-destructive/15 text-destructive'
            }`}
          >
            {report.status}
          </span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl glass-panel">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
            <User className="h-3 w-3 inline mr-1" />
            Uploaded By
          </p>
          <p className="font-semibold">{report.uploadedBy.name}</p>
          <p className="text-xs text-muted-foreground">{report.uploadedBy.email}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl glass-panel">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
            <Clock className="h-3 w-3 inline mr-1" />
            Uploaded At
          </p>
          <p className="font-semibold text-sm">{new Date(report.uploadedAt).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl glass-panel">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
            Session ID
          </p>
          <p className="font-mono text-xs text-muted-foreground break-all">{report.sessionId.slice(0, 16)}...</p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          Import Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Rows Processed', value: summary.rowsProcessed, color: 'text-foreground' },
            { label: 'Rows Imported', value: summary.rowsImported, color: 'text-primary' },
            { label: 'Rows Rejected', value: summary.rowsRejected, color: 'text-destructive' },
            { label: 'Warnings', value: summary.warningsCount, color: 'text-yellow-400' },
            { label: 'Errors', value: summary.errorsCount, color: 'text-destructive' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card border border-border p-5 rounded-2xl glass-panel text-center"
            >
              <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border p-5 rounded-2xl glass-panel space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Import success rate</span>
          <span>
            {summary.rowsProcessed > 0
              ? Math.round((summary.rowsImported / summary.rowsProcessed) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{
              width: `${
                summary.rowsProcessed > 0
                  ? (summary.rowsImported / summary.rowsProcessed) * 100
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="flex gap-6 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Imported ({summary.rowsImported})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
            Rejected ({summary.rowsRejected})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
            Warnings ({summary.warningsCount})
          </span>
        </div>
      </div>

      {/* Anomalies table */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          Detected Anomalies ({report.anomalies.length})
        </h2>

        {report.anomalies.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-primary opacity-60" />
            <p className="font-semibold">No anomalies detected. Clean import!</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">
                      Row
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Anomaly Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">
                      Severity
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Description
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Suggested Action
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                      Decision
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Reviewer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.anomalies.map((anomaly, idx) => (
                    <tr
                      key={anomaly.id}
                      className={`border-b border-border/40 hover:bg-secondary/10 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-secondary/5'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{anomaly.rowNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground text-xs">{anomaly.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={anomaly.severity} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        {anomaly.description}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        {anomaly.suggestedAction}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={anomaly.finalAction} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {anomaly.reviewer ? (
                          <span>{anomaly.reviewer.name}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground flex items-start gap-2">
        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>
          This report is immutable and reflects the state of the import at the time of finalization.
          Every anomaly decision is recorded in the Audit Log for full traceability.
        </p>
      </div>
    </div>
  );
};
