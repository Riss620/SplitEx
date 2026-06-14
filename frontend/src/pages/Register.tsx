import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Wallet, AlertCircle } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Member', 'Admin']).default('Member'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', role: 'Member' },
  });

  const onSubmit = async (data: any) => {
    setError(null);
    setLoading(true);
    try {
      await registerAuth({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-card via-background to-background">
      <div className="w-full max-w-md bg-card/40 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-xl glass-panel">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">Create Account</h1>
          <p className="text-sm text-muted-foreground">Get started with SplitEx today</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/15 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name</label>
            <input
              type="text"
              {...register('name', { required: 'Name is required' })}
              placeholder="e.g. Aisha Sharma"
              className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
            />
            {errors.name && <span className="text-xs text-destructive mt-1 block">{errors.name.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email Address</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              placeholder="e.g. aisha@splitex.com"
              className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
            />
            {errors.email && <span className="text-xs text-destructive mt-1 block">{errors.email.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              placeholder="••••••••"
              className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
            />
            {errors.password && <span className="text-xs text-destructive mt-1 block">{errors.password.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">System Role</label>
            <select
              {...register('role')}
              className="w-full bg-secondary/40 border border-border px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground appearance-none"
            >
              <option value="Member" className="bg-background">Member (Standard Flatmate)</option>
              <option value="Admin" className="bg-background">Admin (Importer, Auditor)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border/40 pt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
