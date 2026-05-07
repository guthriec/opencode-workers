# opencode-workers Design Doc

## 1. Overview

An orchestrator CLI that manages named opencode sessions with git worktree isolation. Each session has a root branch, and `do` runs can fork or continue on branches within that session. The orchestrator auto-commits changes after each run and manages worktree lifecycle.

## 2. Terminology

- **Service root**: The directory where `oc-work activate` was run. Contains global service state (`.oc-work/`).
- **Session**: A named context with:
  - User-defined name (e.g., `s1`)
  - Associated opencode session ID
  - Repository path
  - `rootBranch`: The base branch for this session
  - `branches[]`: All branches created/used in this session
  - `lastUsedAt`: Timestamp of last `do` run (for sorting)

## 3. Architecture

### 3.1 Global Config

Location: `~/.config/opencode-workers/config`

```json
{
  "activeServiceDir": "/path/to/current/service"
}
```

- **`activate`** command: Writes `activeServiceDir`, creates `.oc-work/`.

### 3.2 Service Directory Structure

```
<service-root>/
├── .oc-work/
│   ├── sessions/
│   │   ├── s1/
│   │   │   └── session.json
│   │   └── s2/
│   │       └── session.json
│   ├── worktrees/
│   │   ├── s1-feature-a/
│   │   └── s1-feature-b/
│   └── config.json
└── (repo directories...)
```

### 3.3 Session Metadata (`session.json`)

```json
{
  "name": "s1",
  "opencodeSessionId": "abc-123",
  "repo": "my-repo",
  "rootBranch": "main",
  "branches": ["feature/test", "feature/test-2"],
  "lastUsedAt": "2026-05-07T10:00:00Z",
  "createdAt": "2026-05-01T09:00:00Z"
}
```

## 4. Commands

### 4.1 `oc-work activate`

- Writes cwd to global config as `activeServiceDir`
- Creates `.oc-work/` directory structure if not exists
- Does NOT start a background process

### 4.2 `oc-work session list [--offset <num>] [--limit <num>]`

- Lists sessions sorted by `lastUsedAt` descending (last `do` run)
- Default limit: 20
- Output: name, repo, rootBranch, lastUsed

### 4.3 `oc-work session init --repo <repo> --session <name> --branch <branch>`

- Validates repo exists in service root
- Creates session with `rootBranch: <branch>`
- Initializes `branches: [<branch>]`
- Does NOT create opencode session yet

### 4.4 `oc-work session do --repo <repo> --session <name> --prompt <prompt> --branch <branch> [--file <path>] [--base-branch <branch>] [--agent <name>] [--commit-message <msg>] [--push]`

**Pre-run**:
1. Load session metadata
2. `git pull` on the requested branch (fetch + merge)
3. If branch doesn't exist in session's branch list:
   - If `--base-branch` provided: create new branch from that base
   - Else: create from `session.rootBranch`
4. Ensure worktree exists (rehydrate if cleaned up)

**Run**:
5. Start opencode server (one per repo) via `@opencode-ai/sdk` with worktree path
6. Create/switch to opencode session (use existing if `opencodeSessionId` stored)
7. Inject system prompt: "You are working in an oc-work session. Resolve any merge conflicts that arise during your work."
8. Send user prompt (from `--prompt` flag or `--file` argument)
9. Stream response to stdout

**Post-run**:
10. Auto-commit changes: `git add -A && git commit -m <msg>`
11. If `--push`: `git push` and push any child branches with remote tracking
12. Update `lastUsedAt`, add branch to `branches[]` if new

### 4.5 `oc-work session cleanup`

- Removes worktrees for all but 5 most recently used sessions (by `lastUsedAt`)
- Does NOT delete branches or session metadata

### 4.6 `oc-work session delete --session <name>`

- Removes worktree(s) for this session
- Deletes session metadata
- (Branches remain in repo unless explicitly pruned)

## 5. Implementation Notes

### 5.1 Opencode Server

- One server per repository (not per session)
- Server is started on first `do` run for a repo
- Server persists until CLI exits (or explicit `stop` command)

### 5.2 Prompt Input

- `--prompt <text>`: Inline prompt
- `--file <path>`: Read prompt from file
- `--file -`: Read from stdin (for piping)

### 5.3 Auto-commit

- Default message: `oc-work: session <name> run on branch <branch>`
- Override with `--commit-message <msg>`
- Push with `--push` flag

### 5.4 Worktree Lifecycle

- **Create**: `git worktree add .oc-work/worktrees/<session>-<branch> <branch>`
- **Remove**: `git worktree remove .oc-work/worktrees/<session>-<branch> --force`
- **Rehydrate**: Recreate worktree from current branch state after pull

### 5.5 Error Handling

- Missing global config → "No active service. Run `oc-work activate` first."
- Missing repo → "Repository not found in service directory"
- Pull conflicts → Report error, do not proceed with `do` run
- Opencode SDK errors → Propagate with context

## 6. Future Considerations (Out of Scope for v1)

- Background daemon/API
- Database-backed session storage
- Multi-machine/remote execution
- Session sharing/sync