import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Receipt, Calendar, Trash2, FolderDot } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiRequest('/groups'),
  });

  const [selectedGroup, setSelectedGroup] = React.useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', selectedGroup],
    queryFn: () => apiRequest(`/expenses${selectedGroup ? `?groupId=${selectedGroup}` : ''}`),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedGroup] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const expenses = data?.expenses || [];
  const groups = groupsData?.groups || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses Feed</h1>
          <p className="text-muted-foreground mt-1">Review all expenditures logged across your groups.</p>
        </div>

        {/* Group Filter */}
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

      {/* List Feed */}
      <div className="space-y-4">
        {expenses.map((exp: any) => (
          <div
            key={exp.id}
            className="bg-card/40 border border-border p-5 rounded-2xl flex items-center justify-between hover:bg-card/60 transition-all glass-panel"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">{exp.description}</h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1">
                    <FolderDot className="h-3.5 w-3.5 text-primary" />
                    {exp.groupId} {/* Could map to actual name if desired */}
                  </span>
                  <span>•</span>
                  <span>Paid by: <strong>{exp.paidBy.name}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(exp.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="font-extrabold text-sm text-foreground">
                  ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {exp.originalCurrency !== 'INR' && (
                  <p className="text-[10px] text-muted-foreground">
                    ({exp.originalAmount} {exp.originalCurrency})
                  </p>
                )}
              </div>

              {user?.role === 'Admin' && (
                <button
                  onClick={() => deleteExpenseMutation.mutate(exp.id)}
                  title="Delete Expense"
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/15 rounded-lg transition-all"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {expenses.length === 0 && (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
            No expenses found. Add expenses from inside your specific group panel.
          </div>
        )}
      </div>
    </div>
  );
};
