#!/usr/bin/env bash
# Copy the canonical pipeline contract into every pipeline plugin. Idempotent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
SRC="$ROOT/$CONTRACT_CANONICAL"
[ -f "$SRC" ] || die "canonical contract missing: $SRC"
for name in "${PIPELINE_PLUGINS[@]}"; do
  dest="$ROOT/plugins/$name/skills/$name/references/autopilot-contract.md"
  mkdir -p "$(dirname "$dest")"
  cp "$SRC" "$dest"
  ok "$name"
done
