import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { RoleType } from '@echo-portal/shared';

export interface AuthUser {
  id: string;
  email: string;
  roles: RoleType[];
}

export interface AuthEnv {
  Variables: {
    user: AuthUser | null;
  };
}

/**
 * Middleware to extract user from session/token
 * Sets ctx.user if authenticated, null otherwise
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    c.set('user', null);
    return next();
  }

  // TODO: Implement proper session/token validation
  // For now, this is a placeholder that accepts a simple bearer token format
  // Bearer <userId>:<email>:<roles>
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const parts = token.split(':');

    if (parts.length >= 3) {
      const [id, email, rolesStr] = parts;
      const roles = rolesStr.split(',') as RoleType[];

      c.set('user', { id, email, roles });
    } else {
      c.set('user', null);
    }
  } else {
    c.set('user', null);
  }

  return next();
});

/**
 * Middleware to require authentication
 * Returns 401 if not authenticated
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
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
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRequiredRole) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Required role: ${requiredRoles.join(' or ')}`,
        },
        403
      );
    }

    return next();
  });
}
