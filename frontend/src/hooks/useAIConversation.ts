import { useEffect, useCallback } from 'react';
import { useAIStore } from '../stores/aiStore.js';
import { aiApi } from '../services/ai-api.js';
import type { AIConversationDetail } from '@echo-portal/shared';

/**
 * useAIConversation — multi-turn conversation state management (FR-015, FR-016)
 *
 * Handles loading active conversation on mount, branch-switch cleanup,
 * and turn counting.
 */
export function useAIConversation(branchId: string | null) {
  const store = useAIStore();

  // Load active conversation when branch changes
  useEffect(() => {
    if (!branchId) return;

    // Branch switch detection (FR-016)
    if (store.activeBranchId && store.activeBranchId !== branchId) {
      // Clear conversation for previous branch
      if (store.activeConversationId) {
        aiApi.clearConversation(store.activeConversationId).catch(() => {
          // Best-effort cleanup; server will expire it
        });
      }
      store.clearForBranchSwitch();
    }

    store.setActiveBranchId(branchId);

    // Load existing conversation for this branch
    aiApi
      .getConversation(branchId)
      .then((result) => {
        // The API wraps in data envelope; handle both shapes
        const conv = (result as any)?.conversation ?? result;
        if (conv) {
          store.setConversation(conv);
          store.setActiveConversationId(conv.id);
        }
      })
      .catch(() => {
        // No active conversation — that's fine
      });
  }, [branchId]);

  const clearConversation = useCallback(async () => {
    if (store.activeConversationId) {
      await aiApi.clearConversation(store.activeConversationId);
      store.setConversation(null);
      store.setActiveConversationId(null);
      store.setPendingRequest(null);
    }
  }, [store]);

  const refreshConversation = useCallback(async () => {
    if (!branchId) return;
    try {
      const result = await aiApi.getConversation(branchId);
      const conv = (result as any)?.conversation ?? result;
      if (conv) {
        store.setConversation(conv);
        store.setActiveConversationId(conv.id);
      }
    } catch {
      // ignore
    }
  }, [branchId, store]);

  return {
    conversation: store.conversation,
    conversationId: store.activeConversationId,
    turnCount: store.conversation?.turnCount ?? 0,
    maxTurns: store.conversation?.maxTurns ?? 20,
    hasRemainingTurns: (store.conversation?.turnCount ?? 0) < (store.conversation?.maxTurns ?? 20),
    clearConversation,
    refreshConversation,
  };
}
