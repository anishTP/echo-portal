import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { RoleType } from '@echo-portal/shared';
import { validateSession } from '../../services/auth/session';
import { getCookie } from 'hono/cookie';
import { PermissionDenials } from '../utils/errors.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  role: RoleType;
  roles: RoleType[]; // For backward compatibility
  isActive: boolean;
}

export interface AuthEnv {
  Variables: {
    user: AuthUser | null;
    sessionId: string | null;
  };
}

const SESSION_COOKIE_NAME = 'echo_session';

/**
 * Middleware to extract user from session cookie
 * Validates session and sets ctx.user if authenticated
 * Implements 24-hour sliding expiry (FR-004)
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
  // Try cookie-based session first (primary method)
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionToken) {
    try {
      const session = await validateSession(sessionToken);

      if (session) {
        // Fetch full user details to populate email and verify active status
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (user && user.isActive) {
          c.set('user', {
            id: user.id,
            email: user.email, // Now properly populated from database
            role: session.role,
            roles: [session.role],
            isActive: user.isActive,
          });
          c.set('sessionId', session.id);
          return next();
        } else if (user && !user.isActive) {
          console.warn('[AUTH] Inactive user attempted access', { userId: user.id });
        }
      }
    } catch (error) {
      console.error('[AUTH] Session validation error:', error);
    }
  }

  // Fallback: Bearer token for API access (backward compatibility)
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Try validating as session token
    try {
      const session = await validateSession(token);

      if (session) {
        // Fetch full user details
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (user && user.isActive) {
          c.set('user', {
            id: user.id,
            email: user.email, // Populated from database
            role: session.role,
            roles: [session.role],
            isActive: user.isActive,
          });
          c.set('sessionId', session.id);
          return next();
        }
      }
    } catch (error) {
      // Invalid token
    }
  }

  // No valid authentication found
  c.set('user', null);
  c.set('sessionId', null);
  return next();
});

/**
 * Middleware to require authentication
 * Returns 401 if not authenticated
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
  const user = c.get('user');

  if (!user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
      401
    );
  }

  // Check if user is active
  if (!user.isActive) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      },
      403
    );
  }

  return next();
});

/**
 * Middleware to require specific roles
 */
export function requireRoles(...requiredRoles: RoleType[]) {
  return createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        401
      );
    }

    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRequiredRole) {
      // Use PermissionDenials helper for comprehensive error
      const actionMap: Record<string, string> = {
        administrator: 'perform administrative actions',
        reviewer: 'review branches',
        contributor: 'contribute to branches',
        viewer: 'view content',
      };

      const requiredRole = requiredRoles[0]; // Primary required role
      const action = actionMap[requiredRole] || 'perform this action';

      throw PermissionDenials.insufficientRole(
        user.role,
        requiredRole,
        action
      );
    }

    return next();
  });
}

/**
 * Middleware to allow optional authentication
 * Does not return error if not authenticated, but populates user if available
 */
export const optionalAuth = authMiddleware;

/**
 * Get session cookie name (for external use)
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
