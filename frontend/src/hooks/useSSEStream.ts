import { useState, useCallback, useRef } from 'react';

export type SSEStreamStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled';

interface SSEStreamState {
  content: string;
  status: SSEStreamStatus;
  error: Error | null;
  requestId: string | null;
  conversationId: string | null;
}

/**
 * useSSEStream — SSE streaming hook using fetch() + ReadableStream
 *
 * Uses fetch() instead of EventSource to support auth headers and POST.
 * Provides AbortController-based cancellation (FR-019).
 */
export function useSSEStream() {
  const [state, setState] = useState<SSEStreamState>({
    content: '',
    status: 'idle',
    error: null,
    requestId: null,
    conversationId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (url: string, options?: { body?: object }) => {
      // Abort any existing stream
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        content: '',
        status: 'streaming',
        error: null,
        requestId: null,
        conversationId: null,
      });

      try {
        // Build auth headers (match api.ts pattern)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (localStorage.getItem('dev_auth') === 'true') {
          const token =
            '00000000-0000-0000-0000-000000000001:dev@example.com:contributor,reviewer,publisher,administrator';
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body for SSE stream');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);

                if (currentEvent === 'meta') {
                  setState((prev) => ({
                    ...prev,
                    requestId: parsed.requestId ?? null,
                    conversationId: parsed.conversationId ?? null,
                  }));
                } else if (currentEvent === 'token') {
                  accumulated += parsed.content ?? '';
                  setState((prev) => ({
                    ...prev,
                    content: accumulated,
                  }));
                } else if (currentEvent === 'done') {
                  setState((prev) => ({
                    ...prev,
                    content: parsed.fullContent ?? accumulated,
                    status: 'complete',
                    requestId: parsed.requestId ?? prev.requestId,
                  }));
                  return;
                } else if (currentEvent === 'error') {
                  throw new Error(parsed.message || 'Stream error');
                }
              } catch (parseError) {
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }

        // Stream ended without 'done' event
        setState((prev) => ({
          ...prev,
          status: prev.status === 'streaming' ? 'complete' : prev.status,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setState((prev) => ({ ...prev, status: 'cancelled' }));
          return;
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error : new Error('Unknown error'),
        }));
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({ ...prev, status: 'cancelled' }));
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      content: '',
      status: 'idle',
      error: null,
      requestId: null,
      conversationId: null,
    });
  }, []);

  return {
    ...state,
    startStream,
    abort,
    reset,
  };
}
