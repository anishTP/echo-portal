import { db } from '../../db/index.js';
import { aiConfigurations } from '../../db/schema/ai-configurations.js';
import { eq, and } from 'drizzle-orm';
import { AI_DEFAULTS } from '@echo-portal/shared';
import type { AIConfiguration } from '../../db/schema/ai-configurations.js';

/**
 * AIConfigService — admin configuration management for AI constraints (FR-010)
 *
 * Manages global and per-role settings: enabled/disabled, rate limits,
 * token limits, approved providers, etc.
 */
export class AIConfigService {
  /**
   * Get a config value by scope and key.
   */
  async get(scope: string, key: string): Promise<unknown | null> {
    const results = await db
      .select()
      .from(aiConfigurations)
      .where(and(eq(aiConfigurations.scope, scope), eq(aiConfigurations.key, key)))
      .limit(1);

    return results[0]?.value ?? null;
  }

  /**
   * Set a config value (upsert).
   */
  async update(scope: string, key: string, value: unknown, updatedBy: string): Promise<AIConfiguration> {
    const [result] = await db
      .insert(aiConfigurations)
      .values({ scope, key, value, updatedBy })
      .onConflictDoUpdate({
        target: [aiConfigurations.scope, aiConfigurations.key],
        set: { value, updatedBy, updatedAt: new Date() },
      })
      .returning();

    return result;
  }

  /**
   * Get all config entries for a given scope.
   */
  async getForScope(scope: string): Promise<AIConfiguration[]> {
    return db
      .select()
      .from(aiConfigurations)
      .where(eq(aiConfigurations.scope, scope));
  }

  /**
   * Check if AI is enabled (global or for a specific role).
   */
  async isEnabled(role?: string): Promise<boolean> {
    // Check role-specific override first
    if (role) {
      const roleEnabled = await this.get(`role:${role}`, 'enabled');
      if (roleEnabled !== null) return roleEnabled === true;
    }
    // Fall back to global
    const globalEnabled = await this.get('global', 'enabled');
    return globalEnabled !== false; // Default: enabled
  }

  /**
   * Get effective limits for a user's role.
   */
  async getEffectiveLimits(role?: string): Promise<{
    maxTokens: number;
    rateLimit: number;
    maxTurns: number;
  }> {
    let maxTokens: number = AI_DEFAULTS.MAX_TOKENS_PER_REQUEST;
    let rateLimit: number = AI_DEFAULTS.RATE_LIMIT_PER_HOUR;
    let maxTurns: number = AI_DEFAULTS.MAX_TURNS_PER_CONVERSATION;

    // Check role-specific first, then global, then hardcoded defaults
    for (const scope of [role ? `role:${role}` : null, 'global'].filter(Boolean) as string[]) {
      const maxTokensVal = await this.get(scope, 'max_tokens');
      const rateLimitVal = await this.get(scope, 'rate_limit');
      const maxTurnsVal = await this.get(scope, 'max_turns');

      if (maxTokensVal !== null) maxTokens = maxTokensVal as number;
      if (rateLimitVal !== null) rateLimit = rateLimitVal as number;
      if (maxTurnsVal !== null) maxTurns = maxTurnsVal as number;
    }

    return { maxTokens, rateLimit, maxTurns };
  }

  /**
   * Get full config for admin display.
   */
  async getFullConfig(): Promise<{
    global: Record<string, unknown>;
    roles: Record<string, Record<string, unknown>>;
  }> {
    const allConfig = await db.select().from(aiConfigurations);

    const global: Record<string, unknown> = {};
    const roles: Record<string, Record<string, unknown>> = {};

    for (const entry of allConfig) {
      if (entry.scope === 'global') {
        global[entry.key] = entry.value;
      } else if (entry.scope.startsWith('role:')) {
        const roleName = entry.scope.slice(5);
        if (!roles[roleName]) roles[roleName] = {};
        roles[roleName][entry.key] = entry.value;
      }
    }

    return { global, roles };
  }
}

export const aiConfigService = new AIConfigService();
