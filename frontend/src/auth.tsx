import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

export type UserRole = 'parent' | 'teacher' | 'admin' | 'md';
export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginStaff: (email: string, password: string) => Promise<User>;
  sendOtp: (phone: string) => Promise<{ debug_otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await api<User>('/auth/me');
          setUser(me);
        }
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loginStaff(email: string, password: string) {
    const res = await api<{ access_token: string; user: User }>('/auth/staff/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }

  async function sendOtp(phone: string) {
    return api<{ message: string; debug_otp?: string }>('/auth/parent/send-otp', {
      method: 'POST',
      body: { phone },
      auth: false,
    });
  }

  async function verifyOtp(phone: string, otp: string) {
    const res = await api<{ access_token: string; user: User }>('/auth/parent/verify-otp', {
      method: 'POST',
      body: { phone, otp },
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    await setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
      await setToken(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginStaff, sendOtp, verifyOtp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
