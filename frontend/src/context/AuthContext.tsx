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
  login: (provider: 'github' | 'google') => Promise<void>;
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
        // Backend returns { user: {...}, sessionId: '...' }
        const userData = data.user;
        setUser({
          id: userData.id,
          email: userData.email,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          roles: userData.roles,
          role: userData.roles[0], // Primary role
        });
        setSession({ id: data.sessionId, ...userData });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(provider: 'github' | 'google') {
    try {
      // Get OAuth authorization URL from backend
      const response = await fetch(`/api/v1/auth/login/${provider}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to OAuth provider
        window.location.href = data.url;
      } else {
        const error = await response.json();
        console.error('Login failed:', error);
        // Could show user-friendly error message here
      }
    } catch (error) {
      console.error('Login error:', error);
      // Could show user-friendly error message here
    }
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
        const userData = data.user;
        setUser({
          id: userData.id,
          email: userData.email,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          roles: userData.roles,
          role: userData.roles[0],
        });
        setSession({ id: data.sessionId, ...userData });
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
        setSessions(data.sessions || []);
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
