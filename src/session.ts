import path from "node:path";
import fs from "node:fs/promises";
import { Session } from "./types.js";
import { getWorktreePath } from "./git.js";

export interface SessionManagerDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  rm: (path: string, opts?: { recursive?: boolean }) => Promise<void>;
}

export class SessionManager {
  constructor(
    private readonly serviceRoot: string,
    private readonly deps: SessionManagerDeps,
  ) {}

  private getSessionPath(sessionName: string): string {
    return path.join(this.serviceRoot, ".oc-work", "sessions", sessionName, "session.json");
  }

  private getSessionsDir(): string {
    return path.join(this.serviceRoot, ".oc-work", "sessions");
  }

  private getWorktreesDir(): string {
    return path.join(this.serviceRoot, ".oc-work", "worktrees");
  }

  async ensureDirectoryStructure(): Promise<void> {
    await this.deps.mkdir(path.join(this.serviceRoot, ".oc-work"));
    await this.deps.mkdir(this.getSessionsDir());
    await this.deps.mkdir(this.getWorktreesDir());
  }

  async getSession(sessionName: string): Promise<Session | null> {
    const sessionPath = this.getSessionPath(sessionName);
    try {
      const content = await this.deps.readFile(sessionPath);
      return JSON.parse(content) as Session;
    } catch {
      return null;
    }
  }

  async saveSession(session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(session.name);
    const sessionDir = path.dirname(sessionPath);
    await this.deps.mkdir(sessionDir);
    await this.deps.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  async listSessions(): Promise<Session[]> {
    if (!(await this.deps.exists(this.getSessionsDir()))) {
      return [];
    }

    const entries = await fs.readdir(this.getSessionsDir(), { withFileTypes: true });
    const sessions: Session[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const session = await this.getSession(entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  }

  async createSession(name: string, repo: string, rootBranch: string): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      name,
      opencodeSessionId: "",
      repo,
      rootBranch,
      branches: [rootBranch],
      lastUsedAt: now,
      createdAt: now,
    };
    await this.saveSession(session);
    return session;
  }

  async updateSessionSessionId(sessionName: string, opencodeSessionId: string): Promise<Session | null> {
    const session = await this.getSession(sessionName);
    if (!session) return null;

    const updated: Session = {
      ...session,
      opencodeSessionId,
    };

    await this.saveSession(updated);
    return updated;
  }

  async updateSessionLastUsed(sessionName: string, newBranch?: string): Promise<Session | null> {
    const session = await this.getSession(sessionName);
    if (!session) return null;

    const updatedBranches = newBranch && !session.branches.includes(newBranch)
      ? [...session.branches, newBranch]
      : session.branches;

    const updated: Session = {
      ...session,
      lastUsedAt: new Date().toISOString(),
      branches: updatedBranches,
    };

    await this.saveSession(updated);
    return updated;
  }

  async deleteSession(sessionName: string): Promise<Session | null> {
    const session = await this.getSession(sessionName);
    if (!session) return null;

    const sessionDir = path.dirname(this.getSessionPath(sessionName));
    await this.deps.rm(sessionDir, { recursive: true });
    return session;
  }

  async getWorktreePath(sessionName: string, branch: string): Promise<string> {
    return getWorktreePath(this.serviceRoot, sessionName, branch);
  }

  async getTopSessions(limit: number = 5): Promise<Session[]> {
    const sessions = await this.listSessions();
    return sessions.slice(0, limit);
  }
}

export function createSessionManager(serviceRoot: string, deps: SessionManagerDeps): SessionManager {
  return new SessionManager(serviceRoot, deps);
}