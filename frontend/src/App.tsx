import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Groups } from './pages/Groups';
import { GroupDetails } from './pages/GroupDetails';
import { Expenses } from './pages/Expenses';
import { Settlements } from './pages/Settlements';
import { ImportCsv } from './pages/Import';
import { ImportReport } from './pages/ImportReport';
import { Anomalies } from './pages/Anomalies';
import { Profile } from './pages/Profile';
import { AuditLogs } from './pages/AuditLogs';
import { ExchangeRates } from './pages/ExchangeRates';
import { Landing } from './pages/Landing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000, // 30s cache
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes — Members & Admins */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <Layout><Groups /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <ProtectedRoute>
                  <Layout><GroupDetails /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <Layout><Expenses /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settlements"
              element={
                <ProtectedRoute>
                  <Layout><Settlements /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout><Profile /></Layout>
                </ProtectedRoute>
              }
            />

            {/* Admin-Only Routes */}
            <Route
              path="/import"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Layout><ImportCsv /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/report/:id"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Layout><ImportReport /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/anomalies"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Layout><Anomalies /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Layout><AuditLogs /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/exchange-rates"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Layout><ExchangeRates /></Layout>
                </ProtectedRoute>
              }
            />

            {/* Catch-All */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
