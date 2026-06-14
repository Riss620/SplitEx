import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  CalendarDays,
  UserPlus,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  FileCheck,
  CircleDollarSign,
  HandCoins,
  History,
  Info,
  X,
  Plus
} from 'lucide-react';

export const GroupDetails: React.FC = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'suggestions'>('expenses');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Group Data
  const { data: groupData, isLoading: groupLoading, error: groupErr } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => apiRequest(`/groups/${groupId}`),
  });

  // 2. Fetch Group Expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['groupExpenses', groupId],
    queryFn: () => apiRequest(`/expenses?groupId=${groupId}`),
  });

  // 3. Fetch Group Settlements
  const { data: settlementsData } = useQuery({
    queryKey: ['groupSettlements', groupId],
    queryFn: () => apiRequest(`/settlements?groupId=${groupId}`),
  });

  // 4. Fetch Settlement Suggestions (optimized by balance engine)
  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery({
    queryKey: ['settlementSuggestions', groupId],
    queryFn: () => apiRequest(`/groups/${groupId}/settlement-suggestions`),
  });

  // Mutators
  const addMemberMutation = useMutation({
    mutationFn: (newMember: { email: string; joinedAt?: string }) =>
      apiRequest(`/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify(newMember),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setMemberModalOpen(false);
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (expense: any) =>
      apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify(expense),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupExpenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['settlementSuggestions', groupId] });
      setExpenseModalOpen(false);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) =>
      apiRequest(`/expenses/${expenseId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupExpenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['settlementSuggestions', groupId] });
    },
  });

  const recordSettlementMutation = useMutation({
    mutationFn: (settle: { fromUserId: string; toUserId: string; amount: number; currency: string }) =>
      apiRequest('/settlements', {
        method: 'POST',
        body: JSON.stringify({ ...settle, groupId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupSettlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['settlementSuggestions', groupId] });
      refetchSuggestions();
    },
  });

  // Form setups
  const { register: regMember, handleSubmit: handleMemberSubmit, reset: resetMember } = useForm({
    defaultValues: { email: '', joinedAt: '' },
  });

  const { register: regExpense, handleSubmit: handleExpenseSubmit, control, watch, setValue, reset: resetExpense } = useForm({
    defaultValues: {
      description: '',
      amount: '',
      currency: 'INR',
      paidById: '',
      splitType: 'EQUAL',
      date: new Date().toISOString().slice(0, 10),
      participants: [] as { userId: string; checked: boolean; value?: string }[],
    },
  });

  const watchedSplitType = watch('splitType');
  const watchedAmount = watch('amount');

  // Load members into form participant checkbox array when modal opens
  const openExpenseModal = () => {
    resetExpense();
    const members = groupData?.group?.memberships || [];
    const participantsList = members.map((m: any) => ({
      userId: m.user.id,
      checked: true,
      value: '',
    }));
    setValue('participants', participantsList);
    setFormError(null);
    setExpenseModalOpen(true);
  };

  const onAddMember = (data: any) => {
    addMemberMutation.mutate({
      email: data.email,
      joinedAt: data.joinedAt ? new Date(data.joinedAt).toISOString() : undefined,
    });
    resetMember();
  };

  const onAddExpense = (data: any) => {
    setFormError(null);
    const amount = Number(data.amount);
    
    // Filter selected participants
    const activeParts = data.participants.filter((p: any) => p.checked);
    if (!activeParts.length) {
      setFormError('Please select at least one participant.');
      return;
    }

    // Format splits values
    const formattedParticipants = activeParts.map((p: any) => ({
      userId: p.userId,
      value: p.value ? Number(p.value) : undefined,
    }));

    // Perform check
    if (data.splitType === 'EXACT') {
      const sum = formattedParticipants.reduce((s, p) => s + (p.value || 0), 0);
      if (Math.abs(sum - amount) > 0.05) {
        setFormError(`Sum of exact split amounts (₹${sum}) must equal total amount (₹${amount}).`);
        return;
      }
    } else if (data.splitType === 'PERCENTAGE') {
      const sum = formattedParticipants.reduce((s, p) => s + (p.value || 0), 0);
      if (Math.abs(sum - 100) > 0.05) {
        setFormError(`Sum of percentage shares (${sum}%) must equal 100%.`);
        return;
      }
    }

    // Call create
    createExpenseMutation.mutate({
      groupId,
      description: data.description,
      amount,
      currency: data.currency,
      originalAmount: amount,
      originalCurrency: data.currency,
      exchangeRate: data.currency === 'USD' ? 83.50 : 1.0, // base mock rate
      paidById: data.paidById,
      splitType: data.splitType,
      date: new Date(data.date).toISOString(),
      participants: formattedParticipants,
    }, {
      onError: (err: any) => {
        setFormError(err.message || 'Failed to save expense.');
      }
    });
  };

  if (groupLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const group = groupData?.group || {};
  const memberships = group.memberships || [];
  const expenses = expensesData?.expenses || [];
  const settlements = settlementsData?.settlements || [];
  const suggestions = suggestionsData?.suggestions || [];
  const balances = suggestionsData?.balances || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Navigation bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-3">
          <Link to="/groups" className="p-2 bg-secondary/60 hover:bg-secondary rounded-xl text-muted-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="text-muted-foreground mt-1">{group.description || 'No description'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setMemberModalOpen(true)}
              className="bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          )}
          <button
            onClick={openExpenseModal}
            className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Main Grid structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Membership Timeline & Group Balances */}
        <div className="space-y-6">
          {/* Member timelines */}
          <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold">Timeline & Members</h3>
            </div>

            <div className="space-y-3 pt-2">
              {memberships.map((m: any) => (
                <div key={m.id} className="text-sm p-3 bg-secondary/20 rounded-xl border border-border/40 relative group">
                  <p className="font-semibold text-foreground">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Joined: {new Date(m.joinedAt).toLocaleDateString('en-IN')}
                  </p>
                  {m.leftAt ? (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-yellow-500 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Left: {new Date(m.leftAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold mt-1 inline-block uppercase">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Group balance ledger */}
          <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold">Group Net Balances</h3>
            </div>

            <div className="space-y-3 pt-2">
              {balances.map((b: any) => (
                <div key={b.userId} className="flex justify-between items-center text-sm">
                  <span>{b.name}</span>
                  <span className={`font-semibold ${b.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {b.net >= 0 ? '+' : ''}₹{b.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {balances.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No transactions recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Tabs: Expenses vs Suggestions vs Recorded Settlements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'expenses'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'suggestions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Settle Suggester
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'settlements'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Settlement History
            </button>
          </div>

          {/* Tab 1: Expenses feed */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {expenses.map((exp: any) => (
                <div
                  key={exp.id}
                  className="bg-card/40 border border-border p-5 rounded-2xl flex items-center justify-between hover:bg-card/60 transition-all"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{exp.description}</h4>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
                      <span>Paid by: <strong className="text-foreground">{exp.paidBy.name}</strong></span>
                      <span>•</span>
                      <span>{new Date(exp.createdAt).toLocaleDateString('en-IN')}</span>
                      {exp.splitType !== 'EQUAL' && (
                        <>
                          <span>•</span>
                          <span className="bg-secondary/80 text-muted-foreground px-1.5 py-0.5 rounded font-mono uppercase text-[10px]">
                            {exp.splitType}
                          </span>
                        </>
                      )}
                    </div>
                    {exp.notes && <p className="text-xs text-muted-foreground/85 mt-2 bg-secondary/10 px-2.5 py-1.5 rounded-lg border border-border/30 inline-block">{exp.notes}</p>}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-sm text-foreground">
                        ₹{Number(exp.amount).toLocaleString('en-IN')}
                      </span>
                      {exp.originalCurrency !== 'INR' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          ({exp.originalAmount} {exp.originalCurrency})
                        </p>
                      )}
                    </div>
                    {currentUser?.role === 'Admin' && (
                      <button
                        onClick={() => deleteExpenseMutation.mutate(exp.id)}
                        className="text-xs text-destructive hover:underline font-semibold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {expenses.length === 0 && (
                <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
                  No expenses added yet. Click "Add Expense" to get started.
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Optimized Settlements suggestions */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <p>
                  These suggestion paths are optimized by SplitEx to settle all cumulative debts in this group using the minimal transactions path.
                </p>
              </div>

              <div className="space-y-3">
                {suggestions.map((s: any, idx: number) => (
                  <div key={idx} className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between glass-panel">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <HandCoins className="h-5 w-5" />
                      </div>
                      <span className="text-sm">
                        <strong className="text-foreground">{s.fromUserName}</strong> pays{' '}
                        <strong className="text-foreground">{s.toUserName}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary text-sm">
                        ₹{s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() =>
                          recordSettlementMutation.mutate({
                            fromUserId: s.fromUserId,
                            toUserId: s.toUserId,
                            amount: s.amount,
                            currency: s.currency,
                          })
                        }
                        className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Log Paid
                      </button>
                    </div>
                  </div>
                ))}

                {suggestions.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
                    Everyone is fully settled up! No transactions needed.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Recorded Settlements */}
          {activeTab === 'settlements' && (
            <div className="space-y-4">
              {settlements.map((set: any) => (
                <div key={set.id} className="bg-card/40 border border-border p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/80 rounded-lg text-muted-foreground">
                      <History className="h-4 w-4" />
                    </div>
                    <span className="text-sm">
                      <strong className="text-foreground">{set.fromUser.name}</strong> paid{' '}
                      <strong className="text-foreground">{set.toUser.name}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground text-sm">
                      ₹{Number(set.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(set.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}

              {settlements.length === 0 && (
                <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
                  No manual settlements recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-2xl shadow-xl relative glass-panel">
            <button onClick={() => setMemberModalOpen(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Add Member to Group</h3>
            <form onSubmit={handleMemberSubmit(onAddMember)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">User Email Address</label>
                <input
                  type="email"
                  {...regMember('email', { required: 'User email is required' })}
                  placeholder="e.g. sam@splitex.com"
                  className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Join Date (Optional)</label>
                <input
                  type="date"
                  {...regMember('joinedAt')}
                  className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                />
              </div>
              <button
                type="submit"
                disabled={addMemberMutation.isPending}
                className="w-full bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl hover:opacity-95 transition-all flex items-center justify-center mt-4"
              >
                {addMemberMutation.isPending ? 'Saving...' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg bg-card border border-border p-6 rounded-2xl shadow-xl relative glass-panel my-8">
            <button onClick={() => setExpenseModalOpen(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Add Shared Expense</h3>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-destructive/15 border border-destructive/20 text-destructive text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleExpenseSubmit(onAddExpense)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                  <input
                    type="text"
                    {...regExpense('description', { required: 'Description is required' })}
                    placeholder="e.g. Electricity bill"
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    {...regExpense('date', { required: 'Date is required' })}
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    {...regExpense('amount', { required: 'Amount is required' })}
                    placeholder="0.00"
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Currency</label>
                  <select
                    {...regExpense('currency')}
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Paid By</label>
                  <select
                    {...regExpense('paidById', { required: 'Payer is required' })}
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="">Select payer...</option>
                    {memberships.map((m: any) => (
                      <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Split Type</label>
                  <select
                    {...regExpense('splitType')}
                    className="w-full bg-secondary/40 border border-border px-4 py-2 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="EQUAL">Split Equally</option>
                    <option value="EXACT">Exact Share Amounts</option>
                    <option value="PERCENTAGE">Percentage Splitting</option>
                    <option value="WEIGHTED">Weighted Share Weights</option>
                  </select>
                </div>
              </div>

              {/* Participants selection */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Split Participants Details</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-border p-3 rounded-xl bg-secondary/15">
                  {memberships.map((m: any, idx: number) => (
                    <div key={m.user.id} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/20 last:border-0 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          {...regExpense(`participants.${idx}.checked` as any)}
                          className="rounded text-primary focus:ring-0 h-4 w-4 bg-secondary/40 border-border"
                        />
                        <span>{m.user.name}</span>
                        {/* Hidden input to store userId in form payload */}
                        <input
                          type="hidden"
                          {...regExpense(`participants.${idx}.userId` as any)}
                          value={m.user.id}
                        />
                      </div>

                      {watchedSplitType !== 'EQUAL' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={
                              watchedSplitType === 'EXACT' ? '₹0.00' :
                              watchedSplitType === 'PERCENTAGE' ? '%' : 'Weight'
                            }
                            {...regExpense(`participants.${idx}.value` as any)}
                            className="bg-secondary/40 border border-border px-3 py-1 rounded-lg text-xs w-24 text-right focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={createExpenseMutation.isPending}
                className="w-full bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl hover:opacity-95 transition-all flex items-center justify-center mt-4"
              >
                {createExpenseMutation.isPending ? 'Saving...' : 'Add Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
