import path from "node:path";
import { spawnSync } from "node:child_process";

export interface CliDependencies {
  cwd: string;
  writeStdout: (message: string) => void;
  writeStderr: (message: string) => void;
  doesLocalBranchExist: (repoPath: string, branch: string) => Promise<boolean>;
}

const defaultDependencies: CliDependencies = {
  cwd: process.cwd(),
  writeStdout: (message) => {
    process.stdout.write(`${message}\n`);
  },
  writeStderr: (message) => {
    process.stderr.write(`${message}\n`);
  },
  doesLocalBranchExist: async (repoPath, branch) => {
    const result = spawnSync(
      "git",
      ["-C", repoPath, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      { stdio: "ignore" },
    );

    return result.status === 0;
  },
};

function getFlagValue(flags: Record<string, string>, name: string): string | undefined {
  return flags[name];
}

function parseFlags(args: string[]): { flags?: Record<string, string>; error?: string } {
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      return { error: `Unexpected argument: ${token}` };
    }

    const key = token.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      return { error: `Missing value for --${key}` };
    }

    flags[key] = value;
    index += 1;
  }

  return { flags };
}

function printHelp(writeStdout: (message: string) => void): void {
  writeStdout("Usage: oc-work <command>");
  writeStdout("");
  writeStdout("Commands:");
  writeStdout("  serve");
  writeStdout("  session init --repo <repository> --session <session>");
  writeStdout("  session list");
  writeStdout(
    "  session do --repo <repository> --session <session> --prompt <prompt> --operative-branch <branch> [--base-branch <branch>] [--agent <name>]",
  );
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = defaultDependencies,
): Promise<number> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp(dependencies.writeStdout);
    return 0;
  }

  const [command, subcommand, ...remainingArgs] = argv;

  if (command === "serve") {
    dependencies.writeStdout(`Starting opencode-workers service in ${dependencies.cwd}`);
    return 0;
  }

  if (command !== "session") {
    dependencies.writeStderr(`Unknown command: ${command}`);
    printHelp(dependencies.writeStdout);
    return 1;
  }

  if (subcommand === "list") {
    dependencies.writeStdout(`Listing sessions in ${dependencies.cwd} (stub)`);
    return 0;
  }

  if (subcommand !== "init" && subcommand !== "do") {
    dependencies.writeStderr(`Unknown session command: ${subcommand ?? "(none)"}`);
    printHelp(dependencies.writeStdout);
    return 1;
  }

  const parsedFlags = parseFlags(remainingArgs);
  if (parsedFlags.error || !parsedFlags.flags) {
    dependencies.writeStderr(parsedFlags.error ?? "Invalid arguments");
    return 1;
  }

  const repository = getFlagValue(parsedFlags.flags, "repo");
  const session = getFlagValue(parsedFlags.flags, "session");

  if (!repository || !session) {
    dependencies.writeStderr("--repo and --session are required");
    return 1;
  }

  if (subcommand === "init") {
    dependencies.writeStdout(
      `Initializing session '${session}' for repository '${repository}' in ${dependencies.cwd} (stub)`,
    );
    return 0;
  }

  const prompt = getFlagValue(parsedFlags.flags, "prompt");
  const operativeBranch = getFlagValue(parsedFlags.flags, "operative-branch");
  const baseBranch = getFlagValue(parsedFlags.flags, "base-branch");
  const agent = getFlagValue(parsedFlags.flags, "agent");

  if (!prompt || !operativeBranch) {
    dependencies.writeStderr("--prompt and --operative-branch are required");
    return 1;
  }

  const repositoryPath = path.resolve(dependencies.cwd, repository);
  const branchExists = await dependencies.doesLocalBranchExist(repositoryPath, operativeBranch);

  if (!branchExists && !baseBranch) {
    dependencies.writeStderr(
      `--base-branch is required when operative branch '${operativeBranch}' does not exist in '${repository}'`,
    );
    return 1;
  }

  dependencies.writeStdout(
    [
      `Running session '${session}' for repository '${repository}'`,
      `prompt='${prompt}'`,
      `operativeBranch='${operativeBranch}'`,
      `baseBranch='${baseBranch ?? "(none)"}'`,
      `agent='${agent ?? "(default)"}'`,
      "(stub)",
    ].join("; "),
  );

  return 0;
}
