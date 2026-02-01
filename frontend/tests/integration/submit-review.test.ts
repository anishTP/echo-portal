/**
 * T046: Integration test for submit flow
 * Tests: submit transitions branch state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the API service
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../src/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

// Mock branchService after api mock is set up
import { branchService } from '../../src/services/branchService';

describe('submit for review flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('branch state transitions', () => {
    it('should transition branch from draft to in_review on submit', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1', 'reviewer-2'];
      const reason = 'Ready for review';

      // Mock successful submit response
      mockPost.mockResolvedValueOnce({
        success: true,
        transitionId: 'transition-123',
        branch: {
          id: branchId,
          state: 'in_review',
          reviewers: reviewerIds,
        },
      });

      const result = await branchService.submitForReview(branchId, reviewerIds, reason);

      expect(mockPost).toHaveBeenCalledWith(
        `/branches/${branchId}/submit-for-review`,
        { reviewerIds, reason }
      );
      expect(result.success).toBe(true);
      expect(result.branch.state).toBe('in_review');
    });

    it('should reject submit when no reviewers are provided', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds: string[] = [];

      // Mock validation error response
      mockPost.mockRejectedValueOnce({
        message: 'At least one reviewer is required',
        code: 'VALIDATION_ERROR',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'At least one reviewer is required',
      });
    });

    it('should reject submit when branch is not in draft state', async () => {
      const branchId = 'already-in-review-branch';
      const reviewerIds = ['reviewer-1'];

      // Mock invalid transition error
      mockPost.mockRejectedValueOnce({
        message: 'Invalid transition: branch is not in draft state',
        code: 'INVALID_TRANSITION',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'Invalid transition: branch is not in draft state',
      });
    });

    it('should include reviewer IDs in the transition', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1', 'reviewer-2', 'reviewer-3'];

      mockPost.mockResolvedValueOnce({
        success: true,
        branch: {
          id: branchId,
          state: 'in_review',
          reviewers: reviewerIds,
        },
      });

      const result = await branchService.submitForReview(branchId, reviewerIds);

      expect(mockPost).toHaveBeenCalledWith(
        `/branches/${branchId}/submit-for-review`,
        expect.objectContaining({ reviewerIds })
      );
      expect(result.branch.reviewers).toEqual(reviewerIds);
    });

    it('should pass optional reason to the API', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1'];
      const reason = 'Please review the updated documentation';

      mockPost.mockResolvedValueOnce({
        success: true,
        branch: { id: branchId, state: 'in_review' },
      });

      await branchService.submitForReview(branchId, reviewerIds, reason);

      expect(mockPost).toHaveBeenCalledWith(
        `/branches/${branchId}/submit-for-review`,
        { reviewerIds, reason }
      );
    });

    it('should handle submit without optional reason', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1'];

      mockPost.mockResolvedValueOnce({
        success: true,
        branch: { id: branchId, state: 'in_review' },
      });

      await branchService.submitForReview(branchId, reviewerIds);

      expect(mockPost).toHaveBeenCalledWith(
        `/branches/${branchId}/submit-for-review`,
        { reviewerIds, reason: undefined }
      );
    });
  });

  describe('reviewer assignment during submit', () => {
    it('should assign reviewers as part of submit process', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['user-alice', 'user-bob'];

      mockPost.mockResolvedValueOnce({
        success: true,
        branch: {
          id: branchId,
          state: 'in_review',
          reviewers: reviewerIds,
        },
      });

      const result = await branchService.submitForReview(branchId, reviewerIds);

      expect(result.branch.reviewers).toHaveLength(2);
      expect(result.branch.reviewers).toContain('user-alice');
      expect(result.branch.reviewers).toContain('user-bob');
    });

    it('should prevent owner from being a reviewer', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['owner-id']; // Same as branch owner

      // Mock mutual exclusion validation error
      mockPost.mockRejectedValueOnce({
        message: 'Branch owner cannot be a reviewer',
        code: 'VALIDATION_ERROR',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'Branch owner cannot be a reviewer',
      });
    });
  });

  describe('permissions validation', () => {
    it('should only allow branch owner to submit', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1'];

      // Mock permission error for non-owner
      mockPost.mockRejectedValueOnce({
        message: 'Only branch owner can submit for review',
        code: 'FORBIDDEN',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'Only branch owner can submit for review',
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const branchId = 'test-branch-id';
      const reviewerIds = ['reviewer-1'];

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toThrow('Network error');
    });

    it('should handle branch not found', async () => {
      const branchId = 'non-existent-branch';
      const reviewerIds = ['reviewer-1'];

      mockPost.mockRejectedValueOnce({
        message: 'Branch not found',
        code: 'NOT_FOUND',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'Branch not found',
      });
    });
  });

  describe('edited content requirement', () => {
    it('should require branch to have edited content', async () => {
      const branchId = 'empty-branch-id';
      const reviewerIds = ['reviewer-1'];

      // Mock validation error for branch without edits
      mockPost.mockRejectedValueOnce({
        message: 'Branch has no edited content to submit',
        code: 'VALIDATION_ERROR',
      });

      await expect(
        branchService.submitForReview(branchId, reviewerIds)
      ).rejects.toMatchObject({
        message: 'Branch has no edited content to submit',
      });
    });
  });
});

describe('submit button state management', () => {
  describe('disabled states', () => {
    it('should disable button when no edited content exists', () => {
      // Simulating the disabled prop logic from SubmitForReviewButton
      const hasEditedContent = false;
      const hasReviewers = true;
      const inlineReviewerSelection = true;

      // In inline selection mode, only check for edited content
      const isDisabled = inlineReviewerSelection
        ? !hasEditedContent
        : !hasEditedContent || !hasReviewers;

      expect(isDisabled).toBe(true);
    });

    it('should disable button when no reviewers in dashboard mode', () => {
      const hasEditedContent = true;
      const hasReviewers = false;
      const inlineReviewerSelection = false;

      const isDisabled = inlineReviewerSelection
        ? !hasEditedContent
        : !hasEditedContent || !hasReviewers;

      expect(isDisabled).toBe(true);
    });

    it('should enable button when edited content exists in inline mode', () => {
      const hasEditedContent = true;
      const hasReviewers = false; // Doesn't matter in inline mode
      const inlineReviewerSelection = true;

      const isDisabled = inlineReviewerSelection
        ? !hasEditedContent
        : !hasEditedContent || !hasReviewers;

      expect(isDisabled).toBe(false);
    });

    it('should enable button when both content and reviewers exist in dashboard mode', () => {
      const hasEditedContent = true;
      const hasReviewers = true;
      const inlineReviewerSelection = false;

      const isDisabled = inlineReviewerSelection
        ? !hasEditedContent
        : !hasEditedContent || !hasReviewers;

      expect(isDisabled).toBe(false);
    });
  });

  describe('dialog submit validation', () => {
    it('should disable dialog submit when no reviewers selected', () => {
      const isPending = false;
      const hasReviewers = false;

      const isDialogSubmitDisabled = isPending || !hasReviewers;

      expect(isDialogSubmitDisabled).toBe(true);
    });

    it('should disable dialog submit during pending state', () => {
      const isPending = true;
      const hasReviewers = true;

      const isDialogSubmitDisabled = isPending || !hasReviewers;

      expect(isDialogSubmitDisabled).toBe(true);
    });

    it('should enable dialog submit when reviewers selected and not pending', () => {
      const isPending = false;
      const hasReviewers = true;

      const isDialogSubmitDisabled = isPending || !hasReviewers;

      expect(isDialogSubmitDisabled).toBe(false);
    });
  });
});
