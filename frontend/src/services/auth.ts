import { api } from './api';
import type { RoleType } from '@echo-portal/shared';

/**
 * Current user response
 */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: RoleType;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Session information
 */
export interface Session {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

/**
 * OAuth provider health status
 */
export interface OAuthProviderHealth {
  provider: 'github' | 'google';
  available: boolean;
  state: 'healthy' | 'degraded' | 'unavailable';
  retryAfter?: number;
  message?: string;
}

/**
 * OAuth health check response
 */
export interface OAuthHealthResponse {
  providers: Record<'github' | 'google', OAuthProviderHealth>;
  timestamp: string;
}

/**
 * Authentication service
 */
export const authService = {
  /**
   * Initiate OAuth login flow
   */
  async initiateLogin(provider: 'github' | 'google'): Promise<{ redirectUrl: string }> {
    return await api.post<{ redirectUrl: string }>(`/auth/login/${provider}`);
  },

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    provider: 'github' | 'google',
    code: string,
    state: string,
    codeVerifier?: string
  ): Promise<CurrentUser> {
    const params = new URLSearchParams({ code, state });
    if (codeVerifier) {
      params.append('codeVerifier', codeVerifier);
    }
    return await api.get<CurrentUser>(`/auth/callback/${provider}?${params.toString()}`);
  },

  /**
   * Get current authenticated user
   */
  async me(): Promise<CurrentUser> {
    return await api.get<CurrentUser>('/auth/me');
  },

  /**
   * Logout (revoke current or all sessions)
   */
  async logout(allSessions = false): Promise<void> {
    await api.post<void>('/auth/logout', { allSessions });
  },

  /**
   * List active sessions for current user
   */
  async listSessions(): Promise<Session[]> {
    const response = await api.get<{ sessions: Session[] }>('/auth/sessions');
    return response.sessions || [];
  },

  /**
   * Revoke a specific session by ID
   */
  async revokeSession(sessionId: string): Promise<void> {
    await api.delete<void>(`/auth/sessions/${sessionId}`);
  },

  /**
   * Check OAuth provider health
   */
  async checkOAuthHealth(): Promise<OAuthHealthResponse> {
    return await api.get<OAuthHealthResponse>('/auth/health');
  },

  /**
   * Refresh current session (validate and extend)
   */
  async refreshSession(): Promise<CurrentUser> {
    return await api.get<CurrentUser>('/auth/me');
  },
};

/**
 * User management service (admin only)
 */
export const userService = {
  /**
   * List users
   */
  async listUsers(params?: {
    role?: RoleType;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'lastLoginAt' | 'displayName' | 'email';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    users: CurrentUser[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    return await api.get<{
      users: CurrentUser[];
      total: number;
      limit: number;
      offset: number;
    }>(`/users?${queryParams.toString()}`);
  },

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<CurrentUser> {
    return await api.get<CurrentUser>(`/users/${userId}`);
  },

  /**
   * Change user role (admin only)
   */
  async changeRole(userId: string, newRole: RoleType, reason?: string): Promise<void> {
    await api.patch<void>(`/users/${userId}/role`, { newRole, reason });
  },

  /**
   * Update user status (admin only)
   */
  async updateStatus(userId: string, isActive: boolean, reason?: string): Promise<void> {
    await api.patch<void>(`/users/${userId}/status`, { isActive, reason });
  },

  /**
   * Unlock user account (admin only)
   */
  async unlockAccount(userId: string, reason?: string): Promise<void> {
    await api.post<void>(`/users/${userId}/unlock`, { reason });
  },
};
