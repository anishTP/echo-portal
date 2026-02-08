import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AIRequestDetail, AIConversationDetail } from '@echo-portal/shared';
import type { SSEStreamStatus } from '../hooks/useSSEStream.js';

interface AIState {
  // Panel visibility
  panelOpen: boolean;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;

  // Active conversation
  conversation: AIConversationDetail | null;
  setConversation: (conv: AIConversationDetail | null) => void;

  // Pending request (current AI request awaiting accept/reject)
  pendingRequest: AIRequestDetail | null;
  setPendingRequest: (req: AIRequestDetail | null) => void;

  // Streaming state
  streamingStatus: SSEStreamStatus;
  streamingContent: string;
  setStreamingStatus: (status: SSEStreamStatus) => void;
  setStreamingContent: (content: string) => void;

  // Current active request ID (for cancel)
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;

  // Active conversation ID
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Current branch context
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;

  // Branch-scoped cleanup (FR-016)
  clearForBranchSwitch: () => void;

  // Full reset
  reset: () => void;
}

const initialState = {
  panelOpen: false,
  conversation: null,
  pendingRequest: null,
  streamingStatus: 'idle' as SSEStreamStatus,
  streamingContent: '',
  activeRequestId: null,
  activeConversationId: null,
  activeBranchId: null,
};

export const useAIStore = create<AIState>()(
  devtools(
    (set) => ({
      ...initialState,

      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setPanelOpen: (open) => set({ panelOpen: open }),

      setConversation: (conv) => set({ conversation: conv }),
      setPendingRequest: (req) => set({ pendingRequest: req }),

      setStreamingStatus: (status) => set({ streamingStatus: status }),
      setStreamingContent: (content) => set({ streamingContent: content }),

      setActiveRequestId: (id) => set({ activeRequestId: id }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      setActiveBranchId: (id) => set({ activeBranchId: id }),

      clearForBranchSwitch: () =>
        set({
          conversation: null,
          pendingRequest: null,
          streamingStatus: 'idle',
          streamingContent: '',
          activeRequestId: null,
          activeConversationId: null,
        }),

      reset: () => set(initialState),
    }),
    { name: 'ai-store' }
  )
);
