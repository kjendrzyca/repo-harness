# Changelog

All notable changes to this project will be documented in this file.

Entries are grouped by ISO 8601 dates (`YYYY-MM-DD`). This repository does not maintain separate version numbers unless it later becomes a packaged or released artifact.

Within each date, every change should get its own `### <Change title>` section. Add new sections above older sections for the same day. This keeps diffs clean and avoids growing one large mixed list.

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
