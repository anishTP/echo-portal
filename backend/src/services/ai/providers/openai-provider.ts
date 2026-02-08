import OpenAI from 'openai';
import type {
  AIProvider,
  AIStreamChunk,
  AIProviderGenerateParams,
  AIProviderTransformParams,
} from '../provider-interface.js';

export interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

/**
 * OpenAIProvider — GPT-based AI provider for content generation and transformation.
 *
 * Uses the OpenAI Chat Completions API with streaming.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI (GPT)';

  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? 'gpt-4o';
    this.defaultMaxTokens = config.maxTokens ?? 4000;
  }

  async *generate(params: AIProviderGenerateParams): AsyncIterable<AIStreamChunk> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // System prompt
    const basePrompt = 'You are a content assistant for a brand portal. Output ONLY raw markdown content. Do NOT wrap output in code fences (```). Do NOT include conversational text, explanations, or preamble — just the content itself.';
    const systemPrompt = params.context
      ? `${basePrompt}\n\nDocument context:\n${params.context}`
      : basePrompt;

    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history
    if (params.conversationHistory?.length) {
      for (const turn of params.conversationHistory) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    // Add current user prompt
    messages.push({ role: 'user', content: params.prompt });

    yield* this.streamCompletion(messages, params.maxTokens);
  }

  async *transform(params: AIProviderTransformParams): AsyncIterable<AIStreamChunk> {
    const systemPrompt = params.context
      ? `You are a content editing assistant. Apply the requested transformation to the given text. Return ONLY the transformed text, no explanations.\n\nDocument context:\n${params.context}`
      : 'You are a content editing assistant. Apply the requested transformation to the given text. Return ONLY the transformed text, no explanations.';

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Apply the following transformation to the text below.\n\nInstruction: ${params.instruction}\n\nText to transform:\n${params.selectedText}`,
      },
    ];

    yield* this.streamCompletion(messages, params.maxTokens);
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
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
    messages: OpenAI.ChatCompletionMessageParam[],
    maxTokens?: number,
  ): AsyncIterable<AIStreamChunk> {
    let fullContent = '';
    let completionTokens = 0;
    let promptTokens = 0;

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: maxTokens ?? this.defaultMaxTokens,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield { type: 'token', content: delta.content };
        }

        // Capture usage from the final chunk
        if (chunk.usage) {
          completionTokens = chunk.usage.completion_tokens ?? 0;
          promptTokens = chunk.usage.prompt_tokens ?? 0;
        }
      }

      yield {
        type: 'done',
        content: fullContent,
        metadata: {
          tokensUsed: promptTokens + completionTokens,
          model: this.model,
          finishReason: 'stop',
        },
      };
    } catch (err: unknown) {
      let message = 'OpenAI API error';
      if (err instanceof OpenAI.APIError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      yield { type: 'error', error: message };
    }
  }
}
