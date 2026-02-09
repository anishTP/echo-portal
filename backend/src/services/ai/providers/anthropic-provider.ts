import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AIStreamChunk,
  AIProviderGenerateParams,
  AIProviderTransformParams,
} from '../provider-interface.js';

function getGenerateSystemPrompt(
  mode: string | undefined,
  context: string | undefined,
  selectedText?: string,
  cursorContext?: string,
): string {
  const contextBlock = context ? `\n\nCurrent document:\n${context}` : '';
  const selectionBlock = selectedText
    ? `\n\nUser's selected text:\n${selectedText}`
    : cursorContext
      ? `\n\nText near user's cursor:\n${cursorContext}`
      : '';

  switch (mode) {
    case 'replace':
      if (selectedText) {
        return `You are a content editor for a documentation portal. The user has selected a specific passage and wants it rewritten. Return ONLY the replacement text for the selected passage — do NOT return the entire document. Do NOT wrap output in code fences. Do NOT include conversational text.${contextBlock}${selectionBlock}`;
      }
      return `You are a content editor for a documentation portal. The user wants to modify existing content. Apply the requested changes and return the COMPLETE updated document body in raw markdown. Include ALL content that should remain — not just the changed parts. Do NOT wrap output in code fences. Do NOT include conversational text.${contextBlock}${selectionBlock}`;
    case 'analyse':
      return `You are a content reviewer for a documentation portal. Analyze the document and provide constructive feedback. You may use conversational language. Do NOT output replacement content — just your analysis.${selectedText ? ' If selected text is provided, focus your analysis on that section.' : ''}${contextBlock}${selectionBlock}`;
    default: // 'add'
      return `You are a content assistant for a documentation portal. Generate NEW content based on the user's request. Output ONLY raw markdown. Do NOT wrap output in code fences. Do NOT include conversational text, explanations, or preamble — just the content itself.${contextBlock}${selectionBlock}`;
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

    // Add current user prompt — include selected text reference so the LLM
    // knows exactly which passage the user is referring to (e.g. "this line").
    if (params.selectedText && params.mode === 'replace') {
      messages.push({
        role: 'user',
        content: `[Selected text: ${params.selectedText}]\n\n${params.prompt}`,
      });
    } else {
      messages.push({ role: 'user', content: params.prompt });
    }

    const systemPrompt = getGenerateSystemPrompt(params.mode, params.context, params.selectedText, params.cursorContext);

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
