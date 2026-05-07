import path from "node:path";
import fs from "node:fs/promises";
import { CommanderError } from "commander";
import { DoOptions } from "../types.js";
import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";
import { GitOperations } from "../git.js";
import { OpencodeManager, OpenCodeInstance } from "../opencode.js";

export interface SessionDoDeps {
  configManager: ConfigManager;
  sessionManager: SessionManager;
  opencodeManager: OpencodeManager;
  git: GitOperations;
  exists: (path: string) => Promise<boolean>;
  writeStdout: (message: string) => void;
  options: DoOptions;
}

export async function sessionDo({ configManager, sessionManager, opencodeManager, git, exists, writeStdout, options }: SessionDoDeps): Promise<void> {
  const serviceRoot = await configManager.getActiveServiceDir();
  if (!serviceRoot) {
    throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
  }

  const repoPath = path.join(serviceRoot, options.repo);
  if (!(await exists(repoPath))) {
    throw new CommanderError(1, "oc-work.repoNotFound", `Repository '${options.repo}' not found in service directory`);
  }

  const session = await sessionManager.getSession(options.session);
  if (!session) {
    throw new CommanderError(1, "oc-work.sessionNotFound", `Session '${options.session}' not found`);
  }

  let finalPrompt = options.prompt;
  if (options.file) {
    if (options.file === "-") {
      finalPrompt = await fs.readFile("/dev/stdin", "utf-8");
    } else {
      finalPrompt = await fs.readFile(path.resolve(options.file), "utf-8");
    }
  }

  await git.fetch(repoPath);
  writeStdout(`Fetched updates for ${options.repo}`);

  const branchExistsInSession = session.branches.includes(options.branch);

  if (!branchExistsInSession) {
    const baseBranch = options.baseBranch ?? session.rootBranch;
    await git.createBranch(repoPath, options.branch, baseBranch);
    writeStdout(`Created branch '${options.branch}' from '${baseBranch}'`);
  } else {
    const pullResult = await git.pull(repoPath, options.branch);
    if (pullResult.code !== 0) {
      throw new CommanderError(1, "oc-work.pullFailed", `Failed to pull branch '${options.branch}': ${pullResult.stderr}`);
    }
    writeStdout(`Pulled latest for branch '${options.branch}'`);
  }

  const worktreePath = await sessionManager.getWorktreePath(options.session, options.branch);
  const worktreeExists = await exists(worktreePath);

  if (!worktreeExists) {
    await git.createWorktree(repoPath, worktreePath, options.branch);
    writeStdout(`Created worktree at ${worktreePath}`);
  }

  writeStdout(`Starting opencode session in worktree: ${worktreePath}`);

  const instance: OpenCodeInstance = await opencodeManager.getOrCreateServer(repoPath);
  writeStdout(`Connected to opencode server`);

  const opencodeSessionId = await opencodeManager.ensureSession(
    instance.client,
    worktreePath,
    session.opencodeSessionId || undefined,
    `oc-work: ${options.session}`,
    options.agent,
  );

  if (opencodeSessionId !== session.opencodeSessionId) {
    await sessionManager.updateSessionSessionId(options.session, opencodeSessionId);
    writeStdout(`Created new opencode session: ${opencodeSessionId}`);
  } else {
    writeStdout(`Using existing opencode session: ${opencodeSessionId}`);
  }

  writeStdout(`\n--- Running opencode ---\n`);

  await opencodeManager.runPrompt(
    instance.client,
    opencodeSessionId,
    worktreePath,
    finalPrompt,
    options.agent,
  );

  process.stdout.write("\n");

  const status = await git.getStatus(worktreePath);
  const hasChanges = status.trim().length > 0;

  if (hasChanges) {
    const commitMsg = options.commitMessage || `oc-work: session ${options.session} run on branch ${options.branch}`;
    const commitResult = await git.addAndCommit(worktreePath, commitMsg);
    if (commitResult.code === 0) {
      writeStdout(`Committed changes: ${commitMsg}`);
    }

    if (options.push) {
      await git.push(worktreePath, options.branch, true);
      writeStdout(`Pushed branch '${options.branch}' to remote`);
    }
  }

  await sessionManager.updateSessionLastUsed(options.session, options.branch);
  writeStdout("Updated session metadata");
}

export function createSessionDoDeps(
  configManager: ConfigManager,
  sessionManager: SessionManager,
  opencodeManager: OpencodeManager,
  git: GitOperations,
  exists: (path: string) => Promise<boolean>,
  writeStdout: (message: string) => void,
  options: DoOptions,
): SessionDoDeps {
  return { configManager, sessionManager, opencodeManager, git, exists, writeStdout, options };
}