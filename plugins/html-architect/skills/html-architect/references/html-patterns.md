# HTML layout patterns

Four canonical layout patterns expressed as HTML box-coordinate templates. **Adapt one — don't start from a blank canvas.**

Each pattern is a starting shape; actual coordinates depend on module count and label length. The coordinate sketches below use a 900×800 canvas — scale proportionally for your diagram.

## Selection heuristic

Name the shape in your head before you pick:

- **"2–4 thematic columns at the same abstraction level"** → Pattern 1 — Peer groups.
- **"BMs each have rich internal structure (app/domain/infra)"** → Pattern 2 — Nested BMs.
- **"Stacked layers — presentation on top, externals at the bottom"** → Pattern 3 — Layered MIM AA.
- **"One actor / CLI / entry point fans out"** → Pattern 4 — Root-driven tree.

If the shape is none of these, either compose two patterns (e.g., Pattern 3 with a Pattern 4 sub-tree in the BUSINESS layer) or write your own layout from first principles using `tala-principles.md`.

---

## Pattern 1 — Peer groups

2–4 thematic columns of modules at the same abstraction level. Each column is a container; cross-column arrows land on individual modules.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  AUTH       │  │  CATALOG    │  │  PAYMENTS   │
│  ┌────────┐ │  │  ┌────────┐ │  │  ┌────────┐ │
│  │ login  │ │  │  │products│ │  │  │ stripe │ │
│  └────────┘ │  │  └────────┘ │  │  └────────┘ │
│  ┌────────┐ │  │  ┌────────┐ │  │  ┌────────┐ │
│  │ jwt    │ │  │  │ cart   │ │  │  │ paypal │ │
│  └────────┘ │  │  └────────┘ │  │  └────────┘ │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Canvas and coordinates

- Canvas: `width: 900, height: 700`.
- 3 columns at `x = [60, 330, 600]`, each `width = 240`.
- Column title at `y = 40`, inline modules starting at `y = 80` with 90px row spacing.
- Between-column gap: 30px (inside the 900 canvas this leaves some margin).

### HTML skeleton

```html
<div class="diagram" style="width: 900px; height: 700px;">
  <!-- Column A -->
  <div class="container purple" style="left:60px; top:20px; width:240px; height:500px;">
    <div class="container-title">AUTH</div>
  </div>
  <div class="box purple" style="left:80px; top:80px; width:200px; height:60px;">
    <div class="title">login</div>
  </div>
  <div class="box purple" style="left:80px; top:170px; width:200px; height:60px;">
    <div class="title">jwt</div>
  </div>

  <!-- Column B -->
  <div class="container blue" style="left:330px; top:20px; width:240px; height:500px;">
    <div class="container-title">CATALOG</div>
  </div>
  <!-- ... etc -->
</div>
```

### TALA principles at play

- **Peer symmetry** — columns are equal-width, equal-start-y.
- **Cluster on one side** — each column's modules stay within its column; no BM lives across columns.
- **Direction per container** — flow `down` inside each column.

---

## Pattern 2 — Nested BMs

Business-Modules as containers with internal app/domain/infra children. Cross-module arrows touch the outer container, not internal sub-boxes.

```
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ BM-import                     │  │ BM-card-library               │
│  ┌────────┐  ┌────────┐       │  │  ┌────────┐  ┌────────┐       │
│  │ parser │→ │validator│      │  │  │ model  │→ │ crud   │      │
│  └────────┘  └────────┘       │  │  └────────┘  └────────┘       │
│                               │  │                               │
│              ┌────────────┐   │  │              ┌────────────┐   │
│              │ orchestrator│  │  │              │ query-api  │   │
│              └────────────┘   │  │              └────────────┘   │
└───────────────────────────────┘  └───────────────────────────────┘
           │                                  ▲
           └──── replaceAll() ────────────────┘
```

### Canvas and coordinates

- Canvas: `width: 1100, height: 700` (wider-than-tall — only use when forced; normally split into two rows).
- Each BM container: `width: 420, height: 280`.
- Internal sub-boxes: `width: 160, height: 60` at 30px side-padding.
- Cross-BM arrows touch the outer container's edge only.

### When to use

Only when each BM has genuinely different internal structure worth showing. If you'd just draw "parser/validator/crud/query-api" inside each BM regardless of what the BM does, use Pattern 3 instead and drop the internals.

### TALA principles at play

- **Direction per container** — outer flow is horizontal (or vertical if stacking), inner flow is left-to-right within each BM.
- **Cluster** — each BM's internal sub-boxes cluster tightly; the outer edges are the port sites for cross-BM arrows.

---

## Pattern 3 — Layered MIM AA

Horizontal tiers stacked top-to-bottom. Each tier is a container spanning the full canvas width. Modules live inside tiers. This is the default for frontend-heavy apps (V0 and early versions).

