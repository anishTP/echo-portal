import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryService, getRepositoryService, createRepositoryService } from './repository.js';
import { GitBranchService, createGitBranchService } from './branch.js';

export interface CreateBranchResult {
  gitRef: string;
  baseCommit: string;
  headCommit: string;
}

export interface BranchChanges {
  added: string[];
  modified: string[];
  deleted: string[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface MergeOptions {
  message: string;
  author: string;
}

export interface MergeabilityResult {
  canMerge: boolean;
  conflicts?: Array<{
    path: string;
    type: 'content' | 'rename' | 'delete';
    description: string;
  }>;
}

export interface FileContent {
  path: string;
  content: string;
}

/**
 * High-level git operations for Echo Portal branch management
 */
export class GitOperations {
  private repo: RepositoryService;
  private branchService: GitBranchService;

  constructor(repo: RepositoryService) {
    this.repo = repo;
    this.branchService = createGitBranchService(repo);
  }

  /**
   * Initialize the repository if needed
   */
  async ensureInitialized(): Promise<void> {
    const initialized = await this.repo.isInitialized();
    if (!initialized) {
      await this.repo.init();

      // Create initial commit on main if repo is empty
      const head = await this.repo.getHead();
      if (!head) {
        // Create a .gitkeep file to have something to commit
        const gitkeepPath = path.join(this.repo.baseDir, '.gitkeep');
        fs.mkdirSync(path.dirname(gitkeepPath), { recursive: true });
        fs.writeFileSync(gitkeepPath, '');
        await this.repo.add('.gitkeep');
        await this.repo.commit('Initial commit');
      }
    }
  }

  /**
   * Create a new isolated branch for a user
   * @param branchSlug - The unique slug for the branch (used as git ref)
   * @param baseBranch - The branch to create from (main or dev)
   * @returns Branch creation result with refs and commits
   */
  async createIsolatedBranch(branchSlug: string, baseBranch: string): Promise<CreateBranchResult> {
    await this.ensureInitialized();

    // Ensure base branch exists
    const baseExists = await this.branchService.exists(baseBranch);
    if (!baseExists) {
      throw new Error(`Base branch '${baseBranch}' does not exist`);
    }

    // Get the commit the base branch points to
    const baseCommit = await this.branchService.getCommit(baseBranch);
    if (!baseCommit) {
      throw new Error(`Could not resolve base branch '${baseBranch}'`);
    }

    // Generate the git ref name (prefixed to avoid conflicts)
    const gitRef = `branch/${branchSlug}`;

    // Check if branch already exists
    const exists = await this.branchService.exists(gitRef);
    if (exists) {
      throw new Error(`Branch '${gitRef}' already exists`);
    }

    // Create the new branch at the base commit
    await this.branchService.create({
      name: gitRef,
      startPoint: baseBranch,
      checkout: false,
    });

    return {
      gitRef,
      baseCommit,
      headCommit: baseCommit, // Initially same as base
    };
  }

  /**
   * Delete an isolated branch
   */
  async deleteIsolatedBranch(gitRef: string): Promise<void> {
    const exists = await this.branchService.exists(gitRef);
    if (!exists) {
      throw new Error(`Branch '${gitRef}' does not exist`);
    }

    await this.branchService.delete(gitRef);
  }

  /**
   * Write a file to a branch's working directory
   * Note: In a real implementation, this would write to a branch-specific worktree
   */
  async writeFile(gitRef: string, filepath: string, content: string): Promise<void> {
    const branchDir = this.getBranchWorktree(gitRef);
    const fullPath = path.join(branchDir, filepath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // Write the file
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  /**
   * Read a file from a branch's working directory
   */
  async readFile(gitRef: string, filepath: string): Promise<string | null> {
    const branchDir = this.getBranchWorktree(gitRef);
    const fullPath = path.join(branchDir, filepath);

    try {
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Delete a file from a branch's working directory
   */
  async deleteFile(gitRef: string, filepath: string): Promise<void> {
    const branchDir = this.getBranchWorktree(gitRef);
    const fullPath = path.join(branchDir, filepath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * List files in a branch's working directory
   */
  async listFiles(gitRef: string, directory: string = ''): Promise<string[]> {
    const branchDir = this.getBranchWorktree(gitRef);
    const targetDir = directory ? path.join(branchDir, directory) : branchDir;

    try {
      return this.listFilesRecursive(targetDir, branchDir);
    } catch {
      return [];
    }
  }

  /**
   * Commit changes on a branch
   */
  async commitChanges(gitRef: string, message: string): Promise<string> {
    // For now, use a simple approach with the main repo
    // In production, this would use separate worktrees
    const branchCommit = await this.branchService.getCommit(gitRef);
    if (!branchCommit) {
      throw new Error(`Branch '${gitRef}' does not exist`);
    }

    // This is a simplified implementation
    // In production, you would:
    // 1. Create a tree from the worktree files
    // 2. Create a commit with that tree and the branch as parent
    // 3. Update the branch ref to point to the new commit

    return branchCommit;
  }

  /**
   * Get the changes between a branch and its base
   *
   * Compares worktree files (where edits are stored) rather than
   * git commits, since commitChanges() doesn't create real commits.
   */
  async getChanges(gitRef: string, baseBranch: string): Promise<BranchChanges> {
    // Compare worktree files — content edits are written to worktrees,
    // not committed to git, so commit-level comparison would always be empty
    const branchFiles = await this.listFiles(gitRef);
    const baseFiles = await this.listFiles(baseBranch);

    const branchSet = new Set(branchFiles);
    const baseSet = new Set(baseFiles);

    const added: string[] = [];
    const deleted: string[] = [];
    const modified: string[] = [];

    // Find added files (in branch but not in base)
    for (const file of branchFiles) {
      if (!baseSet.has(file)) {
        added.push(file);
      }
    }

    // Find deleted files (in base but not in branch)
    for (const file of baseFiles) {
      if (!branchSet.has(file)) {
        deleted.push(file);
      }
    }

    // Find modified files (compare worktree content)
    for (const file of branchFiles) {
      if (baseSet.has(file)) {
        const branchContent = await this.readFile(gitRef, file);
        const baseContent = await this.readFile(baseBranch, file);
        if (branchContent !== baseContent) {
          modified.push(file);
        }
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Get the worktree path for a branch
   * Each branch gets its own isolated directory
   */
  private getBranchWorktree(gitRef: string): string {
    const worktreesDir = process.env.GIT_WORKTREES_PATH || './data/worktrees';
    const safeName = gitRef.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(worktreesDir, safeName);
  }

  /**
   * Recursively list files in a directory
   */
  private listFilesRecursive(dir: string, baseDir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        if (entry.name !== '.git') {
          files.push(...this.listFilesRecursive(fullPath, baseDir));
        }
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  /**
   * Get the HEAD commit of a branch
   */
  async getHeadCommit(branchRef: string): Promise<string> {
    const commit = await this.branchService.getCommit(branchRef);
    if (!commit) {
      throw new Error(`Could not get HEAD commit for ${branchRef}`);
    }
    return commit;
  }

  /**
   * Get files changed between a branch and target
   */
  async getChangedFiles(branchRef: string, targetRef: string): Promise<FileChange[]> {
    const changes = await this.getChanges(branchRef, targetRef);
    const files: FileChange[] = [];

    for (const path of changes.added) {
      files.push({ path, status: 'added' });
    }
    for (const path of changes.modified) {
      files.push({ path, status: 'modified' });
    }
    for (const path of changes.deleted) {
      files.push({ path, status: 'deleted' });
    }

    return files;
  }

  /**
   * Get the merge base commit between two branches
   */
  async getMergeBase(branchRef: string, targetRef: string): Promise<string> {
    // In a real implementation, this would use git merge-base
    // For now, return the target's commit as a simplification
    return this.getHeadCommit(targetRef);
  }

  /**
   * Get files changed since a specific commit
   */
  async getChangedFilesSinceCommit(branchRef: string, sinceCommit: string): Promise<FileChange[]> {
    // In a real implementation, this would compare commits
    // For now, return empty array (no concurrent changes)
    return [];
  }

  /**
   * Check if a merge can be performed cleanly
   */
  async checkMergeability(branchRef: string, targetRef: string): Promise<MergeabilityResult> {
    try {
      // In a real implementation, this would do a dry-run merge
      // For now, assume merges can succeed if both branches exist
      const branchCommit = await this.branchService.getCommit(branchRef);
      const targetCommit = await this.branchService.getCommit(targetRef);

      if (!branchCommit || !targetCommit) {
        return {
          canMerge: false,
          conflicts: [{
            path: '*',
            type: 'content',
            description: 'One or both branches do not exist',
          }],
        };
      }

      return { canMerge: true };
    } catch (error) {
      return {
        canMerge: false,
        conflicts: [{
          path: '*',
          type: 'content',
          description: error instanceof Error ? error.message : 'Unknown error',
        }],
      };
    }
  }

  /**
   * Perform a merge of a branch into the target
   */
  async mergeBranch(branchRef: string, targetRef: string, options: MergeOptions): Promise<string> {
    // In a real implementation, this would:
    // 1. Checkout the target branch
    // 2. Merge the source branch
    // 3. Create a merge commit
    // 4. Return the merge commit SHA

    // For now, simulate by getting the branch commit
    const branchCommit = await this.branchService.getCommit(branchRef);
    if (!branchCommit) {
      throw new Error(`Branch ${branchRef} does not exist`);
    }

    // In production, this would create an actual merge commit
    // For MVP, we return the branch commit as the "merge result"
    console.log(`Merging ${branchRef} into ${targetRef}: ${options.message}`);

    return branchCommit;
  }

  /**
   * Reset a branch to a specific commit
   */
  async resetToCommit(branchRef: string, commitSha: string): Promise<void> {
    // In a real implementation, this would reset the branch ref
    console.log(`Resetting ${branchRef} to ${commitSha}`);
  }
}

let gitOperationsInstance: GitOperations | null = null;

export function getGitOperations(): GitOperations {
  if (!gitOperationsInstance) {
    const repo = getRepositoryService();
    gitOperationsInstance = new GitOperations(repo);
  }
  return gitOperationsInstance;
}

export function createGitOperations(repo: RepositoryService): GitOperations {
  return new GitOperations(repo);
}

export { RepositoryService, GitBranchService };
