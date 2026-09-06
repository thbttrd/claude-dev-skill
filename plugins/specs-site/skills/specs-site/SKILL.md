---
name: specs-site
version: 1.1.0
description: 'Renders a project specs/ directory as a local Astro site — dashboard, per-story pages (story, features, plan, state, verification, backlog), architecture, design, journal and backlog — as a pure function of specs/**. /specs-site starts astro dev on 127.0.0.1 with live data; --build exports to specs/.site/. Triggers on "/specs-site", "show me the specs site", "open the dashboard", "build the specs site".'
---

# specs-site

Renders the current project's `specs/` as a local site. Nothing here is written by an LLM: every page is a function of `specs/**` (`stories.json`, `story-*/state.json`, `journal.jsonl`, `backlog.json`, `autopilot.json`, the markdown, the `.feature` files, diagrams, screenshots, mockups). If a fact is not in `specs/`, the site does not show it.

## Usage

```
/specs-site [--specs DIR] [--build | --stop | --status] [--host [ADDR]] [--port N]
```

| Flag | Meaning |
| --- | --- |
| `--specs DIR` | The specs directory. Default `./specs` of the current project. |
| `--build` | Static export to `DIR/.site/` instead of a dev server. |
| `--stop` / `--status` | Stop / report the running dev server (Astro's own lock file; one server at a time). |
| `--host [ADDR]` | Bind the dev server to `ADDR` (bare `--host` = `0.0.0.0`, LAN). Default `127.0.0.1`. |
| `--port N` | Default `4321`. |

## Steps

1. **Locate the CLI**: `SS=$(find -L ~/.claude/skills ~/.claude/plugins -path '*/specs-site/scripts/specs-site.mjs' -not -path '*archive*' | head -1)`. If empty, tell the user to `/plugin install specs-site@claude-dev-skill` and stop.
2. **Check the target**: `DIR` must contain `stories.json`; otherwise print the CLI's own error and suggest `/high-level-scoping` or `/migrate-specs`. Node ≥ 22.12 is required (`node --version`).
3. **Dev (default)**: `node "$SS" dev --specs "$DIR" [--host …] [--port N]`. Inside Claude Code, Astro detects the agent environment and runs the server as a background daemon: the command returns once the server is up (the first run also installs the site's dependencies with `npm ci`, ~30 s) — no `run_in_background` needed. A server already running is replaced (`--force`), so the site always shows the specs dir you asked for. Poll `curl -sf http://127.0.0.1:PORT/ >/dev/null` up to 15 × 2 s, then print the URL and one line of what the dashboard shows (`jq -r '.stories | group_by(.phase) | map("\(.[0].phase) \(length)") | join(", ")' "$DIR/stories.json"`), and how to stop it: `/specs-site --stop` (never `pkill -f astro` on a shared host).
4. **`--build`**: `node "$SS" build --specs "$DIR"`; print the output directory (`DIR/.site/`) and, if `.gitignore` does not contain `specs/.site/`, say so (`/repo-initialization` ≥ 2.2 adds it). **`--stop`** / **`--status`**: `node "$SS" stop` / `node "$SS" status`, print the output.
5. **Ids the site shows**: `jl-NNN` on the journal page is line `NNN` of `specs/journal.jsonl` (`sed -n 'NNNp' specs/journal.jsonl`), so a user can point at an entry; `BL-NNN` is the backlog item. ```` ```mermaid ```` fences in the markdown are rendered in the browser (mermaid.js, bundled), so the `--build` output needs JavaScript for them.
6. Under autopilot (`specs/autopilot.json.active`), do nothing different: the site is read-only and the dashboard's "Now running" panel follows the run.

## Self-review (print as a checked list)

- [ ] the URL printed answers with HTTP 200 (or the build directory exists and contains `index.html`)
- [ ] nothing under `specs/` was modified except `specs/.site/` on `--build`
- [ ] the stop command (dev) or output path (build) was printed
