import { api } from './api.js';
import type {
  AIGenerateParams,
  AITransformParams,
  AIAcceptParams,
  AIRejectParams,
  AIConversationDetail,
  AIRequestDetail,
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
};
