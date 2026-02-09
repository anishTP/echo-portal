import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AIStreamChunk } from '../../src/services/ai/provider-interface';

// Build a mock stream that yields content_block_delta events and has finalMessage()
function createMockStream(text: string) {
  const events = text.split('').map((char) => ({
    type: 'content_block_delta' as const,
    delta: { type: 'text_delta' as const, text: char },
  }));

  let resolvePromise: (value: unknown) => void;
  const finalPromise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const stream = {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
    finalMessage: vi.fn().mockResolvedValue({
      stop_reason: 'stop',
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  };

  return stream;
}

// Capture what the provider sends to the Anthropic SDK
let capturedStreamArgs: any = null;
let mockStream = createMockStream('Hello response');

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockImplementation((args: any) => {
          capturedStreamArgs = args;
          return mockStream;
        }),
      },
    })),
  };
});

import { AnthropicProvider } from '../../src/services/ai/providers/anthropic-provider';

describe('AnthropicProvider — Context Documents & Images', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedStreamArgs = null;
    mockStream = createMockStream('Generated content');
    provider = new AnthropicProvider({ apiKey: 'test-key' });
  });

  async function collectChunks(iterable: AsyncIterable<AIStreamChunk>): Promise<AIStreamChunk[]> {
    const chunks: AIStreamChunk[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe('context documents in system prompt', () => {
    it('includes Reference Materials block when contextDocuments are provided', async () => {
      const contextDocuments = [
        { title: 'Brand Guidelines', content: 'Always use formal tone.' },
        { title: 'Style Guide', content: 'Use active voice.' },
      ];

      await collectChunks(
        provider.generate({
          prompt: 'Write an introduction',
          contextDocuments,
        })
      );

      expect(capturedStreamArgs).not.toBeNull();
      const system = capturedStreamArgs.system as string;
      expect(system).toContain('--- Reference Materials ---');
      expect(system).toContain('## Brand Guidelines');
      expect(system).toContain('Always use formal tone.');
      expect(system).toContain('## Style Guide');
      expect(system).toContain('Use active voice.');
      expect(system).toContain('--- End Reference Materials ---');
    });

    it('does NOT include Reference Materials block when no contextDocuments are provided', async () => {
      await collectChunks(
        provider.generate({
          prompt: 'Write an introduction',
        })
      );

      expect(capturedStreamArgs).not.toBeNull();
      const system = capturedStreamArgs.system as string;
      expect(system).not.toContain('--- Reference Materials ---');
      expect(system).not.toContain('--- End Reference Materials ---');
    });

    it('does NOT include Reference Materials block when contextDocuments is empty array', async () => {
      await collectChunks(
        provider.generate({
          prompt: 'Write an introduction',
          contextDocuments: [],
        })
      );

      expect(capturedStreamArgs).not.toBeNull();
      const system = capturedStreamArgs.system as string;
      expect(system).not.toContain('--- Reference Materials ---');
    });

    it('context documents appear in correct order in system prompt', async () => {
      const contextDocuments = [
        { title: 'First Document', content: 'First content.' },
        { title: 'Second Document', content: 'Second content.' },
        { title: 'Third Document', content: 'Third content.' },
      ];

      await collectChunks(
        provider.generate({
          prompt: 'Write something',
          contextDocuments,
        })
      );

      const system = capturedStreamArgs.system as string;

      const firstIndex = system.indexOf('## First Document');
      const secondIndex = system.indexOf('## Second Document');
      const thirdIndex = system.indexOf('## Third Document');

      expect(firstIndex).toBeGreaterThan(-1);
      expect(secondIndex).toBeGreaterThan(-1);
      expect(thirdIndex).toBeGreaterThan(-1);
      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('includes context documents across different modes', async () => {
      const contextDocuments = [
        { title: 'Tone Guide', content: 'Be concise.' },
      ];

      // Test with 'analyse' mode
      await collectChunks(
        provider.generate({
          prompt: 'Review this content',
          mode: 'analyse',
          contextDocuments,
        })
      );

      const analyseSystem = capturedStreamArgs.system as string;
      expect(analyseSystem).toContain('--- Reference Materials ---');
      expect(analyseSystem).toContain('## Tone Guide');
      expect(analyseSystem).toContain('content reviewer');

      // Test with 'replace' mode
      mockStream = createMockStream('Replaced content');
      provider = new AnthropicProvider({ apiKey: 'test-key' });

      await collectChunks(
        provider.generate({
          prompt: 'Rewrite this',
          mode: 'replace',
          contextDocuments,
        })
      );

      const replaceSystem = capturedStreamArgs.system as string;
      expect(replaceSystem).toContain('--- Reference Materials ---');
      expect(replaceSystem).toContain('## Tone Guide');
      expect(replaceSystem).toContain('content editor');
    });
  });

  describe('multimodal image messages', () => {
    it('sends user message as content array with image blocks and text when images provided', async () => {
      const images = [
        { mediaType: 'image/png', data: 'base64encodeddata1' },
        { mediaType: 'image/jpeg', data: 'base64encodeddata2' },
      ];

      await collectChunks(
        provider.generate({
          prompt: 'Describe these images',
          images,
        })
      );

      expect(capturedStreamArgs).not.toBeNull();
      const messages = capturedStreamArgs.messages;
      expect(messages).toHaveLength(1);

      const userMessage = messages[0];
      expect(userMessage.role).toBe('user');
      // Content should be an array (multimodal), not a string
      expect(Array.isArray(userMessage.content)).toBe(true);

      const contentParts = userMessage.content as any[];
      // Two image blocks + one text block
      expect(contentParts).toHaveLength(3);

      // First two should be image blocks
      expect(contentParts[0].type).toBe('image');
      expect(contentParts[0].source.type).toBe('base64');
      expect(contentParts[0].source.media_type).toBe('image/png');
      expect(contentParts[0].source.data).toBe('base64encodeddata1');

      expect(contentParts[1].type).toBe('image');
      expect(contentParts[1].source.type).toBe('base64');
      expect(contentParts[1].source.media_type).toBe('image/jpeg');
      expect(contentParts[1].source.data).toBe('base64encodeddata2');

      // Last should be text block
      expect(contentParts[2].type).toBe('text');
      expect(contentParts[2].text).toContain('Describe these images');
    });

    it('sends user message as a simple string when no images provided', async () => {
      await collectChunks(
        provider.generate({
          prompt: 'Write something without images',
        })
      );

      expect(capturedStreamArgs).not.toBeNull();
      const messages = capturedStreamArgs.messages;
      expect(messages).toHaveLength(1);

      const userMessage = messages[0];
      expect(userMessage.role).toBe('user');
      // Content should be a plain string, not an array
      expect(typeof userMessage.content).toBe('string');
      expect(userMessage.content).toBe('Write something without images');
    });

    it('sends user message as a simple string when images is an empty array', async () => {
      await collectChunks(
        provider.generate({
          prompt: 'No images here',
          images: [],
        })
      );

      const messages = capturedStreamArgs.messages;
      const userMessage = messages[0];
      expect(typeof userMessage.content).toBe('string');
      expect(userMessage.content).toBe('No images here');
    });

    it('includes selected text prefix in image message text block', async () => {
      const images = [{ mediaType: 'image/png', data: 'imgdata' }];

      await collectChunks(
        provider.generate({
          prompt: 'Explain this diagram',
          selectedText: 'The architecture overview',
          images,
        })
      );

      const messages = capturedStreamArgs.messages;
      const userMessage = messages[0];
      const contentParts = userMessage.content as any[];
      const textBlock = contentParts.find((p: any) => p.type === 'text');

      expect(textBlock.text).toContain('[Selected text: The architecture overview]');
      expect(textBlock.text).toContain('Explain this diagram');
    });
  });

  describe('streaming output', () => {
    it('yields token chunks and a done chunk with metadata', async () => {
      mockStream = createMockStream('OK');
      provider = new AnthropicProvider({ apiKey: 'test-key' });

      const chunks = await collectChunks(
        provider.generate({ prompt: 'Hello' })
      );

      const tokenChunks = chunks.filter((c) => c.type === 'token');
      const doneChunks = chunks.filter((c) => c.type === 'done');

      expect(tokenChunks).toHaveLength(2); // 'O' and 'K'
      expect(tokenChunks[0].content).toBe('O');
      expect(tokenChunks[1].content).toBe('K');

      expect(doneChunks).toHaveLength(1);
      expect(doneChunks[0].content).toBe('OK');
      expect(doneChunks[0].metadata).toBeDefined();
      expect(doneChunks[0].metadata!.tokensUsed).toBe(150); // 100 input + 50 output
      expect(doneChunks[0].metadata!.finishReason).toBe('stop');
    });
  });
});
