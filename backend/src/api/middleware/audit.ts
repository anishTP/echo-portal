import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from '../../services/audit/logger.js';
import { ActorType } from '@echo-portal/shared';
import type { AuthEnv } from './auth.js';

export interface AuditEnv extends AuthEnv {
  Variables: AuthEnv['Variables'] & {
    requestId: string;
    clientIp: string;
    userAgent: string;
  };
}

/**
 * Middleware to add request context for audit logging
 */
export const auditContextMiddleware = createMiddleware<AuditEnv>(async (c: Context, next: Next) => {
  // Generate or extract request ID
  const requestId = c.req.header('X-Request-ID') || uuidv4();

  // Extract client IP (consider X-Forwarded-For for proxied requests)
  const forwardedFor = c.req.header('X-Forwarded-For');
  const clientIp = forwardedFor?.split(',')[0]?.trim() || 'unknown';

  // Extract user agent
  const userAgent = c.req.header('User-Agent') || 'unknown';

  // Set context variables
  c.set('requestId', requestId);
  c.set('clientIp', clientIp);
  c.set('userAgent', userAgent);

  // Add request ID to response headers
  c.header('X-Request-ID', requestId);

  return next();
});

/**
 * Get request context for audit logging
 */
export function getAuditContext(c: Context): {
  ip: string;
  userAgent: string;
  requestId: string;
} {
  return {
    ip: c.get('clientIp') || 'unknown',
    userAgent: c.get('userAgent') || 'unknown',
    requestId: c.get('requestId') || uuidv4(),
  };
}

/**
 * Helper to log an audit event from a route handler
 */
export async function logAuditEvent(
  c: Context,
  action: string,
  resourceType: 'branch' | 'review' | 'convergence' | 'user',
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const user = c.get('user');
  const context = getAuditContext(c);

  return auditLogger.log({
    action,
    actorId: user?.id || 'system',
    actorType: user ? ActorType.USER : ActorType.SYSTEM,
    resourceType,
    resourceId,
    metadata,
    actorIp: context.ip,
    actorUserAgent: context.userAgent,
    requestId: context.requestId,
  });
}
