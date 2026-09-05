#!/usr/bin/env bash
# Validate the marketplace and every plugin. Exits non-zero on any failure.
# Used by CI; safe to run locally too.

set -uo pipefail   # NOT -e: we want to collect all errors, not stop at first.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
require_tools jq yq

ERRORS=0
fail() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; ERRORS=$((ERRORS + 1)); }

# 1. Marketplace manifest
MARKETPLACE="$ROOT/.claude-plugin/marketplace.json"
[ -f "$MARKETPLACE" ] || { fail "missing $MARKETPLACE"; exit 1; }
jq empty "$MARKETPLACE" 2>/dev/null || fail "marketplace.json is not valid JSON"

# 2. Top-level CHANGELOG and README
[ -f "$ROOT/README.md" ]    || fail "missing README.md"
[ -f "$ROOT/CHANGELOG.md" ] || fail "missing CHANGELOG.md"
[ -f "$ROOT/LICENSE" ]      || fail "missing LICENSE"

# 3. Each plugin
for plugin_dir in "$ROOT/plugins/"*/; do
  [ -d "$plugin_dir" ] || continue
  name="$(basename "$plugin_dir")"
  echo "→ $name"

  pj="$plugin_dir.claude-plugin/plugin.json"
  cl="$plugin_dir/CHANGELOG.md"
  sm="$plugin_dir/skills/$name/SKILL.md"

  [ -f "$pj" ] || { fail "  $name: missing plugin.json"; continue; }
  [ -f "$cl" ] || fail "  $name: missing CHANGELOG.md"
  [ -f "$sm" ] || { fail "  $name: missing skills/$name/SKILL.md"; continue; }

  # plugin.json valid + has required fields
  jq empty "$pj" 2>/dev/null || { fail "  $name: plugin.json is not valid JSON"; continue; }
  pj_name="$(jq -r .name "$pj")"
  pj_version="$(jq -r .version "$pj")"
  pj_description="$(jq -r .description "$pj")"
  [ "$pj_name" = "$name" ] || fail "  $name: plugin.json .name=$pj_name (expected $name)"
  [[ "$pj_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "  $name: plugin.json .version=$pj_version (not SemVer)"
  [ "$pj_description" != "null" ] && [ -n "$pj_description" ] || fail "  $name: plugin.json .description missing"

  # SKILL.md frontmatter checks
  sm_name="$(skill_field "$sm" name)"
  sm_version="$(skill_field "$sm" version)"
  sm_description="$(skill_field "$sm" description)"
  [ "$sm_name" = "$name" ] || fail "  $name: SKILL.md frontmatter name=$sm_name (expected $name)"
  [ "$sm_version" = "$pj_version" ] || fail "  $name: SKILL.md version=$sm_version, plugin.json version=$pj_version (must match)"
  [ -n "$sm_description" ] || fail "  $name: SKILL.md frontmatter description missing"

  # marketplace entry exists with matching version
  mk_version="$(jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .version' "$MARKETPLACE")"
  [ -n "$mk_version" ] || fail "  $name: missing entry in marketplace.json"
  [ "$mk_version" = "$pj_version" ] || fail "  $name: marketplace.json version=$mk_version, plugin.json version=$pj_version (must match)"

  # CHANGELOG mentions the current version
  if [ -f "$cl" ] && ! grep -q "## \[$pj_version\]" "$cl"; then
    fail "  $name: CHANGELOG.md has no '## [$pj_version]' section"
  fi

  ok "  $name @ $pj_version"

  # extra skills bundled in the same plugin: frontmatter name must match dir, version must match plugin
  for extra in "$plugin_dir/skills/"*/; do
    extra="${extra%/}"; ename="$(basename "$extra")"
    [ "$ename" = "$name" ] && continue
    esm="$extra/SKILL.md"
    [ -f "$esm" ] || { fail "  $name: extra skill $ename has no SKILL.md"; continue; }
    [ "$(skill_field "$esm" name)" = "$ename" ] || fail "  $name: extra skill $ename frontmatter name mismatch"
    [ "$(skill_field "$esm" version)" = "$pj_version" ] || fail "  $name: extra skill $ename version ≠ plugin version"
  done
done

# 4. marketplace.json plugin entries all map to existing dirs
for entry in $(jq -r '.plugins[].name' "$MARKETPLACE"); do
  [ -d "$ROOT/plugins/$entry" ] || fail "marketplace lists $entry but plugins/$entry/ is missing"
done

# 5. Pipeline contract copies are byte-identical to the canonical one
canon_sum="$(sha256sum "$ROOT/$CONTRACT_CANONICAL" | cut -d' ' -f1)"
for name in "${PIPELINE_PLUGINS[@]}"; do
  copy="$ROOT/plugins/$name/skills/$name/references/autopilot-contract.md"
  [ -f "$copy" ] || { fail "$name: missing references/autopilot-contract.md (run scripts/sync-contract.sh)"; continue; }
  grep -q "autopilot-contract.md" "$ROOT/plugins/$name/skills/$name/SKILL.md" || fail "$name: SKILL.md does not reference references/autopilot-contract.md"
done

# Every copy of the contract anywhere under plugins/, on or off the roster, must match canonical.
while IFS= read -r copy; do
  [ "$(sha256sum "$copy" | cut -d' ' -f1)" = "$canon_sum" ] || fail "$copy: differs from canonical (run scripts/sync-contract.sh)"
done < <(find "$ROOT/plugins" -path '*/references/autopilot-contract.md')

# 6. Bundled agents: frontmatter name matches file name, description present
for agent in "$ROOT"/plugins/*/agents/*.md; do
  [ -f "$agent" ] || continue
  aname="$(basename "$agent" .md)"
  [ "$(skill_field "$agent" name)" = "$aname" ] || fail "$agent: frontmatter name ≠ $aname"
  [ -n "$(skill_field "$agent" description)" ] || fail "$agent: frontmatter description missing"
done

echo ""
if [ "$ERRORS" -eq 0 ]; then
  ok "all checks passed"
  exit 0
else
  fail "$ERRORS error(s) — fix before committing"
  exit 1
fi
