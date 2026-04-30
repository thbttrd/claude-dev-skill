---
name: html-architect
version: 1.3.0
description: Generate architecture diagrams as hand-coded HTML + CSS + inline SVG — no D2, no TALA, no auto-layout engine — by applying TALA's software-architecture layout principles manually (symmetry, clusters, hierarchy, balanced ports, hub-centrality, square-ish aspect ratio). Use whenever you need an architecture diagram rendered straight to HTML/SVG. Strong fit when TALA isn't installed, when an auto-layout pass has produced a tangled result with crossings or label collisions, when a diagram needs deliberate hub-centered composition, or when the user says "hand-code the layout", "fix this messy diagram", "HTML diagram", "SVG diagram", or "rebuild it more readably". Also reach for it when an existing auto-generated PNG needs a cleaner redo — the LLM can reason about routing, cluster membership, and symmetry more flexibly than a force-directed or layered algorithm on dense graphs. Prefer d2-architect when you just want a first-pass whiteboard diagram from scratch; prefer html-architect when layout quality is the bottleneck.
---

# html-architect

Produce a pixel-precise architecture diagram as a single-file HTML + inline SVG, then screenshot to PNG. **No D2, no TALA, no auto-layout engine at any stage** — the LLM places every box and routes every arrow, applying TALA's software-architecture layout principles manually.

Works well whenever placement is the hard part: dense graphs with many crossings, diagrams that need a hub-centered composition, or any time an auto-layout engine has produced an illegible first pass and you want a deliberate redo. Also the obvious fallback when D2/TALA isn't installed.

## How this differs from d2-architect

| | d2-architect | html-architect |
|---|---|---|
| First pass | TALA/elk/dagre auto-layout | LLM picks positions manually |
| Polish pass | hand-coded HTML on top of auto-layout | (no separate pass — the HTML *is* the diagram) |
| D2 dependency | required | none |
| Typical strength | fast, good default for simple graphs | dense graphs, crossings, hub-centrality, bespoke routing |
| Typical weakness | auto-layout mangles crowded graphs | each box is placed by hand — slower than auto |
| Deliverables | `.d2`, `-auto.png`, `.html`, `.png` | `.html`, `.png` |

Pick **d2-architect** when you're drawing from scratch and want an OK-looking first pass fast. Pick **html-architect** when readability is more important than speed, when the graph is complex enough that auto-layout will fight you, or when an existing PNG needs a cleaner rewrite.

## Invocation contract

| Input | Required | Form |
|---|---|---|
| Modules | yes | For each: `id`, human-readable `name`, optional `subtitle` (2–3 words under the title), `type` (`business`, `infrastructure`, `standalone`, `external`, `ui`, `data`, `actor`), optional `group` (container ID), optional visual hints. |
| Dependencies | yes | For each: `from` (module id), `to` (module id), optional `label`, optional `style` (see `references/palette.md` → Arrow semantics). |
| `output_dir` | yes | Absolute directory. All output files written here. |
| `basename` | yes | Stem for the output files. Typical values: `architecture` (high-level) or `architecture-detailed` (MIM AA). |
| `title` | yes | Appears as `<h1>` and `<title>`. Format: `"<Project> — <Scope>"`. |
| `canvas_width` | no | Diagram inner width in px. Default 900. |
| `canvas_height` | no | Diagram inner height in px. Default picks the taller-than-wide ratio (see composition principles). |
| `source_image` | no | Absolute path to an existing PNG/diagram to rebuild more readably. When present, the skill reads it with the `Read` tool and uses it to disambiguate the graph before throwing away the old layout. |

**Returns to the caller:**

- `<output_dir>/<basename>.html` — the editable hand-coded HTML.
- `<output_dir>/<basename>.png` — the final screenshot. **This is the deliverable.**
- A markdown snippet: `![<title>](<basename>.png)` — relative path so it works pasted into an `ARCHITECTURE.md` sitting in the same directory.

**What this skill does NOT do:** write or update `ARCHITECTURE.md`. That's the caller's responsibility.

## Workflow

### Step 1 — Understand the graph

Before placing anything:

- Read each module and note its **type** (drives color — see `references/palette.md`) and **group** (if any — drives containment).
- Count each module's **degree** (in + out). The one with the highest degree is the **hub** — it belongs visually central (composition principle #3).
- Spot **clusters**: sets of modules that all connect to the same neighbor. They want to live on the same side of that neighbor (TALA principle §3.2).
- Spot **hierarchies**: chains of modules connected in the same direction. They want even vertical spacing (TALA §3.3).
- Spot **peers**: modules at the same abstraction level with no direct dependency on each other. They want to be aligned horizontally or vertically in a row/column.
- Note **multi-edge pairs**: two modules with ≥2 connections between them. Their endpoints must be spaced at `1/(n+1)` along the shared edge (TALA §3.4).
- If `source_image` was provided, **read it now** with the `Read` tool. The goal is to recover the node/edge graph, NOT to copy positions — the old layout is being thrown away on purpose.

