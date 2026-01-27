import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ContentDetail, ContentSummary, ContentVersionSummary } from '@echo-portal/shared';

interface ContentState {
  // Current content being edited
  currentContent: ContentDetail | null;
  setCurrentContent: (content: ContentDetail | null) => void;

  // Content list for current branch
  branchContents: ContentSummary[];
  setBranchContents: (contents: ContentSummary[]) => void;

  // Version history for current content
  versions: ContentVersionSummary[];
  setVersions: (versions: ContentVersionSummary[]) => void;

  // Editing state
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Filter state for content list
  filters: {
    contentType: string;
    category: string;
    search: string;
  };
  setFilters: (filters: Partial<ContentState['filters']>) => void;
  clearFilters: () => void;
}

export const useContentStore = create<ContentState>()(
  devtools(
    (set) => ({
      currentContent: null,
      setCurrentContent: (content) => set({ currentContent: content }),

      branchContents: [],
      setBranchContents: (contents) => set({ branchContents: contents }),

      versions: [],
      setVersions: (versions) => set({ versions }),

      isDirty: false,
      setIsDirty: (dirty) => set({ isDirty: dirty }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      filters: {
        contentType: '',
        category: '',
        search: '',
      },
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      clearFilters: () =>
        set({
          filters: {
            contentType: '',
            category: '',
            search: '',
          },
        }),
    }),
    { name: 'content-store' }
  )
);

export default useContentStore;
