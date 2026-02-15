import { api, type PaginatedResult } from './api';
import type {
  ContentDetail,
  ContentSummary,
  ContentVersionDetail,
  ContentVersionSummary,
  ContentDiff,
  ContentLineage,
  ContentReference,
  ContentCreateInput,
  ContentUpdateInput,
  ContentRevertInput,
  DraftSyncInput,
  DraftSyncResult,
} from '@echo-portal/shared';

export const contentApi = {
  /** Create content within a branch */
  create(input: ContentCreateInput): Promise<ContentDetail> {
    return api.post<ContentDetail>('/contents', input);
  },

  /** Get content by ID with current version */
  getById(contentId: string): Promise<ContentDetail> {
    return api.get<ContentDetail>(`/contents/${contentId}`);
  },

  /** Update content (creates new version) */
  update(contentId: string, input: ContentUpdateInput): Promise<ContentDetail> {
    return api.post<ContentDetail>(`/contents/${contentId}`, {
      ...input,
      _method: 'PUT',
    });
  },

  /** Delete (archive) content */
  delete(contentId: string): Promise<void> {
    return api.delete(`/contents/${contentId}`);
  },

  /** List contents in a branch */
  listByBranch(params: {
    branchId: string;
    contentType?: string;
    section?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ContentSummary>> {
    const searchParams = new URLSearchParams();
    searchParams.set('branchId', params.branchId);
    if (params.contentType) searchParams.set('contentType', params.contentType);
    if (params.section) searchParams.set('section', params.section);
    if (params.category) searchParams.set('category', params.category);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    return api.getPaginated<ContentSummary>(`/contents?${searchParams.toString()}`);
  },

  /** List published public content */
  listPublished(params?: {
    contentType?: string;
    section?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ContentSummary>> {
    const searchParams = new URLSearchParams();
    if (params?.contentType) searchParams.set('contentType', params.contentType);
    if (params?.section) searchParams.set('section', params.section);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('q', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.getPaginated<ContentSummary>(
      `/contents/published${qs ? `?${qs}` : ''}`
    );
  },

  /** Get published content by slug */
  getBySlug(slug: string): Promise<ContentDetail> {
    return api.get<ContentDetail>(`/contents/published/${encodeURIComponent(slug)}`);
  },

  /** Search content */
  search(params: {
    q: string;
    contentType?: string;
    section?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ContentSummary>> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.contentType) searchParams.set('contentType', params.contentType);
    if (params.section) searchParams.set('section', params.section);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    return api.getPaginated<ContentSummary>(
      `/contents/search?${searchParams.toString()}`
    );
  },

  /** Get version history */
  getVersions(
    contentId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResult<ContentVersionSummary>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.getPaginated<ContentVersionSummary>(
      `/contents/${contentId}/versions${qs ? `?${qs}` : ''}`
    );
  },

  /** Get specific version */
  getVersion(contentId: string, versionId: string): Promise<ContentVersionDetail> {
    return api.get<ContentVersionDetail>(`/contents/${contentId}/versions/${versionId}`);
  },

  /** Compare two versions */
  diff(contentId: string, from: string, to: string): Promise<ContentDiff> {
    return api.get<ContentDiff>(
      `/contents/${contentId}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
  },

  /** Revert to a previous version */
  revert(contentId: string, input: ContentRevertInput): Promise<ContentDetail> {
    return api.post<ContentDetail>(`/contents/${contentId}/revert`, input);
  },

  /** Get content lineage */
  getLineage(contentId: string): Promise<ContentLineage> {
    return api.get<ContentLineage>(`/contents/${contentId}/lineage`);
  },

  /** Get outgoing references */
  getReferences(contentId: string): Promise<ContentReference[]> {
    return api.get<ContentReference[]>(`/contents/${contentId}/references`);
  },

  /** Get incoming references (referenced by) */
  getReferencedBy(contentId: string): Promise<ContentReference[]> {
    return api.get<ContentReference[]>(`/contents/${contentId}/referenced-by`);
  },

  /**
   * Sync draft changes to server.
   * Uses optimistic concurrency control via expectedServerVersion.
   */
  syncDraft(contentId: string, input: DraftSyncInput): Promise<DraftSyncResult> {
    return api.post<DraftSyncResult>(`/contents/${contentId}/sync`, input);
  },
};

export default contentApi;
