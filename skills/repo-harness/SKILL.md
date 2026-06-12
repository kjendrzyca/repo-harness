---
name: repo-harness
description: Initialize, audit, update, maintain, and continuously check repositories against a lightweight agent-first harness approach. Use when a repo needs better local docs, core beliefs, execution plans, or cleanup of harness drift.
license: MIT
---

# Repo Harness Skill

This skill is the operational interface for the repository harness approach.

It is not a one-shot bootstrap helper.

Use it whenever a repository needs to:
- establish a minimal agent-friendly local knowledge system,
- assess whether its current harness is too thin or too heavy,
- add one justified next-layer improvement,
- clean up drift and restore alignment,
- derive project-specific core beliefs,
- install or refresh repository-local execution plans,
- run continuous conformance checks over time.

## Bundled resources

Use these bundled files as the canonical reference material for this skill.

Always read:
- [references/principles.md](references/principles.md)

Read when core beliefs may matter:
- [references/core-beliefs/README.md](references/core-beliefs/README.md)
- [references/core-beliefs/questionnaire.md](references/core-beliefs/questionnaire.md)
- [assets/core-beliefs/template.md](assets/core-beliefs/template.md)

Read when execution plans may matter:
- [references/exec-plans/README.md](references/exec-plans/README.md)
- [references/exec-plans/customizing-exec-plans.md](references/exec-plans/customizing-exec-plans.md)
- [assets/exec-plans/create-plan-file.md](assets/exec-plans/create-plan-file.md)

Load only what is needed for the current task. Keep context lean.

## How to infer the operating mode

Infer the mode from the user's request and the repo state.

Supported operating modes:
- `init` - bootstrap the smallest useful local harness in a target repo.
- `audit` - assess maturity, alignment, and missing pieces.
- `update` - implement exactly one justified next-layer improvement.
- `maintain` - clean up drift, tighten docs, and restore alignment.
- `decide` - answer whether the repo should add, remove, or evolve a harness element.
- `exec-plans` - install or refresh repo-local execution-plan support.
- `check` - run a continuous conformance review and fix or suggest the smallest useful cleanup.

Inference rules:
- If the user asks to set things up from scratch, use `init`.
- If the user asks what is missing or whether the repo is aligned, use `audit`.
- If the user asks to add one next improvement, use `update`.
- If the user asks to clean up, tighten, or repair drift, use `maintain`.
- If the user asks whether a repo should evolve further, use `decide`.
- If the user asks for planning support or multi-step planning infrastructure, use `exec-plans`.
- If the user wants a periodic or continuous alignment review, use `check`.
- If the request is ambiguous, default to `audit`.

## Operating model

This skill follows a simple rule:
- the skill bundle provides the model,
- the target repository becomes the source of truth.

After the first setup, the target repo's own docs, checks, and conventions should do most of the day-to-day work. This skill remains the operator for future audits, upgrades, and cleanup passes.

## Hard constraints

- Prefer the minimum viable structure.
- Keep `AGENTS.md` map-like and concise.
- Never make the repo less legible during a cleanup. If you shrink `AGENTS.md`, first identify any still-unique knowledge and move it into destination docs in the same change.
- Prefer additive split-then-trim migrations over trim-then-reconstruct cleanups.
- Do not create a large docs tree for optics.
- Do not create repo-specific core beliefs from generic software advice.
- Do not install execution plans too early.
- Keep canonical docs free of references to completed execution plans. Plans may link to docs, but docs must not link to plans, so the docs stay stable as plans are created, completed, and archived.
- Promote repeated human judgment downward over time: docs, then scripts/tests, then lints when warranted.
- When the right action is "do nothing yet", say so explicitly.
- When implementing an update, prefer exactly one justified next step unless the user explicitly asks for a broader sweep.
- Doc updates are part of the change, not a follow-up. When generating or updating `AGENTS.md`, always include a local rule that names the canonical docs for this repo and what triggers an update. The rule must be specific enough to act on: if a change touches user-facing behavior, a public interface, or anything already documented, the doc update goes in the same commit. "Keep docs fresh" is not a rule.

## Standard workflow

For every use of this skill:

