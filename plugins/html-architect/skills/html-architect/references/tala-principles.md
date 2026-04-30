# TALA layout principles for hand-placed HTML diagrams

Distilled from the [TALA User Manual v0.4.1](https://github.com/terrastruct/TALA), sections 3 (Considerations for software architecture) and 6 (Tips). These are the heuristics that make TALA's layouts look hand-drawn — you're going to apply them yourself in the HTML instead of letting TALA do it.

Every principle below includes **what TALA does**, **why it matters**, and **how to translate it into HTML coordinates**. Read the "how" columns as a checklist while you place each box.

## Table of contents

1. [Symmetry](#1-symmetry) — mirror siblings around their shared neighbor
2. [Clusters](#2-clusters) — siblings stay on one side
3. [Hierarchy](#3-hierarchy) — same-direction chains use even spacing
4. [Balanced connection ports](#4-balanced-connection-ports) — endpoints at 1/(n+1)
5. [Dynamic label positioning](#5-dynamic-label-positioning) — labels go where boxes aren't
6. [Square-ish aspect ratio](#6-square-ish-aspect-ratio) — bin-pack toward square (or portrait, for our use case)
7. [Direction per container](#7-direction-per-container) — sub-flows can differ from top-level
8. [Custom dimensions](#8-custom-dimensions) — the hub gets more space
9. [Label collisions](#9-label-collisions) — break long labels with line breaks
10. [Legends](#10-legends) — build from positions + dimensions
11. [Perpendicular port entries and exits](#11-perpendicular-port-entries-and-exits) — arrows exit and arrive at 90° to the edge they touch
12. [Pre-screenshot checklist](#pre-screenshot-checklist)

---

## 1. Symmetry

**TALA does:** positions shapes symmetrically even at the cost of slightly longer edges. A triangle of `a → b, b → c, b → d` is drawn with `c` and `d` as mirror siblings under `b`, not with `c` squeezed left and `d` stretched right.

**Why:** the eye recognizes symmetry faster than any other structural cue. Asymmetric layouts feel cluttered even when they're actually compact.

**How in HTML:**
- When two modules have the same role (both sink into the same hub, or both source from the same root), place them at mirrored x-coordinates around the shared neighbor's centerline. Example: hub at `x=450`, siblings at `x=300` and `x=600` (both offset 150px).
- Keep their `y` equal unless hierarchy dictates otherwise.
- Don't collapse symmetric pairs to save horizontal space. Width is cheap; readability is not.

## 2. Clusters

**TALA does:** when multiple shapes connect to the same parent, places them all on the same side of the parent. `a → x, b → x, c → x` puts `a`, `b`, `c` all above (or all to the left of) `x`, never split across sides.

**Why:** readers scan a cluster as one chunk. Splitting it across the parent makes the reader re-scan to find the cluster members.

**How in HTML:**
- Identify each parent's incoming-edge sources. If there are ≥2, put them all on one side.
- Their `y` (for vertical parent) or `x` (for horizontal parent) should be within a tight band.
- Spread them along the perpendicular axis with even gaps: if 3 siblings, gap = (band_width) / 4 so they're evenly spaced.
- Example: store modules all above their business-module parent, sharing y=120, with x's at 150/350/550/750.

## 3. Hierarchy

**TALA does:** when multiple shapes form a chain of connections all pointing the same direction, arranges them as layers with **even vertical spacing between layers**. A chain `a → b → c → d` becomes four rows at consistent y.

**Why:** hierarchical structure is the single most common thing architecture diagrams depict. Uneven row heights destroy it.

**How in HTML:**
- Count the number of hierarchical tiers (layers). Set a canvas height that divides evenly: `H = padding_top + (N-1) * row_gap + N * box_height + padding_bottom`.
- Fix `row_gap` first (80–100px is typical) and compute the y of each layer: `y_n = padding_top + n * (row_gap + box_height)`.
- All boxes in one tier share the same `top`. Resist the temptation to nudge them to save space.
- Works even better when combined with container groups (Pattern 3 — Layered MIM AA).

## 4. Balanced connection ports

**TALA does:** when multiple arrows connect the same two boxes, spaces the endpoints at `1/(n+1)` intervals along the shared edge. Two arrows land at 1/3 and 2/3 of the edge; three arrows at 1/4, 2/4, 3/4; five at 1/6, 2/6, ..., 5/6.

**Why:** clumped endpoints look like one thick arrow. Spaced endpoints let the eye count the connections.

**How in HTML:**
- For each pair of boxes, count the number of arrows `n` between them.
- The shared edge length is one of: box.width (top/bottom) or box.height (left/right).
- Endpoint `k` (1-indexed) lands at `edge_start + k * edge_length / (n + 1)`.
- Example: `a` (w=200, at x=100) has 3 arrows going down to `b`. They exit `a` at `(150, bottom)`, `(200, bottom)`, `(250, bottom)` — i.e., `a.x + [50, 100, 150]` for `n=3`.

## 5. Dynamic label positioning

**TALA does:** positions each label in whatever whitespace is closest to its arrow without colliding with another shape or another label. Labels go to top-left, top-right, bottom-left, etc. depending on free space.

**Why:** a label that overlaps a box or another label is nearly unreadable and ruins the diagram.

**How in HTML:**
- Compute each arrow's midpoint: `(x_mid, y_mid) = ((x1+x2)/2, (y1+y2)/2)`.
- Default label offset: 10–15px above the midpoint for horizontal-ish arrows, 10–15px to the right for vertical-ish arrows.
- If the default offset would overlap a box or another label, move it to the opposite side.
- If both sides are occupied, shift along the arrow toward the closer endpoint where there's more space.
- As a last resort, break the label with a line break (see §9) and rotate placement 90°.

### Rendering order + white-halo masking (enforced by the template)

Positioning labels in whitespace is the first line of defense. The template adds two more:

1. **SVG document order.** Inside `<svg class="arrows">`, render **all `<path>` arrows FIRST**, then **all `<text>` labels LAST**. SVG paints in document order, so labels end up on top of every arrow — not just their own. Without this ordering, a label correctly placed above arrow A can still be painted over by arrow B that happens to be declared later in the SVG.

2. **White-halo paint-order.** The template's `.arrow-label` class sets `paint-order: stroke fill` with a 3 px white stroke. The stroke paints *behind* the fill, producing a readable mask — so even if a label sits within a few pixels of an arrow line, a tier border, or a container edge, the line appears "broken" around the text instead of running through it.

**These two mechanics do NOT excuse poor placement.** Labels should still live in whitespace 10–15 px from anything else. The halo handles the near-miss cases (arrow clearances of 2–6 px); it does not make a label placed directly on top of a box readable. If a label would overlap a box interior, re-route it — don't rely on the halo.

## 6. Square-ish aspect ratio

**TALA does:** bin-packs non-connected subgraphs to approach a square (~1:1) shape overall.

**Why:** wide-sprawling diagrams don't fit on a page. Tall-skinny ones waste horizontal space. Square-ish is the sweet spot.

**How in HTML — with a twist for this user:**
- Target **height ≥ width** (vertical-leaning). Architecture diagrams embed into A4 / letter pages in portrait orientation — width that exceeds the page margin becomes illegible when scaled.
- Ratio `height : width` in `[1.0, 1.4]` is the goal.
- Never wider than 1.3× the height.
- If the natural layout is wider than tall, **rotate the flow direction** (make it top-to-bottom instead of left-to-right) or break a single row into two rows stacked.

## 7. Direction per container

**TALA does:** lets each container specify its own flow direction (`down`, `right`, `up`, `left`), independent of the top-level direction.

**Why:** the top-level flow is usually top-to-bottom, but a row of peer modules inside a container reads better left-to-right.

**How in HTML:**
- Top-level flow: default `down`. Each row of peer containers flows down to the next row.
- Within a container (e.g., a PRESENTATION group with 4 sub-modules in a row), flow `right` — sub-modules share a `y`, differ only in `x`.
- Within a tree-shaped container (e.g., a Business-Module with internal app/domain/infra layers), flow `down` as usual.
- Use arrow directions (`from → to` on the SVG paths) to reinforce the flow: arrows point the direction of the local flow.

## 8. Custom dimensions — the hub gets more space

**TALA does (§6.1):** lets you set per-shape `width` and `height`. TALA doesn't know which shape is a hub unless you tell it.

**Why:** a hub that looks like its peers is easy to overlook. A slightly larger hub is a structural hint.

**How in HTML:**
- Identify the hub: highest connection count (in + out degree).
- Give it one of: **thicker border** (`.box.hub` class adds 3px vs 2px), **larger footprint** (220×90 vs 160×70), or **darker fill** (deeper tint of its palette color).
- All three together is often too much — pick one or two.
- Alternatively, put the hub in bold centerpiece position (exact canvas center) and leave the visual tweak subtle.
- Also useful: give crowded boxes extra width so their edge ports can spread (TALA §3.12 — port space).

## 9. Label collisions — break long labels

**TALA does (§6.2):** labels avoid each other dynamically, but TALA won't grow the layout to fit an oversized label. For long labels, you manually break into multiple lines with `\n`.

**Why:** a 10-word label stretches a box's natural width beyond what the layout can accommodate. Wrapping it keeps the box compact.

**How in HTML:**
- For box titles: if the name is >20 characters, split across `<div class="title">` + `<div class="sub">`.
- For arrow labels: use `<tspan x="..." dy="14">...</tspan>` inside the `<text>` to wrap. Keep each line ≤20 chars.
- For container headers (group titles): place the title at the top-left of the container (not centered), keep it short ("BUSINESS MODULES — Zero I/O", not "BUSINESS MODULES — Pure TypeScript, Framework-Agnostic Logic").

## 11. Perpendicular port entries and exits

**The rule (both ends, always):** the arrow's **first** and **last** tangents must be perpendicular to the box edge they touch. The triangle marker at the arrow's tip must have its **base parallel to the target edge** — i.e., the triangle should point *straight into* the shape, not graze along it.

**Why:** an arrow that arrives tangent to an edge looks like a cable sliding off, not a signal entering the port. Readers briefly wonder "which box does this arrow actually end at?" and double-count arrival ports. Perpendicular entries remove that ambiguity and produce the clean "cable-tray" look of a well-routed schematic.

Equally important: **perpendicular exits.** A curve that leaves the box heading sideways (tangent to the bottom edge) looks like the source box is *emitting* the arrow along its surface rather than from inside. Exit straight out, then curve.

### How to achieve it in a cubic Bézier

A cubic Bézier `M x0 y0 C cx1 cy1, cx2 cy2, x1 y1` has:
- **Start tangent** = direction from `(x0, y0)` to `(cx1, cy1)` — controlled by where `cp1` sits relative to the start.
- **End tangent** = direction from `(cx2, cy2)` to `(x1, y1)` — controlled by where `cp2` sits relative to the end.

To force a tangent perpendicular to a box edge, put the corresponding control point **on a line perpendicular to that edge, offset from the endpoint**:

| Box edge touched | Perpendicular direction | Control-point placement |
|---|---|---|
| **Top** (arrow arriving from above, y decreasing into the box) | vertical | `cp` at `(endpoint.x, endpoint.y - k)` for some `k > 0` |
| **Bottom** (arrow exiting downward, y increasing away from the box) | vertical | `cp` at `(endpoint.x, endpoint.y + k)` for some `k > 0` |
| **Left** (arrow arriving from the left, x increasing into the box) | horizontal | `cp` at `(endpoint.x - k, endpoint.y)` |
| **Right** (arrow exiting rightward) | horizontal | `cp` at `(endpoint.x + k, endpoint.y)` |

Pick `k` between 30 and 80 px. Too small and the tangent is barely constrained before the curve bends; too large and the curve overshoots. 50 px is a reliable default.

### Example — an arrow from a box's bottom edge curving right to land on a target's top edge

Source bottom edge at `(x=605, y=595)`. Target top edge at `(x=524, y=828)`.

Wrong (tangent exit, tangent entry):
```html
<path d="M 605 595 C 710 700, 680 800, 524 828" ... />
```
- Start tangent: `(710-605, 700-595) = (105, 105)` — 45° diagonal, NOT perpendicular.
- End tangent: `(524-680, 828-800) = (-156, 28)` — shallow, NOT perpendicular.

Right (perpendicular exit, perpendicular entry):
```html
<path d="M 605 595 C 605 650, 700 650, 700 700 L 700 770 C 700 805, 524 805, 524 828" ... />
```
- Start: `cp1 = (605, 650)` directly below start → tangent `(0, 55)` = straight down. ✓
- End: `cp2 = (524, 805)` directly above end → tangent `(0, 23)` = straight down. ✓
- Two cubics joined by a straight `L` segment — the vertical bus — which preserves the downward tangent through the join.

### When you can't get perpendicular with a single cubic

If the source and target are far apart in BOTH axes and you need to route around an obstacle, a single cubic can't satisfy "perpendicular at both ends" AND "avoid the obstacle". Use a **compound path**: chain multiple `C` (and/or `L`) segments, with each segment perpendicular-constrained at the critical endpoint. The example above does this — seg1 exits perpendicular, an `L` carries the tangent through the middle, seg2 arrives perpendicular.

### Smooth joins between segments

When chaining segments, keep the tangent **direction** continuous across the join (the magnitude can differ). That means: `cp2` of segment `N` and `cp1` of segment `N+1` should lie on the same ray from the shared endpoint. Otherwise the join looks like a kink.

For the common case of vertical-then-horizontal routing through an `L` segment (the "cable bundle" pattern), there is no kink because the straight line has constant tangent — as long as both adjacent cubics terminate with vertical tangents, the `L` in between inherits it automatically.

### Always add a short straight `L` terminator at the arrival

Even with a perpendicular analytic tangent, a cubic Bézier still has micro-curvature in its last few pixels. At stroke widths of 1–2 px that asymmetry is enough to make the path visibly enter the triangle slightly off-center from the base midpoint — the tip-of-line hits the slanted side of the triangle, not the middle of the back edge.

**Rule.** End every arrow with a short straight segment (~8 px) along the final tangent direction:

```html
<!-- Wrong: cubic all the way to the edge -->
<path d="M ... C ... 576 810, 576 828" marker-end="..."/>

<!-- Right: cubic ends ~8 px before the edge, then L to the edge -->
<path d="M ... C ... 576 810, 576 820 L 576 828" marker-end="..."/>
```

The `L` segment is exactly perpendicular to the target edge, the marker rotates to align with it, and the triangle's base sits squarely on the edge with the path line striking dead-center. This is the same trick the persist-arrow paths use; apply it to every arrow, including the short in-tier ones.

## 10. Legends — build from positions + dimensions

**TALA does (§6.3):** suggests building legends manually from small positioned shapes + text.

**Why:** a legend is just a micro-diagram. Using the same visual vocabulary (same arrow markers, same box styles) teaches the reader how to read the main diagram.

**How in HTML:**
- Place the legend below the main diagram as a bordered `.legend` block (see `assets/template.html`).
- Each entry: `[source-box-icon] [arrow with marker] [target-box-icon] [text label]` OR `[colored line segment with marker] [text label]`.
- Match stroke color, stroke dasharray, marker color exactly to the main diagram's arrows.
- 2-column grid (or 1-column if narrow) of entries. Keep it tight — the legend should not dominate the composition.

---

## Pre-screenshot checklist

Run through this before calling `scripts/screenshot.sh`:

- [ ] **Title** present, bold, centered at top of the page.
- [ ] **Every label readable** — not on top of a box, not on top of another label.
- [ ] **Hub** is visually central — horizontal center of the canvas, preferably the vertical center too.
- [ ] **Arrow endpoints land on box edges**, not box interiors. Snap to `(box.left + box.width, y)` / `(box.left, y)` / `(x, box.top + box.height)` / `(x, box.top)`.
- [ ] **No arrow passes through a box** — curve around, don't cross.
- [ ] **Multi-arrow sides** have endpoints spaced at `1/(n+1)` intervals.
- [ ] **Both ends perpendicular.** Every arrow's first and last tangent is perpendicular to the edge it touches. No arrow arrives or departs tangent-to-edge — each triangle tip points *straight into* its target box, with the triangle base parallel to the edge. See §11.
- [ ] **Labels render after paths.** In every `<svg class="arrows">`, every `<path>` comes first; every `<text class="arrow-label">` comes last. Labels sit on top of all arrows, and the template's white halo masks any line passing beneath. See §5 → "Rendering order + white-halo masking".
- [ ] **Arrowheads uniform** — same `<marker>` shape and size; only color changes per semantic.
- [ ] **Dash patterns consistent**: `6 4` for DI / implements, `5 3` for async / persistence. Don't mix other patterns.
- [ ] **Legend present** if there's more than one arrow style or color. Uses real mini-arrows, not text descriptions.
- [ ] **Aspect ratio**: `height ≥ width` or at most 1.3× wider than tall.
- [ ] **Palette matches** `references/palette.md` unless deviation is deliberate.
- [ ] **Colors used by semantic**, not by source group. Arrows from multiple sources that all represent "direct call" should all be grey.

If any check fails, fix the HTML before screenshotting. One more edit is cheap; re-screenshotting and re-reviewing a PNG is not.

---

## TALA principles intentionally NOT applied by this skill

- **Self-connections (§3.11)** — self-loops. We don't support them; break the loop into two named edges if needed.
- **Sequence/step shapes (§3.10)** — chevron-tail shapes. Not part of the 4 canonical architecture patterns.
- **SQL table column matching (§3.9)** — ERD routing. Not an architecture-diagram concern.
- **Grid edges (§3.14)** — grid-specific edge routing. We render everything with absolute positioning + inline SVG instead.

Worth re-reading the manual if a diagram doesn't fit the four canonical patterns and you need to extend.
