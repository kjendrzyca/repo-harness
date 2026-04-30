# AGENTS.md

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
