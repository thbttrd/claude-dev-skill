# Changelog

All notable changes to the `d2-architect` skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the skill follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.0] — 2026-04-26

### Added

- **Phase C dense-region rules — §32, §33, §34** (`references/polish-rules.md`). Three new readability checks that close a silent-failure gap: a Phase B render can be geometrically correct yet unreadable in dense regions (bus lanes, multi-arrow strips, busy legends). The existing rules check whether each label looks right where it is; the new rules check whether the lane has room for the labels at all.
  - **§32 — Dense bus-lane breathing room.** Quantitative spacing thresholds for stacked horizontal-arrow rows: ≥ 14 px between rows (one label height + halo), ≥ 20 px clearance from layer-header above, ≥ 20 px clearance from box tops below. The fix is to **grow the host layer height** + uniform downward shift of layers below — explicitly carved out as an exception to the don't-move-boxes rule because vertical resize + uniform shift preserves every cluster, column alignment, and relative position.
  - **§33 — Label-on-label collisions in dense regions.** Bounding-box intersection check between every pair of `<text class="arrow-label">` elements. Two labels can have non-overlapping underlying arrows but overlapping rectangles — the eye reads them as one garbled string. Approximate bbox: `chars × 6.5 px` × 14 px; account for `text-anchor` start vs middle. Fix priority: move label y → raise arrow bus_y → shorten label.
  - **§34 — Legend horizontal overflow.** Horizontal analog of §31 (vertical viewport cropping). Detects when legend text extends past `viewBox` width or when 2-column-legend left-column text reaches the right-column source rectangle. Uses `chars × 7 px` for legend font (sans-serif 14 px). Fix: widen `viewBox` W and `.legend` width.
- **Reviewer agent rules C8, C9, C10** (`~/.claude/agents/d2-architect-polish-reviewer.md`) mapped 1:1 to §32/§33/§34. C8 includes the explicit allowance to grow a layer height (and uniformly shift everything below) — which would otherwise violate C6 — because it preserves all the layout invariants TALA cares about. C10 is HTML-fixable in place; C8 + C9 may also require updates to the SVG overlay `viewBox` height and the `.diagram` div when the layer grows.
- **Reviewer workflow ordering update.** C8 now runs FIRST in the fix pipeline because layer-resize shifts every coordinate below the resized layer; running it last would force every other check to recompute against stale positions. New ordering: C8 → C5 → C1 → C2 → C3 → C9 → C4 → C10 → C7.
- **Pre-screenshot checklist** in `polish-rules.md` gains three entries (§32 / §33 / §34). Reviewer agent self-check list gains four entries (the three rules + a note that C8 also triggers a C7 re-screenshot recommendation because it grew the canvas).
- **`SKILL.md` Step 8 agent prompt** now explicitly directs the reviewer to "pay particular attention to dense regions" and references §32–§34 by number, including the "if §32 fires, the canvas grew — emit a C7 line" instruction so the skill re-screenshots automatically.

### Why MINOR (not MAJOR)

No breaking changes to the invocation contract, output filenames, script interfaces, or existing rule numbers. The new rules are additive — diagrams that previously passed §26–§31 continue to pass them. The reviewer agent's allowed-edits scope expanded slightly (it can now resize a layer height vertically) but the new edit is a pure superset; nothing the agent could previously do is now forbidden. Callers pinning `^2.4.0` continue to work; pinning `^2.5.0` opts into the dense-region checks and the layer-resize remediation. Diagrams generated under 2.4.x that were "passable but cramped" will now be auto-fixed to "comfortable" on a 2.5.x re-run, which is a strictly better outcome.

## [2.4.0] — 2026-04-26

### Added

