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
