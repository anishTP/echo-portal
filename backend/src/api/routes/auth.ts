import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users, sessions, loginAttempts } from '../../db/schema/index.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getAuthorizationURL, validateCallback, type OAuthProvider } from '../../services/auth/oauth.js';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeSessionByToken,
  getUserSessions,
} from '../../services/auth/session.js';
import { requireAuth, type AuthEnv, getSessionCookieName } from '../middleware/auth.js';
import { logAudit } from '../../services/audit/logger.js';
import { randomBytes } from 'crypto';

const authRoutes = new Hono<AuthEnv>();

// OAuth state management (in-memory for MVP, should use Redis in production)
interface OAuthState {
  provider: OAuthProvider;
  codeVerifier?: string;
  createdAt: number;
}

const oauthStates = new Map<string, OAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      oauthStates.delete(state);
    }
  }
}, 60 * 1000); // Every minute

// Session configuration
const SESSION_COOKIE_NAME = getSessionCookieName();

// Detect if running on localhost for development
const isLocalhost =
  process.env.FRONTEND_URL?.includes('localhost') ||
  process.env.FRONTEND_URL?.includes('127.0.0.1') ||
  process.env.NODE_ENV !== 'production';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // For localhost: secure=false allows sameSite=lax on HTTP
  // For production: secure=true required for sameSite=none on HTTPS
  secure: !isLocalhost,
  // For localhost: sameSite=lax works for OAuth (top-level GET navigation)
  // For production: sameSite=none required for cross-origin OAuth
  sameSite: (isLocalhost ? 'lax' : 'none') as 'lax' | 'none',
  // Set domain to 'localhost' to work across all localhost ports (3001, 5173, etc)
  // In production, omit domain to default to current host
  domain: isLocalhost ? 'localhost' : undefined,
  path: '/',
  maxAge: 24 * 60 * 60, // 24 hours
};

// Login attempt tracking (FR-005a, FR-005b)
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if user is locked out and return lockout info
 */
async function checkAccountLockout(email: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  failedAttempts?: number;
}> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return {
      isLocked: true,
      lockedUntil: new Date(user.lockedUntil),
    };
  }

  // Check recent failed attempts
  const cutoff = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const recentFailures = await db
    .select()
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, cutoff)
      )
    );

  return {
    isLocked: false,
    failedAttempts: recentFailures.length,
  };
}

/**
 * Record login attempt and handle lockout logic
 */
async function recordLoginAttempt(
  email: string,
  provider: OAuthProvider,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  failureReason?: string
): Promise<void> {
  // Record attempt (FR-005b)
  await db.insert(loginAttempts).values({
    email,
    provider,
    success,
    ipAddress,
    userAgent,
    failureReason,
  });

  if (!success) {
    // Check if we need to lock the account
    const cutoff = new Date(Date.now() - ATTEMPT_WINDOW_MS);
    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.email, email),
          eq(loginAttempts.success, false),
          gte(loginAttempts.attemptedAt, cutoff)
        )
      );

    if (recentFailures.length >= LOCKOUT_THRESHOLD) {
      // Lock the account (FR-005a)
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await db
        .update(users)
        .set({
          lockedUntil,
          failedLoginCount: recentFailures.length,
          lastFailedLoginAt: new Date(),
        })
        .where(eq(users.email, email));

      // Log audit event
      await logAudit({
        action: 'auth.locked',
        actorId: 'system',
        actorType: 'system',
        resourceId: email,
        resourceType: 'user',
        outcome: 'success',
        metadata: {
          reason: 'excessive_failed_attempts',
          failedAttempts: recentFailures.length,
          lockedUntil: lockedUntil.toISOString(),
        },
      });
    } else {
      // Update failed login count
      await db
        .update(users)
        .set({
          failedLoginCount: recentFailures.length,
          lastFailedLoginAt: new Date(),
        })
        .where(eq(users.email, email));
    }
  } else {
    // Reset failed login count on successful login
    await db
      .update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.email, email));
  }
}

/**
 * Find or create user from OAuth info
 */
