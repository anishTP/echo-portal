import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BranchResponse } from '../services/branchService';

interface BranchState {
  // Current branch being viewed/edited
  currentBranch: BranchResponse | null;
  setCurrentBranch: (branch: BranchResponse | null) => void;

  // List of user's branches
  myBranches: BranchResponse[];
  setMyBranches: (branches: BranchResponse[]) => void;

  // List of branches for review
  reviewBranches: BranchResponse[];
  setReviewBranches: (branches: BranchResponse[]) => void;

  // Branch creation form state
  isCreating: boolean;
  setIsCreating: (creating: boolean) => void;

  // Filter state for branch list
  filters: {
    state: string[];
    visibility: string[];
    search: string;
  };
  setFilters: (filters: Partial<BranchState['filters']>) => void;
  clearFilters: () => void;

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  setPagination: (pagination: Partial<BranchState['pagination']>) => void;

  // Update a branch in the lists
  updateBranchInLists: (branch: BranchResponse) => void;

  // Remove a branch from lists
  removeBranchFromLists: (branchId: string) => void;
}

export const useBranchStore = create<BranchState>()(
  devtools(
    (set) => ({
      currentBranch: null,
      setCurrentBranch: (branch) => set({ currentBranch: branch }),

      myBranches: [],
      setMyBranches: (branches) => set({ myBranches: branches }),

      reviewBranches: [],
      setReviewBranches: (branches) => set({ reviewBranches: branches }),

      isCreating: false,
      setIsCreating: (creating) => set({ isCreating: creating }),

      filters: {
        state: [],
        visibility: [],
        search: '',
      },
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      clearFilters: () =>
        set({
          filters: {
            state: [],
            visibility: [],
            search: '',
          },
        }),

      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      },
      setPagination: (pagination) =>
        set((state) => ({
          pagination: { ...state.pagination, ...pagination },
        })),

      updateBranchInLists: (branch) =>
        set((state) => ({
          myBranches: state.myBranches.map((b) => (b.id === branch.id ? branch : b)),
          reviewBranches: state.reviewBranches.map((b) => (b.id === branch.id ? branch : b)),
          currentBranch: state.currentBranch?.id === branch.id ? branch : state.currentBranch,
        })),

      removeBranchFromLists: (branchId) =>
        set((state) => ({
          myBranches: state.myBranches.filter((b) => b.id !== branchId),
          reviewBranches: state.reviewBranches.filter((b) => b.id !== branchId),
          currentBranch: state.currentBranch?.id === branchId ? null : state.currentBranch,
        })),
    }),
    { name: 'branch-store' }
  )
);

export default useBranchStore;
