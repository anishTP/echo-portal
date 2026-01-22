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
   */
  async getChanges(gitRef: string, baseBranch: string): Promise<BranchChanges> {
    const branchCommit = await this.branchService.getCommit(gitRef);
    const baseCommit = await this.branchService.getCommit(baseBranch);

    if (!branchCommit || !baseCommit) {
      throw new Error('Could not resolve branch commits');
    }

    // Get files at both commits
    const branchFiles = await this.repo.listFilesAtCommit(branchCommit);
    const baseFiles = await this.repo.listFilesAtCommit(baseCommit);

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

    // Find modified files (compare content)
    for (const file of branchFiles) {
      if (baseSet.has(file)) {
        const branchContent = await this.repo.readFileAtCommit(branchCommit, file);
        const baseContent = await this.repo.readFileAtCommit(baseCommit, file);
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
