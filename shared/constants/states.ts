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
 * Content types (003-content-authoring-versioning)
 */
export const ContentType = {
  GUIDELINE: 'guideline',
  ASSET: 'asset',
  OPINION: 'opinion',
} as const;

export type ContentTypeValue = (typeof ContentType)[keyof typeof ContentType];

/**
 * Content body formats
 */
export const BodyFormat = {
  MARKDOWN: 'markdown',
  STRUCTURED: 'structured',
  RICH_TEXT: 'rich_text',
} as const;

export type BodyFormatType = (typeof BodyFormat)[keyof typeof BodyFormat];

/**
 * Content reference types
 */
export const ReferenceType = {
  LINK: 'link',
  EMBED: 'embed',
  EXTENDS: 'extends',
  REPLACES: 'replaces',
} as const;

export type ReferenceTypeValue = (typeof ReferenceType)[keyof typeof ReferenceType];

/**
 * Notification types
 */
export const NotificationType = {
  // Review category
  REVIEW_REQUESTED: 'review_requested',
  REVIEW_COMMENT_ADDED: 'review_comment_added',
  REVIEW_COMMENT_REPLY: 'review_comment_reply',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_CHANGES_REQUESTED: 'review_changes_requested',
  REVIEW_COMMENT_RESOLVED: 'review_comment_resolved',
  REVIEWER_ADDED: 'reviewer_added',
  REVIEWER_REMOVED: 'reviewer_removed',
  // Lifecycle category
  COLLABORATOR_ADDED: 'collaborator_added',
  COLLABORATOR_REMOVED: 'collaborator_removed',
  CONTENT_PUBLISHED: 'content_published',
  BRANCH_ARCHIVED: 'branch_archived',
  BRANCH_READY_TO_PUBLISH: 'branch_ready_to_publish',
  ROLE_CHANGED: 'role_changed',
  // AI category
  AI_COMPLIANCE_ERROR: 'ai_compliance_error',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Notification categories
 */
export const NotificationCategory = {
  REVIEW: 'review',
  LIFECYCLE: 'lifecycle',
  AI: 'ai',
} as const;

export type NotificationCategoryValue =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

/**
 * Mapping from notification type to category
 */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationTypeValue, NotificationCategoryValue> = {
  review_requested: 'review',
  review_comment_added: 'review',
  review_comment_reply: 'review',
  review_approved: 'review',
  review_changes_requested: 'review',
  review_comment_resolved: 'review',
  reviewer_added: 'review',
  reviewer_removed: 'review',
  collaborator_added: 'lifecycle',
  collaborator_removed: 'lifecycle',
  content_published: 'lifecycle',
  branch_archived: 'lifecycle',
  branch_ready_to_publish: 'lifecycle',
  role_changed: 'lifecycle',
  ai_compliance_error: 'ai',
};

/**
 * Content size limit (50 MB in bytes)
 */
export const CONTENT_MAX_BYTE_SIZE = 52_428_800;

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
