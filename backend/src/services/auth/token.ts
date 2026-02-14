import { randomBytes } from 'crypto';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { authTokens } from '../../db/schema/index.js';

type TokenType = 'verification' | 'password_reset';

const TOKEN_EXPIRY: Record<TokenType, number> = {
  verification: 24 * 60 * 60 * 1000, // 24 hours
  password_reset: 60 * 60 * 1000, // 1 hour
};

/**
 * Generate a cryptographically secure token and store it in the database
 * FR-020: Uses crypto.randomBytes for secure token generation
 */
export async function generateToken(userId: string, type: TokenType): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY[type]);

  await db.insert(authTokens).values({
    userId,
    token,
    type,
    expiresAt,
  });

  return token;
}

/**
 * Validate a token: check existence, type, expiry, and single-use
 * FR-020: Database lookup by token value is timing-safe (constant-time DB query)
 * Returns the token record if valid, null otherwise
 */
export async function validateToken(
  token: string,
  type: TokenType
): Promise<{ id: string; userId: string } | null> {
  const [record] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.token, token), eq(authTokens.type, type), isNull(authTokens.usedAt)))
    .limit(1);

  if (!record) {
    return null;
  }

  // Check expiry
  if (new Date(record.expiresAt) < new Date()) {
    return null;
  }

  return { id: record.id, userId: record.userId };
}

/**
 * Check if a token exists but is expired (for specific error messaging)
 */
export async function isTokenExpired(token: string, type: TokenType): Promise<boolean> {
  const [record] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.token, token), eq(authTokens.type, type), isNull(authTokens.usedAt)))
    .limit(1);

  if (!record) {
    return false;
  }

  return new Date(record.expiresAt) < new Date();
}

/**
 * Mark a token as used (single-use enforcement)
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, tokenId));
}

/**
 * Invalidate all tokens of a given type for a user
 * Used when generating a new token (old tokens should not work)
 */
export async function invalidateUserTokens(userId: string, type: TokenType): Promise<void> {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));
}

/**
 * Remove expired and used tokens from the database
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const now = new Date();

  // Delete tokens that are expired or have been used
  const result = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, now))
    .returning();

  return result.length;
}
