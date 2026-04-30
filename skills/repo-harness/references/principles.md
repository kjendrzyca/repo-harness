# Repository Harness Principles

This document is the canonical model for the `repo-harness` skill.

It describes how to make repositories legible to AI agents without pushing every codebase into a heavyweight setup.

It is not meant to become the runtime source of truth for every repo forever. Its job is to help bootstrap the right local structure in each target repository.

## 1. What this pattern is really about

The core lesson from the OpenAI article is not "write more docs".

The useful lesson is this:
- the repository should contain enough durable, discoverable knowledge for an agent to work well,
- `AGENTS.md` should act as a map, not a giant instruction manual,
- repeated human judgment should gradually move from prompts into docs, then into scripts, tests, and lints when needed,
- each new harness element should remove a real bottleneck rather than satisfy an abstract idea of maturity.

## 2. The operating model

### 2.1 Skill guidance vs repo-local truth

Keep a strict distinction between these two layers:

- This skill bundle is global guidance.
- The target repo is the local source of truth.

That means:
- use this skill bundle to bootstrap or improve a repo,
- but write the durable operating knowledge into the target repo itself,
- and once local docs exist, prefer them over external guidance.

Do not create a hidden dependency where an agent must keep remembering an external harness repo in order to make correct decisions.

### 2.2 Repository knowledge should be the system of record

If a piece of knowledge should reliably shape future agent decisions, it should be:
- in the repository,
- versioned,
- easy to find,
- maintained close to the code or workflow it affects.

This does not mean copying everything into Markdown.

It means the agent should not have to depend on:
- private chat history,
- issue comments,
- one-off prompts,
- a maintainer's memory,
- "obvious" conventions that were never written down.

### 2.3 `AGENTS.md` is the map

`AGENTS.md` should answer a short list of questions:
- what this repo is for,
- where the agent should look first,
- which constraints are hard constraints,
- how to verify changes.

`AGENTS.md` should not try to:
- explain the whole system,
- duplicate every doc,
- preserve every historical rule,
- keep growing forever.

When reducing an oversized `AGENTS.md`, do not trim first and hope to reconstruct later.

- Inventory which sections still contain unique operational knowledge.
- Remove a section only if that knowledge already exists in a stable local doc, or you create that destination doc in the same change.
- Prefer additive split-then-trim migrations so the repository never becomes less legible mid-cleanup.

Practical rule of thumb:
- if `AGENTS.md` goes beyond roughly 80-120 lines or mixes too many levels of detail, move deeper knowledge into `docs/` and turn `AGENTS.md` back into a map.

### 2.4 Use progressive disclosure

Agents do better with:
- a short stable entry point,
- clear links to deeper docs,
- task-relevant reading paths,
- small docs organized around decisions, boundaries, and workflows.

They do worse with:
- one huge manual,
- duplicated guidance spread across many files,
- a documentation tree full of placeholders.

Think in terms of a navigable knowledge graph, not a single manifesto.

### 2.5 Only document what the code cannot communicate cheaply

The highest-value documentation explains:
- repository purpose and scope,
- architecture boundaries and dependency direction,
- non-obvious workflows,
- recurring decisions,
- acceptance criteria and quality expectations,
- larger changes that need a plan.

The lowest-value documentation simply restates obvious code.

### 2.6 Project-specific core beliefs are local, not global

Every serious repo eventually develops a small set of non-negotiable beliefs.

These are things like:
- what tradeoffs the project chooses on purpose,
- what kinds of errors are worse than slowness or inconvenience,
- what must always stay true about architecture, data flow, local dev, or safety,
- what kinds of fixes are unacceptable even if they "work".

Those beliefs are project-specific.

Do not copy them from this skill bundle.
Do not copy them from another repo.

Instead:
- infer them from the codebase when possible,
- ask the maintainer targeted questions when they are not explicit yet,
- write them down in the target repo as `docs/core-beliefs.md` only when they are real and decision-shaping.

See `references/core-beliefs/` and `assets/core-beliefs/` in this skill bundle for the generation workflow.