async function findOrCreateUser(
  oauthInfo: { id: string; email: string; name: string; avatarUrl?: string },
  provider: OAuthProvider
): Promise<{ id: string; email: string; roles: string[] }> {
  // Check if user exists by external ID and provider
  const [existingUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.externalId, oauthInfo.id), eq(users.provider, provider)))
    .limit(1);

  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      roles: existingUser.roles || [],
    };
  }

  // Check if user exists by email (same email, different provider)
  const [userByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, oauthInfo.email))
    .limit(1);

  if (userByEmail) {
    // Link this provider to existing account
    await db
      .update(users)
      .set({
        externalId: oauthInfo.id,
        provider: provider,
        displayName: oauthInfo.name,
        avatarUrl: oauthInfo.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userByEmail.id));

    return {
      id: userByEmail.id,
      email: userByEmail.email,
      roles: userByEmail.roles || [],
    };
  }

  // Create new user (default role: contributor)
  const [newUser] = await db
    .insert(users)
    .values({
      externalId: oauthInfo.id,
      provider: provider,
      email: oauthInfo.email,
      displayName: oauthInfo.name,
      avatarUrl: oauthInfo.avatarUrl,
      roles: ['contributor'], // Default role
      isActive: true,
    })
    .returning();

  // Log audit event
  await logAudit({
    action: 'user.created',
    actorId: newUser.id,
    actorType: 'system',
    resourceId: newUser.id,
    resourceType: 'user',
    outcome: 'success',
    metadata: {
      provider,
      email: newUser.email,
    },
  });

  return {
    id: newUser.id,
    email: newUser.email,
    roles: newUser.roles || [],
  };
}

/**
 * T033: OAuth login initiation route
 * GET /auth/login/:provider
 */
