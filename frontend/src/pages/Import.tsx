import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Info, AlertTriangle, AlertCircle, CheckCircle, Download, FileText, ArrowRight } from 'lucide-react';

export const ImportCsv: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('upload.csv');
  
  const [sessionReport, setSessionReport] = useState<any | null>(null);
  const [anomaliesList, setAnomaliesList] = useState<any[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiRequest('/groups'),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { csvContent: string; groupId: string; fileName: string }) =>
      apiRequest('/imports', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      setSessionReport(data.session);
      setAnomaliesList(data.anomalies || []);
      setClientError(null);
    },
    onError: (err: any) => {
      setClientError(err.message || 'Import failed. Check CSV structure.');
      setSessionReport(null);
      setAnomaliesList([]);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.onerror = () => {
      setClientError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (!selectedGroup) {
      setClientError('Please select a target group.');
      return;
    }
    if (!csvContent.trim()) {
      setClientError('Please upload a file or paste valid CSV content.');
      return;
    }

    uploadMutation.mutate({
      csvContent,
      groupId: selectedGroup,
      fileName,
    });
  };

  // Helper to export CSV report
  const downloadCsvReport = () => {
    if (!sessionReport) return;

    const reportHeaders = ['Session ID', 'File Name', 'Status', 'Rows Processed', 'Rows Imported', 'Warnings', 'Errors', 'Timestamp'];
    const reportData = [
      sessionReport.id,
      sessionReport.fileName,
      sessionReport.status,
      sessionReport.rowsProcessed,
      sessionReport.rowsImported,
      sessionReport.warningsCount,
      sessionReport.errorsCount,
      new Date(sessionReport.createdAt).toLocaleString(),
    ];

    let csvString = reportHeaders.join(',') + '\n' + reportData.join(',') + '\n\n';

    if (anomaliesList.length > 0) {
      csvString += 'Row Number,Anomaly Type,Description,Severity,Suggested Action,Resolution Action\n';
      anomaliesList.forEach((a) => {
        csvString += `${a.rowNumber},"${a.anomalyType}","${a.description}",${a.severity},"${a.suggestedAction}",${a.finalAction}\n`;
      });
    }

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Import_Report_${sessionReport.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to export TXT/Print report
  const printTextReport = () => {
    window.print();
  };

  const groups = groupsData?.groups || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header banner */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">CSV Import Engine</h1>
        <p className="text-muted-foreground mt-1">Upload flat bill spreadsheets to validate and ingest records in bulk.</p>
      </div>

      {clientError && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{clientError}</p>
        </div>
      )}

      {/* Import Form & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Upload Panel */}
        <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-5 h-fit">
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span>Upload Spreadsheet</span>
          </h3>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target Group</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              >
                <option value="">Select target group...</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/25 file:cursor-pointer cursor-pointer border border-border rounded-xl p-2 bg-secondary/20"
              />
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border/60"></div>
              <span className="flex-shrink mx-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">Or Paste CSV</span>
              <div className="flex-grow border-t border-border/60"></div>
            </div>

            <div>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="Date,Description,Amount,Currency,PaidBy,SplitType,Participants,SplitValues,IsSettlement&#10;2026-04-20,Groceries,4000,INR,Priya,EQUAL,Aisha;Rohan;Priya;Sam,,FALSE"
                rows={5}
                className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={uploadMutation.isPending}
              className="w-full bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl hover:opacity-95 shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-2"
            >
              {uploadMutation.isPending ? 'Processing Engine...' : 'Submit to Validator'}
            </button>
          </form>
        </div>

        {/* Right Side: Validation Status & Report Summary */}
        <div className="lg:col-span-2 space-y-6">
          {sessionReport ? (
            <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  {sessionReport.status === 'COMPLETED' ? (
                    <CheckCircle className="h-6 w-6 text-primary" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  )}
                  <h3 className="text-lg font-bold">Import Session Report</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadCsvReport}
                    className="p-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg border border-border transition-all"
                    title="Download CSV Report"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={printTextReport}
                    className="p-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg border border-border transition-all"
                    title="Print PDF Report"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* KPI indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Processed</span>
                  <p className="text-2xl font-bold mt-1">{sessionReport.rowsProcessed}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Imported</span>
                  <p className="text-2xl font-bold mt-1 text-primary">{sessionReport.rowsImported}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Warnings</span>
                  <p className="text-2xl font-bold mt-1 text-yellow-500">{sessionReport.warningsCount}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Blockers</span>
                  <p className="text-2xl font-bold mt-1 text-destructive">{sessionReport.errorsCount}</p>
                </div>
              </div>

              {/* Status information */}
              {sessionReport.status === 'PENDING_APPROVAL' ? (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-500 text-xs leading-relaxed flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-1">Session Pending Admin Approval</h4>
                    <p className="text-muted-foreground">
                      This import contains warnings or duplicate items. Go to the Anomalies Console to review duplicate lines, resolve warnings, and finalize the database ingest.
                    </p>
                    <Link
                      to="/anomalies"
                      className="inline-flex items-center gap-1 mt-3 text-xs bg-yellow-500 text-background font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                    >
                      Resolve Anomalies
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs leading-relaxed flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <p>All clean rows were successfully imported directly into the database.</p>
                </div>
              )}

              {/* Anomaly list breakdown */}
              {anomaliesList.length > 0 && (
                <div className="space-y-3 pt-4">
                  <h4 className="font-bold text-sm">Detected Anomalies</h4>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {anomaliesList.map((a: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex gap-3 ${
                          a.severity === 'ERROR'
                            ? 'bg-destructive/10 border-destructive/20 text-destructive'
                            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                        }`}
                      >
                        <span className="font-mono bg-background/50 px-1.5 py-0.5 rounded text-[10px] h-fit">
                          Row {a.rowNumber}
                        </span>
                        <div>
                          <p className="font-bold">{a.anomalyType}</p>
                          <p className="text-muted-foreground mt-0.5">{a.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border rounded-2xl bg-card/10 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12/40 opacity-40 mb-3" />
              <h3 className="font-semibold text-lg text-foreground">Import Preview Console</h3>
              <p className="text-sm mt-1 max-w-sm text-center">
                Submit a CSV file. The validator will analyze formatting, duplicate rows, dates, and split mathematical errors.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
