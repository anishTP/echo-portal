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
      currentState?: string;
      visibility?: string;
      action?: string;
    }
  ) {
    super(403, 'ACCESS_DENIED', message, {
      guidance: {
        reason: guidance.reason,
        requiredRole: guidance.requiredRole,
        requiredPermission: guidance.requiredPermission,
        currentState: guidance.currentState,
        visibility: guidance.visibility,
        action: guidance.action || 'Please contact the branch owner or an administrator for access.',
      },
    });
  }
}

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