authRoutes.get('/login/:provider', async (c) => {
  const provider = c.req.param('provider') as OAuthProvider;

  if (!['github', 'google'].includes(provider)) {
    return c.json(
      {
        error: 'Invalid provider',
        message: 'Supported providers: github, google',
      },
      400
    );
  }

  try {
    // Generate state for CSRF protection
    const state = randomBytes(32).toString('base64url');

    // Generate code verifier for PKCE (Google requires it)
    const codeVerifier = randomBytes(32).toString('base64url');

    // Store state
    oauthStates.set(state, {
      provider,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Get authorization URL from provider (T040: handles provider unavailability)
    const authUrl = await getAuthorizationURL(provider, state, codeVerifier);

    return c.json({
      url: authUrl.toString(),
      provider,
    });
  } catch (error) {
    console.error('OAuth login error:', error);

    // T040: OAuth graceful degradation
    if (error instanceof Error && error.name === 'OAuthProviderUnavailableError') {
      return c.json(
        {
          error: 'Provider unavailable',
          message: error.message,
          provider,
          canRetry: true,
        },
        503
      );
    }

    return c.json(
      {
        error: 'OAuth initiation failed',
        message: 'Failed to initiate OAuth flow',
        provider,
      },
      500
    );
  }
});

/**
 * T034: OAuth callback route
 * GET /auth/callback/:provider
 */
authRoutes.get('/callback/:provider', async (c) => {
  const provider = c.req.param('provider') as OAuthProvider;
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json(
      {
        error: 'Missing parameters',
        message: 'Code and state are required',
      },
      400
    );
  }

  // Validate state
  const storedState = oauthStates.get(state);
  if (!storedState || storedState.provider !== provider) {
    return c.json(
      {
        error: 'Invalid state',
        message: 'OAuth state validation failed',
      },
      400
    );
  }

  // Clean up used state
  oauthStates.delete(state);

  // Get client info
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
  const userAgent = c.req.header('user-agent');

  try {
    // Exchange code for tokens and get user info (T040: handles provider unavailability)
    const oauthUserInfo = await validateCallback(provider, code, storedState.codeVerifier);

    // Check account lockout (FR-005a)
    const lockoutStatus = await checkAccountLockout(oauthUserInfo.email);
    if (lockoutStatus.isLocked) {
      await recordLoginAttempt(
        oauthUserInfo.email,
        provider,
        false,
        ipAddress,
        userAgent,
        'account_locked'
      );

      const remainingMs = lockoutStatus.lockedUntil
        ? lockoutStatus.lockedUntil.getTime() - Date.now()
        : 0;
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      return c.json(
        {
          error: 'Account locked',
          message: `Account is temporarily locked due to excessive failed login attempts. Please try again in ${remainingMinutes} minutes.`,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
          remainingMinutes,
        },
        423
      );
    }

    // Find or create user
    const user = await findOrCreateUser(oauthUserInfo, provider);

    // Create session
    const session = await createSession(user.id, provider, userAgent, ipAddress);

    // Record successful login attempt (FR-005b)
    await recordLoginAttempt(oauthUserInfo.email, provider, true, ipAddress, userAgent);

    // Log audit event (FR-020)
    await logAudit({
      action: 'auth.login',
      actorId: user.id,
      actorType: 'user',
      resourceId: session.id,
      resourceType: 'session',
      outcome: 'success',
      actorIp: ipAddress,
      actorUserAgent: userAgent,
      metadata: {
        provider,
      },
    });

    // Set session cookie
    setCookie(c, SESSION_COOKIE_NAME, session.token, SESSION_COOKIE_OPTIONS);

    // Debug logging for cookie troubleshooting
    console.log('[AUTH] Session cookie set', {
      sessionId: session.id,
      userId: user.id,
      cookieName: SESSION_COOKIE_NAME,
      domain: SESSION_COOKIE_OPTIONS.domain || '(current host)',
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      secure: SESSION_COOKIE_OPTIONS.secure,
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      environment: process.env.NODE_ENV,
      isLocalhost,
      frontendUrl: process.env.FRONTEND_URL,
    });

    // Redirect to frontend
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return c.redirect(`${redirectUrl}/auth/callback?success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);

    // Record failed attempt
    await recordLoginAttempt(
      'unknown',
      provider,
      false,
      ipAddress,
      userAgent,
      error instanceof Error ? error.message : 'unknown_error'
    );

    // T040: OAuth graceful degradation
    if (error instanceof Error && error.name === 'OAuthProviderUnavailableError') {
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return c.redirect(
        `${redirectUrl}/auth/callback?error=provider_unavailable&message=${encodeURIComponent(error.message)}`
      );
    }

    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return c.redirect(`${redirectUrl}/auth/callback?error=auth_failed`);
  }
});

/**
 * T035: /auth/me endpoint
 * GET /auth/me
 */
authRoutes.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user');
  const sessionId = c.get('sessionId');

  if (!authUser) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  // Fetch full user details
  const [user] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);

  if (!user) {
    return c.json(
      {
        error: 'User not found',
        message: 'User record not found',
      },
      404
    );
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
    },
    sessionId,
  });
});

/**
 * T036: /auth/logout endpoint
 * POST /auth/logout
 */
authRoutes.post('/logout', requireAuth, async (c) => {
  const authUser = c.get('user');
  const sessionId = c.get('sessionId');

  if (sessionId) {
    // Revoke session
    await revokeSession(sessionId);

    // Log audit event (FR-020)
    await logAudit({
      action: 'auth.logout',
      actorId: authUser?.id || 'unknown',
      actorType: 'user',
      resourceId: sessionId,
      resourceType: 'session',
      outcome: 'success',
    });
  }

  // Clear session cookie
  deleteCookie(c, SESSION_COOKIE_NAME);

  return c.json({
    message: 'Logged out successfully',
  });
});

/**
 * T037: /auth/sessions endpoint
 * GET /auth/sessions - List all active sessions for current user
 */
authRoutes.get('/sessions', requireAuth, async (c) => {
  const authUser = c.get('user');

  if (!authUser) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  const userSessions = await getUserSessions(authUser.id);

  return c.json({
    sessions: userSessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
    })),
  });
});

/**
 * T038: Session revocation endpoint
 * DELETE /auth/sessions/:sessionId
 */
authRoutes.delete('/sessions/:sessionId', requireAuth, async (c) => {
  const authUser = c.get('user');
  const sessionId = c.req.param('sessionId');

  if (!authUser) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  // Verify the session belongs to the current user
  const userSessions = await getUserSessions(authUser.id);
  const sessionToRevoke = userSessions.find((s) => s.id === sessionId);

  if (!sessionToRevoke) {
    return c.json(
      {
        error: 'Session not found',
        message: 'Session does not exist or does not belong to you',
      },
      404
    );
  }

  // Revoke the session
  await revokeSession(sessionId);

  // Log audit event
  await logAudit({
    action: 'session.revoked',
    actorId: authUser.id,
    actorType: 'user',
    resourceId: sessionId,
    resourceType: 'session',
    outcome: 'success',
  });

  return c.json({
    message: 'Session revoked successfully',
    sessionId,
  });
});

export { authRoutes };
