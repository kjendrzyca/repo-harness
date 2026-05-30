#!/usr/bin/env bash
# install-workflow.sh — install the codex-review GitHub Action bundle into a target repo.
#
# Copies the bundled .github/ (the codex-review workflow + its review scripts) into
# <repo>/.github/, preserving the exact layout the workflow expects at runtime.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$SCRIPT_DIR/../assets/bundle/.github"

usage() {
  cat <<'EOF'
Usage: install-workflow.sh [--repo-dir DIR] [--force] [--dry-run] [--help]

Install the codex-review GitHub Action bundle (.github/workflows/codex-review.yml and
.github/scripts/codex-review/) into a target repository.

Options:
  --repo-dir DIR   Target repo working tree (default: current git repo root, else cwd).
  --force          Overwrite files that already exist in the target.
  --dry-run        Show what would be written; change nothing.
  --help           Show this help.

After installing, commit .github/ to the repo's DEFAULT branch: the workflow runs via
pull_request_target, which reads the workflow and scripts from the base branch.

Exit codes:
  0  success (or dry-run)
  2  bad arguments / target not found
  5  bundle not found (run from the installed skill)
  6  some files already exist; re-run with --force to overwrite
EOF
}

REPO_DIR=""
FORCE=0
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo-dir) REPO_DIR="${2-}"; shift 2 || { echo "Error: --repo-dir requires a value." >&2; exit 2; } ;;
    --force)    FORCE=1; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -d "$BUNDLE" ] || { echo "Error: bundle not found at $BUNDLE — run this from the installed skill." >&2; exit 5; }
if [ -z "$REPO_DIR" ]; then
  REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
[ -d "$REPO_DIR" ] || { echo "Error: target repo dir not found: $REPO_DIR" >&2; exit 2; }

skipped=0
copied=0
while IFS= read -r f; do
  rel="${f#./}"
  src="$BUNDLE/$rel"
  dest="$REPO_DIR/.github/$rel"
  if [ -e "$dest" ] && [ "$FORCE" -ne 1 ]; then
    echo "exists: .github/$rel" >&2
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "would write: .github/$rel"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "wrote: .github/$rel"
    copied=$((copied + 1))
  fi
done < <(cd "$BUNDLE" && find . -type f)

echo
echo "target: $REPO_DIR/.github"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "dry-run complete (nothing written)."
  exit 0
fi
if [ "$skipped" -gt 0 ]; then
  echo "$copied written, $skipped already existed — re-run with --force to overwrite them."
  exit 6
fi
echo "$copied file(s) written. Next: commit .github/ to the DEFAULT branch, then authenticate"
echo "with identity.sh + set-review-secret.sh."
