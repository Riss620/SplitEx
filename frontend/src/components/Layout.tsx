import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Receipt,
  HandCoins,
  FileSpreadsheet,
  AlertTriangle,
  FileClock,
  User,
  LogOut,
  Menu,
  X,
  Wallet,
  DollarSign
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/groups', label: 'Groups', icon: Users },
    { to: '/expenses', label: 'Expenses', icon: Receipt },
    { to: '/settlements', label: 'Settlements', icon: HandCoins },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const adminLinks = [
    { to: '/import', label: 'CSV Import', icon: FileSpreadsheet },
    { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
    { to: '/exchange-rates', label: 'Exchange Rates', icon: DollarSign },
    { to: '/audit-logs', label: 'Audit Logs', icon: FileClock },
  ];

  const LinkItem = ({ link }: { link: typeof navLinks[0] }) => {
    const Icon = link.icon;
    return (
      <NavLink
        to={link.to}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            isActive
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`
        }
      >
        <Icon className="h-5 w-5" />
        {link.label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg text-gradient">
          <Wallet className="h-6 w-6 text-primary" />
          <span>SplitEx</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card/60 backdrop-blur-md border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl text-gradient">
            <Wallet className="h-6 w-6 text-primary" />
            <span>SplitEx</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Menu
            </p>
            {navLinks.map((link) => (
              <LinkItem key={link.to} link={link} />
            ))}
          </div>

          {user?.role === 'Admin' && (
            <div className="space-y-1">
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Admin Console
              </p>
              {adminLinks.map((link) => (
                <LinkItem key={link.to} link={link} />
              ))}
            </div>
          )}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-4 border-t border-border bg-card/40">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="truncate">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                  user?.role === 'Admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};
