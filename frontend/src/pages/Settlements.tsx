import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { HandCoins, Calendar, History, ArrowRight } from 'lucide-react';

export const Settlements: React.FC = () => {
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiRequest('/groups'),
  });

  const [selectedGroup, setSelectedGroup] = React.useState<string>('');

  const { data: settlementsData, isLoading } = useQuery({
    queryKey: ['settlements', selectedGroup],
    queryFn: () => apiRequest(`/settlements${selectedGroup ? `?groupId=${selectedGroup}` : ''}`),
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const settlements = settlementsData?.settlements || [];
  const groups = groupsData?.groups || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settlements</h1>
          <p className="text-muted-foreground mt-1">
            Check payment transfers, transfers history, and resolve balances.
          </p>
        </div>

        {/* Group Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground uppercase font-semibold">Filter by Group:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-card border border-border px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            <option value="">All Groups</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Settlement History feed */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <span>Recorded Transfers Log</span>
          </h3>

          {settlements.map((set: any) => (
            <div
              key={set.id}
              className="bg-card/45 border border-border p-4 rounded-2xl flex items-center justify-between hover:bg-card/65 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                  <HandCoins className="h-5 w-5" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-foreground">{set.fromUser.name}</span>
                  <span className="text-muted-foreground mx-1.5">paid</span>
                  <span className="font-semibold text-foreground">{set.toUser.name}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-extrabold text-foreground text-sm">
                  ₹{Number(set.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(set.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          ))}

          {settlements.length === 0 && (
            <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
              No settlements logged yet in this filter.
            </div>
          )}
        </div>

        {/* Right Side Info Box: Settle Suggestions redirection */}
        <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-4 h-fit">
          <h3 className="text-base font-bold">Suggestions Solver</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ready to square up? Select a group in your navigation dashboard to calculate the minimum payment suggestion paths.
          </p>
          <div className="border-t border-border pt-4 mt-2">
            <Link
              to="/groups"
              className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-xs hover:opacity-95 shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              Choose a Group to Settle
              <ArrowRight className="h-4.5 w-4.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
