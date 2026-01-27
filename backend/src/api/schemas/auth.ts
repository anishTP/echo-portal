import { z } from 'zod';

/**
 * OAuth provider enum
 */
export const OAuthProviderSchema = z.enum(['github', 'google']);

/**
 * Login initiation schema
 */
export const LoginInitiateSchema = z.object({
  provider: OAuthProviderSchema,
  redirectTo: z.string().url().optional(),
});

/**
 * OAuth callback schema
 */
export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  codeVerifier: z.string().optional(), // Required for Google OAuth PKCE
});

/**
 * Session validation response schema
 */
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: z.string(),
  expiresAt: z.date().or(z.string()),
  lastActivityAt: z.date().or(z.string()),
  createdAt: z.date().or(z.string()),
});

/**
 * Current user response schema
 */
export const CurrentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().url().optional(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
});

/**
 * Login attempt schema
 */
export const LoginAttemptSchema = z.object({
  identifier: z.string().email(),
  attemptedAt: z.date().or(z.string()),
  success: z.boolean(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Account lock status schema
 */
export const AccountLockStatusSchema = z.object({
  locked: z.boolean(),
  lockedUntil: z.date().or(z.string()).optional(),
  attemptsRemaining: z.number().int().min(0).optional(),
  message: z.string().optional(),
});

/**
 * Session list schema
 */
export const SessionListSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
      lastActivityAt: z.date().or(z.string()),
      createdAt: z.date().or(z.string()),
      expiresAt: z.date().or(z.string()),
      isCurrent: z.boolean().optional(),
    })
  ),
});

/**
 * Session revocation schema
 */
export const SessionRevocationSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

/**
 * Logout schema
 */
export const LogoutSchema = z.object({
  allSessions: z.boolean().optional().default(false),
});

/**
 * OAuth health status schema
 */
export const OAuthHealthSchema = z.object({
  provider: OAuthProviderSchema,
  available: z.boolean(),
  state: z.enum(['healthy', 'degraded', 'unavailable']),
  retryAfter: z.number().optional(),
  message: z.string().optional(),
});

/**
 * OAuth health check response
 */
export const OAuthHealthResponseSchema = z.object({
  providers: z.record(OAuthProviderSchema, OAuthHealthSchema),
  timestamp: z.date().or(z.string()),
});

// Export types
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
export type LoginInitiate = z.infer<typeof LoginInitiateSchema>;
export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type LoginAttempt = z.infer<typeof LoginAttemptSchema>;
export type AccountLockStatus = z.infer<typeof AccountLockStatusSchema>;
export type SessionList = z.infer<typeof SessionListSchema>;
export type SessionRevocation = z.infer<typeof SessionRevocationSchema>;
export type Logout = z.infer<typeof LogoutSchema>;
export type OAuthHealth = z.infer<typeof OAuthHealthSchema>;
export type OAuthHealthResponse = z.infer<typeof OAuthHealthResponseSchema>;
