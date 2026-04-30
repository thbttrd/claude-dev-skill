# Polish rules — TALA principles applied during the HTML post-processing phase

The skill's default workflow uses TALA as a **first-pass auto-layout engine** (because its layered, clustering-aware algorithms produce whiteboard-like diagrams that other engines can't) and then reproduces the layout in hand-coded HTML + SVG for the final render. The polish phase is where label collisions, watermarks, and font inconsistencies are fixed.

This document distills the principles from the [TALA User Manual v0.4.1](https://github.com/terrastruct/TALA) (Sections 3 and 6) into an actionable checklist for the polish phase. TALA solves most of these automatically; the polish phase's job is to **preserve** what TALA did well and **fix** anything it left rough.

## What TALA already solves for — preserve in polish

1. **Symmetry.** Shapes are positioned symmetrically even at the cost of slightly longer edges. When reading the TALA PNG to extract coordinates, notice and preserve mirror alignment — don't collapse symmetric groups to minimize width.
2. **Clusters.** Sibling shapes connected to the same parent are grouped on the same side. Don't spread cluster members across the diagram in the HTML rewrite.
3. **Hierarchy.** Nodes connected in the same direction form layers with even vertical spacing. Keep the row heights consistent in the HTML.
4. **Square-ish aspect ratio.** Non-connected subgraphs are bin-packed toward a square shape. Don't force a long horizontal or vertical canvas in polish — target 1:1 to 1:1.5 (portrait) overall.
5. **Balanced connection ports.** When multiple arrows share an edge between two nodes, TALA spaces them at `1/(n+1)` intervals along the shared side. Replicate this spacing in SVG — don't bunch arrow endpoints together.

## What polish must actively fix

6. **Label collisions.** TALA's dynamic label positioning handles most cases, but dense diagrams still leak. In the HTML, place every label in clear whitespace adjacent to its arrow midpoint — never inside a box, never overlapping another label.
7. **Long labels.** Break any label wider than ~3 words with explicit `<br>` (HTML) or `\n` (SVG text). TALA won't grow the layout to fit a long label.
8. **Self-connections.** Each self-loop reserves one corner of its node. Route `x -> x` arrows around a reserved corner (top-right, bottom-left, etc.) so multiple self-loops don't collide.
9. **Watermark removal.** Unlicensed TALA diagrams carry an "UNLICENSED COPY" watermark diagonal. Hand-coded HTML has none — that's one of the reasons for this workflow.

## Structural choices during the HTML rewrite

10. **Direction.** Default to `direction: down` (top-to-bottom flow). Per-subtree direction is fine — Pattern 3's layered sub-structures and Pattern 4's branches both work downward.
11. **Hub sizing.** If a node has significantly more connections than its peers, give it slightly larger padding, bolder font, or a darker fill tint. The reader's eye should land on the hub first.
12. **Legend at bottom.** Place the legend below the main diagram, laid out as a 2×3 or 3×2 grid of (arrow demo + text label) pairs. Match the stroke / dash / color exactly to the arrows in the main diagram.
13. **Title at top.** Bold, ~26px, centered. Format: `<Project> — <Scope>` (e.g., `"claude-sddw — Detailed MIM AA Architecture (V0)"`).
14. **A4 orientation.** Target portrait aspect ratio so the diagram embeds cleanly into `ARCHITECTURE.md` rendered as a letter-sized page. Roughly-square is acceptable; wide-horizontal diagrams become illegible when scaled.
15. **Consistent palette.** Use the standard colors (see `references/html-template.md` palette table) unless the d2 source explicitly chose otherwise.
    15bis. **No white module fills — every module carries its category color.** A module reads as belonging to its category before any label is processed; that signal is destroyed by `style.fill: "#FFFFFF"`. The polish phase enforces a 3-tier tint: container = lightest tint (Tailwind 50), non-hub module = light tint (100), hub module = medium tint (200) + 3 px stroke. The category-color stroke alone is not enough — borders thin to invisibility when the diagram is reduced for embedding, and the fill is what survives. The CSS classes `.box.purple` / `.box.hub.purple` (and same per color) implement this directly; never write a `.box` with no color class. The single exception is the **External I/O wrapper container** in Pattern 3: it stays neutral grey + dashed so the resources inside (S3 orange, Postgres teal, etc.) keep their own brand colors against a category-agnostic backdrop. See `references/patterns.md` → "Module color rule" for the rationale.

## Arrow routing specifics

16. **Orthogonal (elbow) routing is the default.** Arrows use only horizontal and vertical segments joined by 90° bends. Cubic Béziers and diagonals are reserved for the rare case where orthogonal routing would cross a box and no margin is available to route around. TALA produces orthogonal routes; the polish phase should preserve that style, not flatten it into curves.
17. **Perpendicular endpoints.** Every arrow's final segment is perpendicular to the edge it touches. Enter/exit the **top** or **bottom** of a box via a vertical segment; enter/exit the **left** or **right** via a horizontal segment. Never land an arrow on a corner or at an oblique angle.
18. **Avoid crossing boxes.** Arrows route _around_ other boxes, not through them. When a straight vertical between two aligned boxes is blocked by a third box in between, use an L-shape or bracket routed through a gap between columns, through the margin between the container edge and the canvas edge, or through the clear strip between a layer label and its first row of boxes.
19. **L-shape / bracket / U-shape vocabulary.** Three recurring orthogonal motifs cover almost every edge:
    - **L-shape** (two 90° bends): `M x1 y1 L x1 yBend L x2 yBend L x2 y2` — exit box along one axis, turn once, enter target along the other axis. Used for cross-layer arrows that route around intermediate content.
    - **Bracket / manifold** (three bends, one source → two targets): draw a shared backbone with no arrowhead, then two short drops each ending with `marker-end`. Used for "one BM reads several repos" patterns.
    - **Straight segment** (zero bends): the short vertical or horizontal between two perfectly aligned boxes. The cleanest shape — use whenever columns/rows line up.
20. **Endpoints on box edges, not corners.** Snap endpoints to `(left, centerY)`, `(right, centerY)`, `(centerX, top)`, `(centerX, bottom)`, or a fractional position along an edge when multiple arrows share it (see §5 balanced-ports rule — space at `1/(n+1)` intervals).
21. **Route around containers using the canvas margin.** When a consolidated arrow needs to travel past several layers to reach a distant target (e.g. "all IMs → storage"), exit the source box, step outward to a vertical bus lane in the canvas margin (just inside the canvas edge, outside every container), drop down past the intervening layers, then step back in to enter the target. Symmetric left/right L-shapes for parallel "down the side" arrows read as a deliberate pair rather than two orphans.
22. **Rotate side-margin labels.** A consolidated arrow running along the canvas margin usually has a multi-word label. Rotate the label 90° counter-clockwise with `transform="rotate(-90 x y)"` so it reads bottom-to-top alongside the vertical segment; this fits a long label in a 20–40px margin without overflowing into a container. Keep horizontal labels for short mid-arrow annotations like "calls" or "delegates".
23. **Uniform arrowheads.** All arrowheads use the same `<marker>` shape and size — only the fill color changes per semantic. When a bracketed manifold has multiple drops, each drop carries its own `marker-end`; the backbone does not.
24. **Dashed styles consistent.** Use `stroke-dasharray="6 4"` for DI / implements-ports edges and `"5 3"` for async / persistence / cross-BM / auth-gate edges. Don't mix dash patterns within one diagram.
25. **Curved routing — when to break orthogonal.** Curves are acceptable when: (a) you want to suggest a smoothly-flowing lifecycle edge (e.g. "session heartbeat") and the diagram already has a mostly-orthogonal core, or (b) an L-shape would collide with a label that cannot be moved. Never mix curves and orthogonals for the _same semantic_ — if cross-BM reads use L-shapes, all cross-BM reads are L-shapes.

## Phase C rules — readability review (applied by the d2-architect-polish-reviewer agent)

Phase B produces a rendered PNG that is geometrically correct. Phase C is a **visual-polish review** applied on top — the agent re-reads the HTML + PNG and fixes the specific readability issues that a layout engine cannot see (a path crossing a label is a valid graph, but an unreadable diagram). These five rules are applied in order.

### 26. **Text always on a clean background — white halo by default**

Every `<text class="arrow-label">` must render against clear whitespace. When that isn't achievable by placement alone (label sits on a box border, crosses a path, or abuts another label), apply a white halo using SVG `paint-order`:

```css
.arrow-label {
  paint-order: stroke fill;
  stroke: white;
  stroke-width: 3px;
  stroke-linejoin: round;
}
```

The halo paints a 3px white stroke behind each character fill, visually isolating the text from anything underneath. This one rule resolves the majority of Phase C readability issues — before moving labels or rerouting arrows, apply the halo globally. Keep the halo on every arrow-label by default in the polish template so new diagrams inherit it automatically.

When halo isn't enough (label sits literally on a layer-header so the halo itself looks like decoration), move the label to the nearest whitespace strip — between two layers, between two rows of boxes, or in the canvas margin.

### 27. **Consolidate N parallel same-semantic arrows into a single container-to-container arrow**

When the edges between two module groups carry **the same semantic** (same stroke color, same dash pattern, same intended meaning) and form a visible bundle of ≥ 3 parallel arrows, replace them with a single arrow drawn between the **container** edges, labeled once.

**Example:** Auth Gate (1 box) → 5 Route Handler boxes all dashed orange for "authenticated request". Instead of 5 short vertical dashed arrows sharing one label, draw **one** dashed orange arrow from the Auth Gate container's bottom-center to the Route Handlers container's top-center, labeled "authenticated requests". The reader still understands that every handler is guarded — the bundle is the point — and the diagram loses four redundant lines plus four ports to balance.

**Don't consolidate when:**

- Arrows carry different labels (different semantics masquerading as one color).
- Source or target is a single box, not a group — per-box wiring is the information.
- Visual intent is to show 1-to-1 pairing (e.g. handler_i → IM_i), where losing the individual lines erases the correspondence. When in doubt, keep the detailed wiring — consolidation trades detail for simplicity, so the consolidation must be net positive.

### 28. **No superposed arrow endpoints on a shared box edge**

When two or more arrows land on the same edge of the same box, spread their endpoints at `1/(n+1)` intervals along the edge (same balanced-ports rule as §5, applied to the post-polish paths). Two arrows on a top edge: endpoints at 1/3 and 2/3 of the edge width. Three arrows: 1/4, 2/4, 3/4. The bend point before the final perpendicular segment shifts with the endpoint so the arrow still arrives at a right angle.

**Typical culprit:** a green "calls" arrow and a dashed grey "cross-BM read" arrow both enter the top-center of the same IM box. The grey one looks like the green one's shadow. Shift them 10–15 px apart along the edge.

### 29. **Arrows must not cross through text**

The halo from §26 mitigates a few-pixel overlap; it does **not** excuse a path running through a label. Fix in this order of preference:

1. **Move the label** to clear whitespace off the path. Cheapest — arrow geometry unchanged.
2. **Reroute the arrow** via an extra elbow (straight → L → bracket) so it goes around the label. Costs arrow simplicity.
3. **Halo only** — accept the overlap, relying on the white stroke to keep the text readable. Use only for a single thin line crossing a short (< 20-char) label.

Do not delete labels to resolve a crossing. The information is more important than the aesthetic.

### 30. **SVG z-order: all `<text>` after all `<path>` inside the arrows overlay**

SVG renders later elements on top of earlier ones. Declare every `<text class="arrow-label">` at the end of the `<svg class="arrows">` block, after the last `<path>`. A mix of paths and texts interleaved risks some labels being painted over by paths declared after them. Combined with the §26 halo, this gives text unambiguous visual priority over the arrow overlay.

Keep arrow-group source-comments in place, but **group all text at the bottom** of the SVG. A diffable structure:

```xml
<svg class="arrows" viewBox="...">
  <defs>…</defs>

  <!-- ─── 1. client → auth_gate ─── -->
  <path d="…" stroke="#9333EA" …/>

  <!-- ─── 2. Auth Gate → handlers ─── -->
  <path d="…" stroke="#EA580C" …/>
  …

  <!-- ─── labels (rendered last so they sit on top) ─── -->
  <text class="arrow-label purple" …>HTTPS + session cookie</text>
  <text class="arrow-label orange" …>authenticated requests</text>
  …
</svg>
```

### 31. **Legend and diagram completeness — nothing clipped by the screenshot viewport**

`scripts/screenshot.sh` captures the **browser viewport**, not the full document. If the viewport height is shorter than the rendered page, everything below the fold is silently cropped — typically the last one or two legend rows. A diagram whose legend is half-visible undermines the whole point of the legend, and the failure mode is invisible when only inspecting the HTML.

**Check (pre-screenshot):** compute the minimum required viewport height from the HTML _before_ invoking `screenshot.sh`. The formula is:

```
required_height = diagram_div_height         (from <div class="diagram" style="...height: Npx"> inline style)
                + 60  (body padding-top + h1 + h1 margin-bottom)
                + 40  (legend margin-top + border/padding top)
                + legend_svg_height           (from <svg viewBox="0 0 W H"> in the legend block)
                + 60  (legend padding-bottom + body padding-bottom)
                + 40  (safety margin — rounding, font-metric variance)
```

For a typical Pattern 3 layered diagram with 4–5 legend rows, this lands at ~1700–1800 px. Round up to the nearest 100 px and pass as the `height` arg to `screenshot.sh`.

**Check (post-screenshot):** Read the rendered PNG with the `Read` tool. Confirm:

- The legend's bottom border is visible (not touching the canvas bottom edge).
- Every legend row is fully drawn — no row half-clipped.
- Nothing below the diagram or legend is truncated.

**Fix:** re-screenshot with a larger `height` arg. Increase by ~200 px per missing row. Kill and restart the HTTP server if needed to avoid cache oddities.

**Why this rule is separate from §26–30:** those are _visual-content_ rules applied by the reviewer agent via HTML edits. §31 is a _rendering-pipeline_ rule — no amount of HTML tweaking resolves it, only a correctly-sized screenshot. The reviewer agent should _flag_ a cropping issue in its change log so the skill re-screenshots, but must not attempt to fix it by rewriting the HTML (which would leave the layout fine and the screenshot still cropped).

### 32. **Dense bus-lane breathing room — vertical spacing between stacked arrow rows**

When ≥ 2 horizontal arrow segments stack vertically inside a "bus lane" (a strip between a container header and the boxes it holds, or any clear strip used to route multiple parallel routes — Pattern 3's BM → BM arrows above the BM boxes are the canonical case), each row needs enough vertical space for its own label. §26–§29 cover _whether the labels look right where they are_; §32 covers _whether the lane has room for them at all_. The failure mode is silent: the renderer happily produces a cramped lane, labels collide with each other or with the layer header, and the diagram still "renders".

**Quantitative thresholds** (font-size 12 px, halo 3.5 px):

- **≥ 14 px** between two consecutive horizontal-arrow y-values (one label height + halo + 1 px margin).
- **≥ 20 px** clearance between the layer-header baseline (typically `y = layer.top + 28`) and the topmost arrow y. Otherwise the topmost label collides with the header text.
- **≥ 20 px** clearance between the bottommost arrow y and the top of the boxes the arrows enter. Otherwise the arrowhead lands inside the label of the row above it.

**Check (HTML-only):** scan SVG `<path>` elements for horizontal segments (two consecutive `L` commands sharing a y). Group by proximity (Δy ≤ 50 px) — that's a bus lane. For each group of N segments at `y₁ < y₂ < … < y_N` inside a container with header at `layer_top` and first box-top at `box_top`:

- Row spacing: every `y_{i+1} − y_i ≥ 14`.
- Header clearance: `y_1 − (layer_top + 28) ≥ 20`.
- Box clearance: `box_top − y_N ≥ 20`.

If any inequality fails, the lane is cramped.

**Fix — grow the host layer height (allowed exception to the don't-move-boxes rule):**

1. Compute the deficit `Δh = sum of three deficits, rounded up to nearest 10 px`.
2. Edit the layer's inline `style="...height: Hpx"` → `H + Δh`.
3. Shift every layer + box BELOW the resized layer downward by `+Δh` (uniform shift — relative positions preserved).
4. Re-spread the bus_y values uniformly between `(layer_top + 28 + 20)` and `(new box_top − 20)`.
5. Update the SVG overlay `viewBox="0 0 W H"` H value and the `.diagram` div `style="height: H_canvas"` by `+Δh`.
6. Emit a `C7:` line in the change log so the skill re-screenshots with the new larger total height.

Why this is allowed even though C6 says don't move boxes: a vertical resize of one layer plus uniform downward shift below preserves TALA's symmetry, clusters, hierarchy, and every column alignment. No box moves laterally, no cluster is broken, the only invariant that changes is "this layer is taller than TALA originally drew it" — and TALA itself routinely sizes layers to fit their contents; this is just reapplying that sizing for content TALA didn't see (the polish-phase BM → BM arrows).

**Don't:** compress the bus lane by lowering spacing below 14 px to "make it fit". The font doesn't scale with arrow density; the labels will collide regardless.

### 33. **Label-on-label collisions in dense regions**

Two `<text class="arrow-label">` elements can have non-overlapping arrows but overlapping label rectangles — the eye reads them as one garbled string. The halo from §26 helps for partial overlaps with arrows but does **not** rescue text painted on top of other text.

**Approximate label bounding box** (font-size 12 px italic):

- width ≈ `chars × 6.5 px` (round up to be safe).
- height ≈ `14 px` (font-size + descender).
- For `text-anchor="middle"`: bbox = `(x − width/2, y − 11)` to `(x + width/2, y + 3)`.
- For `text-anchor="start"`: bbox = `(x, y − 11)` to `(x + width, y + 3)`.

**Check:** for every pair of `<text class="arrow-label">`, compute bboxes; flag the pair if both x-ranges and y-ranges overlap.

**Fix (in order of preference):**

1. **Move one label to a clearer y** (preferred — arrow geometry untouched). If the labels were placed at a shared bus_y by accident, shift the colliding one to align with its arrow's actual horizontal segment, then nudge ± 5 px until clear.
2. **Raise the arrow** to a different bus_y when the two labels are forced into the same y by their shared row. If no bus_y has room, apply §32 (grow the host layer) first.
3. **Shorten one of the labels** as a last resort: "getAllCards (progress)" → "getAllCards (prog)" or just "(progress)" when context disambiguates.

**Don't:** delete a label even when both look short and "redundant". A future reader needs both — that's the entire reason §29 forbids deleting labels to fix arrow-text crossings, and the same logic applies here.

### 34. **Legend horizontal overflow / column-on-column collisions**

The horizontal analog of §31 (viewport too short → legend rows clipped vertically). When the legend SVG `viewBox` width is smaller than the rightmost text reaches, the text is silently clipped at the right edge, OR the right-column source-rectangle is rendered _under_ the left-column text. The failure mode is invisible to the renderer — the SVG just paints what it has.

**Approximate text width in the legend** (font-size 14 px sans-serif, slightly wider than §33 because non-italic):

- width ≈ `chars × 7 px`.

**Check (HTML-only — no PNG needed):**

- For each legend `<text>`: compute `text_end_x = x + chars × 7`.
- Verify `text_end_x + 20 ≤ viewBox_width` (20 px right-margin breathing room).
- For 2-column legends: verify `left_column_text_end_x + 20 ≤ right_column_source_rect_x` (left-column text doesn't reach the right column's first visual element).

**Fix:**

- Widen the legend SVG `viewBox="0 0 W H"`: bump `W` to `max(text_end_x) + 40`.
- Widen the `.legend` CSS `width` to `viewBox_W + 40` (padding allowance). The legend can be wider than tradition (~720–920 px) — even at 1200 px it tucks under a 1500 px diagram cleanly.
- If you genuinely cannot widen (the diagram itself is narrow and a 1200 px legend would visually dominate), shift the right-column elements left **and** shorten right-column labels. Both knobs together usually buy 200–300 px.

**Don't:** shrink the legend font to fit. Legend text is the key to interpreting every arrow in the diagram — its readability is the entire point of the legend block.

---

## Pre-screenshot checklist

Run through this before calling `scripts/screenshot.sh`:

- [ ] **Title present** and bold at top-center.
- [ ] **Every label readable** — not on top of a box, not on top of another label.
- [ ] **Arrow endpoints land on box edges**, not interiors.
- [ ] **All arrows are orthogonal** — only horizontal and vertical segments, 90° bends (exception per rule 25 explicitly documented).
- [ ] **Every final arrow segment is perpendicular** to the edge it touches.
- [ ] **Arrowheads uniform** — same marker shape, size, anchor across all colors.
- [ ] **No arrow crosses through a box** — routed through gaps, margins, or clear strips.
- [ ] **Multi-arrow sides are balanced** — at `1/(n+1)` intervals.
- [ ] **Legend present** and visually consistent with the main diagram.
- [ ] **Overall aspect ratio ≤ 1.5:1** (width:height), portrait-leaning.
- [ ] **Palette matches** the d2 source's color choices.
- [ ] **No module has a white fill** — every `.box` carries one of `.box.purple` / `.blue` / `.grey` / `.green` / `.orange` / `.teal`, with `.box.hub.<color>` on the hub — §15bis.
- [ ] **Arrow labels have a white halo** (`paint-order: stroke fill; stroke: white; stroke-width: 3px`) — §26.
- [ ] **No ≥ 3 parallel same-semantic arrows** remain between two module groups — §27.
- [ ] **No two arrows land on the same point** of any box edge — §28.
- [ ] **No arrow path crosses a `<text>` rectangle** without the halo-only exception logged — §29.
- [ ] **All `<text class="arrow-label">` declared after all `<path>`** inside the arrows SVG — §30.
- [ ] **Viewport height computed from the HTML** (diagram div height + title + legend + padding + safety margin) and passed to `screenshot.sh` — §31.
- [ ] **Post-screenshot PNG verified** — legend fully visible, no row clipped at the canvas bottom — §31.
- [ ] **Bus-lane spacing ≥ 14 px** between consecutive horizontal-arrow rows; **≥ 20 px** clearance from layer header above and box tops below — §32.
- [ ] **No two arrow-label bboxes overlap** — even when their underlying arrows don't cross — §33.
- [ ] **Legend `viewBox` width ≥ rightmost text end + 20 px**; in 2-column legends, left-column text does not reach the right-column source rect — §34.

If any box fails, iterate on the HTML before screenshotting — the cost of one more edit is trivially less than the cost of a rendered-then-revised PNG.

## TALA principles this skill intentionally does not apply

- **SQL table column matching (3.9).** Not relevant for module-level architecture diagrams.
- **Sequence shapes (3.10).** Not in the four canonical patterns; reintroduce only for pipeline-specific diagrams.
- **Grid edges (3.14).** We don't use `grid-columns` / `grid-rows` at the d2 level except in Patterns 1 and 3 where they pin layer structure — TALA handles the rest.

These sections of the manual are worth re-reading if a diagram doesn't fit the four canonical patterns and you need to extend.
