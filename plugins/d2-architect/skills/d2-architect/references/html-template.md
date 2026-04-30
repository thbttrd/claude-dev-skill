# HTML + SVG template for the polish phase

A reusable scaffold for reproducing a TALA first-pass PNG as a hand-coded HTML diagram. Lives at `assets/polish-template.html` — copy, fill in the placeholder sections for your specific diagram, serve via `scripts/serve.sh`, screenshot via `scripts/screenshot.sh` or the Playwright MCP tools.

## Anatomy

```
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{TITLE}}</title>
  <style>
    /* Stable: palette variables, box classes, arrow label classes, legend styles */
  </style>
</head>
<body>
  <h1>{{TITLE}}</h1>

  <div class="diagram" style="width: {{W}}px; height: {{H}}px;">
    <!-- Boxes (absolute-positioned divs) -->
    <div class="box {{COLOR}}" style="left: {{X}}px; top: {{Y}}px; width: {{W}}px; height: {{H}}px;">
      <div class="title">{{NAME}}</div>
      <div class="sub">{{SUBTITLE}}</div>
    </div>

    <!-- Arrow overlay (SVG) -->
    <svg class="arrows" viewBox="0 0 {{W}} {{H}}">
      <defs>
        <!-- Stable: marker definitions per arrow color -->
      </defs>
      <path d="M ... L ..." stroke="..." stroke-width="..." fill="none" marker-end="url(#h-...)"/>
      <text class="arrow-label" x="..." y="...">{{LABEL}}</text>
    </svg>
  </div>

  <div class="legend">
    <h2>Legend</h2>
    <svg viewBox="...">
      <!-- Legend entries: box + arrow + box + label per semantic -->
    </svg>
  </div>
</body>
</html>
```

## Filling in the template

1. **Copy** `assets/polish-template.html` to the caller's `output_dir` as `<basename>.html`.
2. **Read the TALA first-pass PNG** with the `Read` tool to "see" the layout.
3. **Extract coordinates** for each box: approximate `left` / `top` / `width` / `height`. Round to the nearest 10px.
4. **Write one `<div class="box ...">`** per box, with the right color class, coordinates, and label text.
5. **Write one `<path>`** per arrow, plus one `<text class="arrow-label">` if the arrow carries a label. Use `M x y L x y` for straight, `M x y C cx1 cy1 cx2 cy2 x y` for curves.
6. **Build the legend** at the bottom with the semantics actually present in this diagram.
7. **Serve** via `scripts/serve.sh` (defaults to port 8765).
8. **Screenshot** via `scripts/screenshot.sh http://localhost:8765/<basename>.html <basename>.png [width] [height]`.

## Coordinate extraction from a TALA PNG

When reading the first-pass PNG:

- Identify each distinct rectangle. Note its approximate **top-left corner** and **size**.
- Round coordinates to the nearest 10px — TALA's precision is higher than needed here.
- For **arrows**, identify source box, sink box, and any visible bend. Straight arrows just need endpoints. Curved arrows need 1–2 Bézier control points — estimate them as lying midway between source and sink, offset perpendicularly by the curve's "height".
- For **labels**, note the text and the approximate `(x, y)` of its center. Polish moves labels by ±10–20px to reach clear whitespace.

Target canvas width: 800–1000px. Height: whatever fits the rows with ~60px gaps. Aim for portrait ratio (height > width) or roughly square.

## Standard palette

Three-tier tint per category — see `references/patterns.md` → "Module color rule" for the rationale. **Module fills are NEVER pure white.**

| Role                  | Container fill | Module fill (light) | Hub fill (medium) | Stroke    | CSS class |
| --------------------- | -------------- | ------------------- | ----------------- | --------- | --------- |
| Composition root      | `#FAF5FF`      | `#F3E8FF`           | `#E9D5FF`         | `#9333EA` | `.purple` |
| Business Module       | `#EFF6FF`      | `#DBEAFE`           | `#BFDBFE`         | `#2563EB` | `.blue`   |
| External actor        | `#F9FAFB`      | `#E5E7EB`           | `#D1D5DB`         | `#6B7280` | `.grey`   |
| Infrastructure        | `#ECFDF5`      | `#D1FAE5`           | `#A7F3D0`         | `#16A34A` | `.green`  |
| Subprocess / async    | `#FFF7ED`      | `#FED7AA`           | `#FDBA74`         | `#EA580C` | `.orange` |
| Data store / File I/O | `#F0FDFA`      | `#CCFBF1`           | `#99F6E4`         | `#0F766E` | `.teal`   |

Mapping to CSS:

- `.layer.<color>` (lightest tint) → wraps a layer / column / group of related modules.
- `.box.<color>` (light tint) → default non-hub module.
- `.box.hub.<color>` (medium tint + 3 px stroke) → the hub module of its category.

Deviate only when the d2 source explicitly specifies other colors. The neutral grey container (`#F9FAFB` / `#737373` dashed border) is reserved for the **External I/O wrapper** in Pattern 3, where the inner resources keep their own brand colors.

## Standard arrow semantics

| Type                    | Stroke color       | Dash  | Label color   |
| ----------------------- | ------------------ | ----- | ------------- |
| Direct call             | `#6B7280` (grey)   | none  | grey italic   |
| Composition / ownership | `#9333EA` (purple) | none  | purple italic |
| Business use            | `#2563EB` (blue)   | none  | blue italic   |
| Implements / DI         | `#16A34A` (green)  | `6 4` | green italic  |
| Spawns subprocess       | `#EA580C` (orange) | none  | orange italic |
| File I/O                | `#0F766E` (teal)   | none  | teal italic   |
| Async / persistence     | `#6B7280` (grey)   | `5 3` | grey italic   |

Match these exactly to keep the legend symbolic vocabulary stable across diagrams.