- **Phase 0 — Diagram-set planning.** A new first phase that decides, before any d2 source is written, whether the architecture wants a single overview or an overview + zoom-ins. Driven by density signals (modules, edges, nesting depth, edge-semantic count) mapped to Light / Dense / Heavy plans. The remaining phases (A → B → C) then run **once per planned view**. Solves the "1:1 ARCHITECTURE.md → one diagram" failure mode that produces unreadable walls of boxes once a project grows past ~12 modules.
- **`references/views.md`** — new reference: the diagram-set rules. Catalogs the standard views (`overview`, `cross-module-flow`, `presentation`, `infrastructure`, `bm/<id>`), each with goal / includes / excludes / pattern fit. Documents the density-to-plan map, when _not_ to split, and how the Phase 0 plan is written to `<basename>-plan.md` for the caller to embed in `ARCHITECTURE.md`.
- **`views: ["overview", ...]` invocation input.** New optional contract field that lets the caller lock the output to a specific view set. `auto` (default) lets Phase 0 plan; an explicit list bypasses density heuristics.
- **`<basename>-plan.md` output artifact.** Plain-markdown plan — density signals, decision rationale, ordered view list — that the caller pastes into `ARCHITECTURE.md` as a "Diagram set" section so readers see _why_ the architecture is split.
- **Module color rule (no-white doctrine).** New top-of-file section in `references/patterns.md`: every module fill must be a tint of its category color (Tailwind 50 / 100 / 200 / 600 scale — container / non-hub / hub / stroke). Pure white is forbidden because it destroys the category signal at small scale. `polish-rules.md` §15bis enforces it; the pre-screenshot checklist gains a "no white module fill" entry. The single exception: External I/O wrapper stays neutral grey + dashed so brand-colored resources show through.
- **3-tier polish-template CSS.** `assets/polish-template.html` now exposes `--<color>-container` / `--<color>-fill-light` / `--<color>-fill-medium` / `--<color>-stroke` per category, plus `.box.<color>` (light) and `.box.hub.<color>` (medium + 3 px stroke) classes. New `.layer.<color>` helper for drawing layer / group wrappers behind the boxes with the lightest tint.
- **Standard palette table refresh in `references/html-template.md`.** Now shows three fills per category (container / module / hub) instead of one, and links the CSS class names to the specific tier each represents.
- **Pattern templates updated.** Pattern 1 (3 column groups) and Pattern 3 (4 stacked layers) in `references/patterns.md` rewritten to use the 3-tier tints — every `style.fill: "#FFFFFF"` replaced with the appropriate light tint, hub modules tagged with the medium tint + 3 px stroke. Pattern 4 already conformed; Pattern 2 unchanged (uses default d2 styling).
- **Multi-view return contract.** Step 10 now returns one five-path bundle per planned view (plus the `<basename>-plan.md` path once at the top). Single-view callers see `<basename>.png` exactly where they used to; multi-view callers get `<basename>-<view-name>.png` for each zoom-in.

### Changed

- **SKILL.md pipeline overview** rewritten from "three-phase" to "four-phase" with Phase 0 added. The "what each phase decides" recap explicitly attributes _what to show_ to Phase 0, _where_ to TALA, _how it looks_ to HTML polish, and _whether it reads cleanly_ to the readability review.
- **Style conventions** gain two new bullets: "Module fills are NEVER white" (with the pointer to the 3-tier rule) and "One diagram per question, not one diagram per ARCHITECTURE.md" (with the pointer to `views.md`).
- **Pattern 1 & 3 styling-rule paragraphs** rewritten — the old "white fill" bullet replaced by explicit references to the 3-tier tint scale, with the layer-color list expanded from one fill per layer to three.

### Why MINOR (not MAJOR)

The single-view return contract is preserved verbatim: small architectures still produce `<basename>.png` at exactly the same path, with no zoom-ins. Existing callers that read only that path continue to work unchanged. The new behavior — Phase 0 plan + zoom-ins for dense architectures — is additive: callers iterating the return now see additional view paths but never see fewer than before. Callers can also pass `views: ["overview"]` to lock to the legacy single-diagram shape if they prefer. The visual change to module fills (no-white) is technically a behavioral change but produces strictly more legible diagrams; it does not affect any contract field. Pinning `^2.3.0` keeps the old palette and single-diagram default; pinning `^2.4.0` opts into the planner and the colored-module doctrine.

## [2.3.0] — 2026-04-24

### Added

