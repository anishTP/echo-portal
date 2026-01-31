import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Timestamp of last connectivity change */
  lastChanged: number;
  /** Manually trigger an online check */
  checkOnline: () => boolean;
}

/**
 * Hook to detect online/offline status and handle reconnection.
 * Uses browser's navigator.onLine API with event listeners.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastChanged, setLastChanged] = useState(Date.now);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastChanged(Date.now());
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastChanged(Date.now());
  }, []);

  const checkOnline = useCallback(() => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (online !== isOnline) {
      setIsOnline(online);
      setLastChanged(Date.now());
    }
    return online;
  }, [isOnline]);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for visibility changes to recheck connectivity
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleOnline, handleOffline, checkOnline]);

  return { isOnline, lastChanged, checkOnline };
}

/**
 * Event emitter for online status changes.
 * Allows components to subscribe without re-rendering.
 */
type OnlineListener = (isOnline: boolean) => void;
const listeners = new Set<OnlineListener>();

export function subscribeToOnlineStatus(listener: OnlineListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Set up global listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    listeners.forEach(l => l(true));
  });
  window.addEventListener('offline', () => {
    listeners.forEach(l => l(false));
  });
}
