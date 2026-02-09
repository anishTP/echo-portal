// ============================================
// AI-ASSISTED AUTHORING TYPES (007-ai-assisted-authoring)
// ============================================

// --- Enums & Constants ---

export type AIRequestType = 'generation' | 'transformation';

export type AIRequestStatus =
  | 'generating'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'discarded';

export type AIConversationStatus = 'active' | 'ended';

export type AIConversationEndReason =
  | 'session_end'
  | 'branch_switch'
  | 'explicit_clear'
  | 'turn_limit';

/** Phase 1 hardcoded defaults (FR-020, FR-021) */
export const AI_DEFAULTS = {
  MAX_TOKENS_PER_REQUEST: 4000,
  MAX_TURNS_PER_CONVERSATION: 20,
  RATE_LIMIT_PER_HOUR: 50,
  MAX_PROMPT_LENGTH: 10000,
  MAX_SELECTED_TEXT_LENGTH: 50000,
  MAX_INSTRUCTION_LENGTH: 5000,
} as const;

// --- SSE Stream Events ---

export type AIStreamEventType = 'meta' | 'token' | 'done' | 'error';

export interface AIStreamMetaEvent {
  requestId: string;
  conversationId: string;
  providerId: string;
  modelId: string;
}

export interface AIStreamTokenEvent {
  content: string;
}

export interface AIStreamDoneEvent {
  requestId: string;
  tokensUsed: number;
  fullContent: string;
}

export interface AIStreamErrorEvent {
  code: string;
  message: string;
}

export type AIStreamEvent =
  | { event: 'meta'; data: AIStreamMetaEvent }
  | { event: 'token'; data: AIStreamTokenEvent }
  | { event: 'done'; data: AIStreamDoneEvent }
  | { event: 'error'; data: AIStreamErrorEvent };

// --- API Request/Response Types ---

export type AIResponseMode = 'add' | 'replace' | 'analyse';

export interface AIGenerateParams {
  branchId: string;
  contentId?: string;
  prompt: string;
  conversationId?: string;
  context?: string;
  mode?: AIResponseMode;
}

export interface AITransformParams {
  branchId: string;
  contentId: string;
  selectedText: string;
  instruction: string;
  conversationId?: string;
}

export interface AIAcceptParams {
  contentId: string;
  editedContent?: string;
  changeDescription?: string;
}

export interface AIRejectParams {
  reason?: string;
}

// --- Detail Types ---

export interface AIRequestDetail {
  id: string;
  conversationId: string;
  requestType: AIRequestType;
  prompt: string;
  selectedText: string | null;
  generatedContent: string | null;
  status: AIRequestStatus;
  providerId: string | null;
  modelId: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

export interface AIConversationDetail {
  id: string;
  branchId: string;
  status: AIConversationStatus;
  turnCount: number;
  maxTurns: number;
  createdAt: string;
  requests: AIRequestDetail[];
}

// --- Provider Types (shared for frontend display) ---

export interface AIProviderInfo {
  id: string;
  displayName: string;
}
