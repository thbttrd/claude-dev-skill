#!/usr/bin/env python3
"""Regenerate `specs/STORIES.md` from `specs/stories.json`.

Pure stdlib, no deps, idempotent. Writes one of:

    python3 regen_stories_md.py                         # reads ./specs/stories.json
    python3 regen_stories_md.py path/to/stories.json    # custom input
    python3 regen_stories_md.py --out path/to/STORIES.md

Schema reference: high-level-scoping/references/stories-json-schema.md.
Layout reference: high-level-scoping/references/stories-md-template.md.

Every skill that mutates `phase` in stories.json MUST re-run this script so
STORIES.md and stories.json never drift.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PHASE_ORDER = ["verified", "green", "red", "planned", "specced", "scoped", "backlog"]
PHASE_HEADINGS = {
    "verified": "✅ Verified",
    "green":    "🟢 Green (awaiting verification)",
    "red":      "🔴 Red (tests written, awaiting implementation)",
    "planned":  "📋 Planned (PLAN.md ready)",
    "specced":  "📝 Specced (STORY.md + features ready)",
    "scoped":   "🟡 Scoped (in backlog, INVEST-checked)",
    "backlog":  "⚪ Backlog",
}
PHASE_EMOJI = {
    "verified": "✅", "green": "🟢", "red": "🔴", "planned": "📋",
    "specced": "📝", "scoped": "🟡", "backlog": "⚪",
}


def fmt_deps(deps: list[str]) -> str:
    return ", ".join(deps) if deps else "—"


def short_title(s: str, max_len: int = 28) -> str:
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def render_phase_table(stories: list[dict], phase: str) -> str:
    if phase == "verified":
        out = ["| ID | Title | Epic | Priority | Depends on | Verified |\n",
               "| --- | --- | --- | --- | --- | --- |\n"]
        for s in sorted(stories, key=lambda s: s["id"]):
            verified_at = s.get("verification", {}).get("verified_at", "")
            out.append(f"| {s['id']} | {s['title']} | {s['epic_id']} | {s['priority']} | {fmt_deps(s['depends_on_story_ids'])} | {verified_at} |\n")
    elif phase == "backlog":
        out = ["| ID | Title | Epic | Priority |\n",
               "| --- | --- | --- | --- |\n"]
        for s in sorted(stories, key=lambda s: s["id"]):
            out.append(f"| {s['id']} | {s['title']} | {s['epic_id']} | {s['priority']} |\n")
    else:
        out = ["| ID | Title | Epic | Priority | Depends on |\n",
               "| --- | --- | --- | --- | --- |\n"]
        for s in sorted(stories, key=lambda s: s["id"]):
            out.append(f"| {s['id']} | {s['title']} | {s['epic_id']} | {s['priority']} | {fmt_deps(s['depends_on_story_ids'])} |\n")
    return "".join(out)


def render_mermaid(stories: list[dict]) -> str:
    visible = [s for s in stories if s.get("phase") != "backlog"]
    if not visible:
        return "_(no stories past backlog yet)_\n"
    lines = ["```mermaid", "graph TD"]
    for s in sorted(visible, key=lambda s: s["id"]):
        node = s["id"].replace("-", "")
        emoji = PHASE_EMOJI.get(s["phase"], "")
        lines.append(f'  {node}["{s["id"]} {short_title(s["title"])} {emoji}"]')
    lines.append("")
    visible_ids = {s["id"] for s in visible}
    for s in sorted(visible, key=lambda s: s["id"]):
        for dep in s["depends_on_story_ids"]:
            if dep in visible_ids:
                lines.append(f'  {dep.replace("-", "")} --> {s["id"].replace("-", "")}')
    lines.append("```")
    return "\n".join(lines) + "\n"


def render_epics(epics: list[dict]) -> str:
    out = ["| Epic | Title | Stories | Priority |\n",
           "| --- | --- | --- | --- |\n"]
    for e in sorted(epics, key=lambda e: e["id"]):
        out.append(f"| {e['id']} | {e['title']} | {', '.join(e['story_ids'])} | {e['priority']} |\n")
    return "".join(out)


def render(data: dict) -> str:
    project = data["project"]
    stories = data["stories"]
    epics = data["epics"]

    counts = {p: 0 for p in PHASE_ORDER}
    for s in stories:
        counts[s.get("phase", "backlog")] += 1
    summary = " · ".join(f"{counts[p]} {p}" for p in PHASE_ORDER)
    updated = project["updated_at"][:10]

    parts = [
        f"# Stories — {project['name']}\n\n",
        f"_Regenerated from `specs/stories.json` on {updated} by `scripts/regen-stories-md.py`. Manual edits will be overwritten._\n\n",
        f"**Project phase summary:** {summary} (out of {len(stories)} total)\n\n",
        "## Kanban\n",
    ]
    for phase in PHASE_ORDER:
        parts.append(f"\n### {PHASE_HEADINGS[phase]}\n\n")
        parts.append(render_phase_table([s for s in stories if s.get("phase") == phase], phase))

    parts.append("\n## Dependency view\n\n")
    parts.append(render_mermaid(stories))
    parts.append("\n## Epics\n\n")
    parts.append(render_epics(epics))
    return "".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("input", nargs="?", default="specs/stories.json",
                    help="path to stories.json (default: specs/stories.json)")
    ap.add_argument("--out", default=None,
                    help="output path (default: <input dir>/STORIES.md)")
    args = ap.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"error: {in_path} not found", file=sys.stderr)
        return 1
    out_path = Path(args.out) if args.out else in_path.with_name("STORIES.md")
    data = json.loads(in_path.read_text())
    out_path.write_text(render(data))
    print(f"wrote {out_path} ({len(data['stories'])} stories, {len(data['epics'])} epics)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
