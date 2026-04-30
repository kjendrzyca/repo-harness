# Execution Plans

Execution plans are an optional final layer for repositories where work no longer fits into one clean prompt or one short implementation pass.

They are useful when:
- the change spans multiple steps or milestones,
- the agent will likely lose context without a living plan,
- multiple decisions need to be recorded as the work unfolds,
- a future stateless agent should be able to continue from the plan alone.

## Important ordering rule

Do not install execution plans first.

Execution plans should be added only after the repository already has a usable base harness:
- a readable `README.md`,
- a local `AGENTS.md` that acts as a map,
- any necessary orientation and architecture docs,
- local core beliefs if the project truly has them.

Only then should execution-plan support be added.

## Canonical assets in this module

- `../../assets/exec-plans/create-plan-file.md` - the generic execution-plan template and guide.
- `customizing-exec-plans.md` - instructions for adapting that generic file to a specific repository.

## How to install execution plans in a target repo

1. Copy `../../assets/exec-plans/create-plan-file.md` into the target repo as `docs/exec-plans/create-plan-file.md`, unless the target repo already has a stronger local convention.
2. Run the customization process from `customizing-exec-plans.md` against that local file.
3. Let the agent fill in repo-specific plan directories, commands, tech stack, and conventions.
4. Link the resulting planning entrypoint from the target repo's `AGENTS.md` if helpful.

This gives the target repo a repo-local planning entrypoint instead of keeping plan logic hidden in prompts.

## What a good execution plan should do

A good execution plan is:
- self-contained,
- outcome-focused,
- updated as work progresses,
- explicit about assumptions and open questions,
- precise about files, commands, and validation steps.

An execution plan is not a vague checklist.

## Default plan location in the target repo

The generic asset assumes:

```text
docs/exec-plans/
  active/
  completed/
  abandoned/
```

But after customization, the local file should define the repo's actual convention, including monorepo-specific plan directories if needed.

## When not to use execution plans

Do not install or use them when:
- the change is trivial,
- the work fits in one clear prompt,
- a plan would contain more ceremony than useful guidance.
