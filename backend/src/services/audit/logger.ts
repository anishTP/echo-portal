import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import type { ActorTypeValue } from '@echo-portal/shared';

export interface AuditLogInput {
  action: string;
  actorId: string;
  actorType: ActorTypeValue;
  actorIp?: string;
  actorUserAgent?: string;
  resourceType: 'branch' | 'review' | 'convergence' | 'user';
  resourceId: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
}

export class AuditLogger {
  /**
   * Log an audit event
   */
  async log(input: AuditLogInput): Promise<string> {
    const [result] = await db
      .insert(auditLogs)
      .values({
        action: input.action,
        actorId: input.actorId,
        actorType: input.actorType,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata || {},
        requestId: input.requestId,
        sessionId: input.sessionId,
      })
      .returning({ id: auditLogs.id });

    return result.id;
  }

  /**
   * Log branch-related events
   */
  async logBranchEvent(
    action:
      | 'branch_created'
      | 'branch_updated'
      | 'branch_state_transitioned'
      | 'branch_visibility_changed'
      | 'branch_deleted',
    branchId: string,
    actorId: string,
    actorType: ActorTypeValue,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType,
      resourceType: 'branch',
      resourceId: branchId,
      metadata,
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log review-related events
   */
  async logReviewEvent(
    action: 'review_requested' | 'review_completed' | 'review_comment_added',
    reviewId: string,
    actorId: string,
    actorType: ActorTypeValue,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType,
      resourceType: 'review',
      resourceId: reviewId,
      metadata,
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log convergence-related events
   */
  async logConvergenceEvent(
    action:
      | 'convergence_initiated'
      | 'convergence_succeeded'
      | 'convergence_failed'
      | 'convergence_rolled_back',
    convergenceId: string,
    actorId: string,
    actorType: ActorTypeValue,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType,
      resourceType: 'convergence',
      resourceId: convergenceId,
      metadata,
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log user-related events
   */
  async logUserEvent(
    action: 'user_created' | 'user_updated' | 'user_role_changed' | 'user_deactivated',
    userId: string,
    actorId: string,
    actorType: ActorTypeValue,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType,
      resourceType: 'user',
      resourceId: userId,
      metadata,
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
