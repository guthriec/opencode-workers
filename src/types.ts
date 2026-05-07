export interface Session {
  name: string;
  opencodeSessionId: string;
  repo: string;
  rootBranch: string;
  branches: string[];
  lastUsedAt: string;
  createdAt: string;
}

export interface ServiceConfig {
  serviceRoot: string;
}

export interface GlobalConfig {
  activeServiceDir: string;
}

export interface DoOptions {
  repo: string;
  session: string;
  prompt: string;
  branch: string;
  file?: string;
  baseBranch?: string;
  agent?: string;
  commitMessage: string;
  push: boolean;
}

export interface InitOptions {
  repo: string;
  session: string;
  branch: string;
}

export interface ListOptions {
  offset: string;
  limit: string;
}

export interface DeleteOptions {
  session: string;
}