### 2.7 Encode repeated judgment at the lowest sensible layer

Use this ladder:

- One-off confusion: improve the prompt or README.
- Repeated orientation question: add or improve a doc.
- Repeated manual verification step: add a script or test.
- Repeated architectural mistake: add a lint or structural test.
- Repeated documentation drift: add a lightweight check or a doc-gardening pass.

Not every rule needs to become a lint.

But if the same failure keeps returning, prose alone is no longer enough.

### 2.8 Add only the next missing harness element

Default rule:
- add one improvement at a time,
- choose the one with the highest leverage now,
- stop when the immediate bottleneck is removed.

Do not add these too early unless the repo has clearly earned them:
- `docs/references/` for dependencies the agent barely uses,
- execution plans when almost all work fits in one clean prompt,
- quality scorecards no one will maintain,
- observability stacks before basic tests and logs are useful,
- browser automation before the repo even has simple smoke checks.

## 3. Maturity model

This is a heuristic, not a rigid framework.

Use it to choose the smallest structure that matches the repo's actual complexity.

## M0 - Tiny repo

Typical signs:
- one maintainer,
- a simple app, script, library, or utility,
- the agent mostly makes small local changes,
- the architecture is still obvious after a few minutes of reading.

Minimum setup:
- `README.md`,
- a short `AGENTS.md`,
- existing test, lint, typecheck, or build commands as verification.

Optional:
- `docs/ARCHITECTURE.md` only if the structure is not obvious from code.

Do not add yet:
- a large `docs/` tree,
- an execution plan system,
- repo-specific core beliefs unless the project truly has them,
- custom lints without a history of real failures,
- recurring cleanup jobs.

Signals to move to M1:
- `AGENTS.md` keeps growing because it carries too much context,
- the agent repeatedly asks the same orientation questions,
- changes increasingly touch multiple parts of the repo,
- multiple contributors or multiple agent tools now work in the same repo.

Typical shape:

```text
README.md
AGENTS.md
src/
tests/
```

## M1 - Small but growing repo

Typical signs:
- the repo now has multiple domains or a few important workflows,
- important behavior is no longer obvious from code alone,
- the agent works in the repo regularly,
- you want less dependence on unwritten maintainer knowledge.

Minimum useful setup:
- `AGENTS.md` as a map,
- `docs/index.md`,
- `docs/PROJECT.md`,
- `docs/ARCHITECTURE.md`,
- `docs/WORKFLOWS.md` only if workflows are genuinely non-obvious,
- `docs/core-beliefs.md` only if the project has clear non-negotiables,
- a repo-local execution-plan entrypoint such as `docs/exec-plans/create-plan-file.md` only for larger multi-step changes.

Role of each document:
- `docs/index.md` - entry point into repo knowledge.
- `docs/PROJECT.md` - scope, goals, terminology, key use cases.
- `docs/ARCHITECTURE.md` - major parts of the system, boundaries, dependencies, extension points.
- `docs/WORKFLOWS.md` - release, migration, local debugging, data seeding, or similar operational flows.
- `docs/core-beliefs.md` - a short set of project-specific, non-negotiable design constraints.
- `docs/exec-plans/active/*.md` or the repo's equivalent - active plans for work that does not fit into one clean hop.

Important rule:
- do not create empty categories for future optics,
- do not create `docs/decisions/` unless there are recurring non-obvious decisions worth revisiting,
- do not create `docs/core-beliefs.md` full of generic slogans.

Signals to move to M2:
- architectural drift starts showing up,
- the agent writes valid code but misses repo-specific norms,
- review comments start repeating,
- docs drift away from code,
- verification has become multi-step and repetitive.

Typical shape:

```text
README.md
AGENTS.md
docs/
  index.md
  PROJECT.md
  ARCHITECTURE.md
  WORKFLOWS.md
  core-beliefs.md
docs/
  exec-plans/
    create-plan-file.md
    active/
```

## M2 - Active AI repo

Typical signs:
- the agent now does a substantial share of day-to-day work,
- the repo has real drift risk,
- you need more predictable quality without manually reviewing everything.

