import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import type { ActorTypeValue } from '@echo-portal/shared';

export interface AuditLogInput {
  action: string;
  actorId: string;
  actorType: ActorTypeValue;
  actorIp?: string;
  actorUserAgent?: string;
  resourceType: 'branch' | 'review' | 'convergence' | 'user' | 'permission' | 'auth' | 'session';
  resourceId: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
  outcome?: 'success' | 'failure' | 'denied';
  initiatingUserId?: string;
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
        outcome: input.outcome || null,
        initiatingUserId: input.initiatingUserId || null,
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

  /**
   * Log permission decision (granted or denied)
   */
  async logPermissionCheck(
    action: string,
    granted: boolean,
    actorId: string,
    resourceType: 'branch' | 'review' | 'convergence' | 'user',
    resourceId: string,
    metadata?: {
      requiredPermission?: string;
      actorRoles?: string[];
      reason?: string;
      branchState?: string;
      [key: string]: unknown;
    },
    requestContext?: { ip?: string; userAgent?: string; requestId?: string; sessionId?: string }
  ): Promise<string> {
    return this.log({
      action: granted ? 'permission.granted' : 'permission.denied',
      actorId,
      actorType: 'user',
      resourceType: 'permission',
      resourceId: `${resourceType}:${resourceId}:${action}`,
      outcome: granted ? 'success' : 'denied',
      metadata: {
        ...metadata,
        targetAction: action,
        targetResourceType: resourceType,
        targetResourceId: resourceId,
      },
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
      sessionId: requestContext?.sessionId,
    });
  }

  /**
   * Log authentication events (login, logout, failures)
   */
  async logAuthEvent(
    action: 'auth.login' | 'auth.logout' | 'auth.failed' | 'auth.locked',
    success: boolean,
    identifier: string,
    metadata?: {
      provider?: string;
      reason?: string;
      attemptsRemaining?: number;
      lockedUntil?: Date;
      [key: string]: unknown;
    },
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId: identifier,
      actorType: 'user',
      resourceType: 'auth',
      resourceId: identifier,
      outcome: success ? 'success' : 'failure',
      metadata,
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log role change events (FR-009, FR-010)
   */
  async logRoleChange(
    userId: string,
    oldRole: string,
    newRole: string,
    actorId: string,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action: 'role.changed',
      actorId,
      actorType: 'user',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      initiatingUserId: actorId,
      metadata: {
        ...metadata,
        oldRole,
        newRole,
      },
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log collaborator management events (FR-017b)
   */
  async logCollaboratorEvent(
    action: 'collaborator.added' | 'collaborator.removed',
    branchId: string,
    collaboratorId: string,
    actorId: string,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType: 'user',
      resourceType: 'branch',
      resourceId: branchId,
      outcome: 'success',
      initiatingUserId: actorId,
      metadata: {
        ...metadata,
        collaboratorId,
      },
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  /**
   * Log reviewer assignment events (FR-017a)
   */
  async logReviewerEvent(
    action: 'reviewer.assigned' | 'reviewer.unassigned',
    branchId: string,
    reviewerId: string,
    actorId: string,
    metadata?: Record<string, unknown>,
    requestContext?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<string> {
    return this.log({
      action,
      actorId,
      actorType: 'user',
      resourceType: 'branch',
      resourceId: branchId,
      outcome: 'success',
      initiatingUserId: actorId,
      metadata: {
        ...metadata,
        reviewerId,
      },
      actorIp: requestContext?.ip,
      actorUserAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Convenience function for direct audit logging
export function logAudit(input: AuditLogInput): Promise<string> {
  return auditLogger.log(input);
}
