import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/api';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Users, FolderPlus, ArrowRight, FolderKanban, Info, X } from 'lucide-react';

export const Groups: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiRequest('/groups'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: '', description: '' }
  });

  const createGroupMutation = useMutation({
    mutationFn: (newGroup: { name: string; description: string }) =>
      apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify(newGroup),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      setModalOpen(false);
      setSuccessMsg('Group created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const onSubmit = (formData: any) => {
    createGroupMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const groupsList = data?.groups || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header banner */}
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Groups</h1>
          <p className="text-muted-foreground mt-1">
            Manage your flatmate accounts, trips, and joint bills.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all flex items-center gap-2"
        >
          <FolderPlus className="h-4 w-4" />
          Create Group
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2">
          <Info className="h-5 w-5" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/20 text-destructive text-sm">
          Error loading groups: {(error as Error).message}
        </div>
      )}

      {/* Grid List */}
      {groupsList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupsList.map((g: any) => (
            <div
              key={g.id}
              className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-between glass-panel hover:border-primary/40 hover:shadow-lg transition-all group"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                    {g.name}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {g.description || 'No description provided.'}
                </p>
              </div>

              <div className="border-t border-border mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Created {new Date(g.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
                <Link
                  to={`/groups/${g.id}`}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 group-hover:gap-1.5 transition-all"
                >
                  Enter Group
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-card/10">
          <FolderKanban className="h-12 w-12 text-muted-foreground/60 mb-3" />
          <h3 className="font-semibold text-lg">No groups found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            You aren't associated with any active expense groups. Start by creating a group now.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 bg-secondary text-foreground hover:bg-secondary/80 font-medium px-4 py-2 rounded-xl text-sm transition-all"
          >
            Create Your First Group
          </button>
        </div>
      )}

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-2xl shadow-xl relative glass-panel">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Create New Expense Group</h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Group Name</label>
                <input
                  type="text"
                  {...register('name', { required: 'Group name is required' })}
                  placeholder="e.g. Flat 204 Utilities"
                  className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                />
                {errors.name && <span className="text-xs text-destructive mt-1 block">{errors.name.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description (Optional)</label>
                <textarea
                  {...register('description')}
                  placeholder="e.g. Rent, internet, and electricity shares"
                  rows={3}
                  className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="w-full bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center mt-4"
              >
                {createGroupMutation.isPending ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
                ) : (
                  'Create Group'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
