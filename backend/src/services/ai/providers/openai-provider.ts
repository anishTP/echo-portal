import OpenAI from 'openai';
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

    // System prompt (includes context documents if present)
    const systemPrompt = getGenerateSystemPrompt(
      params.mode, params.context, params.selectedText, params.cursorContext, params.contextDocuments
    );

    messages.push({ role: 'system', content: systemPrompt });

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
      const contentParts: OpenAI.ChatCompletionContentPart[] = [
        ...params.images.map((img) => ({
          type: 'image_url' as const,
          image_url: { url: `data:${img.mediaType};base64,${img.data}` },
        })),
        { type: 'text' as const, text: promptText },
      ];
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: promptText });
    }

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
