---
name: d2-architect
version: 2.5.0
description: Generate architecture diagrams via a four-phase pipeline — view planning (decide whether the architecture wants a single overview or an overview + zoom-ins), TALA auto-layout for a whiteboard-quality first pass, hand-coded HTML + SVG for pixel-perfect final polish (no watermark, no label collisions, every module color-coded by category — never white), and an agent-driven readability review. Use this skill whenever creating or regenerating a high-level or detailed architecture diagram — whether invoked from /high-level-scoping, /research-and-architecture, or any request to visualize modules, services, dependencies, or system topology. Always prefer this skill over Excalidraw or Mermaid for architecture work. Ships with a curated catalog of AWS and dev-stack icons, four canonical layout patterns, a standard view catalog (overview / cross-module-flow / presentation / infrastructure / per-BM zoom-ins), and a TALA-aware polish template.
---

# d2-architect

Turn a set of modules + dependencies into a professional architecture diagram through a **four-phase pipeline**:

0. **Phase 0 — Diagram-set planning:** decide whether the architecture fits in a single overview or needs an overview + zoom-ins. Apply density heuristics (modules, edges, nesting depth, edge-semantic count) and pick views from a standard catalog. Output a plan; subsequent phases run **once per planned view**.
1. **Phase A — Auto-layout (fast):** for each planned view, write d2 source, compile through TALA (falling back to `elk` / `dagre` when TALA isn't installed). This produces a clustered, symmetric, whiteboard-like first-pass PNG.
2. **Phase B — Polish (pixel-perfect):** read the first-pass PNG, reproduce the layout in hand-coded HTML + inline SVG with orthogonal elbow routing, apply category-color tints to every module (no white fills), fix any residual label collisions and remove the TALA watermark, then screenshot to PNG.
3. **Phase C — Readability review (agent-driven):** invoke the `d2-architect-polish-reviewer` agent on the Phase B output. The agent reads the HTML + rendered PNG, applies the §26–34 rules (text halo, arrow consolidation, balanced endpoints, no path-through-text, SVG z-order, dense bus-lane breathing room, label-on-label collisions, legend horizontal overflow), edits the HTML in place, and returns a change log. The skill re-screenshots to produce the final PNG.

The combination is the whole point: Phase 0 decides _what to show_ (an overview + targeted zoom-ins is what an architect would draw — not the whole graph crammed into one frame), TALA decides _where_ things go (clustering-aware, symmetry-weighted algorithms dagre and elk can't match), the HTML phase decides _how_ things look (fonts, orthogonal routing, color-coded fills, label placement that a browser renders cleaner than any headless layout engine), and the review phase catches the readability issues a layout engine cannot see (a path crossing a label is a valid graph but an unreadable diagram).

Focused on architecture diagrams (high-level product modules or detailed MIM AA designs), not general-purpose d2 authoring.

## When this skill applies

Typical callers are `/high-level-scoping` and `/research-and-architecture`, but any request to draw a module/service/dependency diagram is fair game. Not intended for sequence diagrams, state machines, or flowcharts — d2 supports those, but this skill's patterns, polish rules, and icon catalog are tuned for architecture.

## Invocation contract

| Input         | Required | Form                                                                                                                                                                                                                              |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules       | yes      | For each: `id`, human-readable `name`, `type` (`business`, `infrastructure`, `standalone`, `external`, `ui`, `data`, `actor`), optional `group` (container ID), optional `icon_key` (from `references/icons.md`) or `shape` hint. |
| Dependencies  | yes      | For each: `from` (module id), `to` (module id), optional `label`, optional `style` notes (e.g., "async", "external", "implements ports").                                                                                         |
| `output_dir`  | yes      | Absolute directory. All output files are written there.                                                                                                                                                                           |
| `basename`    | yes      | Stem for the output files. The overview view uses `<basename>` as is; zoom-ins append a suffix: `<basename>-<view-name>` (e.g., `architecture-cross-module-flow`).                                                                |
| `title`       | no       | Appears in the diagram title, comment header, and embed alt-text. Per-view titles append the view name in parentheses.                                                                                                            |
| `views`       | no       | `auto` (default) \| `["overview"]` \| `["overview", "<view-name>", ...]`. `auto` lets Phase 0 plan the diagram set from density heuristics. Explicit list locks the output to those views in order. See `references/views.md`.    |
| `direction`   | no       | `down` (default) \| `right` \| `up` \| `left`. Applies per-view; the overview default is `down`, zoom-ins inherit unless their pattern requires otherwise.                                                                        |
| `layout`      | no       | `auto` (default — tala if installed, else elk) \| `tala` \| `elk` \| `dagre`. Applies per-view.                                                                                                                                   |
| `theme`       | no       | d2 theme id, default `0`.                                                                                                                                                                                                         |
| `skip_polish` | no       | `false` (default). If `true`, skip Phase B and treat the auto-layout PNG as final. Use only when the caller doesn't have Chrome / Playwright MCP available.                                                                       |

**Returns to the caller:**

For each planned view (always at least `overview`), the skill returns the same five-path bundle:

- `<output_dir>/<view-basename>.d2` — d2 source, editable.
- `<output_dir>/<view-basename>-auto.png` — Phase A first-pass PNG (disposable; may carry a TALA watermark if unlicensed).
- `<output_dir>/<view-basename>.html` — Phase B hand-coded HTML, editable, self-contained.
- `<output_dir>/<view-basename>.png` — Final screenshot. **This is the deliverable for that view.**
- A markdown snippet: `![<title> — <view name>](<view-basename>.png)`.

Plus the diagram-plan artifact:

- `<output_dir>/<basename>-plan.md` — the Phase 0 plan: density signals, decision, ordered list of views with their pattern + scope. Useful for the caller to embed as a "Diagram set" section in `ARCHITECTURE.md`.

When only the `overview` view is produced (small architectures), `<view-basename>` is `<basename>` itself, so existing single-diagram callers see `<basename>.png` exactly where they used to.

**What this skill does NOT do:** write, update, or rewrite `ARCHITECTURE.md`. That's the caller's responsibility — but `<basename>-plan.md` is something the caller can drop in directly.

## Workflow

### Phase 0 — Diagram-set planning

A real architect doesn't put everything in one diagram. They draw a high-level overview that gives the shape of the system, and then targeted close-ups for specific aspects. Phase 0 makes that decision **before** any d2 source is written, so dense architectures don't end up crammed into a single unreadable frame and small ones don't get fragmented for no reason.

#### Step 0.1 — Count the density signals

From the input modules + dependencies, compute:

- **Total modules** (every leaf, not counting containers).
- **Total edges** (`dependencies.length`).
- **Container nesting depth** (deepest level of `group` chains).
- **Distinct edge semantics** (count of unique `style`/`label` clusters — e.g., "calls", "persists", "reads files", "publishes" → 4).

#### Step 0.2 — Apply the density-to-plan map

Cross-reference the table in `references/views.md` → "Decision criteria":

| Density   | Plan                                                                  |
| --------- | --------------------------------------------------------------------- |
| All Light | One diagram: `overview` only.                                         |
| Any Dense | `overview` + 1 zoom-in (pick the densest subgraph as the zoom topic). |
| Any Heavy | `overview` + 2–3 zoom-ins (one per dense subgraph).                   |

If the caller passed an explicit `views: [...]` list, **honor it verbatim** and skip the density check. The caller has reasons.

#### Step 0.3 — Pick views from the standard catalog

Pull from `references/views.md` → "Standard view catalog". Always include `overview` as view 1. For zoom-ins, prefer (in order): `cross-module-flow`, `infrastructure`, `presentation`, `bm/<id>`. Pick zoom-ins whose focal subgraphs match where the density actually concentrates — don't add a `presentation` zoom-in for an architecture whose Presentation layer is 2 modules.

#### Step 0.4 — Write the plan to disk

Write to `<output_dir>/<basename>-plan.md`:

```markdown
# Diagram set for <title>

Density: <N modules>, <M edges>, <D nesting levels>, <S semantic categories> → **<Light|Dense|Heavy>**
Decision: <one-line rationale>

## Views

1. **`<basename>.png`** — overview (Pattern 3 layered MIM AA). Shows the four layers with their primary inter-layer edges; intra-layer detail collapsed.
2. **`<basename>-cross-module-flow.png`** — cross-module flow (Pattern 1 peer columns). Each BM as a column, public-API edges only; presentation and infrastructure reduced to single boxes.
```

The plan is a real artifact the caller embeds in `ARCHITECTURE.md` — readers see _why_ there are two diagrams instead of one, which is half the value.

#### Step 0.5 — For each planned view, run Phases A → C

The remaining workflow (Steps 1–10 below) executes **once per view**. The view's filtering rules (which modules to show, which to collapse, which edges to include) are applied when generating the d2 source in Step 2 — see `references/views.md` for what each view shows / hides.

When the plan is `overview` only, Steps 1–10 run once and the file naming matches the legacy single-diagram contract (`<basename>.d2` / `<basename>.png`). When zoom-ins exist, each view writes to `<basename>-<view-name>.{d2,html,png}`.

### Phase A — Auto-layout first pass

#### Step 1 — Pick icon/shape for each module

Decide visual treatment in this order of preference:

1. **Curated icon** — if the module maps to a named AWS service or dev tool in `references/icons.md`, use its local path (e.g., "RDS" → `aws/rds.svg`, "Redis cache" → `dev/redis.svg`). This is the standardized vocabulary.
2. **Shape hint** — for generic concepts: `cylinder` (database), `queue`, `stored_data`, `cloud` (external), `document`, `hexagon` (logical service boundary). Avoid `person` — renders as a cloud-blob in theme 0; use a grey rectangle for actor nodes.
3. **Plain rectangle** — default. Let label and color carry the meaning.

Consistency matters more than cleverness: if two databases appear, treat them both the same way.

#### Step 2 — Write the d2 source

Read `references/d2-syntax.md` for syntax and `references/patterns.md` for the four canonical templates. **Adapt a template — don't start from a blank canvas.**

- **Pattern 1: Peer groups** → 2–4 thematic columns of modules at the same abstraction level; `grid-columns: N` at root.
- **Pattern 2: Nested BMs** → Business-Modules as containers with `app`/`domain`/`infra` children; cross-module arrows touch `.app` only. Use when BMs have rich internal structure.
- **Pattern 3: Layered MIM AA** → horizontal tiers (`PRESENTATION → BUSINESS → INFRASTRUCTURE → EXTERNAL I/O`); `grid-rows: N` at root + `grid-columns: M` per layer. Typical for frontend-heavy V0 apps.
- **Pattern 4: Root-driven tree** → one actor / CLI / entry point fans out through variable-depth branches; `direction: down` only, no containers, no grid.

Quick selection heuristic: name the shape in your head. "3 peer groups" → Pattern 1. "BMs with internals" → Pattern 2. "Stacked layers" → Pattern 3. "A root fans out" → Pattern 4.

The source should be human-readable:

- IDs are short, descriptive (`auth`, not `mod_7a1b`).
- Related modules grouped via containers.
- A top-of-file comment stating what the diagram represents and when it was generated.

Write to `<output_dir>/<basename>.d2`.

#### Step 3 — Validate before compiling

d2 aborts the entire compile on any broken `icon:`. Before invoking:

- Verify every local `icon:` path exists.
- Only use remote URLs that have been cached by `scripts/add_icon.sh`.
- When uncertain, drop the `icon:` and fall back to a shape hint.

#### Step 4 — Compile first-pass PNG

```bash
~/.claude/skills/d2-architect/scripts/compile.sh \
  <output_dir>/<basename>.d2 \
  <output_dir>/<basename>-auto.png
```

`compile.sh` auto-selects: **`tala`** when `d2plugin-tala` is on the PATH, else `elk`. If you need a specific engine, pass it as the fourth argument. TALA's algorithms consistently produce more readable layouts for architecture diagrams (see the TALA User Manual §3 for the principles: symmetry, clusters, hierarchy, balanced ports, dynamic label positioning, square aspect ratio) — that's why it's the default.

If compile fails:

- **Icon error**: remove the offending `icon:`, retry.
- **Layout sprawl on Pattern 1/4**: retry with `dagre`.
- **Syntax error**: fix inline. Common culprits: unquoted labels with `()` / `:` / `.`, reserved keywords as IDs (`left`, `right`, `middle`, `up`, `down`, `center`), missing `}`.

### Phase B — HTML polish

This phase reproduces the Phase A layout as hand-coded HTML + inline SVG, applying the full set of polish rules from the TALA User Manual (see `references/polish-rules.md`). The browser then renders the HTML and a screenshot becomes the final PNG — **watermark-free, pixel-perfect**.

Skip this phase only if the caller sets `skip_polish: true` (or the environment has no Chrome / Playwright MCP) — in that case `<basename>-auto.png` becomes the deliverable, copied to `<basename>.png`.

#### Step 5 — Read the first-pass PNG

Use the `Read` tool on `<basename>-auto.png` to **see the layout visually**. Extract:

- **Box positions**: approximate `left`, `top`, `width`, `height` for each node. Round to the nearest 10px.
- **Arrow paths**: identify source / sink box, any visible bend. Estimate 1–2 Bézier control points per curved arrow.
- **Label positions**: roughly `(x, y)` of each label's center. Polish will relocate to clear whitespace.

#### Step 6 — Generate the polish HTML

Copy `assets/polish-template.html` → `<output_dir>/<basename>.html`. The template provides:

- CSS variables for the standard 6-color palette (purple / blue / grey / green / orange / teal).
- Stable box classes (`.box.purple`, `.box.blue`, etc.).
- SVG `<marker>` definitions for every arrow color.
- A legend scaffold.

Fill in:

- **Title** at the top (`<h1>`).
- **Diagram canvas dimensions** (`width`, `height`) based on the extracted bounds.
- **One `<div class="box ...">`** per module with its extracted coordinates and labels.
- **One `<path>`** per edge inside the SVG overlay. **Default shape: orthogonal** — horizontal + vertical segments joined by 90° bends, every endpoint perpendicular to the box edge it touches. Reach for a **straight segment** when the two boxes are aligned, an **L-shape** when routing around intermediate content, and a **bracket / manifold** (shared backbone + short drops) when one source fans out to multiple targets. Curved Béziers are a fallback reserved for the rare label-collision exception documented in `polish-rules.md` §25. Use the marker + stroke color matching the semantic (see `references/html-template.md` → Standard arrow semantics and → Arrow path shapes).
- **Arrow labels** as `<text class="arrow-label">` positioned at arrow midpoints, offset 10–20px to sit in clear whitespace. For a long label that would overflow a 20–40px canvas margin next to a vertical L-shape segment, rotate it 90° CCW with `transform="rotate(-90 x y)"` so it reads bottom-to-top.
- **Legend entries** — one per arrow type actually used.

Apply the polish rules while writing (see `references/polish-rules.md` for the full checklist):

- Preserve TALA's symmetry, clusters, hierarchy, square-ish aspect ratio.
- Fix any label that overlaps a box or another label.
- Space multi-arrow endpoints at `1/(n+1)` intervals along shared sides.
- Break long labels with explicit line breaks.
- Route arrows _around_ boxes via gaps, margins, or clear strips — never through. Use the canvas margin (between container edge and canvas edge) as a vertical bus lane for consolidated "down the side" arrows that travel past several layers.

#### Step 7 — Render final PNG

**Compute the viewport height FIRST** — the screenshot tools capture the browser viewport, not the full document, so a too-short viewport silently crops the legend (§31 in `polish-rules.md`). Read your HTML and sum:

```
required_height = diagram_div_height                      (from <div class="diagram" style="...height: Npx">)
                + 60                                       (body padding-top + h1 + h1 margin-bottom)
                + 40                                       (legend margin-top + legend border + padding-top)
                + legend_svg_height                        (from <svg viewBox="0 0 W H"> in the legend block)
                + 60                                       (legend padding-bottom + body padding-bottom)
                + 40                                       (safety margin)
```

Round up to the nearest 100 px. For a typical Pattern 3 layered diagram this lands between **1700 and 1800 px** — noticeably taller than the old 1600 default. Pass it as the `height` arg.

Two paths depending on what's available:

**Preferred — Playwright MCP** (when the plugin is active):

1. Start a local HTTP server in the output directory:
   ```bash
   ~/.claude/skills/d2-architect/scripts/serve.sh <output_dir> 8765 &
   ```
2. Navigate the browser: `http://localhost:8765/<basename>.html`.
3. Take a full-page screenshot to `<output_dir>/<basename>.png`. Playwright's `full-page` captures the whole document regardless of viewport — this path is immune to the cropping pitfall but still benefits from passing the right height to any resize call so labels render at the intended scale.
4. Kill the HTTP server.

**Fallback — headless Chrome CLI** (when Playwright isn't available, or when Playwright MCP times out on a cold page load — its 5s internal font-load timeout trips on fresh runs):

```bash
~/.claude/skills/d2-architect/scripts/screenshot.sh \
  http://localhost:8766/<basename>.html \
  <output_dir>/<basename>.png \
  <width> <required_height>
```

Viewport defaults to 1000×1800 — enough for most diagrams + a 5-entry legend. **Do not rely on the default for a complex diagram**: always pass the computed `required_height` explicitly. The screenshot captures the viewport, so extra padding below content is fine (the PNG just has whitespace); too little height silently crops the legend.

Note: `screenshot.sh` works with `file://` URLs too, but some Chrome versions restrict `file://` from fetching related assets. Using `http://localhost:8766/...` via `serve.sh` is more reliable.

**Verify after screenshot — mandatory.** Read the rendered PNG with the `Read` tool. Confirm:

- The legend box's bottom border is visible, not cut off at the canvas edge.
- Every legend row is fully drawn.
- Nothing below the diagram or legend is truncated.

If cropped, kill the HTTP server, bump the height by ~200 px, restart the server on a different port, and re-screenshot. Report the final height in the return message so future runs learn from it.

If Chrome isn't installed either, copy `<basename>-auto.png` → `<basename>.png` and note the watermark in the return message.

### Phase C — Readability review

TALA + HTML polish produce a geometrically correct diagram. Phase C catches the class of issues that only become visible once everything is rendered: labels sitting on box borders, two arrows landing on the same point, an arrow running through a text, text painted under an arrow, or a bundle of parallel same-semantic arrows that should collapse to a single inter-container arrow. These are the **readability** issues a layout engine cannot see.

Skip Phase C only when the caller sets `skip_polish: true` or when no Agent tool is available (in which case the Phase B PNG becomes the deliverable and you document the limitation in the return message).

#### Step 8 — Invoke the d2-architect-polish-reviewer agent

Call the `d2-architect-polish-reviewer` agent via the Agent tool:

```
Agent({
  description: "Phase C polish review",
  subagent_type: "d2-architect-polish-reviewer",
  prompt: "Review the polished diagram at <output_dir>/<basename>.html against the Phase C rules (§26–34 in ~/.claude/skills/d2-architect/references/polish-rules.md). Rendered PNG: <output_dir>/<basename>.png. Apply fixes in place to the HTML — do not regenerate from scratch. Pay particular attention to dense regions: §32 (bus-lane breathing room), §33 (label-on-label collisions), §34 (legend horizontal overflow) — these are the silent-failure modes that produce a 'rendered but unreadable' diagram. If §31 (legend vertical cropping) is flagged, DO NOT edit HTML to fix it — only report the cropping in the change log so the skill re-screenshots with a larger viewport. If §32 fires (layer grew), the canvas grew too — emit a C7: line so the skill re-screenshots with the new height. Return a change log grouping edits by rule number. Under 200 words."
})
```

The agent reads both files, applies fixes in rule order (**C8 layer-resize FIRST** so later rules see final coordinates → C5 z-order reorder → C1 halo → C2 consolidation → C3 balanced endpoints → C9 label-on-label nudges → C4 path-text crossings → C10 legend horizontal-overflow widening → C7 legend vertical-cropping report), edits the HTML in place, and returns a change log. C7 is report-only — the agent never touches HTML for vertical viewport issues; the skill owns re-screenshotting.

**Why an agent** — a subagent has a fresh context dedicated to visual review. Without that separation, the main conversation that wrote the Phase B HTML tends to defend its choices ("the label looks fine where it is") instead of noticing a problem ("the label overlaps the layer border"). The agent reads with fresh eyes.

#### Step 9 — Re-render the final PNG

After the agent returns a change log with non-zero edits, re-screenshot:

```bash
~/.claude/skills/d2-architect/scripts/serve.sh <output_dir> 8767 &
sleep 1.5
~/.claude/skills/d2-architect/scripts/screenshot.sh \
  http://localhost:8767/<basename>.html \
  <output_dir>/<basename>.png \
  [width] [height]
lsof -ti:8767 | xargs -r kill
```

If the agent returned "All Phase C checks pass — no HTML edits made", skip this step — the existing PNG is already the deliverable.

**Optional second pass:** for dense diagrams, invoke the agent once more with the new PNG. Converge in at most 2 passes; if the second pass still proposes fixes, accept the current state and log the residual items in the return message (further iterations give diminishing returns and risk undoing earlier fixes).

#### Step 10 — Return embed snippets and paths

For each planned view, return the same five-path bundle. When only `overview` is in the plan, the bundle uses `<basename>` directly (legacy single-diagram contract). When zoom-ins exist, each view is returned with `<basename>-<view-name>` and the diagram-plan path is included once at the top.

```
Diagram set ready (N views — see plan).
  Plan:        <abs output_dir>/<basename>-plan.md       [embed in ARCHITECTURE.md "Diagram set" section]

  ─── overview ───
  Source:      <abs output_dir>/<basename>.d2
  First pass:  <abs output_dir>/<basename>-auto.png      [disposable]
  HTML:        <abs output_dir>/<basename>.html          [editable · Phase B + C applied]
  Final:       <abs output_dir>/<basename>.png           [deliverable · post-Phase C render]
  Embed:       ![<title> — Overview](<basename>.png)
  Phase C:     <summary of agent's change log, 1 line>

  ─── cross-module-flow ───
  Source:      <abs output_dir>/<basename>-cross-module-flow.d2
  First pass:  <abs output_dir>/<basename>-cross-module-flow-auto.png    [disposable]
  HTML:        <abs output_dir>/<basename>-cross-module-flow.html        [editable · Phase B + C applied]
  Final:       <abs output_dir>/<basename>-cross-module-flow.png         [deliverable]
  Embed:       ![<title> — Cross-module flow](<basename>-cross-module-flow.png)
  Phase C:     <summary of agent's change log, 1 line>
```

The caller pastes the embed lines into its own document (usually `ARCHITECTURE.md` in the same directory) and the plan into a "Diagram set" section above the embeds, so readers see _why_ there are multiple diagrams.

## Composition principles

These four principles apply to every diagram produced, across both phases. TALA handles them automatically in Phase A; polish should preserve them in Phase B.

### 1. Explicit title

Always a top-level title (in d2 via `near: top-center`, in HTML via `<h1>`). Format: `"<Project> — <Scope>"`. Examples: `"Meal Planner — High-Level Architecture (V0)"`, `"claude-sddw — Detailed MIM AA Architecture (V0)"`.

### 2. Mandatory legend

Any diagram with >1 line style or >1 arrow color must include a legend. Place `near: bottom-center` in d2 (or below the diagram in HTML). Use _actual_ mini-arrows and demo boxes — a real demonstration is clearer than a text description.

### 3. Central placement of the hub module

The module with the most connections sits visually central, not on the edge. Reader's eyes land on the center first; the structural centerpiece belongs there. TALA's hierarchy / cluster detection handles this if you declare the hub in the middle position — don't fight it.

### 4. Vertical-leaning aspect ratio

Architecture diagrams end up in A4 / letter portrait pages. Target roughly-square or taller-than-wide. Avoid long horizontal chains; prefer vertical cascades.

## Style conventions

- **Colors**: stick to the standard 6-color palette (`references/html-template.md` → Palette). Override only when semantics demand it (e.g., external services get `stroke-dash: 3`). When multiple groups each have a color, **color the arrows by the semantic they represent** (not by the source group) — it scales better across patterns.
- **Module fills are NEVER white.** Every module carries one of the six category colors via a 3-tier tint (container 50 → light 100 → medium 200), with the hub module getting the medium tint + a 3 px stroke. The category color is the most load-bearing piece of information on the diagram and it must survive on the _fill_ — borders thin to invisibility when the diagram is scaled down for embedding. The single exception is the External I/O **wrapper** in Pattern 3, which stays neutral grey + dashed so the resources inside keep their own brand colors. Implementation: in d2 use the per-tier hex values listed in each pattern; in HTML use `.box.<color>` for non-hub and `.box.hub.<color>` for the hub. See `references/patterns.md` → "Module color rule" and `references/polish-rules.md` §15bis.
- **Arrow labels**: describe the _relationship_, not the technology. "reads from" / "publishes to" / "authenticates via" — not "HTTP GET" / "gRPC".
- **Grouping**: one level of nesting is usually enough; MIM AA detailed uses two (BM → infra). More nesting = less readable.
- **Direction**: `down` is the usual default. `right` for flow-like architectures (client → server → data).
- **Layout engine**: `auto` picks `tala` then `elk`. Explicit `dagre` only for Pattern 4 root-driven trees.
- **Labels**: prefer full names ("Amazon RDS", "Stripe Payments") over abbreviations — the diagram should read standalone.
- **One diagram per question, not one diagram per ARCHITECTURE.md.** Phase 0 splits the architecture into a high-level overview + targeted zoom-ins when density warrants. Don't try to fit everything into a single frame — see `references/views.md`.

## Reference files

- `references/views.md` — the diagram-set planning rules: density signals, decision criteria, standard view catalog (overview / cross-module-flow / presentation / infrastructure / per-BM).
- `references/d2-syntax.md` — d2 syntax cheat-sheet (shapes, connections, containers, styles, layout, gotchas).
- `references/patterns.md` — the four canonical templates + the no-white "Module color rule"; adapt don't rewrite.
- `references/icons.md` — curated icon catalog + how to add more.
- `references/polish-rules.md` — TALA principles distilled for the HTML polish phase; pre-screenshot checklist.
- `references/html-template.md` — anatomy of the polish HTML, coordinate extraction tips, 3-tier palette + arrow semantics tables.

## Scripts

- `scripts/compile.sh` — compile `.d2` → PNG with tala/elk/dagre auto-selection.
- `scripts/add_icon.sh` — download, verify, and cache a new icon locally.
- `scripts/serve.sh` — start `python3 -m http.server` for Playwright MCP screenshots.
- `scripts/screenshot.sh` — headless Chrome wrapper for `file://`-based PNG capture.

## Assets

- `assets/icons/aws/` — 17 AWS service icons.
- `assets/icons/dev/` — 10 dev-stack icons.
- `assets/polish-template.html` — reusable HTML + SVG scaffold for Phase B. Copy, fill in, render.

## Environment prerequisites

- **d2 0.7.1+** on PATH (core dependency).
- **d2plugin-tala** (highly recommended): `brew install terrastruct/tap/tala` or `curl -fsSL https://d2lang.com/install.sh | sh -s -- --tala`. Skip with `layout: elk` if not installed; no watermark concern when using elk.
- **Google Chrome or Chromium** (for Phase B fallback screenshot). macOS default path `/Applications/Google Chrome.app/...` is auto-detected.
- **Playwright MCP plugin** (optional, preferred for screenshots): handles full-page capture better than headless CLI.
- **TALA license token** (optional): removes the "UNLICENSED COPY" watermark from the Phase A PNG. Not required — the polish phase regenerates watermark-free regardless. Sign up at https://terrastruct.com/tala, set `TSTRUCT_TOKEN` or write `~/.config/tstruct/auth.json`.

## Versioning

This skill follows [Semantic Versioning](https://semver.org/). The current version is in the frontmatter and changes are tracked in `CHANGELOG.md`.

When modifying this skill, always:

1. Bump `version:` per SemVer:
   - **MAJOR** — breaking change to the invocation contract, removed icon, or workflow restructure that invalidates older callers.
   - **MINOR** — new capability, new icons, new patterns, new scripts.
   - **PATCH** — wording fixes, bug fixes, doc clarifications, no behavioral change.
2. Append a `## [X.Y.Z] — YYYY-MM-DD` entry to `CHANGELOG.md`.

Callers (`/high-level-scoping`, `/research-and-architecture`) that depend on specific contract fields should pin the major version they work with.
