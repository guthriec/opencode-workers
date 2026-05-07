import { CommanderError } from "commander";
import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";
import { GitOperations } from "../git.js";

export interface SessionCleanupDeps {
  configManager: ConfigManager;
  sessionManager: SessionManager;
  git: GitOperations;
  exists: (path: string) => Promise<boolean>;
  writeStdout: (message: string) => void;
  writeStderr: (message: string) => void;
}

export async function sessionCleanup({ configManager, sessionManager, git, exists, writeStdout, writeStderr }: SessionCleanupDeps): Promise<void> {
  const serviceRoot = await configManager.getActiveServiceDir();
  if (!serviceRoot) {
    throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
  }

  const sessions = await sessionManager.listSessions();

  if (sessions.length === 0) {
    writeStdout("No sessions to clean up.");
    return;
  }

  const topSessions = await sessionManager.getTopSessions(5);
  const keepNames = new Set(topSessions.map(s => s.name));

  for (const session of sessions) {
    if (!keepNames.has(session.name)) {
      for (const branch of session.branches) {
        const worktreePath = await sessionManager.getWorktreePath(session.name, branch);
        if (await exists(worktreePath)) {
          try {
            await git.removeWorktree(serviceRoot, worktreePath);
            writeStdout(`Removed worktree: ${session.name}-${branch}`);
          } catch {
            writeStderr(`Failed to remove worktree: ${session.name}-${branch}`);
          }
        }
      }
    }
  }

  writeStdout("Cleanup complete");
}

export function createSessionCleanupDeps(
  configManager: ConfigManager,
  sessionManager: SessionManager,
  git: GitOperations,
  exists: (path: string) => Promise<boolean>,
  writeStdout: (message: string) => void,
  writeStderr: (message: string) => void,
): SessionCleanupDeps {
  return { configManager, sessionManager, git, exists, writeStdout, writeStderr };
}