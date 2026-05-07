import path from "node:path";
import { spawn } from "node:child_process";

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface GitOperations {
  fetch(repoPath: string): Promise<void>;
  pull(repoPath: string, branch: string): Promise<GitResult>;
  createBranch(repoPath: string, branchName: string, baseBranch: string): Promise<void>;
  checkoutBranch(repoPath: string, branchName: string): Promise<void>;
  createWorktree(repoPath: string, worktreePath: string, branch: string): Promise<void>;
  removeWorktree(repoPath: string, worktreePath: string): Promise<void>;
  getStatus(repoPath: string): Promise<string>;
  addAndCommit(repoPath: string, message: string): Promise<GitResult>;
  push(repoPath: string, branch: string, setUpstream: boolean): Promise<void>;
  branchExists(repoPath: string, branch: string): Promise<boolean>;
}

class GitOperationsImpl implements GitOperations {
  private async runGit(args: string[], cwd: string): Promise<GitResult> {
    return new Promise((resolve) => {
      const proc = spawn("git", args, { cwd, stdio: "pipe" });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (data) => { stdout += data; });
      proc.stderr?.on("data", (data) => { stderr += data; });
      proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    });
  }

  async fetch(repoPath: string): Promise<void> {
    await this.runGit(["fetch", "--all"], repoPath);
  }

  async pull(repoPath: string, branch: string): Promise<GitResult> {
    return this.runGit(["pull", "origin", branch], repoPath);
  }

  async createBranch(repoPath: string, branchName: string, baseBranch: string): Promise<void> {
    const result = await this.runGit(["checkout", "-b", branchName, baseBranch], repoPath);
    if (result.code !== 0) {
      throw new Error(`Failed to create branch: ${result.stderr}`);
    }
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<void> {
    const result = await this.runGit(["checkout", branchName], repoPath);
    if (result.code !== 0) {
      throw new Error(`Failed to checkout branch: ${result.stderr}`);
    }
  }

  async createWorktree(repoPath: string, worktreePath: string, branch: string): Promise<void> {
    const result = await this.runGit(["worktree", "add", worktreePath, branch], repoPath);
    if (result.code !== 0) {
      throw new Error(`Failed to create worktree: ${result.stderr}`);
    }
  }

  async removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    const result = await this.runGit(["worktree", "remove", worktreePath, "--force"], repoPath);
    if (result.code !== 0) {
      throw new Error(`Failed to remove worktree: ${result.stderr}`);
    }
  }

  async getStatus(repoPath: string): Promise<string> {
    const result = await this.runGit(["status", "--porcelain"], repoPath);
    return result.stdout;
  }

  async addAndCommit(repoPath: string, message: string): Promise<GitResult> {
    await this.runGit(["add", "-A"], repoPath);
    return this.runGit(["commit", "-m", message], repoPath);
  }

  async push(repoPath: string, branch: string, setUpstream: boolean): Promise<void> {
    const args = setUpstream ? ["push", "-u", "origin", branch] : ["push", "origin", branch];
    const result = await this.runGit(args, repoPath);
    if (result.code !== 0) {
      throw new Error(`Failed to push: ${result.stderr}`);
    }
  }

  async branchExists(repoPath: string, branch: string): Promise<boolean> {
    const result = await this.runGit(["rev-parse", "--verify", `--quiet`, `refs/heads/${branch}`], repoPath);
    return result.code === 0;
  }
}

export function createGitOperations(): GitOperations {
  return new GitOperationsImpl();
}

export function getWorktreePath(serviceRoot: string, sessionName: string, branchName: string): string {
  const safeBranch = branchName.replace(/\//g, "-");
  return path.join(serviceRoot, ".oc-work", "worktrees", `${sessionName}-${safeBranch}`);
}