import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { FileClock, User, History, Terminal } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => apiRequest('/audit-logs'),
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-xl">
        Error loading logs: {(error as Error).message}
      </div>
    );
  }

  const logs = data?.logs || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">System Audit Trace</h1>
        <p className="text-muted-foreground mt-1 font-medium">Trace all transactions, memberships, and resolutions historically.</p>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        <div className="flex items-center gap-2 border-b border-border pb-4 mb-2">
          <FileClock className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">Trace Log History</h3>
        </div>

        <div className="space-y-6 relative border-l border-border pl-6 ml-3">
          {logs.map((log: any) => (
            <div key={log.id} className="relative text-sm">
              {/* timeline node dot */}
              <span className="absolute -left-[31px] top-1 bg-background border-2 border-primary h-3 w-3 rounded-full"></span>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-extrabold text-foreground text-xs uppercase tracking-wider bg-secondary/60 px-2 py-0.5 rounded mr-2 inline-block">
                    {log.action.replace('_', ' ')}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium">
                    Entity: {log.entityType} ({log.entityId || 'N/A'})
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground italic">
                  {new Date(log.createdAt).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="mt-2 text-xs text-muted-foreground bg-secondary/10 border border-border/30 p-2.5 rounded-lg font-mono">
                <div className="flex items-center gap-1.5 mb-1.5 font-sans font-semibold text-foreground text-[10px] uppercase">
                  <User className="h-3 w-3 text-primary" />
                  <span>Actor: {log.user?.name || 'System'} ({log.user?.email || 'N/A'})</span>
                </div>
                {log.details ? (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                ) : (
                  <span>No metadata payload.</span>
                )}
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
              No audit logs captured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
