import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../src/cli.js";

type Capture = {
  stdout: string[];
  stderr: string[];
};

function createDependencies() {
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
    },
  };
}

test("serve command starts in current directory", async () => {
  const { capture, deps } = createDependencies();

  const code = await runCli(["serve"], deps);

  assert.equal(code, 0);
  assert.match(capture.stdout[0], /Starting opencode-workers service in \/service/);
});

test("help shows available commands", async () => {
  const { capture, deps } = createDependencies();

  const code = await runCli([], deps);

  assert.equal(code, 0);
  assert.match(capture.stdout.join("\n"), /Commands:/);
});