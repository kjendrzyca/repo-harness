---
name: local-code-review
description: Run a high-signal Codex code review locally from a checked-out repository, with the repo-harness review prompt and local continuity ledger. Use when reviewing a local branch, commit, uncommitted changes, or PR on your own machine without installing the GitHub Action bot. Preserves prior findings across runs, marks resolved issues, reads AGENTS.md and REVIEW_GUIDELINES.md, and prints the Markdown verdict.
license: MIT
---

# Local Code Review

Run the repo-harness review prompt locally with a lightweight continuity ledger. This skill does not
install workflows, set GitHub secrets, or post GitHub comments. Use `install-code-review-bot` for
the CI bot.

## Requirements

- Git
- Node.js 18+
- Authenticated `codex` CLI

The default run disables network and stores continuity under Git's private `codex-review` path.

## Workflow

1. Make sure the target repository is checked out at the branch or commit to review.
2. Choose the review scope:
   - branch review: pass `--base <base-ref>`
   - single commit: check out the target commit as `HEAD`, then pass `--commit HEAD`
   - current worktree: pass `--uncommitted`
3. Run the local review runner from this skill:

   ```bash
   node scripts/run-local-review.cjs --repo-dir <target-repo> --base <base-ref>
   ```

4. Read the Markdown review printed by the script. The same text and structured continuity state are
   saved under the checkout's Git-private `codex-review` path.

## Do not touch the target repository during a run

While `run-local-review.cjs` is running, do not modify the target repository at all until the
runner's output is received:

- no source edits
- no test, build, or lint runs (they write artifacts like `test-results/`, `dist/`, or coverage)
- no git operations (commit, checkout, stash, branch)
- no dev servers or other processes writing into the repo
- nothing else that mutates the worktree or moves refs

The runner's mutation guard diffs the worktree before and after the run and treats any change as a
failed integrity check, so concurrent activity turns a good review into an error. Wait for the run
to finish (it is typically run in the background). If parallel work is genuinely needed, run the
review against a separate `git worktree` copy of the repository instead.

## Available script

- `scripts/run-local-review.cjs` - runs Codex with the local review prompt, a structured output
  schema, and a Git-private continuity ledger. This is the default path.
- `scripts/run-code-review.cjs` - legacy bot-parity runner retained for eval comparisons and
  troubleshooting. It builds `.codex-ci/` artifacts like the GitHub Action bot.

Useful flags:

```bash
node scripts/run-local-review.cjs --repo-dir <target-repo> --base origin/main
node scripts/run-local-review.cjs --repo-dir <target-repo> --uncommitted
node scripts/run-local-review.cjs --repo-dir <target-repo> --commit HEAD --title "Commit title"
node scripts/run-local-review.cjs --repo-dir <target-repo> --base origin/main --reset
node scripts/run-local-review.cjs --repo-dir <target-repo> --base origin/main --force
node scripts/run-local-review.cjs --repo-dir <target-repo> --base origin/main --no-codex
node scripts/run-local-review.cjs --repo-dir <target-repo> --base origin/main --model gpt-5.6-sol --reasoning xhigh
```

Use `--no-codex` to build and inspect the prompt/schema without spending a model run.

## Behavior

- The runner uses ordinary Git commands from the prompt to inspect branch, commit, or uncommitted
  scope. It does not generate `.codex-ci/` diff artifacts.
- Local continuity state lives in Git's private metadata path for the checkout, not in a committed
  file: `$(git rev-parse --git-path codex-review)/state.json` and `review.md`.
- If the same review scope was already reviewed, the runner exits without spending another model run.
  Use `--force` to re-review the same scope.
- Branch and commit reviews require a clean worktree so Codex reads exactly the committed scope under
  review. Use `--uncommitted` when staged, unstaged, or untracked local changes are part of the scope.
- Commit reviews also require the reviewed commit to be checked out as `HEAD`; use a temporary git
  worktree when reviewing an older commit.
- Use `--reset` to ignore previous local state and start a new continuity chain.
- The script compares the checkout and worktree before and after `codex exec`. If the review run
  changes files, switches commits/refs, or if the mutation guard cannot collect a complete Git
  inventory within its output limits, stop and report that as an error.

## Review rules

- Treat the output as a code review: findings first, ordered by severity.
- Do not invent issues. A review with no concrete P0/P1 findings is a valid result.
- Preserve continuity: keep stable issue IDs for still-open issues and mark fixed prior issues as
  resolved.
- Do not commit generated review artifacts unless the user explicitly asks for them.
- If the script says there are no new commits, report that directly instead of forcing another run.
