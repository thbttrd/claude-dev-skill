# Changelog

All notable changes to this skill will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-04-24

### Added
- **Label masking via white halo + render-order.** Two complementary changes that make arrow labels stay readable even when an arrow or container border runs beneath them:
  - `assets/template.html` → `.arrow-label` CSS now sets `paint-order: stroke fill` with a 3 px white stroke. The stroke paints behind the fill, giving each label a halo that visually "breaks" any line passing through it.
  - `assets/template.html` → SVG structure now prescribes "ALL `<path>` arrows first, then ALL `<text>` labels last". SVG paints in document order; this ordering guarantees labels sit on top of every arrow, not just their own.
- **`references/tala-principles.md` §5** — new subsection "Rendering order + white-halo masking (enforced by the template)" documenting both mechanics and warning that neither excuses poor label placement; they are safety nets for near-misses (2–6 px clearances), not substitutes for routing into whitespace.
- **Pre-screenshot checklist** — new line: "Labels render after paths" with a pointer to §5.

### Why
Third-eval run surfaced it: on the V0 MIM AA diagram, the `replaceAll()` label between BM-import and BM-card-library printed directly over the blue arrow it was labeling, and the three `calls` labels sat on top of the INFRASTRUCTURE container's top border. Both failures were readability-critical. The halo+order combo fixes the "label too close to a line" case generically — for all future diagrams — without requiring perfect pixel-level placement.

### Not changed
- Template still positions labels with `<text x y>` coordinates chosen by the LLM. Auto-placement that finds "free whitespace" would require runtime DOM measurement (not available in static HTML generation). The halo makes the LLM's hand-chosen positions forgiving.

## [1.2.0] — 2026-04-24

### Added
- **`scripts/screenshot.sh` auto-computes viewport height** when the caller omits the `[height]` argument. The script curl-fetches the served page, parses the `.diagram` `height: Npx` inline style, adds a fixed overhead for body padding + `<h1>` (~200 px), and if a `.legend` block is present adds another ~150 px plus the legend SVG's declared height.
- Falls back to the previous default (1600 px) when the page isn't reachable or doesn't follow the template convention, so the fallback path is still usable for ad-hoc HTML.
- Explicit `[height]` still overrides auto-computation — fully backward-compatible.
- SKILL.md Step 6 updated to reflect the new behavior.

### Why
Both eval runs (v1.0.0 and v1.1.0 shakedowns) surfaced the same friction: guessing a viewport height that fits the diagram + legend, then bumping it two or three times when the legend got clipped. Auto-computing from the HTML removes the guessing loop without adding a dependency — `curl`, `grep`, and `awk` are already assumed by the rest of the skill's shell plumbing.

### Deliberately not done
- **No post-screenshot whitespace trim.** Considered using PIL or ImageMagick to auto-crop the trailing whitespace in the output PNG, but both are optional on macOS (PIL not installed by default; ImageMagick not shipped). Keeping the skill dep-free is more valuable than the ~100 px of trailing whitespace that the current formula leaves.
- **No JS-based measurement via Chrome DevTools Protocol.** CDP would give exact page height, but orchestrating it from bash requires a WebSocket client, which pulls in a dep. HTML parsing is a simpler path that's "good enough" for the template-shaped pages this skill produces.

## [1.1.0] — 2026-04-23

### Added
- **TALA principle 11: Perpendicular port entries and exits** (in `references/tala-principles.md`). Both the first and last tangent of every arrow must be perpendicular to the touched box edge. The triangle marker's base must be parallel to the target edge so the tip points straight into the shape. Includes the cubic-Bézier control-point placement table, a worked example showing wrong-vs-right for an arrow routing around an obstacle, and guidance on compound paths for cases a single cubic can't satisfy.
- **Rule: always add a short straight `L` terminator (~8 px) at the arrival.** Documented in §11 under "Always add a short straight `L` terminator at the arrival". Without it, cubic Bézier micro-curvature in the last few pixels makes the path visibly join the triangle off-center. The `L` guarantees a perpendicular join exactly through the middle of the triangle's base.
- New line in the pre-screenshot checklist enforcing the above rules.

### Why
User feedback from the first eval run: arrows that arrive tangent-to-edge look like they're sliding past the box instead of entering it. Same problem at the starting end — arrows exiting a box horizontally feel like the source is emitting them along its surface. Inspiration came from a cable-management photo (perfectly perpendicular drops into rack ports) and the mental model maps directly onto arrow routing in architecture diagrams.

## [1.0.0] — 2026-04-23

### Added
- Initial release. Single-phase pipeline: invocation → HTML + CSS + inline SVG → screenshot PNG.
- `references/tala-principles.md` — TALA manual sections 3 and 6 distilled into 10 actionable rules for LLM-driven HTML positioning (symmetry, clusters, hierarchy, balanced ports, dynamic labels, square-ish aspect ratio, direction per container, custom dimensions for hub, label collisions, legends) + a pre-screenshot checklist.
- `references/html-patterns.md` — the four canonical layout patterns (Peer groups, Nested BMs, Layered MIM AA, Root-driven tree) as HTML coordinate templates.
- `references/palette.md` — 6-color box palette and 7 arrow semantics as the single source of truth for colors and markers.
- `assets/template.html` — self-contained HTML + CSS + SVG scaffold with the palette baked in as CSS variables and all arrow markers pre-declared.
- `scripts/serve.sh` and `scripts/screenshot.sh` — copied from d2-architect; Playwright-MCP and headless-Chrome paths for the final PNG render.

### Notes
- This skill does **not** require D2, TALA, or any auto-layout engine.
- Prefer `d2-architect` for fast first-pass whiteboard diagrams. Use `html-architect` when readability trumps speed, when an auto-layout result is tangled, or when D2 isn't installed.
- The four composition principles from the user's auto-memory are baked into SKILL.md: explicit title, mandatory legend, hub central, vertical-leaning aspect ratio.
