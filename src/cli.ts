import path from "node:path";
import fs from "node:fs/promises";
import { Command, CommanderError } from "commander";
import { createConfigManager } from "./config.js";
import { createGitOperations } from "./git.js";
import { createSessionManager } from "./session.js";
import { OpencodeManager } from "./opencode.js";
import {
  activate,
  sessionInit,
  sessionList,
  sessionDo,
  sessionDelete,
  sessionCleanup,
} from "./commands/index.js";

export interface CliDependencies {
  cwd: string;
  writeStdout: (message: string) => void;
  writeStderr: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  cwd: process.cwd(),
  writeStdout: (message) => process.stdout.write(`${message}\n`),
  writeStderr: (message) => process.stderr.write(`${message}\n`),
};

function writeOutput(write: (message: string) => void, message: string): void {
  const formatted = message.replace(/\n$/, "");
  if (formatted.length > 0) {
    write(formatted);
  }
}

function applyExitOverride(command: Command): void {
  command.exitOverride();
  for (const subcommand of command.commands) {
    applyExitOverride(subcommand);
  }
}

function createProgram(dependencies: CliDependencies): Command {
  const program = new Command();

  program
    .name("oc-work")
    .description("An orchestrator for opencode agents")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (message) => writeOutput(dependencies.writeStdout, message),
      writeErr: (message) => writeOutput(dependencies.writeStderr, message),
    });

  const configManager = createConfigManager({
    readFile: async (p) => fs.readFile(p, "utf-8"),
    writeFile: async (p, c) => fs.writeFile(p, c, "utf-8"),
    mkdir: async (p) => { await fs.mkdir(p, { recursive: true }); },
    exists: async (p) => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    },
  });

  const git = createGitOperations();
  const opencodeManager = new OpencodeManager();

  const fileExists = async (p: string): Promise<boolean> => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };

  const createSessionManagerDeps = () => ({
    readFile: async (p: string) => fs.readFile(p, "utf-8"),
    writeFile: async (p: string, c: string) => fs.writeFile(p, c, "utf-8"),
    mkdir: async (p: string) => { await fs.mkdir(p, { recursive: true }); },
    exists: fileExists,
    rm: async (p: string, opts?: { recursive?: boolean }) => { await fs.rm(p, opts); },
  });

  const sessionManagerFactory = (serviceRoot: string) =>
    createSessionManager(serviceRoot, createSessionManagerDeps());

  const requireService = async (): Promise<string> => {
    const sr = await configManager.getActiveServiceDir();
    if (!sr) throw new CommanderError(1, "oc-work.noService", "No active service. Run `oc-work activate` first.");
    return sr;
  };

  program
    .command("activate")
    .description("Activate the current directory as the service root")
    .action(async () => {
      await activate({ configManager, sessionManagerFactory: () => sessionManagerFactory(dependencies.cwd), cwd: dependencies.cwd });
    });

  program.command("serve").action(() => {
    dependencies.writeStdout(`Starting opencode-workers service in ${dependencies.cwd}`);
  });

  const session = program.command("session");

  session
    .command("list")
    .option("--offset <num>", "Offset for pagination", "0")
    .option("--limit <num>", "Limit number of results", "20")
    .action(async (options: { offset: string; limit: string }) => {
      const serviceRoot = await requireService();
      const sm = sessionManagerFactory(serviceRoot);
      await sessionList({ configManager, sessionManager: sm, writeStdout: dependencies.writeStdout, options });
    });

  session
    .command("init")
    .requiredOption("--repo <repository>")
    .requiredOption("--session <session>")
    .option("--branch <branch>", "Root branch for the session", "main")
    .action(async (options: { repo: string; session: string; branch: string }) => {
      const serviceRoot = await requireService();
      const sm = sessionManagerFactory(serviceRoot);
      await sessionInit({ configManager, sessionManager: sm, git, exists: fileExists, options });
    });

  session
    .command("do")
    .requiredOption("--repo <repository>")
    .requiredOption("--session <name>")
    .requiredOption("--prompt <prompt>")
    .requiredOption("--branch <branch>")
    .option("--file <path>", "Read prompt from file (use - for stdin)")
    .option("--base-branch <branch>")
    .option("--agent <name>")
    .option("--commit-message <msg>", "Commit message", "")
    .option("--push", "Push changes after commit")
    .action(async (options: {
      repo: string;
      session: string;
      prompt: string;
      branch: string;
      file?: string;
      baseBranch?: string;
      agent?: string;
      commitMessage: string;
      push: boolean;
    }) => {
      const serviceRoot = await requireService();
      const sm = sessionManagerFactory(serviceRoot);
      await sessionDo({ configManager, sessionManager: sm, opencodeManager, git, exists: fileExists, writeStdout: dependencies.writeStdout, options });
    });

  session
    .command("cleanup")
    .description("Remove worktrees for sessions not in the 5 most recently used")
    .action(async () => {
      const serviceRoot = await requireService();
      const sm = sessionManagerFactory(serviceRoot);
      await sessionCleanup({ configManager, sessionManager: sm, git, exists: fileExists, writeStdout: dependencies.writeStdout, writeStderr: dependencies.writeStderr });
    });

  session
    .command("delete")
    .requiredOption("--session <name>")
    .description("Delete a session and its worktrees")
    .action(async (options: { session: string }) => {
      const serviceRoot = await requireService();
      const sm = sessionManagerFactory(serviceRoot);
      await sessionDelete({ configManager, sessionManager: sm, git, exists: fileExists, writeStdout: dependencies.writeStdout, writeStderr: dependencies.writeStderr, options });
    });

  applyExitOverride(program);
  return program;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = defaultDependencies,
): Promise<number> {
  const program = createProgram(dependencies);

  if (argv.length === 0) {
    program.outputHelp();
    return 0;
  }

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code.startsWith("oc-work.")) {
        dependencies.writeStderr(error.message);
      }
      return error.exitCode;
    }

    dependencies.writeStderr(error instanceof Error ? error.message : "Unknown CLI error");
    return 1;
  }
}