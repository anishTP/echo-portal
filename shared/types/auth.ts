/**
 * OAuth provider types
 */
export type OAuthProvider = 'github' | 'google';

/**
 * All authentication provider types (OAuth + email)
 */
export type AuthProviderType = OAuthProvider | 'email';

/**
 * Session representation
 * Sessions use 24-hour sliding expiry (reset on each authenticated request)
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  provider: AuthProviderType;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt?: string;
}

/**
 * Session creation input
 */
export interface SessionCreateInput {
  userId: string;
  provider: OAuthProvider;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Login attempt tracking (FR-005b)
 */
export interface LoginAttempt {
  id: string;
  email: string;
  provider: OAuthProvider;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  attemptedAt: string;
}

/**
 * Login attempt input
 */
export interface LoginAttemptInput {
  email: string;
  provider: OAuthProvider;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
}

/**
 * Auth state for frontend context
 */
export interface AuthState {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    roles: string[];
    provider?: AuthProviderType;
    emailVerified?: boolean;
  } | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
