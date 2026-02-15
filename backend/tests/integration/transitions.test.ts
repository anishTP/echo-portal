import { describe, it, expect } from 'vitest';
import {
  canPerformTransition,
  isValidTransition,
  getAllowedEvents,
  hasRequiredRole,
  getTargetState,
} from '../../src/services/workflow/state-machine';
import { BranchState, TransitionEvent } from '@echo-portal/shared';

describe('Transitions - Forbidden Transition Tests', () => {
  describe('isValidTransition', () => {
    it('should allow draft -> review transition', () => {
      expect(isValidTransition(BranchState.DRAFT, BranchState.REVIEW)).toBe(true);
    });

    it('should allow draft -> archived transition', () => {
      expect(isValidTransition(BranchState.DRAFT, BranchState.ARCHIVED)).toBe(true);
    });

    it('should NOT allow draft -> approved transition (skip review)', () => {
      expect(isValidTransition(BranchState.DRAFT, BranchState.APPROVED)).toBe(false);
    });

    it('should NOT allow draft -> published transition (skip review and approval)', () => {
      expect(isValidTransition(BranchState.DRAFT, BranchState.PUBLISHED)).toBe(false);
    });

    it('should allow review -> draft transition (request changes)', () => {
      expect(isValidTransition(BranchState.REVIEW, BranchState.DRAFT)).toBe(true);
    });

    it('should allow review -> approved transition', () => {
      expect(isValidTransition(BranchState.REVIEW, BranchState.APPROVED)).toBe(true);
    });

    it('should allow review -> archived transition', () => {
      expect(isValidTransition(BranchState.REVIEW, BranchState.ARCHIVED)).toBe(true);
    });

    it('should NOT allow review -> published transition (skip approval)', () => {
      expect(isValidTransition(BranchState.REVIEW, BranchState.PUBLISHED)).toBe(false);
    });

    it('should allow approved -> published transition', () => {
      expect(isValidTransition(BranchState.APPROVED, BranchState.PUBLISHED)).toBe(true);
    });

    it('should NOT allow approved -> draft transition (backwards)', () => {
      expect(isValidTransition(BranchState.APPROVED, BranchState.DRAFT)).toBe(false);
    });

    it('should NOT allow approved -> review transition (backwards)', () => {
      expect(isValidTransition(BranchState.APPROVED, BranchState.REVIEW)).toBe(false);
    });

    it('should allow published -> archived transition', () => {
      expect(isValidTransition(BranchState.PUBLISHED, BranchState.ARCHIVED)).toBe(true);
    });

    it('should NOT allow published -> draft transition', () => {
      expect(isValidTransition(BranchState.PUBLISHED, BranchState.DRAFT)).toBe(false);
    });

    it('should NOT allow published -> review transition', () => {
      expect(isValidTransition(BranchState.PUBLISHED, BranchState.REVIEW)).toBe(false);
    });

    it('should NOT allow archived -> any transition (final state)', () => {
      expect(isValidTransition(BranchState.ARCHIVED, BranchState.DRAFT)).toBe(false);
      expect(isValidTransition(BranchState.ARCHIVED, BranchState.REVIEW)).toBe(false);
      expect(isValidTransition(BranchState.ARCHIVED, BranchState.APPROVED)).toBe(false);
      expect(isValidTransition(BranchState.ARCHIVED, BranchState.PUBLISHED)).toBe(false);
    });
  });

  describe('canPerformTransition - role validation', () => {
    it('should allow contributor to submit for review', () => {
      const result = canPerformTransition(
        BranchState.DRAFT,
        TransitionEvent.SUBMIT_FOR_REVIEW,
        ['contributor']
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow contributor to approve (contributors can be assigned as reviewers)', () => {
      const result = canPerformTransition(
        BranchState.REVIEW,
        TransitionEvent.APPROVE,
        ['contributor']
      );
      expect(result.allowed).toBe(true);
    });

    it('should NOT allow contributor to publish', () => {
      const result = canPerformTransition(
        BranchState.APPROVED,
        TransitionEvent.PUBLISH,
        ['contributor']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient permissions');
    });

    it('should allow reviewer to approve', () => {
      const result = canPerformTransition(
        BranchState.REVIEW,
        TransitionEvent.APPROVE,
        ['reviewer']
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow reviewer to request changes', () => {
      const result = canPerformTransition(
        BranchState.REVIEW,
        TransitionEvent.REQUEST_CHANGES,
        ['reviewer']
      );
      expect(result.allowed).toBe(true);
    });

    it('should NOT allow reviewer to publish', () => {
      const result = canPerformTransition(
        BranchState.APPROVED,
        TransitionEvent.PUBLISH,
        ['reviewer']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient permissions');
    });

    it('should allow publisher to publish', () => {
      const result = canPerformTransition(
        BranchState.APPROVED,
        TransitionEvent.PUBLISH,
        ['publisher']
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow administrator to do anything', () => {
      expect(
        canPerformTransition(BranchState.DRAFT, TransitionEvent.SUBMIT_FOR_REVIEW, ['administrator']).allowed
      ).toBe(true);
      expect(
        canPerformTransition(BranchState.REVIEW, TransitionEvent.APPROVE, ['administrator']).allowed
      ).toBe(true);
      expect(
        canPerformTransition(BranchState.APPROVED, TransitionEvent.PUBLISH, ['administrator']).allowed
      ).toBe(true);
    });

    it('should allow archive from any state with appropriate role', () => {
      expect(
        canPerformTransition(BranchState.DRAFT, TransitionEvent.ARCHIVE, ['contributor']).allowed
      ).toBe(true);
      expect(
        canPerformTransition(BranchState.REVIEW, TransitionEvent.ARCHIVE, ['contributor']).allowed
      ).toBe(true);
      expect(
        canPerformTransition(BranchState.PUBLISHED, TransitionEvent.ARCHIVE, ['contributor']).allowed
      ).toBe(true);
    });
  });

  describe('canPerformTransition - invalid state transitions', () => {
    it('should reject approval from draft state', () => {
      const result = canPerformTransition(
        BranchState.DRAFT,
        TransitionEvent.APPROVE,
        ['reviewer', 'administrator']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject publish from draft state', () => {
      const result = canPerformTransition(
        BranchState.DRAFT,
        TransitionEvent.PUBLISH,
        ['publisher', 'administrator']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject publish from review state', () => {
      const result = canPerformTransition(
        BranchState.REVIEW,
        TransitionEvent.PUBLISH,
        ['publisher', 'administrator']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject submit for review from published state', () => {
      const result = canPerformTransition(
        BranchState.PUBLISHED,
        TransitionEvent.SUBMIT_FOR_REVIEW,
        ['contributor', 'administrator']
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject any transition from archived state', () => {
      const events = [
        TransitionEvent.SUBMIT_FOR_REVIEW,
        TransitionEvent.APPROVE,
        TransitionEvent.REQUEST_CHANGES,
        TransitionEvent.PUBLISH,
        TransitionEvent.ARCHIVE,
      ];

      for (const event of events) {
        const result = canPerformTransition(
          BranchState.ARCHIVED,
          event,
          ['administrator']
        );
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe('getAllowedEvents', () => {
    it('should return correct events for draft state', () => {
      const events = getAllowedEvents(BranchState.DRAFT);
      expect(events).toContain(TransitionEvent.SUBMIT_FOR_REVIEW);
      expect(events).toContain(TransitionEvent.ARCHIVE);
      expect(events).not.toContain(TransitionEvent.APPROVE);
      expect(events).not.toContain(TransitionEvent.PUBLISH);
    });

    it('should return correct events for review state', () => {
      const events = getAllowedEvents(BranchState.REVIEW);
      expect(events).toContain(TransitionEvent.REQUEST_CHANGES);
      expect(events).toContain(TransitionEvent.APPROVE);
      expect(events).toContain(TransitionEvent.ARCHIVE);
      expect(events).not.toContain(TransitionEvent.PUBLISH);
    });

    it('should return correct events for approved state', () => {
      const events = getAllowedEvents(BranchState.APPROVED);
      expect(events).toContain(TransitionEvent.PUBLISH);
      expect(events).not.toContain(TransitionEvent.APPROVE);
      expect(events).not.toContain(TransitionEvent.SUBMIT_FOR_REVIEW);
    });

    it('should return correct events for published state', () => {
      const events = getAllowedEvents(BranchState.PUBLISHED);
      expect(events).toContain(TransitionEvent.ARCHIVE);
      expect(events).not.toContain(TransitionEvent.PUBLISH);
      expect(events).not.toContain(TransitionEvent.SUBMIT_FOR_REVIEW);
    });

    it('should return no events for archived state', () => {
      const events = getAllowedEvents(BranchState.ARCHIVED);
      expect(events).toHaveLength(0);
    });
  });

  describe('hasRequiredRole', () => {
    it('should require contributor+ for submit for review', () => {
      expect(hasRequiredRole(TransitionEvent.SUBMIT_FOR_REVIEW, ['contributor'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.SUBMIT_FOR_REVIEW, ['reviewer'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.SUBMIT_FOR_REVIEW, ['viewer'])).toBe(false);
    });

    it('should allow contributor+ for approve and request changes (contributors can be assigned as reviewers)', () => {
      expect(hasRequiredRole(TransitionEvent.APPROVE, ['reviewer'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.APPROVE, ['contributor'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.REQUEST_CHANGES, ['reviewer'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.REQUEST_CHANGES, ['contributor'])).toBe(true);
    });

    it('should require publisher+ for publish', () => {
      expect(hasRequiredRole(TransitionEvent.PUBLISH, ['publisher'])).toBe(true);
      expect(hasRequiredRole(TransitionEvent.PUBLISH, ['reviewer'])).toBe(false);
      expect(hasRequiredRole(TransitionEvent.PUBLISH, ['contributor'])).toBe(false);
    });

    it('should allow administrator for all events', () => {
      const events = [
        TransitionEvent.SUBMIT_FOR_REVIEW,
        TransitionEvent.APPROVE,
        TransitionEvent.REQUEST_CHANGES,
        TransitionEvent.PUBLISH,
        TransitionEvent.ARCHIVE,
      ];

      for (const event of events) {
        expect(hasRequiredRole(event, ['administrator'])).toBe(true);
      }
    });
  });

  describe('getTargetState', () => {
    it('should map events to correct target states', () => {
      expect(getTargetState(TransitionEvent.SUBMIT_FOR_REVIEW)).toBe(BranchState.REVIEW);
      expect(getTargetState(TransitionEvent.REQUEST_CHANGES)).toBe(BranchState.DRAFT);
      expect(getTargetState(TransitionEvent.APPROVE)).toBe(BranchState.APPROVED);
      expect(getTargetState(TransitionEvent.PUBLISH)).toBe(BranchState.PUBLISHED);
      expect(getTargetState(TransitionEvent.ARCHIVE)).toBe(BranchState.ARCHIVED);
    });
  });
});
