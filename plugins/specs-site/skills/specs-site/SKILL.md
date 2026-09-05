---
name: specs-site
version: 1.0.0
description: 'Renders a project specs/ directory as a local Astro site — dashboard, per-story pages (story, features, plan, state, verification, backlog), architecture, design, journal and backlog — as a pure function of specs/**. /specs-site starts astro dev on 127.0.0.1 with live data; --build exports to specs/.site/. Triggers on "/specs-site", "show me the specs site", "open the dashboard", "build the specs site".'
---

# specs-site

Renders the current project's `specs/` as a local site. Nothing here is written by an LLM: every page is a function of `specs/**` (`stories.json`, `story-*/state.json`, `journal.jsonl`, `backlog.json`, `autopilot.json`, the markdown, the `.feature` files, diagrams, screenshots, mockups). If a fact is not in `specs/`, the site does not show it.

## Usage

```
/specs-site [--specs DIR] [--build] [--host [ADDR]] [--port N]
```

| Flag | Meaning |
| --- | --- |
| `--specs DIR` | The specs directory. Default `./specs` of the current project. |
| `--build` | Static export to `DIR/.site/` instead of a dev server. |
| `--host [ADDR]` | Bind the dev server to `ADDR` (bare `--host` = `0.0.0.0`, LAN). Default `127.0.0.1`. |
| `--port N` | Default `4321`. |

## Steps

1. **Locate the CLI**: `SS=$(find -L ~/.claude/skills ~/.claude/plugins -path '*/specs-site/scripts/specs-site.mjs' -not -path '*archive*' | head -1)`. If empty, tell the user to `/plugin install specs-site@claude-dev-skill` and stop.
2. **Check the target**: `DIR` must contain `stories.json`; otherwise print the CLI's own error and suggest `/high-level-scoping` or `/migrate-specs`. Node ≥ 22.12 is required (`node --version`).
3. **Dev (default)**: run `node "$SS" dev --specs "$DIR" [--host …] [--port N]` with `run_in_background: true` — this is the one command in the marketplace that must outlive the reply. The first run installs the site's dependencies (`npm ci`, ~30 s). Poll `curl -sf http://127.0.0.1:PORT/ >/dev/null` up to 30 × 2 s, then print the URL and one line of what the dashboard shows (`jq -r '.stories | group_by(.phase) | map("\(.[0].phase) \(length)") | join(", ")' "$DIR/stories.json"`). Say how to stop it: `kill <pid>` (the background task's pid) — never `pkill -f astro` on a shared host.
4. **`--build`**: `node "$SS" build --specs "$DIR"`; print the output directory (`DIR/.site/`) and, if `.gitignore` does not contain `specs/.site/`, say so (`/repo-initialization` ≥ 2.2 adds it).
5. Under autopilot (`specs/autopilot.json.active`), do nothing different: the site is read-only and the dashboard's "Now running" panel follows the run.

## Self-review (print as a checked list)

- [ ] the URL printed answers with HTTP 200 (or the build directory exists and contains `index.html`)
- [ ] nothing under `specs/` was modified except `specs/.site/` on `--build`
- [ ] the process id (dev) or output path (build) was printed
