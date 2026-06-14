import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, ShieldAlert, KeyRound } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fadeIn max-w-xl">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your SplitEx account settings and configurations.</p>
      </div>

      {/* Profile Info Card */}
      <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-primary/10 text-primary flex items-center justify-center rounded-2xl border border-primary/20 shrink-0">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="h-px bg-border"></div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4.5 w-4.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Email Address</p>
              <p className="font-semibold mt-0.5 text-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <ShieldAlert className="h-4.5 w-4.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Verification Role</p>
              <p className="font-semibold mt-0.5 text-foreground uppercase tracking-wider text-xs">
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
