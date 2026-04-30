#!/usr/bin/env bash
# Download and verify an icon into the skill's local cache.
# Usage: add_icon.sh <remote_url> <category>/<name>
#   e.g. add_icon.sh 'https://icons.terrastruct.com/aws%2F...' aws/ecr
set -euo pipefail

url="${1:?usage: add_icon.sh <remote_url> <category>/<name>}"
target="${2:?usage: add_icon.sh <remote_url> <category>/<name>}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(dirname "$script_dir")"
icons_dir="$skill_dir/assets/icons"

# Infer extension from the URL (strip query string)
clean_url="${url%%\?*}"
ext="svg"
case "$clean_url" in
  *.svg)  ext="svg" ;;
  *.png)  ext="png" ;;
  *.jpg|*.jpeg) ext="jpg" ;;
  *.gif)  ext="gif" ;;
esac

dest="$icons_dir/$target.$ext"
mkdir -p "$(dirname "$dest")"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

http=$(curl -sSL -A "Mozilla/5.0" -o "$tmp" -w "%{http_code}" "$url")
if [[ "$http" != "200" ]]; then
  echo "error: HTTP $http from $url" >&2
  exit 2
fi

if [[ ! -s "$tmp" ]]; then
  echo "error: empty file" >&2
  exit 3
fi

if [[ "$ext" == "svg" ]] && ! grep -q '<svg' "$tmp"; then
  echo "error: file at $url doesn't look like SVG" >&2
  exit 4
fi

mv "$tmp" "$dest"
trap - EXIT
echo "ok: $dest"
echo "Next: add a row to ~/.claude/skills/d2-architect/references/icons.md"
