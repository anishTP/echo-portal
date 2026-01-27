/**
 * T098: Tests for comprehensive permission denial error messages (SC-004)
 *
 * Verifies that permission denied errors include:
 * - Human-readable message explaining what action was denied
 * - Current user state (roles)
 * - Required state (what role/permission is needed)
 * - Actionable guidance for what user can do next
 */

import { describe, it, expect } from 'vitest';
import { PermissionDenials, AccessDeniedError } from '../../src/api/utils/errors.js';

describe('T098: Comprehensive Permission Denial Error Messages', () => {
  describe('PermissionDenials.insufficientRole()', () => {
    it('provides clear message when user lacks required role', () => {
      const error = PermissionDenials.insufficientRole(
        'contributor',
        'administrator',
        'view user list'
      );

      expect(error).toBeInstanceOf(AccessDeniedError);
      expect(error.message).toContain('Administrator role');
      expect(error.message).toContain('Contributor');
      expect(error.details?.guidance).toMatchObject({
        currentRole: 'Contributor',
        requiredRole: 'Administrator',
        action: expect.stringContaining('Contact an administrator'),
      });
    });

    it('includes actionable guidance for role change', () => {
      const error = PermissionDenials.insufficientRole(
        'viewer',
        'reviewer',
        'approve branches'
      );

      expect(error.details?.guidance?.action).toContain('Contact an administrator');
      expect(error.details?.guidance?.action).toContain('Reviewer');
    });
  });

  describe('PermissionDenials.ownerOnly()', () => {
    it('provides clear message for owner-only operations', () => {
      const error = PermissionDenials.ownerOnly('manage collaborators', 'Alice');

      expect(error.message).toContain('Only the branch owner');
      expect(error.message).toContain('manage collaborators');
      expect(error.details?.guidance).toMatchObject({
        reason: 'This action requires branch ownership',
        requiredPermission: 'owner',
        ownerName: 'Alice',
      });
    });

    it('includes owner name in actionable guidance', () => {
      const error = PermissionDenials.ownerOnly('delete branch', 'Bob');

      expect(error.details?.guidance?.action).toContain('Bob');
      expect(error.details?.guidance?.action).toContain('branch owner');
    });

    it('provides guidance even without owner name', () => {
      const error = PermissionDenials.ownerOnly('manage reviewers');

      expect(error.details?.guidance?.action).toContain('Contact the branch owner');
    });
  });

  describe('PermissionDenials.invalidState()', () => {
    it('provides clear message about branch state requirements', () => {
      const error = PermissionDenials.invalidState(
        'published',
        'edit content',
        ['draft']
      );

      expect(error.message).toContain('Published');
      expect(error.message).toContain('Draft');
      expect(error.details?.guidance?.currentState).toBe('Published');
    });

    it('provides specific guidance for published branches', () => {
      const error = PermissionDenials.invalidState(
        'published',
        'modify',
        ['draft', 'in_review']
      );

      expect(error.details?.guidance?.action).toContain('Published branches are immutable');
      expect(error.details?.guidance?.action).toContain('Create a new branch');
    });

    it('handles multiple allowed states', () => {
      const error = PermissionDenials.invalidState(
        'draft',
        'approve',
        ['in_review', 'approved']
      );

      expect(error.message).toContain('In Review or Approved');
    });
  });

  describe('PermissionDenials.accessRevoked()', () => {
    it('provides clear message when visibility changed', () => {
      const error = PermissionDenials.accessRevoked(
        'visibility_changed',
        'branch-123'
      );

      expect(error.message).toContain('visibility settings were changed');
      expect(error.details?.guidance?.branchId).toBe('branch-123');
      expect(error.details?.guidance?.action).toContain('Contact the branch owner');
    });

    it('provides clear message when removed from team', () => {
      const error = PermissionDenials.accessRevoked('removed_from_team');

      expect(error.message).toContain('removed from the team');
      expect(error.details?.guidance?.action).toContain('re-added as a collaborator');
    });

    it('provides clear message when branch deleted', () => {
      const error = PermissionDenials.accessRevoked('branch_deleted');

      expect(error.message).toContain('deleted');
      expect(error.details?.guidance?.action).toContain('No action can be taken');
    });
  });

  describe('PermissionDenials.selfReview()', () => {
    it('provides clear message about self-review prevention', () => {
      const error = PermissionDenials.selfReview();

      expect(error.message).toContain('cannot approve');
      expect(error.message).toContain('your own branch');
      expect(error.details?.guidance?.reason).toContain('Self-review is forbidden');
    });

    it('provides actionable guidance to assign different reviewer', () => {
      const error = PermissionDenials.selfReview();

      expect(error.details?.guidance?.action).toContain('Assign a different reviewer');
    });
  });

  describe('PermissionDenials.notAssignedReviewer()', () => {
    it('provides clear message when not assigned as reviewer', () => {
      const error = PermissionDenials.notAssignedReviewer('branch-456');

      expect(error.message).toContain('not assigned as a reviewer');
      expect(error.details?.guidance?.branchId).toBe('branch-456');
    });

    it('provides actionable guidance to get assigned', () => {
      const error = PermissionDenials.notAssignedReviewer();

      expect(error.details?.guidance?.action).toContain('Ask the branch owner to add you');
    });
  });

  describe('PermissionDenials.authenticationRequired()', () => {
    it('provides clear message for unauthenticated access', () => {
      const error = PermissionDenials.authenticationRequired('private');

      expect(error.message).toContain('not publicly accessible');
      expect(error.message).toContain('sign in');
      expect(error.details?.guidance?.visibility).toBe('private');
    });

    it('provides actionable guidance to sign in', () => {
      const error = PermissionDenials.authenticationRequired('team');

      expect(error.details?.guidance?.action).toContain('Sign in with GitHub');
    });
  });

  describe('PermissionDenials.missingPermission()', () => {
    it('provides clear message for missing specific permission', () => {
      const error = PermissionDenials.missingPermission(
        'branch:delete',
        'delete branches',
        'administrator'
      );

      expect(error.message).toContain('do not have permission to delete branches');
      expect(error.message).toContain('administrator role');
      expect(error.details?.guidance?.requiredPermission).toBe('branch:delete');
      expect(error.details?.guidance?.requiredRole).toBe('administrator');
    });

    it('provides actionable guidance to contact admin', () => {
      const error = PermissionDenials.missingPermission(
        'audit:view_all',
        'view audit logs',
        'administrator'
      );

      expect(error.details?.guidance?.action).toContain('Contact an administrator');
    });

    it('works without specific role requirement', () => {
      const error = PermissionDenials.missingPermission(
        'custom:permission',
        'perform custom action'
      );

      expect(error.details?.guidance?.action).toContain('Contact an administrator');
      expect(error.details?.guidance?.requiredRole).toBeUndefined();
    });
  });

  describe('Error response structure (SC-004)', () => {
    it('all errors include guidance object', () => {
      const error = PermissionDenials.insufficientRole('viewer', 'administrator', 'test');

      expect(error.details).toBeDefined();
      expect(error.details?.guidance).toBeDefined();
      expect(error.details?.guidance).toHaveProperty('reason');
      expect(error.details?.guidance).toHaveProperty('action');
    });

    it('guidance includes reason 100% of the time', () => {
      const errors = [
        PermissionDenials.insufficientRole('viewer', 'administrator', 'test'),
        PermissionDenials.ownerOnly('test'),
        PermissionDenials.invalidState('draft', 'test', ['in_review']),
        PermissionDenials.accessRevoked('visibility_changed'),
        PermissionDenials.selfReview(),
        PermissionDenials.notAssignedReviewer(),
        PermissionDenials.authenticationRequired('private'),
        PermissionDenials.missingPermission('test:permission', 'test'),
      ];

      errors.forEach((error) => {
        expect(error.details?.guidance?.reason).toBeDefined();
        expect(error.details?.guidance?.reason).not.toBe('');
      });
    });

    it('guidance includes actionable next steps 100% of the time', () => {
      const errors = [
        PermissionDenials.insufficientRole('viewer', 'administrator', 'test'),
        PermissionDenials.ownerOnly('test'),
        PermissionDenials.invalidState('draft', 'test', ['in_review']),
        PermissionDenials.accessRevoked('visibility_changed'),
        PermissionDenials.selfReview(),
        PermissionDenials.notAssignedReviewer(),
        PermissionDenials.authenticationRequired('private'),
        PermissionDenials.missingPermission('test:permission', 'test'),
      ];

      errors.forEach((error) => {
        expect(error.details?.guidance?.action).toBeDefined();
        expect(error.details?.guidance?.action).not.toBe('');
      });
    });

    it('error response matches SC-004 format', () => {
      const error = PermissionDenials.insufficientRole('contributor', 'reviewer', 'review');

      // Verify error structure matches expected format
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('ACCESS_DENIED');
      expect(error.message).toBeDefined();
      expect(error.details?.guidance).toMatchObject({
        reason: expect.any(String),
        requiredRole: expect.any(String),
        currentRole: expect.any(String),
        action: expect.any(String),
      });
    });
  });
});
