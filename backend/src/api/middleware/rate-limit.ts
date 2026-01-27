import type { Context, Next } from 'hono';
import { db } from '../../db';
import { loginAttempts, users } from '../../db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Rate limit configuration
 */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Track a login attempt
 */
export async function trackLoginAttempt(
  identifier: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await db.insert(loginAttempts).values({
    identifier,
    attemptedAt: new Date(),
    success,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  // If failed, check if we need to lock the account
  if (!success) {
    await checkAndLockAccount(identifier);
  } else {
    // If successful, clear the lockout and reset failed login count
    await clearLockout(identifier);
  }
}

/**
 * Check if account should be locked based on failed attempts
 */
async function checkAndLockAccount(identifier: string): Promise<void> {
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);

  // Count recent failed attempts
  const recentAttempts = await db
    .select()
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.identifier, identifier),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, windowStart)
      )
    );

  const failedCount = recentAttempts.length;

  // Update user with failed login count and last failed attempt
  await db
    .update(users)
    .set({
      failedLoginCount: failedCount,
      lastFailedLoginAt: new Date(),
    })
    .where(eq(users.email, identifier));

  // Lock account if threshold exceeded
  if (failedCount >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await db
      .update(users)
      .set({
        lockedUntil,
      })
      .where(eq(users.email, identifier));
  }
}

/**
 * Clear account lockout and reset failed login count
 */
async function clearLockout(identifier: string): Promise<void> {
  await db
    .update(users)
    .set({
      lockedUntil: null,
      failedLoginCount: 0,
      lastFailedLoginAt: null,
    })
    .where(eq(users.email, identifier));
}

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(identifier: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
  attemptsRemaining?: number;
}> {
  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, identifier)).limit(1);

  if (!user) {
    // User doesn't exist yet (first login attempt)
    return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
  }

  // Check if locked and still within lockout period
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return {
      locked: true,
      lockedUntil: user.lockedUntil,
    };
  }

  // If lockout expired, clear it
  if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
    await clearLockout(identifier);
    return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
  }

  // Count recent failed attempts
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const recentFailedAttempts = await db
    .select()
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.identifier, identifier),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, windowStart)
      )
    );

  const attemptsRemaining = Math.max(0, MAX_LOGIN_ATTEMPTS - recentFailedAttempts.length);

  return {
    locked: false,
    attemptsRemaining,
  };
}

/**
 * Middleware to check rate limits before login
 */
export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Extract identifier (email) from request body
  const body = await c.req.json();
  const identifier = body.email || body.identifier;

  if (!identifier) {
    return c.json({ error: 'Email/identifier required' }, 400);
  }

  // Check if account is locked
  const lockStatus = await isAccountLocked(identifier);

  if (lockStatus.locked && lockStatus.lockedUntil) {
    const minutesRemaining = Math.ceil(
      (lockStatus.lockedUntil.getTime() - Date.now()) / (60 * 1000)
    );

    return c.json(
      {
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
        lockedUntil: lockStatus.lockedUntil.toISOString(),
        retryAfter: minutesRemaining * 60,
      },
      429
    );
  }

  // Store identifier in context for downstream handlers
  c.set('loginIdentifier', identifier);

  await next();
}

/**
 * Manually unlock a user account (admin function)
 */
export async function unlockAccount(identifier: string): Promise<void> {
  await clearLockout(identifier);
}

/**
 * Get login attempt history for a user (admin/audit function)
 */
export async function getLoginAttempts(
  identifier: string,
  limit = 10
): Promise<typeof loginAttempts.$inferSelect[]> {
  return db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .orderBy(loginAttempts.attemptedAt)
    .limit(limit);
}
