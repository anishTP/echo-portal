import { pgEnum } from 'drizzle-orm/pg-core';

export const branchStateEnum = pgEnum('branch_state', [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
]);

export const visibilityEnum = pgEnum('visibility', ['private', 'team', 'public']);

// Updated per Constitution v1.0.1 (2026-01-26)
// Canonical roles: viewer, contributor, reviewer, administrator
export const roleEnum = pgEnum('role', ['viewer', 'contributor', 'reviewer', 'administrator']);

export const authProviderEnum = pgEnum('auth_provider', ['github', 'google', 'saml', 'api_token']);

export const actorTypeEnum = pgEnum('actor_type', ['user', 'system']);

export const reviewStatusEnum = pgEnum('review_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const reviewDecisionEnum = pgEnum('review_decision', ['approved', 'changes_requested']);

export const convergenceStatusEnum = pgEnum('convergence_status', [
  'pending',
  'validating',
  'merging',
  'succeeded',
  'failed',
  'rolled_back',
]);

// Audit outcome enum for FR-021
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'failure', 'denied']);

// Note: Audit action is stored as text (not enum) for flexibility
// Common action patterns:
// - auth.login, auth.logout, auth.failed, auth.locked
// - role.changed
// - permission.granted, permission.denied
// - collaborator.added, collaborator.removed
// - reviewer.assigned, reviewer.unassigned
// - branch.created, branch.transitioned, etc.
