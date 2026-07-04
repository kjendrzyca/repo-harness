# Local Review Continuity Contract

The local `local-code-review` runner stores continuity under Git private metadata by default:

```text
$(git rev-parse --git-path codex-review)/
  state.json
  review.md
  prompt.md
  codex-review-output.json
  runs/<timestamp>/
```

This keeps review state out of the checked-out worktree and avoids accidental commits.

## State Rules

- `scope_key` identifies the exact reviewed scope. It covers scope kind plus the resolved commit,
  base/merge-base, or uncommitted worktree fingerprint. A runner may skip only when both the head SHA
  and `scope_key` match the previous state.
- Branch and commit scopes must be reviewed from a clean worktree. If staged, unstaged, or untracked
  local changes are intended, the runner must use an uncommitted scope so the worktree fingerprint is
  part of `scope_key`.
- Commit scopes must also be checked out at the target commit. If a user wants to review an older
  commit, create a temporary git worktree or detached checkout at that commit before running the
  local review.
- `open_issues` contains only issues that still apply at the current head.
- `recently_resolved_issues` contains issues from the previous state that the current head fixed.
- Keep issue `id` values stable across runs when the same issue remains open.
- Do not duplicate a prior open issue. Update its `last_seen_head_sha` instead.
- If an issue is fixed, remove it from `open_issues` and add it to `recently_resolved_issues`.
- If history was rewritten and prior state may not align, use previous issues as hints but rebuild the state from the current code.
- Every P0/P1 issue must include a concrete `failure_scenario`.

## Severity Rules

- `P0`: merge blocker for data loss, security exposure, production incident, or similarly severe impact.
- `P1`: must fix before merge because the issue is likely to cause incorrect runtime behavior, major reliability loss, serious security risk, or architecture breakage.
- `P2`: should fix soon. Use sparingly and keep to issues with real risk.

No concrete failure scenario means the issue is not P0/P1. Demote or drop it.