1. Read the relevant bundled resources from this skill.
2. Inspect the target repo.
3. Determine the repo's effective maturity and current bottlenecks.
4. Take the smallest action that fits the inferred mode.
5. Verify changes.
6. Summarize what changed, what did not, and what should happen next if anything.

## Inspecting the target repo

When you inspect a target repo, read:
- `README.md`
- `AGENTS.md` if present
- `docs/` if present
- package/build/test/lint config
- CI config if present
- top-level source and test tree

Also read app-specific docs or AGENTS files when the repo is a monorepo or clearly segmented.

Use the maturity model from `references/principles.md`, but do not force the labels into the user-facing response unless they help.

## Mode behavior

### Init

Bootstrap the smallest useful local harness for the target repo.

Typical outputs may include:
- a tighter `README.md`,
- a shorter and better-linked `AGENTS.md`,
- `docs/index.md`, `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, or `docs/WORKFLOWS.md` if the repo is no longer obvious.

Only derive `docs/core-beliefs.md` if the repo clearly has real non-obvious beliefs.

Only install `docs/exec-plans/` at the end if the repo has already earned it or the user explicitly wants it.

### Audit

Assess the target repo against the principles.

Return:
- what maturity the repo is effectively at,
- the top gaps in legibility or maintainability,
- the smallest useful next step,
- what should explicitly not be added yet.

Do not implement changes unless the user asked for an audit-and-fix pass.

### Update

Implement exactly one justified next-layer improvement.

Examples:
- split an oversized `AGENTS.md`,
- add `docs/index.md`,
- add `docs/ARCHITECTURE.md`,
- derive `docs/core-beliefs.md`,
- install `docs/exec-plans/`,
- add one lightweight guardrail.

Prefer the smallest change with compounding value.

### Maintain

Run a cleanup and alignment pass.

Focus on:
- stale docs,
- missing cross-links,
- overgrown `AGENTS.md`,
- drift between docs and actual commands,
- local conventions that became implicit again.

Fix small issues directly. For larger issues, make the smallest safe correction and explain the remaining follow-up.

### Decide

Answer a narrow maturity or architecture question such as:
- should this repo add `docs/ARCHITECTURE.md`?
- should we introduce `docs/core-beliefs.md` yet?
- should execution plans be installed now?
- should this repo stay as-is for now?

Be explicit about:
- the signal you used,
- the tradeoff,
- the smallest correct decision now.

Do not implement unless the user asked you to.

### Exec Plans

Use the bundled execution-plan resources.

Only install or refresh execution-plan support after the repo has a usable base harness.

When installing:
1. Create `docs/exec-plans/` in the target repo if needed.
2. Copy the bundled `assets/exec-plans/create-plan-file.md` into `docs/exec-plans/create-plan-file.md`.
3. Apply the bundled `references/exec-plans/customizing-exec-plans.md` process to make it repo-specific.
4. If helpful, link `docs/exec-plans/create-plan-file.md` from the target repo's `AGENTS.md`.

When updating:
- preserve repo-specific conventions,
- refresh only the generic parts that should stay aligned with the canonical asset,
- do not wipe project-specific customizations.

### Check

Run a continuous conformance pass.

Your job is to answer:
- is this repo still aligned with the harness approach,
- where is drift starting,
- what is the smallest cleanup or correction worth doing now?

If the fixes are small and obvious, apply them.
If they are bigger, suggest a single next cleanup step.

## Core beliefs workflow

When the repo seems to have real non-negotiable beliefs:
- infer them from code, tests, docs, scripts, and recurring patterns,
- ask only the minimum number of targeted questions from `references/core-beliefs/questionnaire.md`,
- write a short repo-local `docs/core-beliefs.md` only if the beliefs are real, stable, and operational.

Do not create a beliefs file full of slogans.

## Continuous evolution rule

This skill should help the repo evolve gradually.

Do not try to jump multiple maturity levels at once.
Do not install advanced components before the current layer is healthy.

The preferred rhythm is:
- audit,
- apply one justified update,
- maintain,
- run periodic checks,
- install execution plans only when the repo truly needs them.

## Deliverables

At the end of any use of this skill, provide:
- the repo's current state in practical terms,
- what you changed or recommended,
- what you deliberately did not add,
- whether the repo should evolve further now or stay at the current layer,
- whether a cleanup pass or execution-plan installation should happen next.
