# Harness

This repository packages a single reusable skill: `repo-harness`.

The skill is designed to help agents and maintainers initialize, audit, update, maintain, and continuously check repositories against a lightweight agent-first documentation and harness model inspired by the OpenAI article ["Harness engineering: leveraging Codex in an agent-first world"](https://openai.com/index/harness-engineering/).

## What lives here

The actual skill bundle is:
- `skills/repo-harness/`

Inside that folder:
- `SKILL.md` is the operational interface.
- `references/` contains bundled reference material used by the skill.
- `assets/` contains copyable templates and resources used by the skill.

The ExecPlan template in `skills/repo-harness/assets/exec-plans/create-plan-file.md` is based on OpenAI's execution plans guidance:

- https://developers.openai.com/cookbook/articles/codex_exec_plans

## What the skill can do

The skill is not bootstrap-only.

It supports the full lifecycle:
- `init` - create the smallest useful local harness in a target repo.
- `audit` - assess maturity and identify gaps.
- `update` - apply one justified next-layer improvement.
- `maintain` - clean up drift and restore alignment.
- `decide` - answer whether the repo should evolve further or stay put.
- `exec-plans` - install or refresh repo-local execution-plan support.
- `check` - run a continuous conformance pass and suggest or apply the smallest useful cleanup.

## How to use it

Install or expose `skills/repo-harness/` as a local skill in your agent environment.

- For OpenCode, copy it to `.opencode/skills/repo-harness/` or `.agents/skills/repo-harness/`.
- For Claude Code, copy it to `.claude/skills/repo-harness/` or symlink `.agents/skills/repo-harness/`.
- For Codex, copy it to `.agents/skills/repo-harness/`.

Then ask the agent to use the skill for the intent you want. For tools that expose direct skill invocation, use the skill name `repo-harness`.

```text
/repo-harness <mode> [focus]
```

Examples:

```text
Use the `repo-harness` skill to initialize this repository.
Use the `repo-harness` skill to audit whether this repository is still aligned.
Use the `repo-harness` skill to update this repo by one justified next step.
Use the `repo-harness` skill to decide whether this repo needs core beliefs yet.
Use the `repo-harness` skill to install execution plans.
Use the `repo-harness` skill to run a continuous conformance check.
```

## Design choice

This repo is intentionally skill-centric.

There is no separate prompt interface here.
The markdown files are bundled resources for the skill itself.

That keeps the operational model in one place:
- humans use the README to understand the package,
- agents use the skill,
- the skill reads its own bundled reference material and applies it to target repositories.
