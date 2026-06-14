import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { AlertTriangle, CheckCircle, Info, ChevronRight, CheckCheck, Loader2 } from 'lucide-react';

export const Anomalies: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch pending sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['importSessions'],
    queryFn: () => apiRequest('/imports'),
  });

  // Fetch groups to select group for finalization
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiRequest('/groups'),
  });

  // Fetch anomalies for selected session
  const { data: sessionDetailData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['importSession', selectedSessionId],
    queryFn: () => apiRequest(`/imports/${selectedSessionId}`),
    enabled: !!selectedSessionId,
  });

  const resolveAnomalyMutation = useMutation({
    mutationFn: ({ anomalyId, action }: { anomalyId: string; action: string }) =>
      apiRequest(`/anomalies/${anomalyId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importSession', selectedSessionId] });
    },
  });

  const finalizeSessionMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest(`/imports/${selectedSessionId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ groupId }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['importSessions'] });
      setSelectedSessionId('');
      setSuccessMsg(`Import finalized! Ingested ${data.importedCount} rows successfully.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    },
  });

  const sessions = sessionsData?.sessions || [];
  const pendingSessions = sessions.filter((s: any) => s.status === 'PENDING_APPROVAL');
  
  const currentSession = sessionDetailData?.session || {};
  const anomalies = currentSession.anomalies || [];
  const groups = groupsData?.groups || [];

  const handleResolve = (anomalyId: string, action: 'MERGE' | 'KEEP' | 'IGNORE') => {
    resolveAnomalyMutation.mutate({ anomalyId, action });
  };

  const handleFinalize = () => {
    if (!selectedGroupId) return;
    finalizeSessionMutation.mutate(selectedGroupId);
  };

  // Check if all warning anomalies have been resolved
  const pendingWarningCount = anomalies.filter(
    (a: any) => a.severity === 'WARNING' && a.finalAction === 'PENDING'
  ).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Anomalies Review Board</h1>
        <p className="text-muted-foreground mt-1">
          Review warnings and approve duplicate resolutions before committing bulk data.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2">
          <CheckCheck className="h-5 w-5" />
          {successMsg}
        </div>
      )}

      {/* Grid selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Sessions selector list */}
        <div className="space-y-4">
          <h3 className="text-base font-bold">Pending Import Sheets</h3>
          {sessionsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingSessions.length > 0 ? (
            <div className="space-y-2">
              {pendingSessions.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    // Match a group or default
                    setSelectedGroupId('');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedSessionId === s.id
                      ? 'bg-primary/15 border-primary text-foreground'
                      : 'bg-card/40 border-border hover:bg-card/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <p className="font-semibold text-sm truncate">{s.fileName}</p>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span>Processed: {s.rowsProcessed}</span>
                    <span className="text-yellow-500 font-bold">Warnings: {s.warningsCount}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              No pending import sessions. Excellent!
            </div>
          )}
        </div>

        {/* Right Side: Review details & Anomaly resolve board */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSessionId ? (
            anomaliesLoading ? (
              <div className="flex h-[30vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-6">
                <div className="border-b border-border pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{currentSession.fileName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Session ID: {currentSession.id}</p>
                  </div>
                  <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full font-semibold">
                    Resolution Pending
                  </span>
                </div>

                {/* Finalize Panel */}
                {pendingWarningCount === 0 ? (
                  <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-foreground">All Warnings Resolved</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You have resolved all duplicate items and warnings. Select the destination group to execute final database insertions.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="bg-background border border-border px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                      >
                        <option value="">Select destination group...</option>
                        {groups.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleFinalize}
                        disabled={!selectedGroupId || finalizeSessionMutation.isPending}
                        className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-95 shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                      >
                        {finalizeSessionMutation.isPending ? 'Ingesting...' : 'Finalize & Ingest'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-yellow-500 shrink-0" />
                    <p>
                      You must select action items for the remaining {pendingWarningCount} warnings below before final ingest.
                    </p>
                  </div>
                )}

                {/* Anomalies List */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm">Action Items</h4>
                  <div className="space-y-3">
                    {anomalies.map((a: any) => (
                      <div
                        key={a.id}
                        className={`p-4 rounded-xl border text-sm space-y-3 ${
                          a.severity === 'ERROR'
                            ? 'bg-destructive/5 border-destructive/10 text-destructive'
                            : 'bg-card border-border/80 text-foreground'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-2">
                            <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px] h-fit shrink-0">
                              Row {a.rowNumber}
                            </span>
                            <div>
                              <p className="font-bold flex items-center gap-1.5">
                                {a.severity === 'WARNING' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                                {a.anomalyType}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                            </div>
                          </div>

                          {a.severity === 'ERROR' && (
                            <span className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                              Blocker
                            </span>
                          )}
                        </div>

                        {/* Actions buttons */}
                        {a.severity === 'WARNING' && (
                          <div className="flex items-center justify-between border-t border-border/40 pt-3 flex-wrap gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              Suggested: <strong>{a.suggestedAction}</strong>
                            </span>

                            {a.finalAction === 'PENDING' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleResolve(a.id, 'MERGE')}
                                  className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-2.5 py-1 rounded-lg text-xs transition-colors"
                                >
                                  Merge
                                </button>
                                <button
                                  onClick={() => handleResolve(a.id, 'KEEP')}
                                  className="bg-secondary hover:bg-secondary/80 text-foreground font-semibold px-2.5 py-1 rounded-lg text-xs transition-all border border-border"
                                >
                                  Keep Both
                                </button>
                                <button
                                  onClick={() => handleResolve(a.id, 'IGNORE')}
                                  className="bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold px-2.5 py-1 rounded-lg text-xs transition-colors"
                                >
                                  Ignore
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold border border-primary/20 uppercase">
                                  Resolved: {a.finalAction}
                                </span>
                                <button
                                  onClick={() => handleResolve(a.id, 'PENDING' as any)} // reset
                                  className="text-xs text-muted-foreground hover:underline"
                                >
                                  Undo
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border rounded-2xl bg-card/10 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 opacity-40 mb-3" />
              <h3 className="font-semibold text-lg text-foreground">Select a Pending Session</h3>
              <p className="text-sm mt-1 max-w-sm text-center">
                Choose a spreadsheet in the left list to load detected duplicates, resolve alerts, and merge records.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
