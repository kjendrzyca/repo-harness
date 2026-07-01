---
name: code-review
description: Run the Codex PR code-review workflow locally from a checked-out repository. Use when reviewing a local branch or PR on your own machine, when the user asks for a Codex-style code review without installing the GitHub Action bot, or when they want the same review logic as the repo-harness bot but run locally. Builds scoped diffs, reads AGENTS.md and REVIEW_GUIDELINES.md, runs codex exec with the bundled schema, maintains local review state, and prints the Markdown verdict.
license: MIT
compatibility: Requires git, Node.js 18+, and an authenticated codex CLI. The default run uses Codex with network disabled and writes temporary artifacts under .codex-ci/ in the reviewed repository.
---

# Code Review

Run the same Codex review prompt and output schema as the GitHub Actions review bot, but locally.
This skill does not install workflows, set GitHub secrets, or post GitHub comments. Use
`install-code-review-bot` for the CI bot.

## Workflow

1. Make sure the target repository is checked out at the branch or commit to review.
2. Pick the base ref. If the user did not specify one, default to the repository default branch
   (`origin/HEAD`, then `origin/main`, then `origin/master`).
3. Run the local review script from this skill:

   ```bash
   node scripts/run-code-review.cjs --repo-dir <target-repo> --base <base-ref>
   ```

4. Read the Markdown review printed by the script. The same text is saved at
   `<target-repo>/.codex-ci/review.md`.

## Available script

- `scripts/run-code-review.cjs` - builds `.codex-ci/` review artifacts, runs `codex exec` with the
  bundled schema, stores local continuity state under `.git/codex-review/`, and prints the review.

Useful flags:

```bash
node scripts/run-code-review.cjs --repo-dir <target-repo> --base origin/main --no-codex
node scripts/run-code-review.cjs --repo-dir <target-repo> --base origin/main --full
node scripts/run-code-review.cjs --repo-dir <target-repo> --base origin/main --reset
node scripts/run-code-review.cjs --repo-dir <target-repo> --base origin/main --since <sha>
node scripts/run-code-review.cjs --repo-dir <target-repo> --base origin/main --model gpt-5.5 --reasoning xhigh
```

Use `--no-codex` to build and inspect the prompt/diff without spending a model run.

## Behavior

- Review scope matches the bot's strategy: full review on first run, incremental review after the
  last locally reviewed head SHA, `--full` for a forced full pass, `--reset` to ignore previous local
  state, and `--since <sha>` to review only newer commits.
- The script writes the same prompt inputs the bot uses:
  - `.codex-ci/pr-diff.patch`
  - `.codex-ci/pr-diff-full.patch`
  - `.codex-ci/changed-files.txt`
  - `.codex-ci/review-commits.txt`
  - `.codex-ci/state-prev.json`
  - `.codex-ci/review-prev.md`
  - `.codex-ci/review-prompt.md`
  - `.codex-ci/codex-review-output.json`
- Local continuity state lives in Git's private metadata path for the checkout, not in a committed
  file: `.git/codex-review/state.json` and `.git/codex-review/review.md`.
- The script compares tracked changes before and after `codex exec`. If the review run changes
  tracked files outside `.codex-ci/`, stop and report that as an error.

## Review rules

- Treat the output as a code review: findings first, ordered by severity.
- Do not invent issues. A review with no concrete P0/P1 findings is a valid result.
- Do not commit `.codex-ci/` artifacts unless the user explicitly asks for them.
- If the script says there are no new commits, report that directly instead of forcing another run.
