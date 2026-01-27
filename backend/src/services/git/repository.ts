import * as git from 'isomorphic-git';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RepositoryConfig {
  baseDir: string;
  author: {
    name: string;
    email: string;
  };
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  parent: string[];
}

export class RepositoryService {
  private config: RepositoryConfig;

  constructor(config: RepositoryConfig) {
    this.config = config;
  }

  get baseDir(): string {
    return this.config.baseDir;
  }

  get author(): { name: string; email: string } {
    return this.config.author;
  }

  /**
   * Initialize a new git repository if it doesn't exist
   */
  async init(): Promise<void> {
    const gitDir = path.join(this.config.baseDir, '.git');
    if (!fs.existsSync(gitDir)) {
      await git.init({ fs, dir: this.config.baseDir, defaultBranch: 'main' });
    }
  }

  /**
   * Check if the repository is initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      await git.resolveRef({ fs, dir: this.config.baseDir, ref: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current HEAD commit OID
   */
  async getHead(ref: string = 'HEAD'): Promise<string | null> {
    try {
      return await git.resolveRef({ fs, dir: this.config.baseDir, ref });
    } catch {
      return null;
    }
  }

  /**
   * Get commit information
   */
  async getCommit(oid: string): Promise<CommitInfo | null> {
    try {
      const { commit } = await git.readCommit({ fs, dir: this.config.baseDir, oid });
      return {
        oid,
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
          timestamp: commit.author.timestamp,
        },
        parent: commit.parent,
      };
    } catch {
      return null;
    }
  }

  /**
   * List all branches in the repository
   */
  async listBranches(): Promise<string[]> {
    try {
      return await git.listBranches({ fs, dir: this.config.baseDir });
    } catch {
      return [];
    }
  }

  /**
   * Get the commit OID for a branch
   */
  async getBranchCommit(branchName: string): Promise<string | null> {
    try {
      return await git.resolveRef({
        fs,
        dir: this.config.baseDir,
        ref: `refs/heads/${branchName}`,
      });
    } catch {
      return null;
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.listBranches();
    return branches.includes(branchName);
  }

  /**
   * Get the log of commits for a ref
   */
  async log(ref: string, depth: number = 10): Promise<CommitInfo[]> {
    try {
      const commits = await git.log({ fs, dir: this.config.baseDir, ref, depth });
      return commits.map((entry) => ({
        oid: entry.oid,
        message: entry.commit.message,
        author: {
          name: entry.commit.author.name,
          email: entry.commit.author.email,
          timestamp: entry.commit.author.timestamp,
        },
        parent: entry.commit.parent,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Stage files for commit
   */
  async add(filepath: string): Promise<void> {
    await git.add({ fs, dir: this.config.baseDir, filepath });
  }

  /**
   * Remove a file from the index
   */
  async remove(filepath: string): Promise<void> {
    await git.remove({ fs, dir: this.config.baseDir, filepath });
  }

  /**
   * Create a commit
   */
  async commit(message: string): Promise<string> {
    return await git.commit({
      fs,
      dir: this.config.baseDir,
      message,
      author: this.config.author,
    });
  }

  /**
   * Get the status of files in the working directory
   */
  async status(): Promise<Array<[string, number, number, number]>> {
    return await git.statusMatrix({ fs, dir: this.config.baseDir });
  }

  /**
   * Read a file at a specific commit
   */
  async readFileAtCommit(oid: string, filepath: string): Promise<string | null> {
    try {
      const { blob } = await git.readBlob({
        fs,
        dir: this.config.baseDir,
        oid,
        filepath,
      });
      return new TextDecoder().decode(blob);
    } catch {
      return null;
    }
  }

  /**
   * List files in a tree at a specific commit
   */
  async listFilesAtCommit(oid: string, prefix: string = ''): Promise<string[]> {
    try {
      const result = await git.listFiles({
        fs,
        dir: this.config.baseDir,
        ref: oid,
      });
      if (prefix) {
        return result.filter((f) => f.startsWith(prefix));
      }
      return result;
    } catch {
      return [];
    }
  }
}

let repositoryServiceInstance: RepositoryService | null = null;

export function getRepositoryService(): RepositoryService {
  if (!repositoryServiceInstance) {
    const baseDir = process.env.GIT_REPO_PATH || './data/repo';
    repositoryServiceInstance = new RepositoryService({
      baseDir,
      author: {
        name: process.env.GIT_AUTHOR_NAME || 'Echo Portal',
        email: process.env.GIT_AUTHOR_EMAIL || 'system@echo-portal.dev',
      },
    });
  }
  return repositoryServiceInstance;
}

export function createRepositoryService(config: RepositoryConfig): RepositoryService {
  return new RepositoryService(config);
}
