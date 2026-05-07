import { CommanderError } from "commander";
import { ListOptions } from "../types.js";
import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";

export interface SessionListDeps {
  configManager: ConfigManager;
  sessionManager: SessionManager;
  writeStdout: (message: string) => void;
  options: ListOptions;
}

export async function sessionList({ configManager, sessionManager, writeStdout, options }: SessionListDeps): Promise<void> {
  const serviceRoot = await configManager.getActiveServiceDir();
  if (!serviceRoot) {
    throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
  }

  const sessions = await sessionManager.listSessions();
  const offset = parseInt(options.offset, 10);
  const limit = parseInt(options.limit, 10);
  const paginated = sessions.slice(offset, offset + limit);

  if (paginated.length === 0) {
    writeStdout("No sessions found.");
    return;
  }

  for (const s of paginated) {
    writeStdout(`${s.name}\t${s.repo}\t${s.rootBranch}\t${s.lastUsedAt}`);
  }
}

export function createSessionListDeps(
  configManager: ConfigManager,
  sessionManager: SessionManager,
  writeStdout: (message: string) => void,
  options: ListOptions,
): SessionListDeps {
  return { configManager, sessionManager, writeStdout, options };
}