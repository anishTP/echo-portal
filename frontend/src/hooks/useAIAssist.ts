import { useCallback, useEffect } from 'react';
import { useSSEStream } from './useSSEStream.js';
import { useAIStore } from '../stores/aiStore.js';
import { aiApi } from '../services/ai-api.js';
import type { AIGenerateParams, AITransformParams, AIAcceptParams } from '@echo-portal/shared';

/**
 * useAIAssist — composes useSSEStream + aiStore + ai-api for AI workflows
 *
 * Provides generate, transform, accept, reject, cancel operations.
 * Uses useEffect to sync stream metadata to the store (avoids stale closures).
 */
export function useAIAssist() {
  const stream = useSSEStream();
  const store = useAIStore();

  // Sync stream metadata to store reactively (avoids stale closure issue)
  useEffect(() => {
    if (stream.requestId) {
      store.setActiveRequestId(stream.requestId);
    }
  }, [stream.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stream.conversationId) {
      store.setActiveConversationId(stream.conversationId);
    }
  }, [stream.conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync streaming status and content to store
  useEffect(() => {
    store.setStreamingStatus(stream.status);
  }, [stream.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    store.setStreamingContent(stream.content);
  }, [stream.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(
    async (params: AIGenerateParams) => {
      const url = aiApi.getGenerateUrl();
      await stream.startStream(url, {
        body: {
          ...params,
          conversationId: store.activeConversationId ?? params.conversationId,
        },
      });
      // Metadata sync is handled by useEffect above
    },
    [stream, store]
  );

  const transform = useCallback(
    async (params: AITransformParams) => {
      const url = aiApi.getTransformUrl();
      await stream.startStream(url, {
        body: {
          ...params,
          conversationId: store.activeConversationId ?? params.conversationId,
        },
      });
      // Metadata sync is handled by useEffect above
    },
    [stream, store]
  );

  const accept = useCallback(
    async (requestId: string, params: AIAcceptParams) => {
      const result = await aiApi.accept(requestId, params);
      store.setPendingRequest(null);
      store.setActiveRequestId(null);
      return result;
    },
    [store]
  );

  const reject = useCallback(
    async (requestId: string, reason?: string) => {
      await aiApi.reject(requestId, reason ? { reason } : undefined);
      store.setPendingRequest(null);
      store.setActiveRequestId(null);
    },
    [store]
  );

  const cancel = useCallback(
    async (requestId: string) => {
      stream.abort();
      await aiApi.cancel(requestId);
      store.setActiveRequestId(null);
    },
    [stream, store]
  );

  return {
    // Actions
    generate,
    transform,
    accept,
    reject,
    cancel,

    // Stream state
    streamContent: stream.content,
    streamStatus: stream.status,
    streamError: stream.error,
    streamRequestId: stream.requestId,
    streamConversationId: stream.conversationId,
    abortStream: stream.abort,
    resetStream: stream.reset,
  };
}
