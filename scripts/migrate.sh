#!/usr/bin/env bash
# Migrate a skill from ~/.claude/skills/<name>/ into plugins/<name>/.
#
# Usage:
#   scripts/migrate.sh <name> [--version <x.y.z>] [--agents <a>,<b>,...] [--rename-frontmatter]
#
# - <name>           name of the skill in ~/.claude/skills/
# - --version        override version (default: read from SKILL.md `version:` frontmatter, fallback "1.0.0")
# - --agents         comma-separated list of agents (filenames in ~/.claude/agents/, without .md) to bundle
# - --rename-frontmatter  rewrite SKILL.md frontmatter `name:` to match <name> (fixes name/dir mismatches)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
require_tools yq jq rsync

NAME=""
VERSION_OVERRIDE=""
AGENTS=""
RENAME_FRONTMATTER=0

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION_OVERRIDE="$2"; shift 2 ;;
    --agents) AGENTS="$2"; shift 2 ;;
    --rename-frontmatter) RENAME_FRONTMATTER=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) die "unknown flag: $1" ;;
    *) [ -z "$NAME" ] && NAME="$1" || die "unexpected arg: $1"; shift ;;
  esac
done

[ -n "$NAME" ] || die "missing <name>. usage: $0 <name> [--version x.y.z] [--agents a,b]"

SRC_SKILL="$HOME/.claude/skills/$NAME"
[ -d "$SRC_SKILL" ] || die "source skill not found: $SRC_SKILL"
[ -f "$SRC_SKILL/SKILL.md" ] || die "no SKILL.md in $SRC_SKILL"

DEST_PLUGIN="$ROOT/plugins/$NAME"
[ ! -d "$DEST_PLUGIN" ] || die "plugin already exists: $DEST_PLUGIN (delete it first if re-migrating)"

# --- Resolve version ---
if [ -n "$VERSION_OVERRIDE" ]; then
  VERSION="$VERSION_OVERRIDE"
else
  EXISTING_VERSION="$(skill_field "$SRC_SKILL/SKILL.md" version)"
  VERSION="${EXISTING_VERSION:-1.0.0}"
fi

# --- Read description ---
DESCRIPTION="$(skill_field "$SRC_SKILL/SKILL.md" description)"
[ -n "$DESCRIPTION" ] || die "no description: in $SRC_SKILL/SKILL.md frontmatter"

# Take a short tagline (first sentence, capped at 200 chars) for marketplace.json
TAGLINE="$(printf '%s' "$DESCRIPTION" | awk -v RS='. ' 'NR==1{print; exit}' | cut -c1-200)"

info "migrating $NAME @ $VERSION"
info "  src: $SRC_SKILL"
info "  dst: $DEST_PLUGIN"

# --- Copy skill body ---
mkdir -p "$DEST_PLUGIN/skills/$NAME" "$DEST_PLUGIN/.claude-plugin"
rsync -a --exclude='.DS_Store' --exclude='*.log' "$SRC_SKILL/" "$DEST_PLUGIN/skills/$NAME/"
ok "copied skill body"

# --- Optionally fix mismatched name in frontmatter ---
if [ "$RENAME_FRONTMATTER" -eq 1 ]; then
  CURRENT_NAME="$(skill_field "$DEST_PLUGIN/skills/$NAME/SKILL.md" name)"
  if [ "$CURRENT_NAME" != "$NAME" ]; then
    # Rewrite the `name:` line in the frontmatter (first occurrence only)
    awk -v target="$NAME" '
      BEGIN { in_fm = 0; fm_count = 0; done = 0 }
      /^---$/ { fm_count++; in_fm = (fm_count == 1); print; next }
      in_fm && !done && /^name:[[:space:]]/ {
        sub(/^name:[[:space:]]*.*/, "name: " target)
        done = 1
      }
      { print }
    ' "$DEST_PLUGIN/skills/$NAME/SKILL.md" > "$DEST_PLUGIN/skills/$NAME/SKILL.md.tmp"
    mv "$DEST_PLUGIN/skills/$NAME/SKILL.md.tmp" "$DEST_PLUGIN/skills/$NAME/SKILL.md"
    ok "renamed SKILL.md frontmatter name: $CURRENT_NAME → $NAME"
  fi
