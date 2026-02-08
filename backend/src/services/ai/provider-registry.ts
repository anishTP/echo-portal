import type { AIProvider } from './provider-interface.js';

/**
 * AIProviderRegistry — manages available AI providers (FR-011)
 *
 * Enables runtime provider selection and swapping. Phase 2 admin config
 * will use this to set approved providers per-role.
 */
export class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId: string | null = null;

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    // First registered provider becomes default
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getDefault(): AIProvider | undefined {
    if (!this.defaultProviderId) return undefined;
    return this.providers.get(this.defaultProviderId);
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider '${id}' is not registered`);
    }
    this.defaultProviderId = id;
  }

  listProviders(): Array<{ id: string; displayName: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }));
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

// Singleton instance
export const providerRegistry = new AIProviderRegistry();
