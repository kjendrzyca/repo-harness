# AGENTS.md

## Spec compliance

All skills in this repository must be compatible with the Agent Skills spec so they work across Claude, Codex, OpenCode, and other compatible clients.

Source of truth:

- https://agentskills.io/llms.txt

Before creating or editing a skill here, fetch the current docs from that index and read them.

- the specification page must be read before authoring or changing a skill
- do not copy spec details into this file; use the upstream docs as the canonical reference
- keep skills portable and avoid machine-specific assumptions

## Privacy (hard rule)

This repository is public. Do not commit:

- internal project, product, client, or organization names
- ticket IDs, codenames, or internal URLs
- credentials, tokens, API keys, or auth material
- absolute paths from any author's machine
- personal data or context that is not meant to be public

Audit every new or modified skill for leaks before commit. If unsure, do not commit.

## Conventions

- one skill per folder, kebab-case name
- relative paths within a skill, never absolute
- English for skill content unless the skill is explicitly about a non-English context
- prefer minimal changes when updating an existing skill

## Changelog Convention

Update `CHANGELOG.md` for notable repository changes.

Use date-based entries, not semantic versions:

```md
## YYYY-MM-DD

### Short Change Title

- Concrete change summary.
- Any important behavior, migration, or usage note.
```

Rules:

- Group entries by ISO 8601 date: `YYYY-MM-DD`.
- Give each separate change its own `### <Change title>` section.
- Add new sections above older sections for the same day.
- Do not grow one large mixed list under a date.
- Do not introduce version numbers unless this repo later becomes a packaged or released artifact.
