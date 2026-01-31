import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedSave } from './useDebounce';
import { draftDb, createDraftId, type Draft } from '../services/draft-db';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface AutoSaveOptions {
  /** Content UUID */
  contentId: string;
  /** Branch UUID */
  branchId: string;
  /** Debounce delay in ms (default: 2000) */
  delay?: number;
  /** Callback when save completes */
  onSave?: (draft: Draft) => void;
  /** Callback when save fails */
  onError?: (error: Error) => void;
}

export interface AutoSaveState {
  /** Current save status */
  status: SaveStatus;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Last save timestamp */
  lastSavedAt: number | null;
  /** Current local version number */
  localVersion: number;
  /** Error message if save failed */
  error: string | null;
}

export interface DraftContent {
  title: string;
  body: string;
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
  };
}

export interface UseAutoSaveReturn {
  /** Current auto-save state */
  state: AutoSaveState;
  /** Save content (debounced) */
  save: (content: DraftContent) => void;
  /** Force immediate save */
  saveNow: (content: DraftContent) => Promise<void>;
  /** Cancel pending save */
  cancel: () => void;
  /** Load existing draft */
  loadDraft: () => Promise<Draft | undefined>;
  /** Mark as synced with server */
  markSynced: (serverVersionTimestamp: string) => Promise<void>;
}

/**
 * Hook for auto-saving drafts to IndexedDB with debouncing.
 * Tracks dirty state and provides save status for UI feedback.
 */
export function useAutoSave(options: AutoSaveOptions): UseAutoSaveReturn {
  const { contentId, branchId, delay = 2000, onSave, onError } = options;
  const draftId = createDraftId(contentId, branchId);

  const [state, setState] = useState<AutoSaveState>({
    status: 'idle',
    isDirty: false,
    lastSavedAt: null,
    localVersion: 0,
    error: null,
  });

  const contentRef = useRef<DraftContent | null>(null);

  // Core save function
  const performSave = useCallback(async (content: DraftContent) => {
    setState(prev => ({ ...prev, status: 'saving', error: null }));

    try {
      const existingDraft = await draftDb.drafts.get(draftId);
      const now = Date.now();
      const newVersion = (existingDraft?.localVersion ?? 0) + 1;

      const draft: Draft = {
        id: draftId,
        contentId,
        branchId,
        title: content.title,
        body: content.body,
        metadata: content.metadata ?? {},
        localVersion: newVersion,
        serverVersionTimestamp: existingDraft?.serverVersionTimestamp ?? null,
        createdAt: existingDraft?.createdAt ?? now,
        updatedAt: now,
        synced: false,
      };

      await draftDb.drafts.put(draft);

      setState(prev => ({
        ...prev,
        status: 'saved',
        isDirty: false,
        lastSavedAt: now,
        localVersion: newVersion,
        error: null,
      }));

      onSave?.(draft);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Save failed');
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
      onError?.(error);
    }
  }, [draftId, contentId, branchId, onSave, onError]);

  // Debounced save
  const { trigger, cancel, flush } = useDebouncedSave(
    (content: DraftContent) => performSave(content),
    delay
  );

  // Public save function (debounced)
  const save = useCallback((content: DraftContent) => {
    contentRef.current = content;
    setState(prev => ({ ...prev, status: 'dirty', isDirty: true }));
    trigger(content);
  }, [trigger]);

  // Force immediate save
  const saveNow = useCallback(async (content: DraftContent) => {
    cancel(); // Cancel any pending debounced save
    await performSave(content);
  }, [cancel, performSave]);

  // Load existing draft
  const loadDraft = useCallback(async () => {
    const draft = await draftDb.drafts.get(draftId);
    if (draft) {
      setState(prev => ({
        ...prev,
        localVersion: draft.localVersion,
        lastSavedAt: draft.updatedAt,
        isDirty: !draft.synced,
        status: draft.synced ? 'saved' : 'dirty',
      }));
    }
    return draft;
  }, [draftId]);

  // Mark draft as synced with server
  const markSynced = useCallback(async (serverVersionTimestamp: string) => {
    await draftDb.drafts.update(draftId, {
      synced: true,
      serverVersionTimestamp,
    });
    setState(prev => ({ ...prev, isDirty: false, status: 'saved' }));
  }, [draftId]);

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return {
    state,
    save,
    saveNow,
    cancel,
    loadDraft,
    markSynced,
  };
}
