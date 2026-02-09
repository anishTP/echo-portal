import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AIStreamChunk,
  AIProviderGenerateParams,
  AIProviderTransformParams,
} from '../provider-interface.js';

function buildReferenceBlock(contextDocuments?: Array<{ title: string; content: string }>): string {
  if (!contextDocuments?.length) return '';
  const sections = contextDocuments.map((doc) => `## ${doc.title}\n${doc.content}`).join('\n\n');
  return `\n\n--- Reference Materials ---\n${sections}\n--- End Reference Materials ---`;
}

function getGenerateSystemPrompt(
  mode: string | undefined,
  context: string | undefined,
  selectedText?: string,
  cursorContext?: string,
  contextDocuments?: Array<{ title: string; content: string }>,
): string {
  const refBlock = buildReferenceBlock(contextDocuments);
  const contextBlock = context ? `\n\nCurrent document:\n${context}` : '';
  const selectionBlock = selectedText
    ? `\n\nUser's selected text:\n${selectedText}`
    : cursorContext
      ? `\n\nText near user's cursor:\n${cursorContext}`
      : '';

  switch (mode) {
    case 'replace':
      if (selectedText) {
        return `You are a content editor for a documentation portal. The user has selected a specific passage and wants it rewritten. Return ONLY the replacement text for the selected passage — do NOT return the entire document. Do NOT wrap output in code fences. Do NOT include conversational text.${refBlock}${contextBlock}${selectionBlock}`;
      }
      return `You are a content editor for a documentation portal. The user wants to modify existing content. Apply the requested changes and return the COMPLETE updated document body in raw markdown. Include ALL content that should remain — not just the changed parts. Do NOT wrap output in code fences. Do NOT include conversational text.${refBlock}${contextBlock}${selectionBlock}`;
    case 'analyse':
      return `You are a content reviewer for a documentation portal. Analyze the document and provide constructive feedback. You may use conversational language. Do NOT output replacement content — just your analysis.${selectedText ? ' If selected text is provided, focus your analysis on that section.' : ''}${refBlock}${contextBlock}${selectionBlock}`;
    default: // 'add'
      return `You are a content assistant for a documentation portal. Generate NEW content based on the user's request. Output ONLY raw markdown. Do NOT wrap output in code fences. Do NOT include conversational text, explanations, or preamble — just the content itself.${refBlock}${contextBlock}${selectionBlock}`;
  }
}

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

/**
 * AnthropicProvider — Claude-based AI provider for content generation and transformation.
 *
 * Uses the Anthropic Messages API with streaming for real-time content delivery.
 */
export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly displayName = 'Anthropic (Claude)';

  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.defaultMaxTokens = config.maxTokens ?? 4000;
  }

  async *generate(params: AIProviderGenerateParams): AsyncIterable<AIStreamChunk> {
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history
    if (params.conversationHistory?.length) {
      for (const turn of params.conversationHistory) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    // Build the user message — may include images (multimodal)
    const promptText = params.selectedText
      ? `[Selected text: ${params.selectedText}]\n\n${params.prompt}`
      : params.prompt;

    if (params.images?.length) {
      // Multimodal message: images + text as content array
      const contentParts: Anthropic.ContentBlockParam[] = [
        ...params.images.map((img) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: img.data,
          },
        })),
        { type: 'text' as const, text: promptText },
      ];
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: promptText });
    }

    const systemPrompt = getGenerateSystemPrompt(
      params.mode, params.context, params.selectedText, params.cursorContext, params.contextDocuments
    );

    yield* this.streamCompletion(systemPrompt, messages, params.maxTokens);
  }

  async *transform(params: AIProviderTransformParams): AsyncIterable<AIStreamChunk> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Apply the following transformation to the text below.\n\nInstruction: ${params.instruction}\n\nText to transform:\n${params.selectedText}`,
      },
    ];

    const systemPrompt = params.context
      ? `You are a content editing assistant. Apply the requested transformation to the given text. Return ONLY the transformed text, no explanations.\n\nDocument context:\n${params.context}`
      : 'You are a content editing assistant. Apply the requested transformation to the given text. Return ONLY the transformed text, no explanations.';

    yield* this.streamCompletion(systemPrompt, messages, params.maxTokens);
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Make a minimal API call to validate credentials
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private async *streamCompletion(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    maxTokens?: number,
  ): AsyncIterable<AIStreamChunk> {
    let totalTokens = 0;
    let fullContent = '';

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: maxTokens ?? this.defaultMaxTokens,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullContent += text;
          totalTokens++;
          yield { type: 'token', content: text };
        }
      }

      const finalMessage = await stream.finalMessage();
      const usage = finalMessage.usage;

      yield {
        type: 'done',
        content: fullContent,
        metadata: {
          tokensUsed: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
          model: this.model,
          finishReason: finalMessage.stop_reason ?? 'stop',
        },
      };
    } catch (err: unknown) {
      // Extract clean error message from Anthropic SDK errors
      let message = 'Anthropic API error';
      if (err instanceof Anthropic.APIError) {
        const body = err.error as { error?: { message?: string } } | undefined;
        message = body?.error?.message ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      yield { type: 'error', error: message };
    }
  }
}
