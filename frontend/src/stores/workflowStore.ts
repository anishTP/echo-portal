import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ReviewResponse } from '../services/reviewService';
import type { TransitionHistory } from '../hooks/useWorkflow';

interface WorkflowState {
  // Current review context
  currentReview: ReviewResponse | null;
  setCurrentReview: (review: ReviewResponse | null) => void;

  // Reviews list
  reviews: ReviewResponse[];
  setReviews: (reviews: ReviewResponse[]) => void;
  addReview: (review: ReviewResponse) => void;
  updateReview: (review: ReviewResponse) => void;
  removeReview: (id: string) => void;

  // Active reviews (for current user)
  activeReviews: ReviewResponse[];
  setActiveReviews: (reviews: ReviewResponse[]) => void;

  // Transition history
  transitionHistory: TransitionHistory[];
  setTransitionHistory: (history: TransitionHistory[]) => void;

  // Loading states
  isSubmittingReview: boolean;
  setIsSubmittingReview: (isSubmitting: boolean) => void;

  isTransitioning: boolean;
  setIsTransitioning: (isTransitioning: boolean) => void;

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  setPagination: (pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set) => ({
      // Current review
      currentReview: null,
      setCurrentReview: (currentReview) => set({ currentReview }),

      // Reviews list
      reviews: [],
      setReviews: (reviews) => set({ reviews }),
      addReview: (review) =>
        set((state) => ({ reviews: [...state.reviews, review] })),
      updateReview: (review) =>
        set((state) => ({
          reviews: state.reviews.map((r) => (r.id === review.id ? review : r)),
          currentReview:
            state.currentReview?.id === review.id ? review : state.currentReview,
        })),
      removeReview: (id) =>
        set((state) => ({
          reviews: state.reviews.filter((r) => r.id !== id),
          currentReview: state.currentReview?.id === id ? null : state.currentReview,
        })),

      // Active reviews
      activeReviews: [],
      setActiveReviews: (activeReviews) => set({ activeReviews }),

      // Transition history
      transitionHistory: [],
      setTransitionHistory: (transitionHistory) => set({ transitionHistory }),

      // Loading states
      isSubmittingReview: false,
      setIsSubmittingReview: (isSubmittingReview) => set({ isSubmittingReview }),

      isTransitioning: false,
      setIsTransitioning: (isTransitioning) => set({ isTransitioning }),

      // Pagination
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      },
      setPagination: (pagination) => set({ pagination }),
    }),
    { name: 'workflow-store' }
  )
);

export default useWorkflowStore;
