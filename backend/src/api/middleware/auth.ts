import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { RoleType } from '@echo-portal/shared';
import { validateSession } from '../../services/auth/session';
import { getCookie } from 'hono/cookie';

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
        // Fetch user details from database to get email and isActive status
        // For now, we'll use the session data
        c.set('user', {
          id: session.userId,
          email: '', // Will be populated from user record
          role: session.role,
          roles: [session.role], // Simplified to single role
          isActive: true,
        });
        c.set('sessionId', session.id);
        return next();
      }
    } catch (error) {
      // Invalid session, continue without auth
      console.error('Session validation error:', error);
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
        c.set('user', {
          id: session.userId,
          email: '',
          role: session.role,
          roles: [session.role],
          isActive: true,
        });
        c.set('sessionId', session.id);
        return next();
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
      return c.json(
        {
          error: 'Forbidden',
          message: `Required role: ${requiredRoles.join(' or ')}`,
          code: 'INSUFFICIENT_ROLE',
          requiredRoles,
          currentRole: user.role,
        },
        403
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
