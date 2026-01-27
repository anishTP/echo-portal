import * as git from 'isomorphic-git';
import * as fs from 'node:fs';
import { RepositoryService } from './repository.js';

export interface BranchCreateOptions {
  name: string;
  startPoint: string;
  checkout?: boolean;
}

export interface BranchInfo {
  name: string;
  oid: string;
  isHead: boolean;
}

export class GitBranchService {
  private repo: RepositoryService;

  constructor(repo: RepositoryService) {
    this.repo = repo;
  }

  /**
   * Create a new branch at the specified start point
   */
  async create(options: BranchCreateOptions): Promise<string> {
    const { name, startPoint, checkout = false } = options;

    // Resolve the start point to an OID
    const oid = await git.resolveRef({
      fs,
      dir: this.repo.baseDir,
      ref: startPoint,
    });

    // Create the branch ref
    await git.writeRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${name}`,
      value: oid,
    });

    // Optionally checkout the new branch
    if (checkout) {
      await this.checkout(name);
    }

    return oid;
  }

  /**
   * Checkout a branch (update HEAD to point to the branch)
   */
  async checkout(branchName: string): Promise<void> {
    await git.checkout({
      fs,
      dir: this.repo.baseDir,
      ref: branchName,
    });
  }

  /**
   * Delete a branch
   */
  async delete(branchName: string): Promise<void> {
    // Prevent deletion of protected branches
    if (branchName === 'main' || branchName === 'dev') {
      throw new Error(`Cannot delete protected branch: ${branchName}`);
    }

    await git.deleteRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${branchName}`,
    });
  }

  /**
   * Rename a branch
   */
  async rename(oldName: string, newName: string): Promise<void> {
    // Prevent renaming protected branches
    if (oldName === 'main' || oldName === 'dev') {
      throw new Error(`Cannot rename protected branch: ${oldName}`);
    }

    // Get the commit the old branch points to
    const oid = await git.resolveRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${oldName}`,
    });

    // Create the new branch
    await git.writeRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${newName}`,
      value: oid,
    });

    // Delete the old branch
    await git.deleteRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${oldName}`,
    });
  }

  /**
   * Get information about all branches
   */
  async list(): Promise<BranchInfo[]> {
    const branches = await this.repo.listBranches();
    const currentBranch = await this.getCurrentBranch();

    const result: BranchInfo[] = [];
    for (const name of branches) {
      const oid = await this.repo.getBranchCommit(name);
      if (oid) {
        result.push({
          name,
          oid,
          isHead: name === currentBranch,
        });
      }
    }

    return result;
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const head = await git.currentBranch({
        fs,
        dir: this.repo.baseDir,
        fullname: false,
      });
      return head || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a branch exists
   */
  async exists(branchName: string): Promise<boolean> {
    return await this.repo.branchExists(branchName);
  }

  /**
   * Get the commit OID for a branch
   */
  async getCommit(branchName: string): Promise<string | null> {
    return await this.repo.getBranchCommit(branchName);
  }

  /**
   * Get the merge base between two branches
   */
  async getMergeBase(branch1: string, branch2: string): Promise<string | null> {
    try {
      const oid1 = await git.resolveRef({
        fs,
        dir: this.repo.baseDir,
        ref: branch1,
      });

      const oid2 = await git.resolveRef({
        fs,
        dir: this.repo.baseDir,
        ref: branch2,
      });

      const result = await git.findMergeBase({
        fs,
        dir: this.repo.baseDir,
        oids: [oid1, oid2],
      });

      return result.length > 0 ? result[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if branch is ahead/behind another branch
   */
  async getAheadBehind(
    branch: string,
    baseBranch: string
  ): Promise<{ ahead: number; behind: number } | null> {
    try {
      const branchOid = await git.resolveRef({
        fs,
        dir: this.repo.baseDir,
        ref: branch,
      });

      const baseOid = await git.resolveRef({
        fs,
        dir: this.repo.baseDir,
        ref: baseBranch,
      });

      const mergeBase = await this.getMergeBase(branch, baseBranch);
      if (!mergeBase) {
        return null;
      }

      // Count commits from merge base to branch
      const branchLog = await git.log({
        fs,
        dir: this.repo.baseDir,
        ref: branchOid,
      });
      const ahead = branchLog.findIndex((c) => c.oid === mergeBase);

      // Count commits from merge base to base branch
      const baseLog = await git.log({
        fs,
        dir: this.repo.baseDir,
        ref: baseOid,
      });
      const behind = baseLog.findIndex((c) => c.oid === mergeBase);

      return {
        ahead: ahead === -1 ? branchLog.length : ahead,
        behind: behind === -1 ? baseLog.length : behind,
      };
    } catch {
      return null;
    }
  }

  /**
   * Force update a branch to point to a specific commit
   */
  async forceUpdate(branchName: string, oid: string): Promise<void> {
    await git.writeRef({
      fs,
      dir: this.repo.baseDir,
      ref: `refs/heads/${branchName}`,
      value: oid,
      force: true,
    });
  }
}

export function createGitBranchService(repo: RepositoryService): GitBranchService {
  return new GitBranchService(repo);
}