### Step 2 — Pick a pattern

Open `references/html-patterns.md` and pick whichever shape fits. **Adapt a template — don't start from a blank canvas.** Briefly:

- **Pattern 1 — Peer groups**: 2–4 thematic columns of modules at the same abstraction level.
- **Pattern 2 — Nested BMs**: Business-Modules as containers with inner sub-boxes. Cross-module arrows touch the outer container.
- **Pattern 3 — Layered MIM AA**: horizontal tiers stacked top-to-bottom (PRESENTATION → BUSINESS → INFRASTRUCTURE → EXTERNAL). Typical for frontend-heavy apps.
- **Pattern 4 — Root-driven tree**: one actor / CLI / entry point fans out through branches. No containers.

Heuristic: "3 peer columns" → 1. "BMs with internals" → 2. "Stacked layers" → 3. "Root fans out" → 4.

### Step 3 — Apply TALA principles to pick coordinates

Open `references/tala-principles.md` and translate each principle into pixel coordinates. The goal is a layout a software engineer would draw on a whiteboard:

- **Symmetry** — mirror siblings around the hub.
- **Clusters** — sibling children on the same side of their parent.
- **Hierarchy** — same-direction chains get even vertical spacing; one row height per tier.
- **Balanced ports** — multi-arrow sides get endpoints at `1/(n+1)` intervals.
- **Hub dimensions** — the hub may be slightly larger (wider, taller, or both) than its peers. This matches TALA §6.1.
- **Square-ish aspect ratio** — aim for height ≥ width (vertical-leaning, A4-friendly) or 1:1. Never wider than 1.3× the height.
- **Direction per container** — each group can flow its own direction; the top level defaults to `down`.

### Step 4 — Fill in the template

Copy `assets/template.html` → `<output_dir>/<basename>.html`. The template provides:

- CSS variables for the 6-color palette (`references/palette.md` → Palette).
- Stable box classes (`.box.purple`, `.box.blue`, etc., plus `.box.hub` for the central node).
- SVG `<marker>` definitions for every arrow color.
- A legend scaffold at the bottom.

Fill in:

- **Title** (`<h1>`) at the top.
- **Canvas dimensions** (`width`, `height`) on `.diagram`.
- **One `<div class="box ...">`** per module with absolute `left`/`top`/`width`/`height`. Inside each box: `.title` and (optional) `.sub`.
- **Group containers** (Pattern 3 especially) as `<div class="container COLOR">` with their own absolute coords.
- **One `<path>`** per dependency inside the SVG overlay.
  - `M x1 y1 L x2 y2` for straight.
  - `M x1 y1 C cx1 cy1 cx2 cy2 x2 y2` for curved (use when the straight line would cross another box).
  - `stroke` + `marker-end` from the semantic table (`references/palette.md` → Arrow semantics).
- **Arrow labels** as `<text class="arrow-label ...">` positioned near arrow midpoints, offset 10–20px into clear whitespace. Never inside a box. Never overlapping another label.
- **Legend entries** — one per arrow semantic actually used. Demonstrate with a real mini-arrow, not a text block.

### Step 5 — Sanity-check before rendering

Walk the pre-render checklist in `references/tala-principles.md` → "Pre-screenshot checklist" (copied to the top of this skill for convenience):

- [ ] Title present and centered at top.
- [ ] Legend present if >1 arrow style.
- [ ] Hub is visually central, not on the edge.
- [ ] Aspect ratio: height ≥ width, or at most 1.3× wider than tall.
- [ ] Every arrow starts and ends on a box edge, not inside.
- [ ] No arrow crosses through a box (goes around, not through).
- [ ] Multi-arrow sides spaced at `1/(n+1)` intervals.
- [ ] No label overlaps a box or another label.
- [ ] Colors match the palette; deviations are intentional and documented.

Fix anything that fails before screenshotting. Iterating on HTML is cheap; re-screenshotting is not.

### Step 6 — Render final PNG

Two paths depending on what's available:

**Preferred — Playwright MCP** (when the plugin is active):
1. Start a local HTTP server in the output directory:
   ```bash
   ~/.claude/skills/html-architect/scripts/serve.sh <output_dir> 8765 &
   ```
2. Navigate the browser: `http://localhost:8765/<basename>.html`.
3. Take a full-page screenshot to `<output_dir>/<basename>.png`.
4. Kill the HTTP server.

