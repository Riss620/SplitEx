import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setAccessToken } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Member';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Attempt to refresh
      const data = await apiRequest('/auth/refresh', { method: 'POST', skipAuth: true });
      if (data.success) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
    } catch (err) {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        skipAuth: true,
      });
      if (data.success) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (regData: { email: string; password: string; name: string; role?: string }) => {
    setLoading(true);
    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(regData),
        skipAuth: true,
      });
      if (data.success) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen to token expiry event from API client
    const handleAuthExpired = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
