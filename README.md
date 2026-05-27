# Repo Harness

A reusable [Agent Skill](https://agentskills.io) for initializing, auditing, updating, maintaining, and continuously checking repositories against a lightweight agent-first harness model. Inspired by OpenAI's ["Harness engineering: leveraging Codex in an agent-first world"](https://openai.com/index/harness-engineering/).

Compatible with Claude, Codex, OpenCode, and other agents that support the Agent Skills spec.

## Installation

```bash
npx skills add github.com/kjendrzyca/repo-harness --skill repo-harness
```

Target a specific agent:

```bash
npx skills add github.com/kjendrzyca/repo-harness --skill repo-harness --agent opencode
```

## What the skill does

The skill is not bootstrap-only. It supports the full lifecycle:

- `init` - create the smallest useful local harness in a target repo.
- `audit` - assess maturity and identify gaps.
- `update` - apply one justified next-layer improvement.
- `maintain` - clean up drift and restore alignment.
- `decide` - answer whether the repo should evolve further or stay put.
- `exec-plans` - install or refresh repo-local execution-plan support.
- `check` - run a continuous conformance pass and suggest or apply the smallest useful cleanup.

Use it by asking the agent to invoke the skill:

```text
Use the `repo-harness` skill to audit this repository.
Use the `repo-harness` skill to apply one justified next step.
Use the `repo-harness` skill to install execution plans.
```

The ExecPlan template in [`skills/repo-harness/assets/exec-plans/create-plan-file.md`](skills/repo-harness/assets/exec-plans/create-plan-file.md) is based on OpenAI's execution plans guidance:

- https://developers.openai.com/cookbook/articles/codex_exec_plans

## Extras

- [`tools/codex-review/`](tools/codex-review/README.md) - GitHub Actions PR review bot powered by the Codex CLI. Not part of the skill bundle; copy it in if you want it.

## Contributing

See [AGENTS.md](./AGENTS.md).

## License

[MIT](./LICENSE)
