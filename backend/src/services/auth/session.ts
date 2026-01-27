import { eq, and, lt, gt, desc } from 'drizzle-orm';
import { db } from '../../db';
import { sessions, users } from '../../db/schema';
import type { Session as SharedSession, RoleType } from '@echo-portal/shared';
import { randomBytes } from 'crypto';

// Extended session type with role for backend use
export interface Session extends SharedSession {
  role: RoleType;
}

// Session configuration
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CACHE_TTL_MS = 30 * 1000; // 30 seconds for role change propagation

// In-memory cache for session validation
interface CachedSession {
  session: Session;
  cachedAt: number;
}

const sessionCache = new Map<string, CachedSession>();

/**
 * Generate a cryptographically secure session token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  provider: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [session] = await db
    .insert(sessions)
    .values({
      id: randomBytes(16).toString('hex'),
      userId,
      token,
      provider,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      lastActivityAt: new Date(),
    })
    .returning();

  // Fetch user details to include role in session
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const sessionWithRole: Session = {
    id: session.id,
    userId: session.userId,
    token: session.token,
    provider: session.provider as 'github' | 'google',
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent || undefined,
    ipAddress: session.ipAddress || undefined,
    lastActivityAt: session.lastActivityAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString(),
    role: user.roles[0] || 'viewer',
  };

  // Cache the session
  sessionCache.set(token, {
    session: sessionWithRole,
    cachedAt: Date.now(),
  });

  return sessionWithRole;
}

/**
 * Validate a session token and return the session if valid
 * Uses 30-second cache to improve performance and support role change propagation (SC-007)
 */
export async function validateSession(token: string): Promise<Session | null> {
  // Check cache first
  const cached = sessionCache.get(token);
  if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    // Update sliding expiry in background (don't await)
    updateSessionActivity(cached.session.id).catch(() => {
      // Ignore errors in background activity update
    });
    return cached.session;
  }

  // Fetch from database
  const [sessionRecord] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!sessionRecord) {
    sessionCache.delete(token);
    return null;
  }

  const { session, user } = sessionRecord;

  // Check if session is expired
  if (new Date(session.expiresAt) < new Date()) {
    await revokeSession(session.id);
    sessionCache.delete(token);
    return null;
  }

  // Check if user is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return null;
  }

  const validSession: Session = {
    id: session.id,
    userId: session.userId,
    token: session.token,
    provider: session.provider as 'github' | 'google',
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent || undefined,
    ipAddress: session.ipAddress || undefined,
    lastActivityAt: session.lastActivityAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString(),
    role: user.roles[0] || 'viewer',
  };

  // Update cache
  sessionCache.set(token, {
    session: validSession,
    cachedAt: Date.now(),
  });

  // Update sliding expiry (24h from last activity)
  await updateSessionActivity(session.id);

  return validSession;
}

/**
 * Update session activity timestamp and extend expiry (sliding window)
 */
async function updateSessionActivity(sessionId: string): Promise<void> {
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({
      lastActivityAt: new Date(),
      expiresAt: newExpiresAt,
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Revoke a session by ID
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (session) {
    sessionCache.delete(session.token);
  }

  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Revoke a session by token
 */
export async function revokeSessionByToken(token: string): Promise<void> {
  sessionCache.delete(token);
  await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  // Clear cache entries for this user
  const userSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId));

  for (const session of userSessions) {
    sessionCache.delete(session.token);
  }

  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const sessionRecords = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastActivityAt));

  return sessionRecords.map(({ session, user }) => ({
    id: session.id,
    userId: session.userId,
    token: session.token,
    provider: session.provider as 'github' | 'google',
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent || undefined,
    ipAddress: session.ipAddress || undefined,
    lastActivityAt: session.lastActivityAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString(),
    role: user.roles[0] || 'viewer',
  }));
}

/**
 * Invalidate session cache for a user (used when role changes)
 */
export function invalidateUserSessionCache(userId: string): void {
  // Remove all cached sessions for this user
  for (const [token, cached] of sessionCache.entries()) {
    if (cached.session.userId === userId) {
      sessionCache.delete(token);
    }
  }
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning();

  // Clear cache for expired sessions
  for (const [token, cached] of sessionCache.entries()) {
    if (new Date(cached.session.expiresAt) < new Date()) {
      sessionCache.delete(token);
    }
  }

  return result.length;
}