Useful additions at this stage:
- lightweight documentation checks such as broken links or required cross-links,
- `docs/references/` for compact repo-local references to external tools and APIs,
- `docs/generated/` for generated reference material such as schemas,
- a small `docs/QUALITY.md` focused on current gaps and risk areas,
- `docs/exec-plans/completed/` or the repo's equivalent if completed plans remain useful as future context,
- custom lints or structural tests for boundaries that are actually getting broken.

At this point the model becomes:
- docs explain intent and boundaries,
- automation enforces repeated invariants.

Good examples of invariants worth enforcing:
- validate inputs at system boundaries,
- do not bypass architectural layers,
- do not create duplicated helpers when a shared home already exists,
- do not commit secrets or machine-specific paths.

Signals to move to M3:
- a large share of work now involves UI behavior the agent cannot verify well,
- performance or reliability constraints have become important,
- human QA has become the main bottleneck,
- tasks are regularly long-running and multi-stage.

Typical shape:

```text
README.md
AGENTS.md
docs/
  index.md
  PROJECT.md
  ARCHITECTURE.md
  WORKFLOWS.md
  core-beliefs.md
  QUALITY.md
  references/
  generated/
  exec-plans/
    create-plan-file.md
    active/
    completed/
    abandoned/
scripts/
tests/
```

## M3 - Advanced harness

Most repos should not start here.

This level only makes sense when the agent should be able to:
- reproduce UI bugs,
- validate end-to-end flows,
- inspect logs, metrics, or latency targets,
- work in isolated environments per task or per worktree.

Possible elements:
- browser automation for smoke checks and reproduction,
- bootable app instances per worktree,
- local observability the agent can query,
- automated review loops,
- periodic cleanup tasks that open small corrective PRs.

Important note:
- M3 is not the default destination.
- most repos get more leverage from better docs, scripts, tests, and a few strong guardrails.

## 4. Task-oriented guidance matters more than abstract rules alone

Strong agent-first repos do not stop at principles.

They also make it easy for an agent to answer:
- "Where do I start for this kind of task?"
- "Which files should I read first?"
- "Which docs are structural maps and which are operational guides?"

That means a mature `AGENTS.md` often includes:
- reading paths for common task types,
- links to architecture docs,
- links to local core beliefs,
- links to execution plans when relevant.

Do not jump there too early, but recognize that principles alone are not enough once a repo grows.

## 5. How to roll this out

The right operating model for most repos is not "big documentation redesign".

It is a small maintenance loop:
- after a meaningful change, update the relevant local doc if architecture, workflow, or invariants changed,
- every so often, run a repo legibility audit and propose one small next step,
- when review comments repeat, promote them into docs or guardrails,
- when docs drift away from code, run a doc-gardening pass,
- when a change no longer fits into one clean prompt, create an execution plan.

Minimal loop:

1. Scan recent work for recurring friction.
2. Pick the most common pattern.
3. Classify it as missing knowledge, missing verification, or missing guardrail.
4. Add the smallest fix that prevents repetition.
5. Stop there.

## 6. Anti-patterns to avoid

- One giant `AGENTS.md` full of everything.
- Empty `docs/` folders created for future optics.
- Copying another project's core beliefs into your repo.
- Turning a beliefs document into vague slogans.
- Creating execution plan infrastructure before work is complex enough to need it.
- Adding browser automation before basic scripts and tests are useful.
- Letting prompts become the hidden source of truth instead of moving durable knowledge into the repo.
- Writing docs that are detached from the repo's real workflow.

## 7. The simplest sensible default

If you want one cross-repo default, use this:

- Every repo has `README.md` and a short `AGENTS.md`.
- `AGENTS.md` points to local source-of-truth docs and verification commands.
- Add `docs/` only when the repo stops being obvious.
- Generate project-specific `docs/core-beliefs.md` only when there are real non-negotiables worth preserving.
- Add `docs/exec-plans/` only when work stops fitting in one clean prompt.
- Promote repeated human judgment into automation over time.

That is enough to stay aligned with the spirit of the article without importing the full weight of a much larger harness.
