# Changelog

All notable changes to this project will be documented in this file.

Entries are grouped by ISO 8601 dates (`YYYY-MM-DD`). This repository does not maintain separate version numbers unless it later becomes a packaged or released artifact.

Within each date, every change should get its own `### <Change title>` section. Add new sections above older sections for the same day. This keeps diffs clean and avoids growing one large mixed list.

## 2026-05-30

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
