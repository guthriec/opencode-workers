import { ConfigManager } from "../config.js";
import { SessionManager } from "../session.js";

export interface ActivateDeps {
  configManager: ConfigManager;
  sessionManagerFactory: (serviceRoot: string) => SessionManager;
  cwd: string;
}

export async function activate({ configManager, sessionManagerFactory, cwd }: ActivateDeps): Promise<void> {
  await configManager.setActiveServiceDir(cwd);
  const sessionManager = sessionManagerFactory(cwd);
  await sessionManager.ensureDirectoryStructure();
}

export function createActivateDeps(
  configManager: ConfigManager,
  sessionManagerFactory: (serviceRoot: string) => SessionManager,
  cwd: string,
): ActivateDeps {
  return { configManager, sessionManagerFactory, cwd };
}