# d2 Syntax Cheat Sheet

Focused on what architecture diagrams need. Full docs: https://d2lang.com/

## Shapes

```d2
# Plain rectangle (default)
server: Web Server

# Typed shape
db: User DB {
  shape: cylinder
}
```

**Built-in shape types** (verified on d2 0.7):
`rectangle` (default) · `square` · `circle` · `ellipse` · `oval` · `diamond` ·
`cylinder` · `hexagon` · `cloud` · `person` · `document` · `package` · `step` ·
`callout` · `queue` · `stored_data` · `page` · `parallelogram` · `sql_table` ·
`class` · `code` · `text` · `image`

Most useful for architecture: `cylinder`, `queue`, `stored_data`, `cloud`, `person`, `hexagon`, `document`.

## Connections

```d2
a -> b                   # arrow A to B
a <- b                   # arrow B to A
a <-> b                  # bidirectional
a -- b                   # plain line, no arrow
a -> b: "reads from"     # labeled
a -> b: {                # styled
  style.stroke: "#2563EB"
  style.stroke-dash: 3
  style.stroke-width: 2
}
```

Use `.` to target nested shapes: `ui.button -> backend.api`.

## Containers (grouping)

```d2
# Inline nesting
backend.api: API
backend.db: Database

# Block syntax — preferred when a container has 2+ children
backend: Backend {
  api: API
  db: Database {
    shape: cylinder
  }
  api -> db: query
}

# Containers nest
aws: AWS Cloud {
  vpc: VPC {
    ec2: EC2
    rds: RDS { shape: cylinder }
    ec2 -> rds
  }
}
```

## Icons

```d2
# Attach an icon to a labeled shape — appears as a badge
lambda: Auth {
  icon: /Users/thibauttroude/.claude/skills/d2-architect/assets/icons/aws/lambda.svg
}

# Icon as the entire shape (no label)
logo: {
  shape: image
  icon: /path/to/logo.svg
}
```

Local absolute paths work. Relative paths resolve from the `.d2` file's directory. Remote URLs work but d2 aborts the whole compile if any URL returns non-200 — prefer local paths.

## Labels

```d2
# Single line
api: API Gateway

# Multi-line markdown label — an EMPTY LINE forces a paragraph break
api: |md
  **API Gateway**

  Public HTTPS endpoint
|

# Labels with special chars must be quoted
order: "Order Flow (v2)"
```

**Gotcha — markdown labels suppress the default rectangle shape.** A shape with a `|md ... |` label renders as a borderless text block unless you explicitly set `shape: rectangle`. If you want the multi-line markdown label AND a visible box with fill/stroke, always add `shape: rectangle`:

```d2
m001: |md
  **M-001**

  Import Engine
| {
  shape: rectangle
  style.fill: "#FFFFFF"
  style.stroke: "#EA580C"
  style.stroke-width: 2
  style.border-radius: 4
}
```

Plain quoted labels render as a box by default; markdown labels do not. This is a frequent source of invisible-module bugs.

Also note: a single `\n` inside a markdown label is **not** a visual line break — you must use a blank line between paragraphs for d2 to render them on separate visual lines.

**Gotcha — markdown list markers.** A line inside a `|md` label that starts with `+ `, `- `, or `* ` (a space after the marker) renders as a bullet point. That's standard markdown, but it trips people up when a module label says something like `+ rehype-highlight` or `- async`. Workarounds:

- Replace with a plain word: `with rehype-highlight`.
- Use the middle-dot separator (no list semantics): `· rehype-highlight`.
- Escape with a backslash: `\+ rehype-highlight` — works on most markdown renderers but test on your d2 version first.

```d2
# Renders as a bullet (probably not what you want):
m1: |md
  **react-markdown**

  + rehype-highlight
|

# Renders as a second paragraph of plain text:
m1: |md
  **react-markdown**

  with rehype-highlight
|
```

## Styles

```d2
svc: Service {
  style: {
    fill: "#E8F4FD"
    stroke: "#2563EB"
    stroke-width: 2
    stroke-dash: 3          # dashed border = external / boundary
    border-radius: 8
    font-color: "#1E3A8A"
    shadow: true
    bold: true
  }
}
```

