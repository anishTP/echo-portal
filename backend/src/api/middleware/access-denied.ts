import type { Context, Next } from 'hono';
import { AccessDeniedError, ForbiddenError } from '../utils/errors.js';

/**
 * Middleware to enhance access denied errors with actionable guidance (SC-004)
 *
 * This middleware wraps ForbiddenError instances with additional context
 * to help users understand why access was denied and what they can do about it.
 */
export async function accessDeniedMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    // Only enhance ForbiddenError instances
    if (err instanceof ForbiddenError && !(err instanceof AccessDeniedError)) {
      // Try to extract helpful context from the error message
      const message = err.message;
      const guidance = extractGuidanceFromMessage(message);

      // Re-throw as AccessDeniedError with guidance
      throw new AccessDeniedError(message, guidance);
    }

    // Re-throw other errors
    throw err;
  }
}

/**
 * Extract actionable guidance from error message
 */
function extractGuidanceFromMessage(message: string): {
  reason: string;
  requiredRole?: string;
  requiredPermission?: string;
  currentState?: string;
  visibility?: string;
  action?: string;
} {
  const guidance: {
    reason: string;
    requiredRole?: string;
    requiredPermission?: string;
    currentState?: string;
    visibility?: string;
    action?: string;
  } = {
    reason: 'Access denied',
  };

  // Check for role requirements
  if (message.includes('administrator')) {
    guidance.requiredRole = 'administrator';
    guidance.reason = 'This action requires administrator privileges';
    guidance.action = 'Please contact your system administrator for access.';
  } else if (message.includes('publisher')) {
    guidance.requiredRole = 'publisher';
    guidance.reason = 'This action requires publisher privileges';
    guidance.action = 'Please contact an administrator to request publisher role.';
  } else if (message.includes('reviewer')) {
    guidance.requiredRole = 'reviewer';
    guidance.reason = 'This action requires reviewer privileges';
    guidance.action = 'Please ask the branch owner to add you as a reviewer.';
  }

  // Check for state requirements
  if (message.includes('draft')) {
    guidance.currentState = 'draft';
    guidance.reason = 'This branch is in draft state';
    guidance.action = 'Draft branches are only accessible to the owner and collaborators.';
  } else if (message.includes('not published')) {
    guidance.reason = 'This branch has not been published yet';
    guidance.action = 'Only published branches can be accessed anonymously. Please sign in to access this content.';
  } else if (message.includes('published')) {
    guidance.currentState = 'published';
    guidance.reason = 'This branch is published and immutable';
    guidance.action = 'Published branches cannot be modified. Create a new branch to make changes.';
  }

  // Check for visibility requirements
  if (message.includes('not public') || message.includes('private')) {
    guidance.visibility = 'private';
    guidance.reason = 'This branch is private';
    guidance.action = 'Please sign in to access this content, or contact the branch owner for access.';
  } else if (message.includes('public')) {
    guidance.visibility = 'public';
  }

  // Check for specific permissions
  if (message.includes('owner')) {
    guidance.requiredPermission = 'owner';
    guidance.reason = 'This action can only be performed by the branch owner';
    guidance.action = 'Contact the branch owner if you need to perform this action.';
  } else if (message.includes('collaborator')) {
    guidance.requiredPermission = 'collaborator';
    guidance.reason = 'This action requires collaborator access';
    guidance.action = 'Ask the branch owner to add you as a collaborator.';
  }

  // Check for immutability
  if (message.includes('immutable') || message.includes('cannot be modified')) {
    guidance.reason = 'This branch is immutable and cannot be modified';
    guidance.action = 'Create a new branch if you need to make changes.';
  }

  return guidance;
}

/**
 * Helper to create access denied errors with guidance
 */
export function createAccessDeniedError(
  message: string,
  options: {
    requiredRole?: string;
    requiredPermission?: string;
    currentRole?: string;
    currentState?: string;
    visibility?: string;
    customAction?: string;
    ownerName?: string;
    branchId?: string;
  } = {}
): AccessDeniedError {
  return new AccessDeniedError(message, {
    reason: message,
    requiredRole: options.requiredRole,
    requiredPermission: options.requiredPermission,
    currentRole: options.currentRole,
    currentState: options.currentState,
    visibility: options.visibility,
    ownerName: options.ownerName,
    branchId: options.branchId,
    action: options.customAction,
  });
}
