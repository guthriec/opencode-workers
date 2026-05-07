import path from "node:path";
import { CommanderError } from "commander";
import { InitOptions } from "../types.js";
import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";
import { GitOperations } from "../git.js";

export interface SessionInitDeps {
  configManager: ConfigManager;
  sessionManager: SessionManager;
  git: GitOperations;
  exists: (path: string) => Promise<boolean>;
  options: InitOptions;
}

export async function sessionInit({ configManager, sessionManager, git, exists, options }: SessionInitDeps): Promise<void> {
  const serviceRoot = await configManager.getActiveServiceDir();
  if (!serviceRoot) {
    throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
  }

  const repoPath = path.join(serviceRoot, options.repo);
  if (!(await exists(repoPath))) {
    throw new CommanderError(1, "oc-work.repoNotFound", `Repository '${options.repo}' not found in service directory`);
  }

  const existingSession = await sessionManager.getSession(options.session);
  if (existingSession) {
    throw new CommanderError(1, "oc-work.sessionExists", `Session '${options.session}' already exists`);
  }

  await sessionManager.createSession(options.session, options.repo, options.branch);
}

export function createSessionInitDeps(
  configManager: ConfigManager,
  sessionManager: SessionManager,
  git: GitOperations,
  exists: (path: string) => Promise<boolean>,
  options: InitOptions,
): SessionInitDeps {
  return { configManager, sessionManager, git, exists, options };
}