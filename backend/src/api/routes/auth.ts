import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users, sessions, loginAttempts } from '../../db/schema/index.js';
import { eq, desc, and, gte, lt } from 'drizzle-orm';
import { getAuthorizationURL, validateCallback, type OAuthProvider } from '../../services/auth/oauth.js';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeSessionByToken,
  revokeAllUserSessions,
  getUserSessions,
} from '../../services/auth/session.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../services/auth/password.js';
import { generateToken, validateToken, isTokenExpired, markTokenUsed, invalidateUserTokens, cleanupExpiredTokens } from '../../services/auth/token.js';
import { getEmailService } from '../../services/email/index.js';
import { verificationEmail, passwordResetEmail } from '../../services/email/templates.js';
import { rateLimit, signupLimiter, resendLimiter, resetLimiter } from '../middleware/auth-rate-limit.js';
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
  provider: OAuthProvider | 'email',
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
  // FR-024: Block login if email exists with a different provider (no auto-linking)
  const [userByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, oauthInfo.email))
    .limit(1);

  if (userByEmail) {
    throw Object.assign(
      new Error(`An account with this email already exists using ${userByEmail.provider} authentication.`),
      { name: 'ProviderConflictError', existingProvider: userByEmail.provider }
    );
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

// --- Zod schemas for email/password auth endpoints ---

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// --- Cleanup: unverified accounts (7 days) + expired tokens ---
const UNVERIFIED_ACCOUNT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function cleanupUnverifiedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - UNVERIFIED_ACCOUNT_TTL_MS);
  const result = await db
    .delete(users)
    .where(
      and(
        eq(users.provider, 'email'),
        eq(users.emailVerified, false),
        lt(users.createdAt, cutoff)
      )
    )
    .returning();
  return result.length;
}

// Scheduled cleanup alongside existing OAuth state cleanup
setInterval(async () => {
  try {
    const deletedAccounts = await cleanupUnverifiedAccounts();
    const deletedTokens = await cleanupExpiredTokens();
    if (deletedAccounts > 0 || deletedTokens > 0) {
      console.log('[AUTH] Cleanup:', { deletedAccounts, deletedTokens });
    }
  } catch (error) {
    console.error('[AUTH] Cleanup error:', error);
  }
}, 60 * 60 * 1000); // Every hour

// --- Email/Password Auth Endpoints ---

/**
 * T015: POST /auth/register — Create a new email/password account
 * FR-001, FR-002, FR-003, FR-013, FR-024
 */
authRoutes.post(
  '/register',
  rateLimit(signupLimiter, (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'),
  async (c) => {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { success: false, error: { message: 'Validation failed', details: parsed.error.flatten() } },
        400
      );
    }

    const { email, password, displayName } = parsed.data;

    // Validate password strength (3-of-4-types rule)
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return c.json(
        { success: false, error: { message: 'Password does not meet strength requirements. Must be at least 8 characters with 3 of 4 types: uppercase, lowercase, number, special character.', criteria: strength.criteria } },
        400
      );
    }

    // Check if email already exists (FR-024: single-provider-per-email)
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return c.json(
        { success: false, error: { message: 'An account with this email already exists' } },
        409
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        provider: 'email',
        email,
        displayName,
        passwordHash,
        emailVerified: false,
        roles: ['contributor'],
        isActive: true,
      })
      .returning();

    // Generate verification token and send email
    const token = await generateToken(newUser.id, 'verification');
    const emailContent = verificationEmail(token);
    const emailService = getEmailService();

    try {
      await emailService.sendMail({
        to: email,
        ...emailContent,
      });
    } catch (error) {
      console.error('[AUTH] Failed to send verification email:', error);
      // Don't fail the registration — user can resend later
    }

    // Audit log
    await logAudit({
      action: 'auth.register',
      actorId: newUser.id,
      actorType: 'user',
      resourceId: newUser.id,
      resourceType: 'user',
      outcome: 'success',
      metadata: { provider: 'email', email },
    });

    return c.json(
      { success: true, data: { message: 'Account created. Please check your email to verify your account.' } },
      201
    );
  }
);

/**
 * T016: POST /auth/login — Authenticate with email and password
 * FR-004, FR-005a/b, FR-006, FR-010
 */