- **`polish-rules.md` §31 — Legend and diagram completeness.** New rule catching a silent failure mode: `screenshot.sh` captures the browser viewport (not the full document), so a too-short viewport silently crops the legend at the canvas bottom. The rule specifies both a pre-screenshot computation (sum of diagram-div height + title + legend + padding + safety margin, rounded up to the nearest 100 px) and a post-screenshot visual check (legend's bottom border visible, every row drawn, nothing truncated).
- **`d2-architect-polish-reviewer` Rule C7 — Legend visibility (report-only).** The reviewer now inspects the PNG for legend cropping and emits a `C7: legend CROPPED — recommend re-screenshot at height ≥ N px` line in the change log when found. C7 is deliberately **report-only**: the fix is a re-screenshot (owned by the skill), not an HTML edit. The agent must not shrink the diagram or move the legend to compensate.
- **Self-check list** in the reviewer agent gains an entry: legend visibility checked, C7 line emitted if cropped, no HTML edit for that rule.

### Changed

- **SKILL.md Step 7** now leads with the viewport-height computation formula. The old "1000×1600 default is usually fine" guidance is replaced with "compute from the HTML and pass explicitly; rely on the default only for simple diagrams" — the default itself bumps from 1600 → 1800 px for safety.
- **SKILL.md Step 8** agent prompt updated to reference §26–31 (was §26–30) and to instruct the agent that C7 is report-only.
- **`screenshot.sh`** default height: 1600 → 1800. Comment block expanded to warn that the callsite SHOULD pass an explicit height computed from the HTML, because the viewport-capture behavior will crop the legend when the default under-shoots.
- **Pre-screenshot checklist** in `polish-rules.md` gains two entries for §31 (height computed from HTML; post-screenshot PNG verified).

### Why MINOR (not MAJOR)

No breaking changes to the invocation contract, output file names, or script arguments. Callers pinning `^2.2.0` continue to work — their diagrams render against the more generous 1800-px default, which is strictly safer. The C7 change log line is additive; existing change-log consumers that grep by `C1:`–`C5:` ignore it. Pinning `^2.3.0` opts into the explicit height-computation doctrine.

## [2.2.0] — 2026-04-24

### Added

- **Phase C — Readability review.** A third phase added to the pipeline after the first-render PNG. The skill invokes the new `d2-architect-polish-reviewer` agent, which reads the polished HTML + rendered PNG and applies the §26–30 readability rules in place, then the skill re-screenshots. Catches readability issues a layout engine cannot see (a path crossing a label is a valid graph but an unreadable diagram).
- **`d2-architect-polish-reviewer` agent** at `~/.claude/agents/d2-architect-polish-reviewer.md`. Dedicated review subagent with a fresh context — separation from the main conversation that wrote the HTML avoids the usual "defend the choice" bias. Applies fixes mechanically in rule order (C5 z-order → C1 halo → C2 consolidation → C3 endpoints → C4 path-text crossings) and returns a short change log.
- **`references/polish-rules.md` §26–30** — the five Phase C rules, authoritative:
  - **§26 Text on clean background** — universal white halo via `paint-order: stroke fill; stroke: white; stroke-width: 3px`. Solves 60–80 % of readability issues with one CSS rule applied globally to `.arrow-label`.
  - **§27 Consolidate N parallel same-semantic arrows** — when every sub-shape of module A points to every sub-shape of module B for the same reason, collapse to one inter-container arrow labeled once.
  - **§28 No superposed arrow endpoints** — when multiple arrows share a box edge, distribute at `1/(n+1)` intervals (same as §5 balanced-ports, applied post-polish).
  - **§29 Arrows must not cross text** — prefer moving the label, then rerouting the arrow, then halo-only as last resort. Never delete labels to resolve crossings.
  - **§30 SVG z-order** — all `<text class="arrow-label">` elements declared AFTER all `<path>` elements inside the arrows overlay, so text paints on top of arrows.
- **Polish template halo in CSS** — `assets/polish-template.html` now includes `paint-order` with 3 px white stroke on every `.arrow-label` by default, so new diagrams inherit the halo without any per-call effort.
- **Pre-screenshot checklist additions** — five new checks mirroring §26–30.
- **SKILL.md pipeline section rewritten** to describe three phases (was two). New Step 8 invokes the agent; Step 9 re-renders; Step 10 returns the updated paths with a one-line Phase C summary.

### Why MINOR (not MAJOR)

No breaking changes to the invocation contract, output file names, or script interfaces. Callers pinning `^2.1.0` continue to work — their diagrams just start rendering without the Phase C pass until they bump to `^2.2.0`. The new `skip_polish: true` input already existed and is the way to opt out of both Phase B and Phase C for environments without Chrome/agents.

## [2.1.0] — 2026-04-24

### Added

- **Orthogonal (elbow) routing as the default polish-phase arrow shape.** `references/polish-rules.md` §16–25 codify: every arrow uses horizontal + vertical segments joined by 90° bends, every final segment is perpendicular to the edge it touches, and TALA's orthogonal routes are preserved rather than flattened into curves during the HTML polish. Introduces a compact vocabulary — **straight segment** (zero bends, aligned boxes), **L-shape** (two bends, routes around intermediate content), and **bracket / manifold** (shared backbone + short drops, one source → multiple targets).
- **Canvas-margin bus lanes**: rule §21 formalizes routing consolidated "down the side" arrows through the narrow strip between container edge and canvas edge — symmetric left/right L-shapes read as a deliberate pair when the same semantic needs to reach a distant layer from several sources.
- **Rotated side-margin labels**: rule §22 adds `transform="rotate(-90 x y)"` for long labels alongside vertical L-shape segments so multi-word text fits a 20–40px margin without overflowing.
- **Arrow path shapes catalog** in `references/html-template.md` — copy-paste SVG examples for straight, L-shape, bracket/manifold, side-margin rotated label, and curved-fallback forms, each with the perpendicular-endpoint reasoning explained inline.
- **Pre-screenshot checklist** additions: "all arrows are orthogonal" and "every final arrow segment is perpendicular to its box edge" — catches curve-flattening regressions before the PNG is rendered.
- **Polish template inline comments** (`assets/polish-template.html`) rewritten to show orthogonal examples first (straight / L-shape / manifold) with the curved form labeled as a fallback.

### Changed

- **SKILL.md Step 6** now specifies orthogonal as the default path shape and lists straight / L-shape / manifold as the three primary choices, with curved Béziers reduced to an explicit exception.
- Curved Béziers are now documented as a **narrow fallback** rather than a peer of straight/elbow — only acceptable when an L-shape would collide with an un-moveable label, or for an intentional lifecycle edge amid an otherwise-orthogonal diagram. Never mix curves and orthogonals for the same semantic.

### Why MINOR (not MAJOR)

No breaking changes to the invocation contract, output files, or script interfaces. Callers that previously produced curved arrows still compile and render — the new guidance changes the _default_ shape for the polish phase but doesn't remove support for the curved form. Pinning d2-architect `^2.0.0` continues to work; `^2.1.0` opts into the codified orthogonal doctrine.

## [2.0.0] — 2026-04-23

### Added

- **Two-phase pipeline**: TALA auto-layout (Phase A) + hand-coded HTML polish (Phase B). The diagram is compiled through TALA first to get whiteboard-quality clustering, symmetry, and balanced-port routing; Claude then reads that PNG, reproduces the layout in HTML + inline SVG, and screenshots the result. Final output is watermark-free and pixel-perfect.
- **`references/polish-rules.md`** — TALA User Manual §3 and §6 distilled into an actionable polish-phase checklist. Covers symmetry / clusters / hierarchy preservation, label-collision fixing, balanced connection ports, hub sizing, A4 aspect ratio, and a pre-screenshot verification checklist.
- **`references/html-template.md`** — anatomy of the Phase B HTML + SVG scaffold. Coordinate extraction tips for reading the first-pass PNG, standard palette table (6 colors × CSS classes), standard arrow semantics table (7 types × stroke + dash + label color), and the stable `<marker>` definitions.
- **`assets/polish-template.html`** — copy-and-fill HTML scaffold with palette CSS variables, stable box classes, pre-defined arrow markers, and a legend skeleton. Used as the starting point for every Phase B render.
- **`scripts/serve.sh`** — wraps `python3 -m http.server` for Playwright MCP screenshots (which block `file://`).
- **`scripts/screenshot.sh`** — headless-Chrome wrapper for `file://`-based PNG capture when Playwright MCP isn't available. Auto-detects Google Chrome on macOS.
- **New invocation contract output**: the skill now returns `<basename>.html` (editable polish source) and `<basename>-auto.png` (disposable first-pass) in addition to the existing `<basename>.d2` and `<basename>.png`.
- **New invocation input**: `skip_polish: true` lets callers opt out of Phase B when headless Chrome / Playwright isn't available.

### Changed

- **`scripts/compile.sh`** default layout: `elk` → `auto` (`tala` when `d2plugin-tala` is installed, else `elk`). TALA's clustering + symmetry + dynamic-label-positioning algorithms consistently produce better architecture diagrams than elk/dagre alone.
- **Workflow restructured** from a single compile step to two phases (A: auto-layout → first-pass PNG; B: read PNG, reproduce in HTML, screenshot). Phase B is the watermark-free deliverable.
- **`SKILL.md`** rewritten to describe the two-phase pipeline, TALA licensing story, Playwright-MCP vs. Chrome-CLI fallback path, and environment prerequisites (tala, Chrome, Playwright MCP, TALA license).
- **Style conventions**: arrow color semantic now "color by meaning" (direct call / spawns / implements / persists / etc.) rather than "color by source group". The meaning-based palette scales across all four patterns and matches TALA's conventions.

### Why this is a MAJOR bump

- The default `compile.sh` layout changed (`elk` → `auto`/`tala`), and auto-add-to-PATH is not guaranteed — callers who explicitly pass `layout: elk` are unchanged; callers relying on the default get a different engine.
- The invocation contract now returns 4 files instead of 2; existing callers that only consume `.png` are unaffected, but any caller that introspects the output listing sees two additional paths.
- The workflow timing changed: a typical invocation now runs a headless browser screenshot step, which adds ~1s and requires Chrome / Playwright. Under `skip_polish: true` the old single-PNG behavior is preserved.

## [1.3.0] — 2026-04-23

### Added

- **Pattern 4 — Tree / Hierarchical Fan-Out** (new `references/patterns.md` section): a fourth canonical template for architectures with a single root (actor, CLI, entry point, webhook) that fans out through successive layers to leaf resources. Variable-depth branches are natural — one branch may be 2 levels deep, another 4. Uses **dagre** (not elk) with NO containers and NO grid constraints: edges alone drive the layout. Validated on the `claude-sddw` V0 architecture rebuild.
- **Pattern-4 engine rationale** (`references/patterns.md`): documented why elk misreads tree shapes (global edge-length minimization pulls the root toward sink-centroid) while dagre's layered algorithm places each rank in its own row. Moral: _if a diagram looks tree-shaped but the engine keeps scrambling it, check the engine before changing the graph_.
- **Reserved-keywords gotcha** (`references/d2-syntax.md` and `patterns.md` "Don't do this"): `left`, `right`, `middle`, `up`, `down`, `center` are d2-reserved. They compile fine as container declarations but fail with `reserved keywords are prohibited in edges` the moment an edge references them. Use semantic names (`workflow_lane`, not `left`).
- **Actor-shape gotcha** (`references/d2-syntax.md`): `shape: person` renders as a cloud blob in theme 0, not a stick figure. Use `shape: rectangle` with grey fill + rounded corners for actor nodes.
- **Pattern-selection heuristic** (`SKILL.md` Step 2): "name the shape in your head" — peer groups / nested BMs / stacked layers / root fans out — maps to Patterns 1 / 2 / 3 / 4. The new heuristic is the fastest tiebreaker when the architecture is ambiguous.

### Changed

- `SKILL.md` Step 2 expanded from 3 patterns to 4, with a one-line "which pattern?" selector at the end. Pattern 4 (`direction: down` only, no containers) is the recommended default for any CLI-tool or entry-point-driven diagram.
- `patterns.md` "Choosing a direction" and "Layout engine selection" tables now include a Pattern 4 row each; the tala entry in "Don't do this" softened — not bundled but not forbidden, in case the user chooses to install it separately.

## [1.2.0] — 2026-04-22

### Added

- **Pattern 3 — Layered MIM AA** (new `references/patterns.md` section): a third canonical template for architectures that read as horizontal layers (e.g., `PRESENTATION → BUSINESS MODULES → INFRASTRUCTURE → EXTERNAL I/O`). Uses `grid-rows: N` at root **plus** `grid-columns: M` per layer — the one safe case where `grid-*` coexists at two levels, because root and per-layer are orthogonal axes. Cross-layer arrows colored by **semantic** ("calls" / "persist" / "reads files") rather than by source group as in Pattern 1, because layer boundaries already carry the grouping signal. Best for frontend-heavy V0 apps where the key grouping axis is responsibility tier, not per-module internals.
- **Pattern selection guidance** (`references/patterns.md`): new "When to pick Pattern 3 vs Pattern 2" subsection; extended "Choosing a direction" and "Layout engine selection" tables to cover Pattern 3.
- **Markdown list-marker gotcha** (`references/d2-syntax.md`): lines starting with `+ `, `- `, or `* ` inside `|md` labels render as bullet points. Workaround: plain text ("with rehype-highlight"), middle-dot separator ("· rehype-highlight"), or backslash-escape. Validated on the `flashcards-v0-detailed-rebuild` test case.

### Changed

- `SKILL.md` Step 2 now walks through all three patterns with a "what does the architecture look like" selection rule. Pattern 3 is the recommended default for MIM AA V0 diagrams that read as layers rather than peer BMs with internal structure.

## [1.1.1] — 2026-04-22

### Fixed

- **Pattern 1 module-box rendering**: Pattern 1 now shows every module as an explicit bordered rectangle, not floating text. The fix required adding `shape: rectangle` + explicit `style.fill` / `style.stroke` / `style.stroke-width` / `style.border-radius` on each module. Markdown labels (`|md`) render as borderless text blocks by default; this is now documented in `references/d2-syntax.md` and shown in the Pattern 1 template.
- **Markdown label line breaks**: a single `\n` inside a `|md` block does NOT produce a visual line break. Use a blank line (paragraph break) between lines. Documented in `references/d2-syntax.md`.
- **Legend placement**: switched Pattern 1 template from `near: bottom-right` to `near: bottom-center`. `bottom-right` widens the canvas to accommodate the legend, creating a large horizontal whitespace gap between the diagram and legend. `bottom-center` tucks the legend directly under the diagram with minimal waste.

### Changed

- Pattern 1 template now grid-columns at **root level** instead of wrapping in a `columns: { ... }` container. The wrapper's default label leaks into the render ("columns" appeared at the top of the diagram in 1.1.0). Positioning `title` and `legend` with `near:` keeps them out of the grid flow.
- **Hub highlight**: Pattern 1 now emphasises the hub module with a darker fill + 3px stroke so the reader's eye lands on it first.
- **Sibling-ordering hint**: documented the invisible-edge trick (`m_a -> m_b: {style.opacity: 0}`) for stacking sibling modules when no real edge exists between them.

## [1.1.0] — 2026-04-22

### Added

- **Composition principles** (new `SKILL.md` section): every diagram must have (1) an explicit title as a top-level text shape with `near: top-center`, (2) a mandatory legend (with real mini-arrows, not a text block) for any diagram using multiple line styles or colored arrows, (3) central placement of the hub module via declaration order + `grid-columns` constraint, (4) vertical-leaning aspect ratio for A4/document embedding.
- **Pattern 1 template rewrite** (`references/patterns.md`): now includes title block, grid-columns wrapper, per-container `direction: down`, arrow-coloring by source group, and a legend with demonstrative mini-arrows. Preserves the feel of hand-drawn architecture diagrams.
- **Layout-engine guidance** (`SKILL.md` Style conventions + new section in `references/patterns.md`): prefer `dagre` for Pattern 1 (flat, respects declaration order, tighter), prefer `elk` for Pattern 2 (deep nesting). Observed from the v1.0.0 flashcards-V0 rebuild.
- **`near:` positioning reference** (`references/d2-syntax.md`): `top-center`, `bottom-right`, etc. — used by title + legend.
- **Grid positioning reference** with the single-wrapper rule.

### Fixed

- Documented the `grid-rows` gotcha: applying it to every top-level container flips the whole diagram horizontal (Pattern 2 experience). `references/d2-syntax.md` now warns against broad application; only use on the ONE wrapper that defines column structure.

### Changed

- Pattern 2 template now also includes a title block and legend (parity with Pattern 1).

## [1.0.0] — 2026-04-22

### Added

- Initial skill: `SKILL.md` with invocation contract, 5-step workflow (pick icons → write d2 → validate → compile → return embed), style conventions, and failure handling.
- `references/d2-syntax.md` — d2 syntax cheat-sheet focused on architecture diagrams (shapes, connections, containers, icons, styles, layout, themes, gotchas).
- `references/patterns.md` — two canonical templates: Pattern 1 (high-level product modules) and Pattern 2 (detailed MIM AA) with styling rules for each.
- `references/icons.md` — curated icon catalog, shape-vs-icon decision table, instructions for adding new icons.
- `assets/icons/aws/` — 17 AWS service icons: `api-gateway`, `aurora`, `cloudfront`, `cloudwatch`, `dynamodb`, `ec2`, `ec2-autoscaling`, `ecs`, `eks`, `elasticache`, `elb`, `lambda`, `rds`, `route53`, `s3`, `sns`, `sqs`. All sourced from `icons.terrastruct.com`.
- `assets/icons/dev/` — 10 dev-tool icons: `docker`, `github`, `mongodb`, `nginx`, `nodejs`, `postgresql`, `python`, `react`, `redis`, `typescript`.
- `scripts/compile.sh` — wraps `d2 --theme=0 --layout=elk --pad=40 <src> <out>` with overridable theme and layout.
- `scripts/add_icon.sh` — download, validate (HTTP 200 + SVG/PNG sanity check), and cache a new icon into `assets/icons/<category>/<name>.<ext>`.
- Versioning + CHANGELOG convention (this file).
