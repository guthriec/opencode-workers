import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../src/cli";

type Capture = {
  stdout: string[];
  stderr: string[];
};

function createDependencies(branchExists: boolean): {
  capture: Capture;
  deps: Parameters<typeof runCli>[1];
} {
  const capture: Capture = { stdout: [], stderr: [] };

  return {
    capture,
    deps: {
      cwd: "/service",
      writeStdout: (message: string) => {
        capture.stdout.push(message);
      },
      writeStderr: (message: string) => {
        capture.stderr.push(message);
      },
      doesLocalBranchExist: async () => branchExists,
    },
  };
}

test("serve command starts in current directory", async () => {
  const { capture, deps } = createDependencies(true);

  const code = await runCli(["serve"], deps);

  assert.equal(code, 0);
  assert.match(capture.stdout[0], /Starting opencode-workers service in \/service/);
});

test("session init requires repository and session", async () => {
  const { capture, deps } = createDependencies(true);

  const code = await runCli(["session", "init", "--repo", "my-repo"], deps);

  assert.equal(code, 1);
  assert.match(capture.stderr.join("\n"), /required option '--session <session>' not specified/);
});

test("session do requires base branch when operative branch is missing", async () => {
  const { capture, deps } = createDependencies(false);

  const code = await runCli(
    [
      "session",
      "do",
      "--repo",
      "my-repo",
      "--session",
      "s1",
      "--prompt",
      "write tests",
      "--operative-branch",
      "feature/new-work",
    ],
    deps,
  );

  assert.equal(code, 1);
  assert.match(capture.stderr.join("\n"), /--base-branch is required/);
});

test("session do allows existing operative branch without base branch", async () => {
  const { capture, deps } = createDependencies(true);

  const code = await runCli(
    [
      "session",
      "do",
      "--repo",
      "my-repo",
      "--session",
      "s1",
      "--prompt",
      "write tests",
      "--operative-branch",
      "feature/existing",
    ],
    deps,
  );

  assert.equal(code, 0);
  assert.match(capture.stdout[0], /Running session 's1' for repository 'my-repo'/);
});
