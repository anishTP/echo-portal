import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '../stores/notificationStore';
import { notificationKeys } from './useNotifications';
import type { Notification } from '@echo-portal/shared';

const SSE_URL = `${import.meta.env.VITE_API_URL || '/api/v1'}/notifications/stream`;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export function useNotificationSSE(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const lastEventIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    const headers: Record<string, string> = {};
    if (lastEventIdRef.current) {
      headers['Last-Event-ID'] = lastEventIdRef.current;
    }

    fetch(SSE_URL, {
      signal: controller.signal,
      credentials: 'include',
      headers,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) return;
        retryCountRef.current = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';
        let currentData = '';
        let currentId = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trim();
            } else if (line.startsWith('id:')) {
              currentId = line.slice(3).trim();
            } else if (line === '') {
              // End of event
              if (currentEvent && currentData) {
                handleSSEEvent(currentEvent, currentData, currentId);
                if (currentId) lastEventIdRef.current = currentId;
              }
              currentEvent = '';
              currentData = '';
              currentId = '';
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[SSE] Connection error:', err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          // Reconnect with exponential backoff
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, retryCountRef.current),
            RECONNECT_MAX_MS
          );
          retryCountRef.current++;
          setTimeout(connect, delay);
        }
      });
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSSEEvent = useCallback(
    (event: string, data: string, _id: string) => {
      try {
        const parsed = JSON.parse(data);

        if (event === 'notification') {
          addNotification(parsed as Notification);
          queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
        } else if (event === 'count') {
          setUnreadCount(parsed.count);
        }
      } catch {
        // Ignore malformed SSE data
      }
    },
    [addNotification, setUnreadCount, queryClient]
  );

  useEffect(() => {
    connect();
    return () => {
      controllerRef.current?.abort();
    };
  }, [connect]);
}
