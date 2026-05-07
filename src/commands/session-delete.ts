import { CommanderError } from "commander";
import { DeleteOptions } from "../types.js";
import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";
import { GitOperations } from "../git.js";

export interface SessionDeleteDeps {
  configManager: ConfigManager;
  sessionManager: SessionManager;
  git: GitOperations;
  exists: (path: string) => Promise<boolean>;
  writeStdout: (message: string) => void;
  writeStderr: (message: string) => void;
  options: DeleteOptions;
}

export async function sessionDelete({ configManager, sessionManager, git, exists, writeStdout, writeStderr, options }: SessionDeleteDeps): Promise<void> {
  const serviceRoot = await configManager.getActiveServiceDir();
  if (!serviceRoot) {
    throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
  }

  const session = await sessionManager.getSession(options.session);
  if (!session) {
    throw new CommanderError(1, "oc-work.sessionNotFound", `Session '${options.session}' not found`);
  }

  for (const branch of session.branches) {
    const worktreePath = await sessionManager.getWorktreePath(options.session, branch);
    if (await exists(worktreePath)) {
      try {
        await git.removeWorktree(serviceRoot, worktreePath);
        writeStdout(`Removed worktree: ${options.session}-${branch}`);
      } catch {
        writeStderr(`Failed to remove worktree: ${options.session}-${branch}`);
      }
    }
  }

  await sessionManager.deleteSession(options.session);
  writeStdout(`Deleted session '${options.session}'`);
}

export function createSessionDeleteDeps(
  configManager: ConfigManager,
  sessionManager: SessionManager,
  git: GitOperations,
  exists: (path: string) => Promise<boolean>,
  writeStdout: (message: string) => void,
  writeStderr: (message: string) => void,
  options: DeleteOptions,
): SessionDeleteDeps {
  return { configManager, sessionManager, git, exists, writeStdout, writeStderr, options };
}