# Codex Review Bot

This directory contains a copyable GitHub Actions review bot powered by the Codex CLI.

It is designed as a lightweight PR review workflow that can be installed into a repository without adopting the rest of the `repo-harness` skill.

## What It Does

- Reviews same-repo pull requests with Codex.
- Supports incremental reviews after new commits.
- Tracks review state between passes.
- Collapses stale review comments.
- Supports manual `/codex-review` comments.
- Reads repo-local guidance from `AGENTS.md` and `REVIEW_GUIDELINES.md`.
- Can post both summary comments and inline review comments.

## Files

Copy these files into the target repository:

```text
.github/workflows/codex-review.yml
.github/scripts/codex-review/index.cjs
.github/scripts/codex-review/prompt.md
.github/scripts/codex-review/output-schema.json
```

The files are stored here under the same `.github/` layout so they can be copied directly.

## Installation

1. Copy the bundled `.github/` directory into the target repository.

2. Authenticate Codex locally and create the GitHub Actions secret:

   ```bash
   codex login
   gh secret set CODEX_AUTH_JSON_B64 \
     --body "$(cat ~/.codex/auth.json | base64 | tr -d '\n')"
   ```

   See OpenAI's Codex auth documentation for the current `auth.json` location on your platform:

   https://developers.openai.com/codex/auth#credential-storage

3. Review the workflow defaults in `.github/workflows/codex-review.yml`:

   ```yaml
   CODEX_MODEL: gpt-5.5
   CODEX_REASONING: xhigh
   CODEX_SANDBOX_MODE: workspace-write
   CODEX_WEB_SEARCH_MODE: disabled
   ```

4. Optionally customize the `pull_request_target.paths` filter in the workflow.

5. Add repo-local review guidance if needed:

   ```text
   AGENTS.md
   REVIEW_GUIDELINES.md
   ```

## Cost Control

> [!WARNING]
> This bot uses a strong Codex model by default (`gpt-5.5` with `xhigh` reasoning). That can make it more useful than lightweight review bots, but it can also make it pricey if it runs on every push.
>
> For cost-sensitive repositories, consider disabling automatic `pull_request_target` runs and triggering the review only on demand with a PR comment:
>
> ```text
> /codex-review
> ```
>
> You can do that by removing or commenting out the `pull_request_target` trigger in `.github/workflows/codex-review.yml` and keeping the `issue_comment` and `workflow_dispatch` triggers.

## Running It

The workflow runs automatically for same-repo PRs when:

- a PR is opened,
- a draft PR becomes ready for review,
- new commits are pushed to the PR branch.

It can also be triggered manually:

- via GitHub Actions `workflow_dispatch`,
- by commenting `/codex-review` on a PR.

Supported comment options:

```text
/codex-review
/codex-review full
/codex-review reset
/codex-review --since <sha>
```

## Security Notes

- The workflow uses `pull_request_target` so it can access secrets, but it only runs automatically for same-repo PRs.
- The PR is checked out by head SHA with `persist-credentials: false`.
- `GITHUB_TOKEN` is not passed to Codex.
- Codex runs with network disabled by default.
- The workflow fails if Codex modifies tracked files during review.
- Treat this as a starting point. Review permissions and sandbox settings before installing it in a sensitive repository.

## Expected Repository Setup

This tool works best when the target repository has:

- clear `AGENTS.md` instructions,
- concise review guidelines,
- deterministic test/lint/typecheck commands,
- branch protection or human review expectations that match the bot's advisory role.

The bot should help reviewers find high-signal risks. It should not be the only gate before merging production code.
