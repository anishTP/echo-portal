import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} with id '${id}' not found` : `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action', details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/**
 * Access denied error with actionable guidance (SC-004)
 */
export class AccessDeniedError extends AppError {
  constructor(
    message: string,
    guidance: {
      reason: string;
      requiredRole?: string;
      requiredPermission?: string;
      currentRole?: string;
      currentState?: string;
      visibility?: string;
      action?: string;
      ownerName?: string;
      branchId?: string;
    }
  ) {
    super(403, 'ACCESS_DENIED', message, {
      guidance: {
        reason: guidance.reason,
        requiredRole: guidance.requiredRole,
        requiredPermission: guidance.requiredPermission,
        currentRole: guidance.currentRole,
        currentState: guidance.currentState,
        visibility: guidance.visibility,
        action: guidance.action || 'Please contact the branch owner or an administrator for access.',
        ownerName: guidance.ownerName,
        branchId: guidance.branchId,
      },
    });
  }
}

/**
 * Helper functions for creating common permission denial scenarios
 */
export const PermissionDenials = {
  /**
   * User lacks required role
   */
  insufficientRole(
    currentRole: string,
    requiredRole: string,
    action: string
  ): AccessDeniedError {
    const roleNames: Record<string, string> = {
      viewer: 'Viewer',
      contributor: 'Contributor',
      reviewer: 'Reviewer',
      administrator: 'Administrator',
    };

    const current = roleNames[currentRole] || currentRole;
    const required = roleNames[requiredRole] || requiredRole;

    return new AccessDeniedError(
      `This action requires ${required} role. You are currently a ${current}.`,
      {
        reason: `Insufficient privileges to ${action}`,
        currentRole: current,
        requiredRole: required,
        action: `Contact an administrator to change your role to ${required} or higher.`,
      }
    );
  },

  /**
   * Branch owner-only operation
   */
  ownerOnly(action: string, ownerName?: string): AccessDeniedError {
    return new AccessDeniedError(
      `Only the branch owner can ${action}.`,
      {
        reason: `This action requires branch ownership`,
        requiredPermission: 'owner',
        ownerName,
        action: ownerName
          ? `Contact ${ownerName} (branch owner) to request this change.`
          : 'Contact the branch owner to request this change.',
      }
    );
  },

  /**
   * Branch state prevents action
   */
  invalidState(
    currentState: string,
    action: string,
    allowedStates: string[]
  ): AccessDeniedError {
    const stateNames: Record<string, string> = {
      draft: 'Draft',
      in_review: 'In Review',
      approved: 'Approved',
      published: 'Published',
    };

    const current = stateNames[currentState] || currentState;
    const allowed = allowedStates.map((s) => stateNames[s] || s).join(' or ');

    return new AccessDeniedError(
      `Cannot ${action} when branch is ${current}. This action requires the branch to be ${allowed}.`,
      {
        reason: `Branch state does not allow this action`,
        currentState: current,
        action:
          currentState === 'published'
            ? 'Published branches are immutable. Create a new branch to make changes.'
            : `Wait for the branch to transition to ${allowed} state.`,
      }
    );
  },

  /**
   * Visibility/access restriction
   */
  accessRevoked(
    reason: 'visibility_changed' | 'removed_from_team' | 'branch_deleted',
    branchId?: string
  ): AccessDeniedError {
    const messages = {
      visibility_changed:
        'You no longer have access to this branch because its visibility settings were changed.',
      removed_from_team:
        'You no longer have access to this branch because you were removed from the team.',
      branch_deleted: 'This branch has been deleted and is no longer accessible.',
    };

    const actions = {
      visibility_changed: 'Contact the branch owner to request access or ask them to update visibility settings.',
      removed_from_team: 'Contact the branch owner to be re-added as a collaborator or reviewer.',
      branch_deleted: 'This branch no longer exists. No action can be taken.',
    };

    return new AccessDeniedError(messages[reason], {
      reason: 'Access was revoked',
      branchId,
      action: actions[reason],
    });
  },

  /**
   * Self-review prevention
   */
  selfReview(): AccessDeniedError {
    return new AccessDeniedError(
      'You cannot approve or request changes on your own branch.',
      {
        reason: 'Self-review is forbidden to maintain review integrity',
        action: 'Assign a different reviewer to review this branch, or ask the branch owner to add another reviewer.',
      }
    );
  },

  /**
   * Not assigned as reviewer
   */
  notAssignedReviewer(branchId?: string): AccessDeniedError {
    return new AccessDeniedError(
      'You are not assigned as a reviewer for this branch.',
      {
        reason: 'Only assigned reviewers can approve or request changes',
        branchId,
        action: 'Ask the branch owner to add you as a reviewer, or wait for the owner to assign you.',
      }
    );
  },

  /**
   * Anonymous access to protected content
   */
  authenticationRequired(visibility: string): AccessDeniedError {
    return new AccessDeniedError(
      'This content is not publicly accessible. Please sign in to continue.',
      {
        reason: 'Authentication required to access this content',
        visibility,
        action: 'Sign in with GitHub to access this content.',
      }
    );
  },

  /**
   * Permission for specific operation
   */
  missingPermission(
    permission: string,
    action: string,
    requiredRole?: string
  ): AccessDeniedError {
    const roleGuidance = requiredRole
      ? ` You need the ${requiredRole} role to perform this action.`
      : '';

    return new AccessDeniedError(
      `You do not have permission to ${action}.${roleGuidance}`,
      {
        reason: `Missing required permission: ${permission}`,
        requiredPermission: permission,
        requiredRole,
        action: requiredRole
          ? `Contact an administrator to change your role to ${requiredRole}.`
          : 'Contact an administrator to request the necessary permissions.',
      }
    );
  },
};

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'An internal error occurred') {
    super(500, 'INTERNAL_ERROR', message);
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

/**
 * Global error handler for Hono
 */
export function handleError(err: Error, c: Context): Response {
  const requestId = c.get('requestId');

  // Handle AppError
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    };
    return c.json(response, err.statusCode as 400 | 401 | 403 | 404 | 409 | 500);
  }

  // Handle Hono HTTPException
  if (err instanceof HTTPException) {
    const response: ErrorResponse = {
      error: {
        code: 'HTTP_ERROR',
        message: err.message,
      },
      requestId,
    };
    return c.json(response, err.status);
  }

  // Handle unknown errors
  console.error('Unhandled error:', err);
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    requestId,
  };
  return c.json(response, 500);
}