fi

# --- Add or update version in SKILL.md frontmatter ---
EXISTING_VERSION="$(skill_field "$DEST_PLUGIN/skills/$NAME/SKILL.md" version)"
if [ -z "$EXISTING_VERSION" ]; then
  # Insert `version: $VERSION` line after `name:` line
  awk -v ver="$VERSION" '
    BEGIN { in_fm = 0; fm_count = 0; injected = 0 }
    /^---$/ { fm_count++; in_fm = (fm_count == 1); print; next }
    in_fm && !injected && /^name:[[:space:]]/ {
      print
      print "version: " ver
      injected = 1
      next
    }
    { print }
  ' "$DEST_PLUGIN/skills/$NAME/SKILL.md" > "$DEST_PLUGIN/skills/$NAME/SKILL.md.tmp"
  mv "$DEST_PLUGIN/skills/$NAME/SKILL.md.tmp" "$DEST_PLUGIN/skills/$NAME/SKILL.md"
  ok "injected version: $VERSION into SKILL.md frontmatter"
fi

# --- Bundle agents ---
if [ -n "$AGENTS" ]; then
  mkdir -p "$DEST_PLUGIN/agents"
  IFS=',' read -ra agent_list <<< "$AGENTS"
  for agent in "${agent_list[@]}"; do
    SRC_AGENT="$HOME/.claude/agents/${agent}.md"
    [ -f "$SRC_AGENT" ] || die "agent not found: $SRC_AGENT"
    cp "$SRC_AGENT" "$DEST_PLUGIN/agents/${agent}.md"
    ok "bundled agent: $agent"
  done
fi

# --- Write plugin.json ---
jq -n \
  --arg name "$NAME" \
  --arg version "$VERSION" \
  --arg description "$DESCRIPTION" \
  '{
    name: $name,
    version: $version,
    description: $description,
    author: { name: "thbttrd" },
    homepage: "https://github.com/thbttrd/claude-dev-skill",
    license: "MIT"
  }' > "$DEST_PLUGIN/.claude-plugin/plugin.json"
ok "wrote .claude-plugin/plugin.json"

# --- Write or preserve CHANGELOG.md ---
SRC_CHANGELOG="$DEST_PLUGIN/skills/$NAME/CHANGELOG.md"
DEST_CHANGELOG="$DEST_PLUGIN/CHANGELOG.md"
if [ -f "$SRC_CHANGELOG" ]; then
  mv "$SRC_CHANGELOG" "$DEST_CHANGELOG"
  ok "moved existing CHANGELOG.md to plugin root"
else
  cat > "$DEST_CHANGELOG" <<EOF
# Changelog — $NAME

All notable changes to the \`$NAME\` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [$VERSION] — $(date +%Y-%m-%d)

### Added

- Initial release in the \`claude-dev-skill\` marketplace. Migrated from \`~/.claude/skills/$NAME/\`.
EOF
  ok "created fresh CHANGELOG.md (v$VERSION)"
fi

# --- Write README.md (per-plugin, optional but nice) ---
cat > "$DEST_PLUGIN/README.md" <<EOF
# $NAME

> $TAGLINE

**Version:** $VERSION · **License:** MIT · **Part of:** [\`claude-dev-skill\`](../../README.md)

## Install

\`\`\`
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install $NAME@claude-dev-skill
\`\`\`

## Changelog

See [\`CHANGELOG.md\`](./CHANGELOG.md).
EOF
ok "wrote README.md"

# --- Update marketplace.json ---
MARKETPLACE="$ROOT/.claude-plugin/marketplace.json"
TMP="$(mktemp)"
jq \
  --arg name "$NAME" \
  --arg version "$VERSION" \
  --arg description "$TAGLINE" \
  --arg source "./plugins/$NAME" \
  '
    .plugins |= (
      map(select(.name != $name)) +
      [{
        name: $name,
        source: $source,
        description: $description,
        version: $version
      }]
      | sort_by(.name)
    )
  ' "$MARKETPLACE" > "$TMP" && mv "$TMP" "$MARKETPLACE"
ok "registered in marketplace.json"

echo ""
ok "migration complete: plugins/$NAME @ $VERSION"
