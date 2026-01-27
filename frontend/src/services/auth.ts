import { apiClient } from './api';
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
    const response = await apiClient(`/auth/login/${provider}`, {
      method: 'POST',
    });
    return response.data;
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

    const response = await apiClient(`/auth/callback/${provider}?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
  },

  /**
   * Get current authenticated user
   */
  async me(): Promise<CurrentUser> {
    const response = await apiClient('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
  },

  /**
   * Logout (revoke current or all sessions)
   */
  async logout(allSessions = false): Promise<void> {
    await apiClient('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allSessions }),
    });
  },

  /**
   * List active sessions for current user
   */
  async listSessions(): Promise<Session[]> {
    const response = await apiClient('/auth/sessions', {
      method: 'GET',
      credentials: 'include',
    });
    return response.data.sessions || [];
  },

  /**
   * Revoke a specific session by ID
   */
  async revokeSession(sessionId: string): Promise<void> {
    await apiClient(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },

  /**
   * Check OAuth provider health
   */
  async checkOAuthHealth(): Promise<OAuthHealthResponse> {
    const response = await apiClient('/auth/health', {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
  },

  /**
   * Refresh current session (validate and extend)
   */
  async refreshSession(): Promise<CurrentUser> {
    const response = await apiClient('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
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

    const response = await apiClient(`/users?${queryParams.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
  },

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<CurrentUser> {
    const response = await apiClient(`/users/${userId}`, {
      method: 'GET',
      credentials: 'include',
    });
    return response.data;
  },

  /**
   * Change user role (admin only)
   */
  async changeRole(userId: string, newRole: RoleType, reason?: string): Promise<void> {
    await apiClient(`/users/${userId}/role`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRole, reason }),
    });
  },

  /**
   * Update user status (admin only)
   */
  async updateStatus(userId: string, isActive: boolean, reason?: string): Promise<void> {
    await apiClient(`/users/${userId}/status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive, reason }),
    });
  },

  /**
   * Unlock user account (admin only)
   */
  async unlockAccount(userId: string, reason?: string): Promise<void> {
    await apiClient(`/users/${userId}/unlock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },
};