```
┌──────────────────────────────────────────────────────────┐
│ PRESENTATION — Next.js App Router + React                │
│  ┌─────────┐  ┌───────────┐  ┌───────┐  ┌────────────┐   │
│  │ routes  │  │components │  │ hooks │  │react-markdown│ │
│  └─────────┘  └───────────┘  └───────┘  └────────────┘   │
└──────────────────────────────────────────────────────────┘
                          │ subscribes to ↓
┌──────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE — Zustand Stores + Persist                │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌────────┐  │
│  │store-A│  │store-B│  │store-C│  │store-D│  │store-E │  │
│  └───────┘  └───────┘  └───────┘  └───────┘  └────────┘  │
└──────────────────────────────────────────────────────────┘
                          │ calls ↓
┌──────────────────────────────────────────────────────────┐
│ BUSINESS MODULES — Pure TypeScript, Zero I/O             │
│                                                          │
│   ┌───────┐          ┌───────┐          ┌───────┐        │
│   │ BM-A  │    ←→    │ HUB   │    ←→    │ BM-C  │        │
│   └───────┘          └───────┘          └───────┘        │
│                         ↑  ↓                             │
│                  ┌───────┐  ┌───────┐                    │
│                  │ BM-D  │  │ BM-E  │                    │
│                  └───────┘  └───────┘                    │
└──────────────────────────────────────────────────────────┘
                          │ reads files / persists ↓
┌──────────────────────────────────────────────────────────┐
│ EXTERNAL SYSTEMS                                         │
│   ┌──────────────┐         ┌─────────────────────────┐   │
│   │ FS Access API│         │    localStorage          │   │
│   └──────────────┘         └─────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Canvas and coordinates (default)

- Canvas: `width: 1100, height: 900`. Portrait-leaning by stacking 4 tiers.
- Tier 1 (Presentation): `top=40, height=130`.
- Tier 2 (Infrastructure): `top=200, height=130`.
- Tier 3 (Business Modules): `top=360, height=380` — the tallest, because the hub sits here with its peers.
- Tier 4 (External Systems): `top=770, height=100`.
- Tier label at `top: <tier-top> + 8`, left: `<tier-left> + 12`, left-aligned (so it doesn't fight boxes).
- Inter-tier gap: 30px. Inside-tier padding: 20–40px.

### HTML skeleton

```html
<div class="diagram" style="width: 1100px; height: 900px;">
  <!-- Tier 1: Presentation -->
  <div class="container purple" style="left:40px; top:40px; width:1020px; height:130px;">
    <div class="container-title">PRESENTATION — Next.js App Router + React</div>
  </div>
  <div class="box purple" style="left:80px; top:85px; width:180px; height:75px;">
    <div class="title">app/ routes</div>
    <div class="sub">/, /import, /review</div>
  </div>
  <!-- ... more presentation boxes -->

  <!-- Tier 3: Business Modules — put the hub at the center -->
  <div class="container blue" style="left:40px; top:360px; width:1020px; height:380px;">
    <div class="container-title">BUSINESS MODULES — Pure TypeScript, Zero I/O</div>
  </div>
  <div class="box blue hub" style="left:450px; top:530px; width:200px; height:80px;">
    <div class="title">BM-card-library</div>
    <div class="sub">hub — called by 4 BMs</div>
  </div>
  <!-- ... peers mirrored around the hub -->

  <svg class="arrows" viewBox="0 0 1100 900">
    <!-- ... -->
  </svg>
</div>
```

### TALA principles at play

- **Hierarchy** — 4 tiers at even vertical spacing.
- **Hub central** — the most-connected BM sits at the horizontal center of its tier and vertically central in the canvas.
- **Symmetry** — peer BMs mirror around the hub.
- **Square-ish aspect ratio** — 1100×900 is slightly wider than tall; when the diagram is dense, widen canvas vertically (height=1000+) rather than horizontally.

---

## Pattern 4 — Root-driven tree

One actor, CLI, or entry point at the top (or left); the rest of the diagram fans out through branches. No containers.

```
           ┌──────┐
           │ user │
           └──┬───┘
              │
           ┌──▼───┐
           │ CLI  │
           └─┬──┬─┘
     ┌───────┘  └───────┐
     ▼                  ▼
  ┌─────┐            ┌─────┐
  │ cmd │            │ cmd │
  │  A  │            │  B  │
  └──┬──┘            └──┬──┘
     │                  │
  ┌──▼──┐ ┌────┐   ┌──▼──┐
  │ svc │→│ db │   │ svc │
  └─────┘ └────┘   └─────┘
```

### Canvas and coordinates

- Canvas: `width: 700, height: 900` (portrait, because the tree grows down).
- Root at `(x = center, y = 40)`. Branches fan out with incrementing depth.
- Each depth level: `y = 40 + depth * 130`.
- Sibling spread at each depth: divide canvas width by (1 + num_siblings). Place each sibling at `x = (i+1) * (canvas_width / (num_siblings + 1))` (centered around canvas midline).

### TALA principles at play

- **Hierarchy** — strict. One direction (down), even row heights.
- **Symmetry** — siblings at each depth mirror around the parent's centerline.
- **Cluster** — siblings share a parent's x-band.

### When NOT to use

If the "tree" has joins (node X is a child of both Y and Z), Pattern 4 doesn't hold. Use Pattern 3 or compose.

---

## Composing patterns

It's fine to compose. Common examples:

- **Pattern 3 with Pattern 2 in the BUSINESS tier**: outer layered canvas, but the BUSINESS tier's BMs each show their internals.
- **Pattern 3 with Pattern 4 rooted at a PRESENTATION entry point**: the top tier is an entry, fanning out into the BUSINESS tier. Use when there's a single composition root.

When composing, the **outer** pattern defines canvas dimensions and the top-level `.diagram` wrapper. The **inner** pattern provides coordinates relative to its own container, which you then absolutely position inside the outer layout.
