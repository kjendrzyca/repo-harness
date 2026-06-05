---
name: codex-review
description: Install, authenticate, and maintain the Codex PR-review GitHub Action on a repository. Copies the bundled review workflow into a target repo's .github/, then authenticates Codex for CI by provisioning a dedicated, isolated login (its own CODEX_HOME and auth.json, separate from ~/.codex) and storing it as the CODEX_AUTH_JSON_B64 repository secret. Use when setting up the Codex code-review bot on a repo, wiring up its auth, or rotating/reauthenticating the credential it runs with (e.g. a review fails because CODEX_AUTH_JSON_B64 is missing, invalid, or stale).
license: MIT
compatibility: Requires the gh GitHub CLI (authenticated, repo scope), the codex CLI, jq, and bash. The dedicated login uses macOS-style paths by default; the GitHub Action itself runs on Linux runners. Run the auth/secret steps with access to the target GitHub repository.
---

# Codex Review

Set up and maintain the **Codex PR-review GitHub Action** on a repository. This skill bundles the
review workflow and its scripts (`assets/bundle/.github/`) and drives three jobs:

- **Install** — copy the bundle into a target repo's `.github/`.
- **Authenticate** — provision a dedicated, isolated Codex login and store it as the
  `CODEX_AUTH_JSON_B64` secret the workflow consumes.
- **Reauthenticate** — rotate that credential.

The auth is deliberately a *separate* Codex login in its own `CODEX_HOME`
(`~/.codex-review-auth/home`), not your everyday `~/.codex` — so the CI credential can be rotated or
revoked without touching your interactive session.

## Security posture

This skill is for private repositories only. Do not install the bundled review bot in public
repositories.

The workflow restores a Codex `auth.json` credential inside GitHub Actions. Treat that credential as
a password-equivalent automation secret. Private repositories reduce the attacker set, but they do
not remove the need for trigger authorization, least-privilege workflow permissions, sandbox
hardening, supply-chain pinning, and prompt/output sanitization.

See `references/setup.md` before installing this bot in a sensitive repository.

## Pick the mode from the request

- "set up / add codex-review on this repo" → **Install**, then **Authenticate**.
- "authenticate / wire up the secret" → **Authenticate**.
- "rotate / reauthenticate / the token is stale" → **Reauthenticate**.

Resolve and pin the target repo first:

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

## Available scripts

- **`scripts/install-workflow.sh`** — copy the bundled `.github/` into a target repo (`--repo-dir`,
  `--force`, `--dry-run`).
- **`scripts/identity.sh`** — manage the dedicated `CODEX_HOME` (`--home`, `--login-command`,
  `--status`). Never prints token contents.
- **`scripts/set-review-secret.sh`** — base64 the dedicated `auth.json` into the
  `CODEX_AUTH_JSON_B64` secret (`--repo`, `--dry-run`; defaults to the dedicated home).

## Install

1. `bash scripts/install-workflow.sh --repo-dir <target> --dry-run`, then again without `--dry-run`
   (add `--force` to overwrite existing files).
2. Commit the new `.github/` to the repo's **default branch**. The workflow triggers on
   `pull_request_target`, which reads the workflow and scripts from the base branch — so it only
   takes effect once committed there.

## Authenticate

1. `bash scripts/identity.sh --status`. If it reports needs-login (exit 3), continue.
2. Have the **user** run the login interactively in their terminal — agents cannot complete a
   browser/device-code flow. `scripts/identity.sh --login-command` prints the exact command:
   ```
   CODEX_HOME="$HOME/.codex-review-auth/home" codex login --device-auth -c cli_auth_credentials_store=file
   ```
   The user signs in with whichever account they want dedicated to CI.
   `-c cli_auth_credentials_store=file` forces a real `auth.json` rather than the OS keyring, so
   there is a file to push.
3. Re-run `bash scripts/identity.sh --status` until it reports ready.
4. `bash scripts/set-review-secret.sh --repo "<OWNER/REPO>" --dry-run`, then without `--dry-run`.
5. (Optional) verify: `gh workflow run "Codex Code Review" -R "<OWNER/REPO>" -f pr_number=<PR>`.

## Reauthenticate (rotate)

Re-run the login from Authenticate step 2 (mints a fresh token in the same home), then
`set-review-secret.sh` again. Nothing else changes.

## Rules

- Never print, echo, or log the contents of any `auth.json` or the base64 value.
- Setting a secret is outward-facing — confirm the target repo and pass `--repo` explicitly.
- The stored credential carries a long-lived refresh token; if it is ever exposed, reauthenticate to
  rotate it.
- See `references/setup.md` for workflow configuration, triggers, cost control, and security details.
