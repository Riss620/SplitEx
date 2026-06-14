import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DollarSign, Plus, RefreshCw, TrendingUp, Calendar, User, AlertCircle } from 'lucide-react';

const exchangeRateSchema = z.object({
  fromCurrency: z.string().min(1, 'From currency is required'),
  toCurrency: z.string().min(1, 'To currency is required'),
  rate: z
    .string()
    .min(1, 'Rate is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Rate must be a positive number'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  source: z.string().optional(),
});

type ExchangeRateForm = z.infer<typeof exchangeRateSchema>;

export const ExchangeRates: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExchangeRateForm>({
    resolver: zodResolver(exchangeRateSchema),
    defaultValues: {
      fromCurrency: 'USD',
      toCurrency: 'INR',
      effectiveDate: new Date().toISOString().slice(0, 10),
      source: 'manual_override',
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['exchangeRates'],
    queryFn: () => apiRequest('/exchange-rates'),
  });

  const createMutation = useMutation({
    mutationFn: (formData: ExchangeRateForm) =>
      apiRequest('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          rate: Number(formData.rate),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
      reset();
      setShowForm(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create exchange rate');
    },
  });

  const rates = data?.rates || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-primary" />
            Exchange Rates
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Auditable currency conversion rates. Every rate change is tracked in the Audit Log.
          </p>
        </div>
        {user?.role === 'Admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Rate
          </button>
        )}
      </div>

      {/* Business Rule Notice */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-yellow-300">Important: Currency Rule</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            SplitEx never assumes 1 USD = 1 INR. Every expense in USD is converted using the rate
            effective on the expense date. Rates stored here are used by both manual expense entry
            and CSV import.
          </p>
        </div>
      </div>

      {/* Add Rate Form */}
      {showForm && user?.role === 'Admin' && (
        <div className="bg-card border border-border p-6 rounded-2xl glass-panel animate-fadeIn space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Add / Override Exchange Rate
          </h3>

          {formError && (
            <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/20 text-destructive text-xs">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                From Currency
              </label>
              <select
                {...register('fromCurrency')}
                className="w-full bg-secondary/40 border border-border px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
              {errors.fromCurrency && (
                <p className="text-destructive text-xs mt-1">{errors.fromCurrency.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                To Currency
              </label>
              <select
                {...register('toCurrency')}
                className="w-full bg-secondary/40 border border-border px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="INR">INR (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Rate (1 FROM = ? TO)
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="e.g. 83.50"
                {...register('rate')}
                className="w-full bg-secondary/40 border border-border px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.rate && (
                <p className="text-destructive text-xs mt-1">{errors.rate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Effective Date
              </label>
              <input
                type="date"
                {...register('effectiveDate')}
                className="w-full bg-secondary/40 border border-border px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.effectiveDate && (
                <p className="text-destructive text-xs mt-1">{errors.effectiveDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Source
              </label>
              <input
                type="text"
                placeholder="e.g. manual_override, rbi_api"
                {...register('source')}
                className="w-full bg-secondary/40 border border-border px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-95 transition-all"
              >
                {createMutation.isPending ? 'Saving...' : 'Add Rate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rates Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground">
          <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No exchange rates configured yet.</p>
          {user?.role === 'Admin' && (
            <p className="text-xs mt-1">Click "Add Rate" to define the USD → INR conversion.</p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden glass-panel">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              All Rates ({rates.length})
            </h3>
            <p className="text-xs text-muted-foreground">Newest effective date first</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {['From', 'To', 'Rate', 'Effective Date', 'Source', 'Added By', 'Created At'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rates.map((rate: any, idx: number) => (
                  <tr
                    key={rate.id}
                    className={`border-b border-border/30 hover:bg-secondary/10 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-secondary/5'
                    }`}
                  >
                    <td className="px-5 py-3 font-bold text-foreground">{rate.fromCurrency}</td>
                    <td className="px-5 py-3 font-bold text-foreground">{rate.toCurrency}</td>
                    <td className="px-5 py-3 font-mono text-primary font-bold">
                      {Number(rate.rate).toFixed(4)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(rate.effectiveDate).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full font-mono">
                        {rate.source || 'unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {rate.createdBy?.name || 'System'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {new Date(rate.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
