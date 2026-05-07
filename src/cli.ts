import path from "node:path";
import { spawnSync } from "node:child_process";
import { Command, CommanderError } from "commander";

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
      writeOut: (message) => {
        writeOutput(dependencies.writeStdout, message);
      },
      writeErr: (message) => {
        writeOutput(dependencies.writeStderr, message);
      },
    });

  program.command("serve").action(() => {
    dependencies.writeStdout(`Starting opencode-workers service in ${dependencies.cwd}`);
  });

  const session = program.command("session");

  session.command("list").action(() => {
    dependencies.writeStdout(`Listing sessions in ${dependencies.cwd} (stub)`);
  });

  session
    .command("init")
    .requiredOption("--repo <repository>")
    .requiredOption("--session <session>")
    .action((options: { repo: string; session: string }) => {
      dependencies.writeStdout(
        `Initializing session '${options.session}' for repository '${options.repo}' in ${dependencies.cwd} (stub)`,
      );
    });

  session
    .command("do")
    .requiredOption("--repo <repository>")
    .requiredOption("--session <session>")
    .requiredOption("--prompt <prompt>")
    .requiredOption("--branch <branch>")
    .option("--base-branch <branch>")
    .option("--agent <name>")
    .action(
      async (options: {
        repo: string;
        session: string;
        prompt: string;
        branch: string;
        baseBranch?: string;
        agent?: string;
      }) => {
        const repositoryPath = path.resolve(dependencies.cwd, options.repo);
        const branchExists = await dependencies.doesLocalBranchExist(repositoryPath, options.branch);

        if (!branchExists && !options.baseBranch) {
          throw new CommanderError(
            1,
            "oc-work.baseBranchRequired",
            `--base-branch is required when branch '${options.branch}' does not exist in '${options.repo}'`,
          );
        }

        dependencies.writeStdout(
          [
            `Running session '${options.session}' for repository '${options.repo}'`,
            `prompt='${options.prompt}'`,
            `branch='${options.branch}'`,
            `baseBranch='${options.baseBranch ?? "(none)"}'`,
            `agent='${options.agent ?? "(default)"}'`,
            "(stub)",
          ].join("; "),
        );
      },
    );

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
