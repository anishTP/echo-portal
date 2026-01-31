import { useCallback, useEffect, useRef, useState } from 'react';
import { draftDb, type EditSession } from '../services/draft-db';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_SESSION_THRESHOLD = 3600000; // 1 hour

export interface EditSessionOptions {
  /** Content UUID */
  contentId: string;
  /** Branch UUID */
  branchId: string;
  /** User UUID */
  userId: string;
  /** Optional device ID (browser fingerprint) */
  deviceId?: string;
  /** Callback when stale session detected */
  onStaleSession?: (sessions: EditSession[]) => void;
}

export interface EditSessionState {
  /** Current session ID */
  sessionId: string | null;
  /** Session start time */
  startedAt: number | null;
  /** Last activity time */
  lastActivityAt: number | null;
  /** Whether this is a recovered session */
  isRecovered: boolean;
  /** Other active sessions (multi-tab/device detection) */
  otherSessions: EditSession[];
}

export interface UseEditSessionReturn {
  state: EditSessionState;
  /** Start or resume a session */
  startSession: () => Promise<void>;
  /** Update last activity timestamp */
  recordActivity: () => void;
  /** End the session */
  endSession: () => Promise<void>;
  /** Check for stale sessions (crash recovery) */
  checkStaleSessions: () => Promise<EditSession[]>;
  /** Clean up stale sessions */
  cleanupStaleSessions: () => Promise<void>;
}

/**
 * Generates a simple device ID from browser properties.
 */
function generateDeviceId(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ];
  // Simple hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return `device-${Math.abs(hash).toString(36)}`;
}

/**
 * Generates a session UUID.
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hook for tracking editing sessions for crash recovery and multi-tab detection.
 */
export function useEditSession(options: EditSessionOptions): UseEditSessionReturn {
  const { contentId, branchId, userId, deviceId: customDeviceId, onStaleSession } = options;

  const deviceId = customDeviceId ?? generateDeviceId();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [state, setState] = useState<EditSessionState>({
    sessionId: null,
    startedAt: null,
    lastActivityAt: null,
    isRecovered: false,
    otherSessions: [],
  });

  // Check for existing sessions (multi-tab/crash detection)
  const checkExistingSessions = useCallback(async () => {
    const sessions = await draftDb.editSessions
      .where('[contentId+branchId]')
      .equals([contentId, branchId])
      .toArray();

    const now = Date.now();
    const activeSessions = sessions.filter(s =>
      s.id !== sessionIdRef.current &&
      now - s.lastActivityAt < STALE_SESSION_THRESHOLD
    );

    setState(prev => ({ ...prev, otherSessions: activeSessions }));

    return sessions;
  }, [contentId, branchId]);

  // Check for stale sessions (crash recovery)
  const checkStaleSessions = useCallback(async () => {
    const threshold = Date.now() - STALE_SESSION_THRESHOLD;
    const staleSessions = await draftDb.editSessions
      .where('lastActivityAt')
      .below(threshold)
      .filter(s => s.contentId === contentId && s.branchId === branchId)
      .toArray();

    if (staleSessions.length > 0) {
      onStaleSession?.(staleSessions);
    }

    return staleSessions;
  }, [contentId, branchId, onStaleSession]);

  // Clean up stale sessions
  const cleanupStaleSessions = useCallback(async () => {
    const threshold = Date.now() - STALE_SESSION_THRESHOLD;
    await draftDb.editSessions
      .where('lastActivityAt')
      .below(threshold)
      .delete();
  }, []);

  // Start or resume a session
  const startSession = useCallback(async () => {
    const existingSessions = await checkExistingSessions();

    // Check if we have a session from this device that might be from a crash
    const myDeviceSession = existingSessions.find(s =>
      s.deviceId === deviceId && s.userId === userId
    );

    const now = Date.now();
    let session: EditSession;
    let isRecovered = false;

    if (myDeviceSession && now - myDeviceSession.lastActivityAt < STALE_SESSION_THRESHOLD) {
      // Resume existing session
      session = {
        ...myDeviceSession,
        lastActivityAt: now,
      };
      isRecovered = true;
      await draftDb.editSessions.put(session);
    } else {
      // Create new session
      const sessionId = generateSessionId();
      session = {
        id: sessionId,
        contentId,
        branchId,
        userId,
        deviceId,
        startedAt: now,
        lastActivityAt: now,
      };
      await draftDb.editSessions.put(session);
    }

    sessionIdRef.current = session.id;

    setState(prev => ({
      ...prev,
      sessionId: session.id,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      isRecovered,
    }));

    // Start heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = setInterval(() => {
      recordActivity();
    }, HEARTBEAT_INTERVAL);

    // Check for stale sessions on start
    await checkStaleSessions();
  }, [contentId, branchId, userId, deviceId, checkExistingSessions, checkStaleSessions]);

  // Record user activity
  const recordActivity = useCallback(() => {
    if (!sessionIdRef.current) return;

    const now = Date.now();
    draftDb.editSessions.update(sessionIdRef.current, {
      lastActivityAt: now,
    });

    setState(prev => ({ ...prev, lastActivityAt: now }));
  }, []);

  // End the session
  const endSession = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (sessionIdRef.current) {
      await draftDb.editSessions.delete(sessionIdRef.current);
      sessionIdRef.current = null;
    }

    setState({
      sessionId: null,
      startedAt: null,
      lastActivityAt: null,
      isRecovered: false,
      otherSessions: [],
    });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      // End session on unmount (but don't await since we're in cleanup)
      if (sessionIdRef.current) {
        draftDb.editSessions.delete(sessionIdRef.current);
      }
    };
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recordActivity();
        checkExistingSessions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recordActivity, checkExistingSessions]);

  // Handle beforeunload to clean up session
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        // Use sendBeacon for reliable cleanup
        // For now, just update the timestamp so other tabs know we're gone
        draftDb.editSessions.update(sessionIdRef.current, {
          lastActivityAt: Date.now(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    state,
    startSession,
    recordActivity,
    endSession,
    checkStaleSessions,
    cleanupStaleSessions,
  };
}
