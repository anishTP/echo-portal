import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { RoleType } from '@echo-portal/shared';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: RoleType[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: 'github' | 'google') => void;
  loginDev: () => void;
  logout: () => void;
  hasRole: (role: RoleType) => boolean;
  hasAnyRole: (...roles: RoleType[]) => boolean;
}

// Mock user for development
const DEV_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@example.com',
  displayName: 'Dev User',
  roles: ['contributor', 'reviewer', 'publisher', 'administrator'],
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkAuth();
  }, []);

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

  async function logout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    } finally {
      setUser(null);
      localStorage.removeItem('dev_auth');
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
    login,
    loginDev,
    logout,
    hasRole,
    hasAnyRole,
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
