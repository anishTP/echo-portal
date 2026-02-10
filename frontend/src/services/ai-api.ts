import { api, apiFetch } from './api.js';
import type {
  AIAcceptParams,
  AIRejectParams,
  AIConversationDetail,
  AIRequestDetail,
  AIContextDocument,
  ComplianceCategory,
  ComplianceCategoryConfig,
} from '@echo-portal/shared';

const AI_BASE = '/ai';

/**
 * AI API service — wraps AI-assisted authoring endpoints
 */
export const aiApi = {
  /**
   * Start a generate request (returns SSE stream URL info, actual streaming
   * is handled by useSSEStream hook via fetch)
   */
  getGenerateUrl: () => `${import.meta.env.VITE_API_URL || '/api/v1'}${AI_BASE}/generate`,
  getTransformUrl: () => `${import.meta.env.VITE_API_URL || '/api/v1'}${AI_BASE}/transform`,
  getAnalyseUrl: () => `${import.meta.env.VITE_API_URL || '/api/v1'}${AI_BASE}/analyse`,

  /** Accept pending AI content → creates content version */
  accept: (requestId: string, params: AIAcceptParams) =>
    api.post<{ success: boolean; contentVersion: unknown; requestId: string }>(
      `${AI_BASE}/requests/${requestId}/accept`,
      params
    ),

  /** Reject pending AI content */
  reject: (requestId: string, params?: AIRejectParams) =>
    api.post<{ success: boolean; requestId: string }>(
      `${AI_BASE}/requests/${requestId}/reject`,
      params ?? {}
    ),

  /** Cancel in-progress streaming generation */
  cancel: (requestId: string) =>
    api.post<{ success: boolean; requestId: string }>(
      `${AI_BASE}/requests/${requestId}/cancel`
    ),

  /** Get active conversation for a branch */
  getConversation: (branchId: string) =>
    api.get<{ conversation: AIConversationDetail | null }>(
      `${AI_BASE}/conversation?branchId=${branchId}`
    ),

  /** Clear/end a conversation */
  clearConversation: (conversationId: string) =>
    api.delete<{ success: boolean }>(
      `${AI_BASE}/conversation/${conversationId}`
    ),

  /** Get a specific request detail (for reload) */
  getRequest: (requestId: string) =>
    api.get<{ request: AIRequestDetail }>(
      `${AI_BASE}/requests/${requestId}`
    ),

  /** Force-discard all pending requests for user+branch (reset stuck state) */
  discardPending: (branchId: string) =>
    api.post<{ success: boolean; discarded: number }>(
      `${AI_BASE}/discard-pending`,
      { branchId }
    ),

  // --- Context Documents (admin) ---

  /** List all context documents */
  getContextDocuments: () =>
    api.get<AIContextDocument[]>(`${AI_BASE}/context-documents`),

  /** Create a new context document */
  createContextDocument: (data: { title: string; content: string; sortOrder?: number }) =>
    api.post<AIContextDocument>(`${AI_BASE}/context-documents`, data),

  /** Update a context document */
  updateContextDocument: (id: string, data: { title?: string; content?: string; enabled?: boolean; sortOrder?: number }) =>
    apiFetch<AIContextDocument>(`${AI_BASE}/context-documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Delete a context document */
  deleteContextDocument: (id: string) =>
    api.delete<{ success: boolean }>(`${AI_BASE}/context-documents/${id}`),

  // --- Compliance Config (008-image-compliance-analysis) ---

  /** Get AI config including compliance categories */
  getConfig: () =>
    api.get<{
      config: {
        global: Record<string, unknown>;
        roles: Record<string, Record<string, unknown>>;
        compliance: Record<ComplianceCategory, ComplianceCategoryConfig>;
      };
    }>(`${AI_BASE}/config`),

  /** Update compliance category configuration */
  updateComplianceConfig: (categories: Partial<Record<ComplianceCategory, ComplianceCategoryConfig>>) =>
    apiFetch(`${AI_BASE}/config`, {
      method: 'PUT',
      body: JSON.stringify({ compliance: categories }),
    }),
};
