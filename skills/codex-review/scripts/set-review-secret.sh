#!/usr/bin/env bash
# set-review-secret.sh — install a Codex auth.json as the codex-review GitHub secret.
#
# Base64-encodes the given auth.json (newline-stripped) and stores it as a repository
# Actions secret (default CODEX_AUTH_JSON_B64). The value is passed to gh via stdin, so it
# never appears in argv, the process list, or this script's output.
set -euo pipefail

DEFAULT_AUTH="${CODEX_REVIEW_AUTH_DIR:-$HOME/.codex-review-auth}/home/auth.json"

usage() {
  cat <<EOF
Usage: set-review-secret.sh [--auth-json PATH] [--repo OWNER/REPO] [--secret NAME] [--dry-run]

Encode a Codex auth.json and set it as a GitHub Actions secret for the codex-review workflow.

Options:
  --auth-json PATH    auth.json to install (default: the dedicated CI home,
                      $DEFAULT_AUTH).
  --repo OWNER/REPO   Target repository (default: the gh-resolved current repo).
  --secret NAME       Secret name (default: CODEX_AUTH_JSON_B64).
  --dry-run           Show what would happen; do not set the secret.
  --help              Show this help.

Exit codes:
  0  success (or dry-run)
  2  bad arguments
  4  missing dependency (gh)
  5  auth.json missing, empty, or not valid JSON
EOF
}

AUTH_JSON=""
REPO=""
SECRET="CODEX_AUTH_JSON_B64"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --auth-json) AUTH_JSON="${2-}"; shift 2 || { echo "Error: --auth-json requires a value." >&2; exit 2; } ;;
    --repo)      REPO="${2-}";      shift 2 || { echo "Error: --repo requires a value." >&2; exit 2; } ;;
    --secret)    SECRET="${2-}";    shift 2 || { echo "Error: --secret requires a value." >&2; exit 2; } ;;
    --dry-run)   DRY_RUN=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$AUTH_JSON" ] || AUTH_JSON="$DEFAULT_AUTH"
command -v gh >/dev/null 2>&1 || { echo "Error: gh (GitHub CLI) is required but was not found." >&2; exit 4; }
[ -f "$AUTH_JSON" ] || { echo "Error: auth.json not found: $AUTH_JSON" >&2; exit 5; }
[ -s "$AUTH_JSON" ] || { echo "Error: auth.json is empty: $AUTH_JSON" >&2; exit 5; }
if command -v jq >/dev/null 2>&1; then
  jq empty "$AUTH_JSON" >/dev/null 2>&1 || { echo "Error: not valid JSON: $AUTH_JSON" >&2; exit 5; }
fi

repo_display="$REPO"
if [ -z "$repo_display" ]; then
  repo_display="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '(current repo)')"
fi

b64="$(base64 < "$AUTH_JSON" | tr -d '\n')"
bytes="${#b64}"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY RUN — would set secret:"
  echo "  repo:    $repo_display"
  echo "  secret:  $SECRET"
  echo "  source:  $AUTH_JSON"
  echo "  encoded: ${bytes} base64 chars (value not shown)"
  exit 0
fi

# Pass the value on stdin so it is never exposed in argv / process list.
if [ -n "$REPO" ]; then
  printf '%s' "$b64" | gh secret set "$SECRET" -R "$REPO"
else
  printf '%s' "$b64" | gh secret set "$SECRET"
fi

echo "Set secret '$SECRET' on ${repo_display} from ${AUTH_JSON} (${bytes} base64 chars)."
