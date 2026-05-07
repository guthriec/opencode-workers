# opencode-workers
An orchestrator for opencode agents with named sessions and git worktree isolation (separate per session)

## CLI (stub)
The CLI entrypoint is `oc-work`.

- `oc-work serve`
  - Initializes and starts the service in the current directory.
  - The service directory should contain one or more git repositories.

- `oc-work session list`
  - Lists sessions for the current service directory.

- `oc-work session init --repo <repository> --session <session>`
  - Initializes a named session for a repository.
  - `--repo` and `--session` are required.

- `oc-work session do --repo <repository> --session <session> --prompt <prompt> --branch <branch> [--base-branch <branch>] [--agent <name>]`
  - Executes a session action with a prompt.
  - Required: `--repo`, `--session`, `--prompt`, `--branch`.
  - `--base-branch` is required when the branch does not yet exist.
  - `--agent` is optional.
