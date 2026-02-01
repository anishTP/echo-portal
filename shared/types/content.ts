import type { ContentTypeValue, VisibilityType, ActorTypeValue } from '../constants/states.js';

export interface ContentSummary {
  id: string;
  branchId: string;
  title: string;
  slug: string;
  contentType: ContentTypeValue;
  category?: string;
  tags: string[];
  description?: string;
  visibility: VisibilityType;
  isPublished: boolean;
  publishedAt?: string;
  sourceContentId?: string;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  /** Whether content has been edited since creation (createdAt !== updatedAt) */
  hasEdits: boolean;
}

export interface ContentDetail extends ContentSummary {
  currentVersion: ContentVersionDetail;
}

export interface ContentVersionDetail {
  id: string;
  versionTimestamp: string;
  body: string;
  bodyFormat: string;
  metadataSnapshot: ContentMetadataSnapshot;
  changeDescription: string;
  author: UserSummary;
  authorType: ActorTypeValue;
  byteSize: number;
  checksum: string;
  isRevert: boolean;
  revertedFromId?: string;
  createdAt: string;
}

export interface ContentVersionSummary {
  id: string;
  versionTimestamp: string;
  changeDescription: string;
  author: UserSummary;
  authorType: ActorTypeValue;
  byteSize: number;
  isRevert: boolean;
  createdAt: string;
}

export interface ContentMetadataSnapshot {
  title: string;
  category?: string;
  tags: string[];
}

export interface UserSummary {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ContentCreateInput {
  branchId: string;
  title: string;
  contentType: ContentTypeValue;
  category?: string;
  tags?: string[];
  description?: string;
  body: string;
  bodyFormat?: string;
  changeDescription: string;
}

export interface ContentUpdateInput {
  title?: string;
  category?: string;
  tags?: string[];
  description?: string;
  body: string;
  bodyFormat?: string;
  changeDescription: string;
  currentVersionTimestamp?: string;
}

export interface ContentRevertInput {
  targetVersionTimestamp: string;
  changeDescription: string;
}

export interface ContentReference {
  id: string;
  sourceContentId: string;
  targetContentId: string;
  referenceType: string;
  targetContent?: ContentSummary;
}

export interface ContentDiff {
  contentId: string;
  from: {
    versionTimestamp: string;
    author: UserSummary;
    changeDescription: string;
  };
  to: {
    versionTimestamp: string;
    author: UserSummary;
    changeDescription: string;
  };
  diff: {
    bodyChanges: DiffChange[];
    metadataChanges: MetadataChange[];
  };
  summary: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  lineStart: number;
  lineEnd: number;
  content: string;
}

export interface MetadataChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ContentLineage {
  contentId: string;
  versions: ContentVersionDetail[];
  sourceContent?: ContentSummary;
}

/**
 * Input for syncing a draft from client to server.
 * Used by auto-save and manual "Save Draft" operations.
 */
export interface DraftSyncInput {
  /** Branch UUID context */
  branchId: string;
  /** Updated title (optional - only if changed) */
  title?: string;
  /** Updated markdown body */
  body: string;
  /** Updated metadata (optional) */
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
  };
  /** Last known server version for conflict detection */
  expectedServerVersion: string | null;
  /** Description for version history */
  changeDescription: string;
}

/**
 * Response from draft sync operation.
 */
export interface DraftSyncResult {
  /** Whether sync succeeded */
  success: boolean;
  /** New version timestamp if successful */
  newVersionTimestamp?: string;
  /** Conflict details if version mismatch */
  conflict?: {
    /** Current server version timestamp */
    serverVersionTimestamp: string;
    /** Server version author */
    serverVersionAuthor: UserSummary;
    /** Server version content for merge UI */
    serverBody: string;
  };
}

/**
 * Input for creating a branch from published content.
 * Initiates the "Edit" workflow from Library view.
 */
export interface EditBranchCreateInput {
  /** Published content to fork */
  sourceContentId: string;
  /** Human-readable branch name */
  name: string;
  /** URL-safe branch slug */
  slug: string;
}

/**
 * Response when branch is created for editing.
 */
export interface EditBranchCreateResult {
  /** Created branch details */
  branch: BranchSummary;
  /** Copied content in the new branch */
  content: ContentDetail;
}

export interface BranchSummary {
  id: string;
  name: string;
  slug: string;
  state: string;
  ownerId: string;
  createdAt: string;
}
