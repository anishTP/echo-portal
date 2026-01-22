import { pgEnum } from 'drizzle-orm/pg-core';

export const branchStateEnum = pgEnum('branch_state', [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
]);

export const visibilityEnum = pgEnum('visibility', ['private', 'team', 'public']);

export const roleEnum = pgEnum('role', ['contributor', 'reviewer', 'publisher', 'administrator']);

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
