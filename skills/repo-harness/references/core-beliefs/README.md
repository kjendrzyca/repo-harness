# Project Core Beliefs

This module helps you create a repo-local `docs/core-beliefs.md` file when a project has real non-negotiable beliefs that should shape architecture, reviews, and future agent decisions.

## What core beliefs are

Core beliefs are not slogans.

They are:
- durable design constraints,
- explicit tradeoffs the project chooses on purpose,
- rules that change implementation decisions,
- beliefs that should cause review comments or architecture changes when violated.

Good examples:
- wrong data is worse than missing data,
- local development must work without cloud-only dependencies,
- sandbox code is untrusted,
- the read model should absorb complexity so the UI stays simple.

Weak examples:
- write clean code,
- keep things simple,
- prefer maintainability,
- tests are important.

Those may be true, but they are too generic to guide project-specific decisions.

## Why this must be local to the target repo

Core beliefs are specific to a project's:
- architecture,
- product risk,
- operational constraints,
- safety model,
- preferred tradeoffs.

Do not copy a core-beliefs file from another repo.

Instead:
- infer beliefs from code, tests, docs, and existing patterns,
- ask the maintainer targeted questions when the beliefs are still implicit,
- write them down locally once they are real and decision-shaping.

## When to create `docs/core-beliefs.md`

Create it when at least one of these is true:
- the project has non-obvious tradeoffs that keep coming up,
- review comments repeatedly defend the same principles,
- architecture decisions are drifting because the repo's real constraints are not explicit,
- the agent keeps making technically valid but philosophically wrong changes.

Do not create it just because mature repos often have one.

## Recommended workflow

1. Inspect the target repo's code, docs, tests, scripts, and AGENTS.md.
2. Infer existing beliefs from what the repo already rewards or forbids.
3. Ask the maintainer a small set of targeted questions only where the beliefs remain ambiguous.
4. Draft 5-10 beliefs maximum.
5. Keep each belief concrete enough to affect design and review.
6. Link `docs/core-beliefs.md` from the repo's `AGENTS.md` once it is real.

## Quality bar

A good beliefs file is:
- short,
- local to the repo,
- non-generic,
- stable enough to matter,
- strong enough to shape decisions.

If a belief would not change implementation choices, it probably does not belong in the file.

## Files in this module

- `questionnaire.md` - maintainer questions that help surface real beliefs.
- `../../assets/core-beliefs/template.md` - a simple output shape for `docs/core-beliefs.md` in the target repo.
