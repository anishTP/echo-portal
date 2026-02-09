/**
 * AI Provider Interface — abstraction for pluggable AI providers (FR-011)
 *
 * All providers (Anthropic, OpenAI, local models, etc.) implement this
 * interface so they can be swapped without changing the authoring workflow.
 */

export interface AIStreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  metadata?: {
    tokensUsed?: number;
    model?: string;
    finishReason?: string;
  };
  error?: string;
}

export interface AIProviderGenerateParams {
  prompt: string;
  context?: string;
  mode?: string;
  conversationHistory?: ConversationTurn[];
  maxTokens?: number;
  selectedText?: string;
  cursorContext?: string;
}

export interface AIProviderTransformParams {
  selectedText: string;
  instruction: string;
  context?: string;
  maxTokens?: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  [key: string]: unknown;
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;

  generate(params: AIProviderGenerateParams): AsyncIterable<AIStreamChunk>;
  transform(params: AIProviderTransformParams): AsyncIterable<AIStreamChunk>;
  validateConfig(): Promise<boolean>;
}
