import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { GlobalConfig } from "./types.js";

const GLOBAL_CONFIG_PATH = path.join(os.homedir(), ".config", "opencode-workers", "config");

export class ConfigManager {
  constructor(
    private readonly readFile: (path: string) => Promise<string>,
    private readonly writeFile: (path: string, content: string) => Promise<void>,
    private readonly mkdir: (path: string) => Promise<void>,
    private readonly exists: (path: string) => Promise<boolean>,
  ) {}

  async getActiveServiceDir(): Promise<string | null> {
    try {
      const content = await this.readFile(GLOBAL_CONFIG_PATH);
      const config: GlobalConfig = JSON.parse(content);
      return config.activeServiceDir ?? null;
    } catch {
      return null;
    }
  }

  async setActiveServiceDir(serviceRoot: string): Promise<void> {
    const configDir = path.dirname(GLOBAL_CONFIG_PATH);
    if (!(await this.exists(configDir))) {
      await this.mkdir(configDir);
    }
    const config: GlobalConfig = { activeServiceDir: serviceRoot };
    await this.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  getGlobalConfigPath(): string {
    return GLOBAL_CONFIG_PATH;
  }
}

export function createConfigManager(deps: {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
}): ConfigManager {
  return new ConfigManager(deps.readFile, deps.writeFile, deps.mkdir, deps.exists);
}