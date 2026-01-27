/**
 * Branch lifecycle states
 */
export const BranchState = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type BranchStateType = (typeof BranchState)[keyof typeof BranchState];

/**
 * Branch visibility levels
 */
export const Visibility = {
  PRIVATE: 'private',
  TEAM: 'team',
  PUBLIC: 'public',
} as const;

export type VisibilityType = (typeof Visibility)[keyof typeof Visibility];

/**
 * User roles
 * Note: VIEWER is implicit for anonymous/unauthenticated users
 * Constitution v1.0.1 canonical roles: viewer, contributor, reviewer, administrator
 */
export const Role = {
  VIEWER: 'viewer', // Implicit for anonymous users
  CONTRIBUTOR: 'contributor',
  REVIEWER: 'reviewer',
  ADMINISTRATOR: 'administrator', // Consolidated publisher role per constitution
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

/**
 * Review status
 */
export const ReviewStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ReviewStatusType = (typeof ReviewStatus)[keyof typeof ReviewStatus];

/**
 * Review decision
 */
export const ReviewDecision = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
} as const;

export type ReviewDecisionType = (typeof ReviewDecision)[keyof typeof ReviewDecision];

/**
 * Convergence status
 */
export const ConvergenceStatus = {
  PENDING: 'pending',
  VALIDATING: 'validating',
  MERGING: 'merging',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
} as const;

export type ConvergenceStatusType = (typeof ConvergenceStatus)[keyof typeof ConvergenceStatus];

/**
 * Actor types
 */
export const ActorType = {
  USER: 'user',
  SYSTEM: 'system',
} as const;

export type ActorTypeValue = (typeof ActorType)[keyof typeof ActorType];

/**
 * Authentication providers
 */
export const AuthProvider = {
  GITHUB: 'github',
  GOOGLE: 'google',
  SAML: 'saml',
  API_TOKEN: 'api_token',
} as const;

export type AuthProviderType = (typeof AuthProvider)[keyof typeof AuthProvider];

/**
 * Valid state transitions
 */
export const ValidTransitions: Record<BranchStateType, BranchStateType[]> = {
  [BranchState.DRAFT]: [BranchState.REVIEW, BranchState.ARCHIVED],
  [BranchState.REVIEW]: [BranchState.DRAFT, BranchState.APPROVED, BranchState.ARCHIVED],
  [BranchState.APPROVED]: [BranchState.PUBLISHED],
  [BranchState.PUBLISHED]: [BranchState.ARCHIVED],
  [BranchState.ARCHIVED]: [],
};

/**
 * State transition events
 */
export const TransitionEvent = {
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  APPROVE: 'APPROVE',
  PUBLISH: 'PUBLISH',
  ARCHIVE: 'ARCHIVE',
} as const;

export type TransitionEventType = (typeof TransitionEvent)[keyof typeof TransitionEvent];