## SVG marker definitions (stable, always include)

```xml
<defs>
  <marker id="h-grey"   viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#6B7280"/></marker>
  <marker id="h-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9333EA"/></marker>
  <marker id="h-blue"   viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2563EB"/></marker>
  <marker id="h-green"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#16A34A"/></marker>
  <marker id="h-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#EA580C"/></marker>
  <marker id="h-teal"   viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#0F766E"/></marker>
</defs>
```

## Example: tracing an arrow

TALA PNG shows: an arrow from `cli` (right side, approximately at y=262) to `Terminal` (left side, y=262), with label "injected listener" above.

HTML:

```html
<path
  d="M 250 262 L 350 262"
  stroke="#6B7280"
  stroke-width="1.7"
  fill="none"
  marker-end="url(#h-grey)"
/>
<text x="260" y="256" class="arrow-label">injected listener</text>
```

## Arrow path shapes (orthogonal by default)

Phase B preserves TALA's orthogonal (elbow) routing — every arrow uses only horizontal and vertical segments joined by 90° bends, and every endpoint is perpendicular to the box edge it touches. Curved Béziers are reserved for the explicit exceptions noted in `polish-rules.md` §25.

### Straight segment (zero bends)

Two perfectly aligned boxes. The cleanest shape — use whenever columns or rows line up.

```html
<!-- Vertical: exits (centerX, bottom) of source, enters (centerX, top) of target. -->
<path
  d="M 400 300 L 400 420"
  stroke="#2563EB"
  stroke-width="2"
  fill="none"
  marker-end="url(#h-blue)"
/>

<!-- Horizontal: exits (right, centerY) of source, enters (left, centerY) of target. -->
<path
  d="M 720 500 L 960 500"
  stroke="#6B7280"
  stroke-width="1.8"
  fill="none"
  stroke-dasharray="5 3"
  marker-end="url(#h-grey)"
/>
```

### L-shape (two 90° bends)

Exit along one axis, turn once, enter along the other axis. Use for arrows that route around intermediate content — e.g. a consolidated "IM layer → storage" arrow that drops down the canvas margin past the BM layer.

```html
<!-- Down the left margin: exit box on left edge, step outward, drop down, step in. -->
<!--     (x1,y1) source-left           step outward (xBus)                -->
<!--         ├────────────────┐                                           -->
<!--         │                │  bus lane just inside canvas edge         -->
<!--         │                │                                           -->
<!--         │                │                                           -->
<!--         │                └────────────────┤                          -->
<!--                          step in           (x2,y2) target-left       -->
<path
  d="M 60 735 L 18 735 L 18 1240 L 78 1240"
  stroke="#0F766E"
  stroke-width="2.4"
  fill="none"
  marker-end="url(#h-teal)"
/>
```

The path has exactly four points: source-edge, outward elbow, downward elbow, target-edge. The `marker-end` fires on the last segment, so the arrowhead points in the direction of that final segment (here, rightward, perpendicular to the target's left edge).

### Bracket / manifold (one source → multiple targets)

A shared backbone with no arrowhead, plus one short drop per target. Each drop carries its own `marker-end`. Use for "one BM reads several repos" / "one IM publishes to multiple sinks" patterns.

```html
<!-- Backbone: source → up → across (no arrowhead). -->
<path
  d="M 1050 665 L 1050 650 L 385 650"
  stroke="#6B7280"
  stroke-width="1.8"
  fill="none"
  stroke-dasharray="5 3"
/>
<!-- Drop 1: short vertical into target 1 top-center. -->
<path
  d="M 610 650 L 610 663"
  stroke="#6B7280"
  stroke-width="1.8"
  fill="none"
  stroke-dasharray="5 3"
  marker-end="url(#h-grey)"
/>
<!-- Drop 2: short vertical into target 2 top-center. -->
<path
  d="M 385 650 L 385 663"
  stroke="#6B7280"
  stroke-width="1.8"
  fill="none"
  stroke-dasharray="5 3"
  marker-end="url(#h-grey)"
/>
```

When multiple drops would overlap on the same Y (because source and both targets are in the same row), use **two parallel L-shapes at different Y levels** instead of a shared backbone — the staggering keeps the paths disentangled.

### Side-margin rotated labels

A long label that would overflow the 20–40px canvas margin next to a vertical arrow segment. Rotate it 90° CCW so it reads bottom-to-top.

```html
<!-- Label sits 5–8px left of the vertical segment at x=18, rotated around its own anchor. -->
<text
  x="13"
  y="1080"
  class="arrow-label teal"
  transform="rotate(-90 13 1080)"
  text-anchor="middle"
  >all IMs · read / write · prepared statements</text
>
```

Keep horizontal labels for short mid-arrow annotations ("calls", "delegates", "reads repos") placed in the clear strip between two layers.

### When to fall back to curves

Only when: (a) an L-shape would land a label on top of a box and the label can't be moved, or (b) the diagram is portraying a smoothly-flowing lifecycle edge amid an otherwise orthogonal core. Never mix curves and orthogonals for the _same semantic_ — if cross-BM reads are L-shapes, all cross-BM reads are L-shapes.

Curved fallback form:

```html
<path
  d="M x1 y1 C cx1 cy1 cx2 cy2 x2 y2"
  stroke="..."
  stroke-width="..."
  fill="none"
  marker-end="url(#h-...)"
/>
```

## Worked examples

- `/tmp/claude-sddw-detailed-rebuild/architecture-detailed.html` — full 11-node layered MIM AA diagram (4 patterns combined). Good reference for dense diagrams with multiple arrow types.
- `/tmp/claude-sddw-rebuild/architecture.html` — simpler Pattern 4 tree (to be created on first re-run of the high-level case).

Adapt these rather than starting from scratch.
