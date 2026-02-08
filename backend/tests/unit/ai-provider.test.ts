import { describe, it, expect } from 'vitest';
import { EchoProvider } from '../../src/services/ai/providers/echo-provider';
import type { AIStreamChunk } from '../../src/services/ai/provider-interface';
import { AIProviderRegistry } from '../../src/services/ai/provider-registry';

// ============================================
// EchoProvider Tests
// ============================================
describe('EchoProvider', () => {
  const provider = new EchoProvider();

  it('has correct id and displayName', () => {
    expect(provider.id).toBe('echo');
    expect(provider.displayName).toBe('Echo (Development)');
  });

  it('validateConfig always returns true', async () => {
    expect(await provider.validateConfig()).toBe(true);
  });

  describe('generate()', () => {
    it('streams token chunks followed by a done chunk', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.generate({ prompt: 'Hello world' })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c) => c.type === 'token');
      const doneChunks = chunks.filter((c) => c.type === 'done');

      expect(tokenChunks.length).toBeGreaterThan(0);
      expect(doneChunks).toHaveLength(1);
    });

    it('done chunk contains full content and metadata', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.generate({ prompt: 'Test prompt' })) {
        chunks.push(chunk);
      }

      const done = chunks.find((c) => c.type === 'done')!;
      expect(done.content).toBeTruthy();
      expect(done.content).toContain('Test prompt');
      expect(done.metadata).toBeDefined();
      expect(done.metadata!.tokensUsed).toBeGreaterThan(0);
      expect(done.metadata!.model).toBe('echo-v1');
      expect(done.metadata!.finishReason).toBe('stop');
    });

    it('includes prompt in generated content', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.generate({ prompt: 'My unique prompt' })) {
        chunks.push(chunk);
      }

      const done = chunks.find((c) => c.type === 'done')!;
      expect(done.content).toContain('My unique prompt');
    });

    it('includes context info when context is provided', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.generate({
        prompt: 'Generate something',
        context: 'This is existing content.',
      })) {
        chunks.push(chunk);
      }

      const done = chunks.find((c) => c.type === 'done')!;
      expect(done.content).toContain('document context');
    });

    it('truncates long prompts in the response', async () => {
      const longPrompt = 'x'.repeat(300);
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.generate({ prompt: longPrompt })) {
        chunks.push(chunk);
      }

      const done = chunks.find((c) => c.type === 'done')!;
      expect(done.content).toContain('...');
    });
  });

  describe('transform()', () => {
    it('streams token chunks followed by a done chunk', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.transform({
        selectedText: 'Hello world',
        instruction: 'rewrite',
      })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c) => c.type === 'token');
      const doneChunks = chunks.filter((c) => c.type === 'done');

      expect(tokenChunks.length).toBeGreaterThan(0);
      expect(doneChunks).toHaveLength(1);
    });

    it('includes instruction and selected text in response', async () => {
      const chunks: AIStreamChunk[] = [];
      for await (const chunk of provider.transform({
        selectedText: 'Original text here',
        instruction: 'summarize',
      })) {
        chunks.push(chunk);
      }

      const done = chunks.find((c) => c.type === 'done')!;
      expect(done.content).toContain('summarize');
      expect(done.content).toContain('Original text here');
    });
  });
});

// ============================================
// AIProviderRegistry Tests
// ============================================
describe('AIProviderRegistry', () => {
  it('registers a provider and retrieves it by id', () => {
    const registry = new AIProviderRegistry();
    const provider = new EchoProvider();
    registry.register(provider);

    expect(registry.get('echo')).toBe(provider);
    expect(registry.has('echo')).toBe(true);
  });

  it('first registered provider becomes the default', () => {
    const registry = new AIProviderRegistry();
    const provider = new EchoProvider();
    registry.register(provider);

    expect(registry.getDefault()).toBe(provider);
  });

  it('returns undefined for unregistered provider', () => {
    const registry = new AIProviderRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('getDefault returns undefined when no providers registered', () => {
    const registry = new AIProviderRegistry();
    expect(registry.getDefault()).toBeUndefined();
  });

  it('setDefault changes the default provider', () => {
    const registry = new AIProviderRegistry();

    // Create a second provider
    const echo1 = new EchoProvider();
    const echo2 = {
      id: 'mock',
      displayName: 'Mock Provider',
      generate: async function* () {},
      transform: async function* () {},
      validateConfig: async () => true,
    };

    registry.register(echo1);
    registry.register(echo2 as any);

    expect(registry.getDefault()).toBe(echo1);

    registry.setDefault('mock');
    expect(registry.getDefault()).toBe(echo2);
  });

  it('setDefault throws for unregistered provider', () => {
    const registry = new AIProviderRegistry();
    expect(() => registry.setDefault('unknown')).toThrow("Provider 'unknown' is not registered");
  });

  it('listProviders returns all registered providers', () => {
    const registry = new AIProviderRegistry();
    registry.register(new EchoProvider());

    const list = registry.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ id: 'echo', displayName: 'Echo (Development)' });
  });
});
