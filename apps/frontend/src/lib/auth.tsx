import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'super_admin' | 'dean' | 'principal' | 'teacher' | 'accountant';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  must_change_password: boolean;
  avatar?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Bump this whenever the stored auth shape changes — forces a clean re-login
const SESSION_VERSION = '2';

function clearSession() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

function loadStoredUser(): AuthUser | null {
  try {
    // Invalidate old sessions from previous code versions
    if (localStorage.getItem('session_version') !== SESSION_VERSION) {
      clearSession();
      localStorage.setItem('session_version', SESSION_VERSION);
      return null;
    }
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AuthUser;
    // Validate the stored object has the required fields
    if (!parsed?.id || !parsed?.role || !parsed?.email) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('session_version') === SESSION_VERSION
      ? localStorage.getItem('token')
      : null
  );

  // Keep session_version in sync
  useEffect(() => {
    if (localStorage.getItem('session_version') !== SESSION_VERSION) {
      clearSession();
      localStorage.setItem('session_version', SESSION_VERSION);
    }
  }, []);

  const setAuth = (user: AuthUser, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    localStorage.setItem('session_version', SESSION_VERSION);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout, isAuthenticated: !!user && !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
