import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { RoleType } from '@echo-portal/shared';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: RoleType[];
  role: RoleType; // Single role (new auth system)
}

interface Session {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  sessions: Session[];
  login: (provider: 'github' | 'google') => void;
  loginDev: () => void;
  logout: (allSessions?: boolean) => Promise<void>;
  hasRole: (role: RoleType) => boolean;
  hasAnyRole: (...roles: RoleType[]) => boolean;
  refreshSession: () => Promise<void>;
  listSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
}

// Mock user for development
const DEV_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@example.com',
  displayName: 'Dev User',
  roles: ['contributor', 'reviewer', 'administrator'],
  role: 'administrator',
};

const SESSION_CHECK_INTERVAL = 30000; // 30 seconds for role change detection

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    // Check for existing session on mount
    checkAuth();

    // Set up periodic session validation (30s interval for role change detection)
    const intervalId = setInterval(() => {
      if (user) {
        refreshSession();
      }
    }, SESSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user]);

  async function checkAuth() {
    // Check for dev auth first
    if (localStorage.getItem('dev_auth') === 'true') {
      setUser(DEV_USER);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function login(provider: 'github' | 'google') {
    // Redirect to OAuth flow
    window.location.href = `/api/v1/auth/login/${provider}`;
  }

  function loginDev() {
    // Mock login for development
    setUser(DEV_USER);
    localStorage.setItem('dev_auth', 'true');
  }

  async function logout(allSessions = false) {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allSessions }),
      });
    } catch {
      // Ignore errors
    } finally {
      setUser(null);
      setSession(null);
      setSessions([]);
      localStorage.removeItem('dev_auth');
    }
  }

  async function refreshSession() {
    // Don't refresh dev auth
    if (localStorage.getItem('dev_auth') === 'true') {
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
      } else if (response.status === 401) {
        // Session expired
        setUser(null);
        setSession(null);
        setSessions([]);
      }
    } catch {
      // Ignore errors
    }
  }

  async function listSessions() {
    if (localStorage.getItem('dev_auth') === 'true') {
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/sessions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.data.sessions || []);
      }
    } catch {
      // Ignore errors
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      // Refresh session list
      await listSessions();
    } catch (error) {
      console.error('Failed to revoke session:', error);
      throw error;
    }
  }

  function hasRole(role: RoleType): boolean {
    return user?.roles.includes(role) ?? false;
  }

  function hasAnyRole(...roles: RoleType[]): boolean {
    return roles.some((role) => user?.roles.includes(role));
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    session,
    sessions,
    login,
    loginDev,
    logout,
    hasRole,
    hasAnyRole,
    refreshSession,
    listSessions,
    revokeSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
