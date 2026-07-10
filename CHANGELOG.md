# Changelog

All notable changes to this project will be documented in this file.

Entries are grouped by ISO 8601 dates (`YYYY-MM-DD`). This repository does not maintain separate version numbers unless it later becomes a packaged or released artifact.

Within each date, every change should get its own `### <Change title>` section. Add new sections above older sections for the same day. This keeps diffs clean and avoids growing one large mixed list.

## 2026-07-10

### Warn Against Modifying the Repository During a Local Review Run

- Add a "Do not touch the target repository during a run" rule to the `local-code-review` skill:
  while `run-local-review.cjs` is running, invoking agents must not edit sources, run
  tests/builds/lints that write artifacts, perform git operations, or start dev servers writing into
  the repo, because the mutation guard diffs the worktree before/after and treats any change as a
  failed integrity check. Parallel work belongs in a separate `git worktree`.
- Print a one-line stderr notice when the review starts ("Review in progress - do not modify the
  repository until this process exits").
- Motivation: concurrent worktree mutations were tripping the mutation guard and invalidating
  otherwise good reviews.

## 2026-07-04

### Harden Local Code Review Eval Safety

- Validate `local-code-review` eval run IDs before creating or recursively replacing a workspace, so
  `--run-id` cannot escape `evals/local-code-review/workspaces/`.
- Update the legacy bot-parity runner's mutation guard to compare raw Git diffs instead of only
  filename/status output.

### Rename Local Code Review Skill

- Rename the local review skill from `code-review` to `local-code-review` so it is clearly distinct
  from the `install-code-review-bot` GitHub Action installer.
- Update the README install command, local eval harness path, and skill metadata for the new public
  install target: `npx skills add github.com/kjendrzyca/repo-harness --skill local-code-review`.

## 2026-07-03

### Add Eval-Driven Local Code Review Runner

- Add a lighter local `local-code-review` runner that keeps the repo-harness review prompt and structured
  continuity state while avoiding `.codex-ci/` diff artifacts in the reviewed repository.
- Store scope-keyed local review continuity under Git's private `codex-review` path by default, and
  fail if the review run changes the checkout/worktree or if the mutation guard cannot collect a
  complete Git inventory within its output limits.
- Require a clean worktree for branch and commit reviews, and require commit reviews to run from a
  checkout whose `HEAD` is the reviewed commit. Use the uncommitted scope when local changes are
  intended.
- Add a local-code-review eval harness that compares the legacy bot-parity runner with the local runner on
  an omission-detection and resolved-issue continuity fixture.

## 2026-07-01

### Split Local Code Review From Bot Installation

- Rename the GitHub Action installer skill from `codex-review` to `install-code-review-bot`.
- Add `code-review`, a local Codex review skill that reuses the bot's prompt and output schema,
  builds `.codex-ci/` artifacts, keeps local continuity state under `.git/codex-review/`, and prints
  the Markdown review instead of posting GitHub comments.

## 2026-06-12

### Add Hard Constraint: Doc Updates Belong in the Same Commit

- Add a hard constraint to `SKILL.md`: when generating or updating `AGENTS.md`, always include a local rule naming the canonical docs and what triggers an update - if a change touches user-facing behavior, a public interface, or anything already documented, the doc update goes in the same commit.

## 2026-06-05

### Mark Codex Review as Private-Repo-Only

- Mark `codex-review` as intended for private repositories only.

## 2026-05-30

### Add codex-review Skill; Consolidate the Bot Into It

- Add `skills/codex-review/`, a skill that installs, authenticates, and rotates the Codex PR-review
  bot on a repo: installs the bundle, provisions a dedicated isolated Codex login (its own
  `CODEX_HOME`/`auth.json`, separate from `~/.codex`), and sets the `CODEX_AUTH_JSON_B64` secret.
- Move the bot bundle from `tools/codex-review/` into the skill at
  `skills/codex-review/assets/bundle/` and remove the standalone `tools/codex-review/` directory.
  The installed layout in target repos is unchanged (`.github/workflows/codex-review.yml` +
  `.github/scripts/codex-review/`), so the workflow needs no path changes.

### Fix Codex Review Sandbox Probe and Pin Codex CLI

- Pin `@openai/codex@0.135.0` in the review bot's "Install Codex CLI" step. The unpinned `latest` shipped a `codex sandbox` CLI change that silently broke the sandbox probe.
- Update the probe from `codex sandbox linux /bin/true` to `codex sandbox -- /bin/true` to match the current CLI, which removed the `linux` positional (the old form tried to `execvp` a binary named `linux` and failed).

## 2026-05-28

### Clean Up SKILL.md Frontmatter

- Remove redundant `compatibility` field (per Agent Skills spec: most skills do not need it; ours was effectively tautological).
- Add `license: MIT` field to match the new `LICENSE` file.

### Standardize Installation and Authoring Rules

- Rewrite README installation to use `npx skills add github.com/kjendrzyca/repo-harness --skill repo-harness`. Remove manual copy paths that referenced an incorrect `.opencode/skills/` location and a misleading `.claude/skills -> .agents/skills` symlink chain.
- Add Spec compliance, Privacy (public repo), and Conventions sections to AGENTS.md, aligned with `kjendrzyca/public-skills`.
- Add MIT LICENSE.

## 2026-05-26

### Add Diagnostic Signals to Principles

- Add explicit `AGENTS.md` growth signal to section 2.3: when you keep wanting to add another detail, that itself is the trigger to move detail into `docs/`.
- Add explicit exec-plan readiness signal to section 2.8: when a meaningful change no longer fits in one clean prompt, the repo has earned execution plans.

## 2026-04-30

### Add Codex Review Bot Tool

- Add `tools/codex-review/`, a copyable GitHub Actions PR review bot powered by the Codex CLI.
- Add installation notes for the Codex review bot, including auth setup, trigger options, and security considerations.
- Document the cost tradeoff of running the review bot with `gpt-5.5` and `xhigh` reasoning.

### Publish Initial Repo Harness

- Publish the initial `repo-harness` skill bundle.
- Add repository harness principles for progressive, agent-friendly repo documentation.
- Add core-beliefs references and templates.
- Add ExecPlan references and a copyable ExecPlan template.
- Document that the bundled ExecPlan template is based on OpenAI's execution plans guidance.
