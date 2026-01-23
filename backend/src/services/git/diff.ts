import { getGitOperations } from './operations.js';

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string; // For renames
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface BranchDiff {
  branchId: string;
  baseRef: string;
  headRef: string;
  baseCommit: string;
  headCommit: string;
  files: FileDiff[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

/**
 * Service for computing diffs between branches
 */
export class DiffService {
  /**
   * Get diff between a branch and its base
   */
  async getBranchDiff(
    gitRef: string,
    baseRef: string,
    baseCommit: string,
    headCommit: string
  ): Promise<BranchDiff> {
    const gitOps = getGitOperations();

    // Get the list of changed files
    const changes = await gitOps.getChanges(gitRef, baseRef);

    const files: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    // Process added files
    for (const path of changes.added) {
      const content = await gitOps.readFile(gitRef, path);
      const lines = content?.split('\n') || [];
      const hunks = this.createAdditionHunks(lines);

      files.push({
        path,
        status: 'added',
        additions: lines.length,
        deletions: 0,
        hunks,
      });
      totalAdditions += lines.length;
    }

    // Process deleted files
    for (const path of changes.deleted) {
      // Read from base to get original content
      const content = await this.readFileAtRef(baseRef, path);
      const lines = content?.split('\n') || [];
      const hunks = this.createDeletionHunks(lines);

      files.push({
        path,
        status: 'deleted',
        additions: 0,
        deletions: lines.length,
        hunks,
      });
      totalDeletions += lines.length;
    }

    // Process modified files
    for (const path of changes.modified) {
      const oldContent = await this.readFileAtRef(baseRef, path);
      const newContent = await gitOps.readFile(gitRef, path);

      const diff = this.computeLineDiff(
        oldContent?.split('\n') || [],
        newContent?.split('\n') || []
      );

      files.push({
        path,
        status: 'modified',
        additions: diff.additions,
        deletions: diff.deletions,
        hunks: diff.hunks,
      });
      totalAdditions += diff.additions;
      totalDeletions += diff.deletions;
    }

    return {
      branchId: gitRef,
      baseRef,
      headRef: gitRef,
      baseCommit,
      headCommit,
      files,
      stats: {
        filesChanged: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
      },
    };
  }

  /**
   * Read a file from a specific ref (simplified - uses worktree for now)
   */
  private async readFileAtRef(ref: string, path: string): Promise<string | null> {
    const gitOps = getGitOperations();
    // For the base ref, we read from the actual branch worktree
    // In a real implementation, this would use git show or similar
    return gitOps.readFile(ref, path);
  }

  /**
   * Create hunks for a fully added file
   */
  private createAdditionHunks(lines: string[]): DiffHunk[] {
    if (lines.length === 0) return [];

    return [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((content, index) => ({
          type: 'addition' as const,
          content,
          newLineNumber: index + 1,
        })),
      },
    ];
  }

  /**
   * Create hunks for a fully deleted file
   */
  private createDeletionHunks(lines: string[]): DiffHunk[] {
    if (lines.length === 0) return [];

    return [
      {
        oldStart: 1,
        oldLines: lines.length,
        newStart: 0,
        newLines: 0,
        lines: lines.map((content, index) => ({
          type: 'deletion' as const,
          content,
          oldLineNumber: index + 1,
        })),
      },
    ];
  }

  /**
   * Compute line-by-line diff between two versions
   * Uses a simple LCS-based diff algorithm
   */
  private computeLineDiff(
    oldLines: string[],
    newLines: string[]
  ): { hunks: DiffHunk[]; additions: number; deletions: number } {
    const diffLines: DiffLine[] = [];
    let additions = 0;
    let deletions = 0;

    // Simple diff using longest common subsequence approach
    const lcs = this.longestCommonSubsequence(oldLines, newLines);

    let oldIndex = 0;
    let newIndex = 0;
    let lcsIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (
        lcsIndex < lcs.length &&
        oldIndex < oldLines.length &&
        oldLines[oldIndex] === lcs[lcsIndex]
      ) {
        // Context line (unchanged)
        if (newIndex < newLines.length && newLines[newIndex] === lcs[lcsIndex]) {
          diffLines.push({
            type: 'context',
            content: oldLines[oldIndex],
            oldLineNumber: oldIndex + 1,
            newLineNumber: newIndex + 1,
          });
          oldIndex++;
          newIndex++;
          lcsIndex++;
        } else {
          // Addition
          diffLines.push({
            type: 'addition',
            content: newLines[newIndex],
            newLineNumber: newIndex + 1,
          });
          additions++;
          newIndex++;
        }
      } else if (oldIndex < oldLines.length) {
        // Check if this old line was deleted
        if (
          lcsIndex >= lcs.length ||
          oldLines[oldIndex] !== lcs[lcsIndex]
        ) {
          diffLines.push({
            type: 'deletion',
            content: oldLines[oldIndex],
            oldLineNumber: oldIndex + 1,
          });
          deletions++;
          oldIndex++;
        }
      } else if (newIndex < newLines.length) {
        // Addition at end
        diffLines.push({
          type: 'addition',
          content: newLines[newIndex],
          newLineNumber: newIndex + 1,
        });
        additions++;
        newIndex++;
      }
    }

    // Group into hunks (simplified - one hunk for now)
    const hunks: DiffHunk[] = [];
    if (diffLines.length > 0) {
      hunks.push({
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 1,
        newLines: newLines.length,
        lines: diffLines,
      });
    }

    return { hunks, additions, deletions };
  }

  /**
   * Compute longest common subsequence of two arrays
   */
  private longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        lcs.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  /**
   * Get a summary of changes (without full diff content)
   */
  async getChangeSummary(
    gitRef: string,
    baseRef: string
  ): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
    total: number;
  }> {
    const gitOps = getGitOperations();
    const changes = await gitOps.getChanges(gitRef, baseRef);

    return {
      added: changes.added,
      modified: changes.modified,
      deleted: changes.deleted,
      total: changes.added.length + changes.modified.length + changes.deleted.length,
    };
  }
}

// Export singleton instance
export const diffService = new DiffService();