authRoutes.post('/email-login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { message: 'Validation failed', details: parsed.error.flatten() } },
      400
    );
  }

  const { email, password } = parsed.data;
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
  const userAgent = c.req.header('user-agent');

  // Check lockout
  const lockoutStatus = await checkAccountLockout(email);
  if (lockoutStatus.isLocked) {
    const remainingMs = lockoutStatus.lockedUntil
      ? lockoutStatus.lockedUntil.getTime() - Date.now()
      : 0;
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return c.json(
      {
        success: false,
        error: {
          message: `Account is temporarily locked due to excessive failed login attempts. Please try again in ${remainingMinutes} minutes.`,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
          remainingMinutes,
        },
      },
      423
    );
  }

  // Find user by email + provider='email'
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.provider, 'email')))
    .limit(1);

  if (!user || !user.passwordHash) {
    // Record failed attempt (FR-010: generic error, don't reveal user existence)
    await recordLoginAttempt(email, 'email', false, ipAddress, userAgent, 'invalid_credentials');
    return c.json(
      { success: false, error: { message: 'Invalid email or password' } },
      401
    );
  }

  // Check if email is verified
  if (!user.emailVerified) {
    return c.json(
      { success: false, error: { message: 'Please verify your email address before logging in', needsVerification: true } },
      403
    );
  }

  // Check if user is active
  if (!user.isActive) {
    return c.json(
      { success: false, error: { message: 'Account has been deactivated' } },
      403
    );
  }

  // Verify password
  const isValid = await verifyPassword(user.passwordHash, password);
  if (!isValid) {
    await recordLoginAttempt(email, 'email', false, ipAddress, userAgent, 'invalid_password');
    return c.json(
      { success: false, error: { message: 'Invalid email or password' } },
      401
    );
  }

  // Create session
  const session = await createSession(user.id, 'email', userAgent, ipAddress);

  // Record successful login
  await recordLoginAttempt(email, 'email', true, ipAddress, userAgent);

  // Set session cookie
  setCookie(c, SESSION_COOKIE_NAME, session.token, SESSION_COOKIE_OPTIONS);

  // Audit log
  await logAudit({
    action: 'auth.login',
    actorId: user.id,
    actorType: 'user',
    resourceId: session.id,
    resourceType: 'session',
    outcome: 'success',
    actorIp: ipAddress,
    actorUserAgent: userAgent,
    metadata: { provider: 'email' },
  });

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        roles: user.roles,
        role: user.roles?.[0] || 'viewer',
      },
    },
  });
});

/**
 * T017: POST /auth/verify-email — Verify email address using token
 * FR-003, FR-009
 */
authRoutes.post('/verify-email', async (c) => {
  const body = await c.req.json();
  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { message: 'Validation failed' } },
      400
    );
  }

  const { token } = parsed.data;

  // Check if token is expired (for specific error messaging)
  const expired = await isTokenExpired(token, 'verification');
  if (expired) {
    return c.json(
      { success: false, error: { message: 'Verification link has expired. Please request a new one.' } },
      410
    );
  }

  // Validate token
  const tokenRecord = await validateToken(token, 'verification');
  if (!tokenRecord) {
    return c.json(
      { success: false, error: { message: 'Invalid or already-used verification token' } },
      400
    );
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, tokenRecord.userId));

  // Mark token as used
  await markTokenUsed(tokenRecord.id);

  // Audit log
  await logAudit({
    action: 'auth.verify_email',
    actorId: tokenRecord.userId,
    actorType: 'user',
    resourceId: tokenRecord.userId,
    resourceType: 'user',
    outcome: 'success',
  });

  return c.json({
    success: true,
    data: { message: 'Email verified successfully. You can now log in.' },
  });
});

/**
 * Health check endpoint for auth service
 * GET /auth/health
 */
authRoutes.get('/health', async (c) => {
  // Check if OAuth providers are configured
  const githubConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return c.json({
    status: 'ok',
    providers: {
      github: githubConfigured,
      google: googleConfigured,
    },
  });
});

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

    console.log('[AUTH] OAuth login initiated', {
      provider,
      authUrl: authUrl.toString(),
      state,
    });

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

  console.log('[AUTH] OAuth callback received', {
    provider,
    hasCode: !!code,
    hasState: !!state,
    url: c.req.url,
    method: c.req.method,
  });

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

    // FR-024: Provider conflict — email exists with different provider
    if (error instanceof Error && error.name === 'ProviderConflictError') {
      const existingProvider = (error as Error & { existingProvider?: string }).existingProvider || 'another method';
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return c.redirect(
        `${redirectUrl}/auth/callback?error=provider_conflict&existing_provider=${encodeURIComponent(existingProvider)}&message=${encodeURIComponent(error.message)}`
      );
    }

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

  // Use database roles, falling back to auth middleware roles if DB roles are empty
  const effectiveRoles = user.roles && user.roles.length > 0
    ? user.roles
    : authUser.roles;

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: effectiveRoles,
      isActive: user.isActive,
      provider: user.provider,
      emailVerified: user.emailVerified,
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

/**
 * T030: POST /auth/forgot-password — Request a password reset link
 * FR-007, FR-010, FR-012
 */
authRoutes.post(
  '/forgot-password',
  rateLimit(resetLimiter, (c) => {
    try {
      const body = c.req.raw.clone();
      // Rate limit by IP as fallback
      return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    } catch {
      return 'unknown';
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { success: false, error: { message: 'Validation failed' } },
        400
      );
    }

    const { email } = parsed.data;

    // Always return success to prevent account enumeration (FR-010)
    // Only actually send email if user exists with provider='email'
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.provider, 'email')))
      .limit(1);

    if (user) {
      // Invalidate previous reset tokens
      await invalidateUserTokens(user.id, 'password_reset');

      // Generate new reset token (1h expiry)
      const token = await generateToken(user.id, 'password_reset');
      const emailContent = passwordResetEmail(token);
      const emailService = getEmailService();

      try {
        await emailService.sendMail({
          to: email,
          ...emailContent,
        });
      } catch (error) {
        console.error('[AUTH] Failed to send password reset email:', error);
      }

      // Audit log
      await logAudit({
        action: 'auth.password_reset_requested',
        actorId: user.id,
        actorType: 'user',
        resourceId: user.id,
        resourceType: 'user',
        outcome: 'success',
      });
    }

    return c.json({
      success: true,
      data: { message: 'If an account exists with this email, a password reset link has been sent.' },
    });
  }
);