Connections style identically via `style.*` on the connection block.

## Direction and layout

```d2
direction: right        # L → R (default for flow architectures)
direction: down         # top-down
direction: up
direction: left
```

Direction is scoped — containers can override the parent direction:

```d2
outer: {
  direction: right       # columns left-to-right
  col_a: { direction: down; a1; a2 }   # col_a stacks a1 above a2
  col_b: { direction: down; b1; b2 }
}
```

Layout engine is chosen at the CLI:

```bash
d2 --layout=dagre src.d2 out.png   # flat graphs, respects declaration order — prefer for Pattern 1
d2 --layout=elk   src.d2 out.png   # deeply nested containers — prefer for Pattern 2
# tala is commercial, not installed — don't use
```

## Positioning (title, legend, floating nodes)

The `near:` keyword positions a shape at a fixed spot relative to the whole diagram — useful for titles, legends, and notes that shouldn't be laid out by the engine.

```d2
title: "My Diagram" {
  shape: text
  near: top-center
  style.font-size: 40
  style.bold: true
}

legend: Legend {
  near: bottom-right
  # …contents…
}
```

Valid values: `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

You can also anchor one shape near another: `helper.near: main_node`.

## Grid positioning

Force a specific column/row count on a container's children with `grid-columns` or `grid-rows`:

```d2
columns: {
  grid-columns: 3         # 3 equal columns
  col_a: { direction: down; a1; a2 }
  col_b: { direction: down; b1; b2 }   # this one is in the middle
  col_c: { direction: down; c1; c2 }
}
```

**Gotcha**: apply grid-* to **one** wrapper only. Using `grid-rows: 2` on every top-level container causes the layout engine to flip the whole diagram horizontal (observed in v1.0.0). Use a single grid wrapper around the groups that should share structure.

## Themes (CLI flag `--theme=N`)

Common picks for architecture diagrams:

| ID | Name | Use when |
|---|---|---|
| `0` | Default neutral | Recommended default — clean, professional |
| `3` | Earth tones | Warmer palette |
| `4` | Mixed soft | Slightly more colorful |
| `100` | Terrastruct flagship | Bolder, more distinct module types |
| `200` | Dark mauve | Dark-mode diagrams |

## Useful patterns

**External / 3rd-party services:**
```d2
stripe: Stripe {
  shape: cloud
  style.stroke-dash: 3
}
```

**Deployment boundary:**
```d2
aws: AWS Production {
  style.fill: "#FFF8E1"
  api: API
  db: DB { shape: cylinder }
}
```

**Typed arrows:**
```d2
client -> api: "HTTPS"
api -> db: "SQL"
api -> queue: "publish" {
  style.stroke-dash: 3     # async
}
```

## Gotchas

- **Labels with `()`, `:`, or `.`** must be double-quoted.
- **IDs can't start with a digit** — use `v1svc`, not `1svc`.
- **Reserved keywords as identifiers fail inside edges.** `left`, `right`, `middle`, `up`, `down`, and `center` are d2 keywords (used as values for `direction:` and `near:`). A container named `left` *declares* fine, but the moment any edge references it — `a -> lanes.left.foo` — the compile fails with `reserved keywords are prohibited in edges`. Use semantic names (`workflow_lane`, not `left`; `pipeline_lane`, not `middle`).
- **`shape: person` renders as a cloud blob** in theme 0, not a stick figure. For actor nodes (users, developers, external systems), prefer `shape: rectangle` with a neutral grey fill (`#E5E7EB`) and rounded corners (`style.border-radius: 8`) — reads clearly as an "external party" and matches hand-drawn conventions.
- **A container with only one child** lays out awkwardly — merge it or add a sibling.
- **d2 aborts on any remote icon 403** — prefer the local catalog.
- **`shape: image` replaces the label**; to keep the label, use plain `icon:` on a labeled shape instead.
- **Arrow labels stack** — if you have many parallel arrows between two nodes, only label the important ones.