**Fallback — headless Chrome CLI** (when Playwright isn't available, or when it hits its 5s cold-load timeout):
```bash
~/.claude/skills/html-architect/scripts/screenshot.sh \
  http://localhost:8766/<basename>.html \
  <output_dir>/<basename>.png \
  [width] [height]
```
Width defaults to 1000. **Height is auto-computed** by fetching the served page and parsing the `.diagram` and `.legend` dimensions — pass it explicitly only to override. If the HTML can't be parsed (unreachable URL or a non-template page), falls back to 1600. Expect ~100px of trailing whitespace in auto-mode; if you need a tight fit, pass an exact height.

The `file://` URL sometimes works too, but `http://localhost:...` via `serve.sh` is the reliable path. Some Chrome versions restrict `file://` from loading related assets.

### Step 7 — Return embed snippet and paths

```
Diagram ready.
  HTML:   <abs output_dir>/<basename>.html    [editable]
  Final:  <abs output_dir>/<basename>.png     [deliverable]
  Embed:  ![<title>](<basename>.png)
```

The caller pastes the embed line into its document.

## Composition principles

These four principles apply to every diagram. No auto-layout handles them for you — you apply them by hand.

### 1. Explicit title

Always a top-level `<h1>`, bold, ~26px, centered. Format: `"<Project> — <Scope>"`. Examples: `"Meal Planner — High-Level Architecture (V0)"`, `"claude-sddw — Detailed MIM AA Architecture (V0)"`.

### 2. Mandatory legend

Any diagram with >1 line style (solid + dashed) or >1 arrow color must include a legend below the main canvas. Use *actual* mini-arrows and demo boxes — a real demonstration is clearer than a text description. See `assets/template.html` for the scaffold.

### 3. Hub module visually central

The module with the most connections sits in the middle of the canvas, not on an edge. The reader's eye lands on the center first; the structural centerpiece belongs there. Optionally give it `.box.hub` for a thicker border and slightly larger footprint.

### 4. Vertical-leaning aspect ratio

Architecture diagrams embed into A4 / letter pages in portrait mode. Target height ≥ width (taller than wide) or close to 1:1. Never wider than 1.3× the height. Wide-sprawling diagrams become illegible when scaled to fit.

## Style conventions

- **Colors**: stick to the 6-color palette (`references/palette.md`). Override only when semantics demand it (e.g., external services with dashed strokes).
- **Arrow color convention**: color arrows **by the semantic they represent** (direct call / composition / DI / file I/O / ...), not by the source group. This scales better across patterns.
- **Arrow labels**: describe the *relationship*, not the technology. "reads from" / "publishes to" / "authenticates via" — not "HTTP GET" / "gRPC".
- **Grouping**: one level of nesting for simple diagrams; two for MIM AA detailed. More nesting = less readable.
- **Box sizing**: default 160×70 or 180×80 px. Hub can go up to 220×90. Taller boxes for nodes with 2–3 lines of subtitle.
- **Whitespace**: leave 40–80px between peer boxes, 60–100px between tiers.
- **Labels**: prefer full names ("Amazon RDS", "Stripe Payments") over abbreviations — the diagram should read standalone.

## Reference files

- `references/tala-principles.md` — TALA layout principles distilled into rules for hand placement. Read this every time.
- `references/html-patterns.md` — four canonical layout patterns with HTML coordinate templates. Adapt, don't rewrite.
- `references/palette.md` — palette + arrow semantics tables. Single source of truth for colors.

## Scripts

- `scripts/serve.sh` — start `python3 -m http.server` for Playwright/Chrome screenshots.
- `scripts/screenshot.sh` — headless Chrome wrapper for final PNG capture.

## Assets

- `assets/template.html` — self-contained HTML + CSS + SVG scaffold. Copy, fill in, render.

## Environment prerequisites

- **Google Chrome or Chromium** (for the screenshot step). macOS default path `/Applications/Google Chrome.app/...` is auto-detected.
- **Playwright MCP plugin** (optional, preferred): handles full-page capture more reliably than headless CLI.
- **Python 3** (for `serve.sh`).

No D2, no TALA, no Go, no licenses — that's the whole point.

## Versioning

This skill follows [Semantic Versioning](https://semver.org/). The current version is in the frontmatter. When modifying:

1. Bump `version:` per SemVer:
   - **MAJOR** — breaking change to the invocation contract.
   - **MINOR** — new patterns, palette additions, workflow additions.
   - **PATCH** — wording fixes, doc clarifications.
2. Append a `## [X.Y.Z] — YYYY-MM-DD` entry to `CHANGELOG.md`.
