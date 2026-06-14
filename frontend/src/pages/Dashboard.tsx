import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Activity,
  ChevronRight,
  FolderDot
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => apiRequest('/dashboard/summary'),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/15 border border-destructive/20 text-destructive rounded-xl">
        Error loading dashboard: {(error as Error).message}
      </div>
    );
  }

  const summary = data?.summary || {};
  const isOwed = summary.netBalance >= 0;

  // Chart data formatting
  const chartData = (summary.groupSummaries || []).map((g: any) => ({
    name: g.name,
    balance: g.net,
  }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, <span className="font-semibold text-foreground">{user?.name}</span>. Here's your balance snapshot.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'Admin' && (
            <Link
              to="/import"
              className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Import CSV
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Outstanding Balance */}
        <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-between glass-panel relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full pointer-events-none"></div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
            <h3 className={`text-3xl font-extrabold mt-2 ${isOwed ? 'text-primary' : 'text-destructive'}`}>
              {isOwed ? '+' : ''}₹{Math.abs(summary.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs font-medium">
            {isOwed ? (
              <span className="text-primary flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> You are owed money overall
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-1">
                <ArrowDownRight className="h-4 w-4" /> You owe money overall
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Group Expenditures */}
        <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-between glass-panel">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Group Spending</p>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">
              ₹{summary.totalExpensesInInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Cumulative expenses across your groups</span>
          </div>
        </div>

        {/* Card 3: Admin Actions / User Profile */}
        <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-between glass-panel">
          {user?.role === 'Admin' && summary.adminStats ? (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Anomaly Review Board</p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-yellow-500">{summary.adminStats.warningAnomalies}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Warnings</span>
                  </div>
                  <div className="h-8 w-px bg-border"></div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-destructive">{summary.adminStats.errorAnomalies}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Errors</span>
                  </div>
                  <div className="h-8 w-px bg-border"></div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-primary">{summary.adminStats.totalImports}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sessions</span>
                  </div>
                </div>
              </div>
              <Link to="/anomalies" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 mt-4 self-start">
                Go to Anomalies Console <ChevronRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Permissions</p>
                <div className="flex items-center gap-2.5 mt-3 text-sm text-foreground">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span>Verified Member (Read & Log Access)</span>
                </div>
              </div>
              <Link to="/profile" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 mt-4 self-start">
                View Profile <ChevronRight className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Chart & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column: Chart & Groups list */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chart Card */}
          <div className="bg-card border border-border p-6 rounded-2xl glass-panel">
            <h3 className="text-lg font-bold mb-6">Group Balance Allocations</h3>
            {chartData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.balance >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No balance data available. Join a group and add expenses.
              </div>
            )}
          </div>

          {/* Group Overview Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Your Active Groups</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(summary.groupSummaries || []).map((g: any) => (
                <Link
                  key={g.groupId}
                  to={`/groups/${g.groupId}`}
                  className="bg-card/50 hover:bg-card/80 border border-border p-5 rounded-xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-all">
                      <FolderDot className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{g.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Click to view details</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${g.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {g.net >= 0 ? '+' : ''}₹{g.net.toLocaleString('en-IN')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-6 flex flex-col justify-between h-[500px] overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Recent Activities</h3>
            </div>

            <div className="space-y-4">
              {summary.recentActivities && summary.recentActivities.length > 0 ? (
                summary.recentActivities.map((act: any) => (
                  <div key={act.id} className="text-sm flex gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div>
                      <p className="text-foreground font-medium">
                        <span className="font-semibold">{act.user?.name || 'System'}</span>{' '}
                        {act.action.replace('_', ' ').toLowerCase()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(act.createdAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-10">
                  No activity logged yet.
                </div>
              )}
            </div>
          </div>

          {user?.role === 'Admin' && (
            <Link
              to="/audit-logs"
              className="text-xs text-primary font-semibold hover:underline block text-center border-t border-border pt-4 mt-auto"
            >
              View Full Audit Logs
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
