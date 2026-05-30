#!/usr/bin/env bash
# identity.sh — manage the dedicated, isolated Codex login used for CI (codex-review).
#
# Uses a private CODEX_HOME folder holding one fresh auth.json, kept
# separate from the user's everyday ~/.codex login. This script only prepares/inspects the
# folder; the interactive `codex login` is run by the user (see --login-command). It never
# reads or prints token contents.
set -euo pipefail

BASE="${CODEX_REVIEW_AUTH_DIR:-$HOME/.codex-review-auth}"
HOME_DIR="$BASE/home"

usage() {
  cat <<'EOF'
Usage: identity.sh <--home | --login-command | --status> [--help]

Manage the dedicated CODEX_HOME used to authenticate the codex-review GitHub Action.

  --home            Ensure the dedicated home exists (0700) and print its path.
  --login-command   Print the exact `codex login` command to run interactively (e.g. via the
                    `!` prefix) to populate this home with a fresh, isolated auth.json.
  --status          Exit 0 if the home holds a usable auth.json, 3 if a login is still needed.
  --help            Show this help.

Location: $CODEX_REVIEW_AUTH_DIR (default ~/.codex-review-auth); the CODEX_HOME is <dir>/home.

Exit codes:
  0  ok (--home / --login-command; or --status when ready)
  2  bad arguments
  3  --status: no usable auth.json yet (login needed)
EOF
}

[ $# -ge 1 ] || { echo "Error: a mode is required (--home | --login-command | --status)." >&2; usage >&2; exit 2; }

case "$1" in
  --home)
    mkdir -p "$HOME_DIR"
    chmod 700 "$BASE" "$HOME_DIR" 2>/dev/null || true
    printf '%s\n' "$HOME_DIR"
    ;;
  --login-command)
    printf '%s\n' "CODEX_HOME=\"$HOME_DIR\" codex login --device-auth -c cli_auth_credentials_store=file"
    ;;
  --status)
    auth="$HOME_DIR/auth.json"
    if [ ! -s "$auth" ]; then
      echo "not-logged-in: no auth.json at $auth" >&2
      exit 3
    fi
    if command -v jq >/dev/null 2>&1 && ! jq empty "$auth" >/dev/null 2>&1; then
      echo "invalid: $auth is not valid JSON" >&2
      exit 3
    fi
    echo "ready: $auth"
    ;;
  -h|--help) usage; exit 0 ;;
  *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
esac
