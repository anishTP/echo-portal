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
  MAX_IMAGES_PER_REQUEST: 4,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
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
  selectedText?: string;
  cursorContext?: string;
  images?: Array<{ mediaType: string; data: string }>;
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
  responseMode: AIResponseMode | null;
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

// --- Context Document Types ---

export interface AIContextDocument {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// --- Provider Types (shared for frontend display) ---

export interface AIProviderInfo {
  id: string;
  displayName: string;
}

// ============================================
// IMAGE COMPLIANCE ANALYSIS TYPES (008-image-compliance-analysis)
// ============================================

export const COMPLIANCE_CATEGORIES = [
  'brand_adherence',
  'accessibility',
  'content_appropriateness',
  'licensing_attribution',
  'technical_quality',
] as const;

export type ComplianceCategory = typeof COMPLIANCE_CATEGORIES[number];

export type ComplianceSeverity = 'error' | 'warning' | 'informational';

export interface ComplianceCategoryConfig {
  enabled: boolean;
  severity: ComplianceSeverity;
}

export const COMPLIANCE_DEFAULTS: Record<ComplianceCategory, ComplianceCategoryConfig> = {
  brand_adherence: { enabled: true, severity: 'warning' },
  accessibility: { enabled: true, severity: 'warning' },
  content_appropriateness: { enabled: true, severity: 'warning' },
  licensing_attribution: { enabled: true, severity: 'warning' },
  technical_quality: { enabled: true, severity: 'warning' },
};

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  brand_adherence: 'Brand Adherence',
  accessibility: 'Accessibility',
  content_appropriateness: 'Content Appropriateness',
  licensing_attribution: 'Licensing & Attribution',
  technical_quality: 'Technical Quality',
};

export const COMPLIANCE_CATEGORY_DESCRIPTIONS: Record<ComplianceCategory, string> = {
  brand_adherence: 'Logo usage, colour palette, typography, and layout conformance',
  accessibility: 'Alt-text quality, contrast ratios, text legibility, and decorative vs informational classification',
  content_appropriateness: 'Professional quality, relevance to context, and absence of offensive imagery',
  licensing_attribution: 'Watermark detection, stock photo attribution, and rights metadata presence',
  technical_quality: 'Resolution adequacy, file size optimisation, and format appropriateness',
};
