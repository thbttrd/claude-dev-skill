#!/usr/bin/env bash
# Scaffold a brand-new skill plugin (NOT a migration — for greenfield skills).
#
# Usage:
#   scripts/new-skill.sh <name> "<one-line description>"

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
require_tools jq

NAME="${1:-}"
DESCRIPTION="${2:-}"
[ -n "$NAME" ] && [ -n "$DESCRIPTION" ] || die "usage: $0 <name> \"<description>\""

DEST="$ROOT/plugins/$NAME"
[ ! -d "$DEST" ] || die "plugin already exists: $DEST"

mkdir -p "$DEST/.claude-plugin" "$DEST/skills/$NAME"

# SKILL.md
cat > "$DEST/skills/$NAME/SKILL.md" <<EOF
---
name: $NAME
version: 0.1.0
description: $DESCRIPTION
---

# $NAME

TODO — write the skill body here.
EOF

# plugin.json
jq -n \
  --arg name "$NAME" \
  --arg description "$DESCRIPTION" \
  '{
    name: $name,
    version: "0.1.0",
    description: $description,
    author: { name: "thbttrd" },
    homepage: "https://github.com/thbttrd/claude-dev-skill",
    license: "MIT"
  }' > "$DEST/.claude-plugin/plugin.json"

# CHANGELOG.md
cat > "$DEST/CHANGELOG.md" <<EOF
# Changelog — $NAME

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — $(date +%Y-%m-%d)

### Added

- Initial scaffold.
EOF

# README.md
cat > "$DEST/README.md" <<EOF
# $NAME

> $DESCRIPTION

**Version:** 0.1.0 · **License:** MIT · **Part of:** [\`claude-dev-skill\`](../../README.md)

## Install

\`\`\`
/plugin install $NAME@claude-dev-skill
\`\`\`

## Changelog

See [\`CHANGELOG.md\`](./CHANGELOG.md).
EOF

# Add to marketplace.json
MARKETPLACE="$ROOT/.claude-plugin/marketplace.json"
TMP="$(mktemp)"
jq \
  --arg name "$NAME" \
  --arg description "$DESCRIPTION" \
  --arg source "./plugins/$NAME" \
  '
    .plugins |= (
      map(select(.name != $name)) +
      [{ name: $name, source: $source, description: $description, version: "0.1.0" }]
      | sort_by(.name)
    )
  ' "$MARKETPLACE" > "$TMP" && mv "$TMP" "$MARKETPLACE"

ok "scaffolded plugins/$NAME at v0.1.0"