/**
 * T031: POST /auth/reset-password — Set a new password using a reset token
 * FR-008, FR-014, FR-020
 */
authRoutes.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { message: 'Validation failed' } },
      400
    );
  }

  const { token, password } = parsed.data;

  // Validate password strength
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return c.json(
      { success: false, error: { message: 'Password does not meet strength requirements. Must be at least 8 characters with 3 of 4 types: uppercase, lowercase, number, special character.' } },
      400
    );
  }

  // Validate token
  const tokenRecord = await validateToken(token, 'password_reset');
  if (!tokenRecord) {
    // Check if expired for specific messaging
    const expired = await isTokenExpired(token, 'password_reset');
    return c.json(
      { success: false, error: { message: expired ? 'Password reset link has expired. Please request a new one.' : 'Invalid or already-used reset token' } },
      400
    );
  }

  // Hash new password and update user
  const newPasswordHash = await hashPassword(password);
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, tokenRecord.userId));

  // Mark token as used
  await markTokenUsed(tokenRecord.id);

  // Revoke ALL sessions (FR-008)
  await revokeAllUserSessions(tokenRecord.userId);

  // Audit log
  await logAudit({
    action: 'auth.password_reset',
    actorId: tokenRecord.userId,
    actorType: 'user',
    resourceId: tokenRecord.userId,
    resourceType: 'user',
    outcome: 'success',
  });

  return c.json({
    success: true,
    data: { message: 'Password reset successfully. You can now log in with your new password.' },
  });
});

/**
 * T036: POST /auth/resend-verification — Resend verification email
 * FR-011
 */
authRoutes.post(
  '/resend-verification',
  rateLimit(resendLimiter, (c) => {
    try {
      return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    } catch {
      return 'unknown';
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { success: false, error: { message: 'Validation failed' } },
        400
      );
    }

    const { email } = parsed.data;

    // Always return success to prevent account enumeration
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.provider, 'email'), eq(users.emailVerified, false)))
      .limit(1);

    if (user) {
      // Invalidate old verification tokens
      await invalidateUserTokens(user.id, 'verification');

      // Generate new token
      const token = await generateToken(user.id, 'verification');
      const emailContent = verificationEmail(token);
      const emailService = getEmailService();

      try {
        await emailService.sendMail({
          to: email,
          ...emailContent,
        });
      } catch (error) {
        console.error('[AUTH] Failed to resend verification email:', error);
      }

      // Audit log
      await logAudit({
        action: 'auth.resend_verification',
        actorId: user.id,
        actorType: 'user',
        resourceId: user.id,
        resourceType: 'user',
        outcome: 'success',
      });
    }

    return c.json({
      success: true,
      data: { message: 'If an unverified account exists with this email, a new verification email has been sent.' },
    });
  }
);

/**
 * T037: PUT /auth/change-password — Change password while logged in
 * FR-023
 */
authRoutes.put('/change-password', requireAuth, async (c) => {
  const authUser = c.get('user');
  const currentSessionId = c.get('sessionId');

  if (!authUser) {
    return c.json(
      { success: false, error: { message: 'Authentication required' } },
      401
    );
  }

  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { message: 'Validation failed' } },
      400
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch user to check provider and password
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!user) {
    return c.json(
      { success: false, error: { message: 'User not found' } },
      404
    );
  }

  // Only email users can change password
  if (user.provider !== 'email' || !user.passwordHash) {
    return c.json(
      { success: false, error: { message: 'Password change is only available for email accounts' } },
      403
    );
  }

  // Verify current password
  const isValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!isValid) {
    return c.json(
      { success: false, error: { message: 'Current password is incorrect' } },
      403
    );
  }

  // Validate new password strength
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return c.json(
      { success: false, error: { message: 'New password does not meet strength requirements.' } },
      400
    );
  }

  // Hash and update password
  const newPasswordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Revoke all OTHER sessions (FR-023: keep current session)
  const allSessions = await getUserSessions(user.id);
  for (const s of allSessions) {
    if (s.id !== currentSessionId) {
      await revokeSession(s.id);
    }
  }

  // Audit log
  await logAudit({
    action: 'auth.password_changed',
    actorId: user.id,
    actorType: 'user',
    resourceId: user.id,
    resourceType: 'user',
    outcome: 'success',
  });

  return c.json({
    success: true,
    data: { message: 'Password changed successfully.' },
  });
});

export { authRoutes };
