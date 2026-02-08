import { useCallback } from 'react';
import { useSSEStream } from './useSSEStream.js';
import { useAIStore } from '../stores/aiStore.js';
import { aiApi } from '../services/ai-api.js';
import type { AIGenerateParams, AITransformParams, AIAcceptParams } from '@echo-portal/shared';

/**
 * useAIAssist — composes useSSEStream + aiStore + ai-api for AI workflows
 *
 * Provides generate, transform, accept, reject, cancel operations.
 */
export function useAIAssist() {
  const stream = useSSEStream();
  const store = useAIStore();

  const generate = useCallback(
    async (params: AIGenerateParams) => {
      store.setStreamingStatus('streaming');
      store.setStreamingContent('');

      const url = aiApi.getGenerateUrl();
      await stream.startStream(url, {
        body: {
          ...params,
          conversationId: store.activeConversationId ?? params.conversationId,
        },
      });

      // After stream completes, update store with request info
      if (stream.requestId) {
        store.setActiveRequestId(stream.requestId);
      }
      if (stream.conversationId) {
        store.setActiveConversationId(stream.conversationId);
      }
    },
    [stream, store]
  );

  const transform = useCallback(
    async (params: AITransformParams) => {
      store.setStreamingStatus('streaming');
      store.setStreamingContent('');

      const url = aiApi.getTransformUrl();
      await stream.startStream(url, {
        body: {
          ...params,
          conversationId: store.activeConversationId ?? params.conversationId,
        },
      });

      if (stream.requestId) {
        store.setActiveRequestId(stream.requestId);
      }
      if (stream.conversationId) {
        store.setActiveConversationId(stream.conversationId);
      }
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
      store.setStreamingStatus('idle');
      store.setStreamingContent('');
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
