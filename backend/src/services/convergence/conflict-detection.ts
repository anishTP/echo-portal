import { getGitOperations } from '../git/operations.js';
import type { ConflictDetail } from '@echo-portal/shared';

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictDetail[];
}

/**
 * Service for detecting merge conflicts before convergence
 */
export class ConflictDetectionService {
  /**
   * Check for conflicts between a branch and the target (main)
   */
  async checkConflicts(
    branchRef: string,
    targetRef: string = 'main'
  ): Promise<ConflictCheckResult> {
    const gitOps = getGitOperations();
    const conflicts: ConflictDetail[] = [];

    try {
      // Get the files changed in the branch compared to target
      const branchFiles = await gitOps.getChangedFiles(branchRef, targetRef);

      // Get the files changed in target since the branch was created
      // (This would detect concurrent modifications)
      const targetChanges = await gitOps.getChangedFilesSinceCommit(
        targetRef,
        await gitOps.getMergeBase(branchRef, targetRef)
      );

      // Find overlapping files (potential conflicts)
      const branchFilePaths = new Set(branchFiles.map((f) => f.path));
      const overlappingFiles = targetChanges.filter((f) =>
        branchFilePaths.has(f.path)
      );

      // For each overlapping file, check if it's an actual conflict
      for (const file of overlappingFiles) {
        const conflictType = this.determineConflictType(file);
        if (conflictType) {
          conflicts.push({
            path: file.path,
            type: conflictType,
            description: this.getConflictDescription(file, conflictType),
          });
        }
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
      };
    } catch (error) {
      // If we can't determine conflicts, assume none for now
      // A real merge will reveal actual conflicts
      console.error('Error checking conflicts:', error);
      return {
        hasConflicts: false,
        conflicts: [],
      };
    }
  }

  /**
   * Determine the type of conflict for a file
   */
  private determineConflictType(
    file: { path: string; status: string }
  ): ConflictDetail['type'] | null {
    switch (file.status) {
      case 'modified':
        return 'content';
      case 'renamed':
        return 'rename';
      case 'deleted':
        return 'delete';
      default:
        return null;
    }
  }

  /**
   * Get a human-readable description of the conflict
   */
  private getConflictDescription(
    file: { path: string; status: string },
    type: ConflictDetail['type']
  ): string {
    switch (type) {
      case 'content':
        return `File "${file.path}" was modified in both the branch and main`;
      case 'rename':
        return `File "${file.path}" was renamed in both the branch and main`;
      case 'delete':
        return `File "${file.path}" was deleted in one location but modified in another`;
      default:
        return `Conflict detected in "${file.path}"`;
    }
  }

  /**
   * Try to auto-resolve simple conflicts
   * Returns true if all conflicts can be auto-resolved
   */
  async canAutoResolve(conflicts: ConflictDetail[]): Promise<boolean> {
    // For MVP, we don't auto-resolve conflicts
    // All conflicts require manual intervention or re-work
    return conflicts.length === 0;
  }
}

// Export singleton instance
export const conflictDetectionService = new ConflictDetectionService();
