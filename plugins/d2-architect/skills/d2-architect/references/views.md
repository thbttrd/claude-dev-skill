# Diagram views — splitting one architecture into a readable set of diagrams

A real architect doesn't draw the whole system on one page. They draw a **high-level overview** that gives the shape of the system at a glance, and then **zoom-ins** that detail one aspect each. The `d2-architect` skill encodes this — Phase 0 plans the diagram set before Phase A starts laying anything out.

The pitfall this avoids: a 1:1 mapping from `ARCHITECTURE.md` to a single diagram. That works for ≤ 12 modules and few edges; it fails the moment the project grows. The diagram becomes a wall of small boxes connected by arrows that cross every other arrow, the polish phase spends most of its time relocating labels around clutter, and the reader gives up before extracting any structural insight. Splitting solves that — each diagram has one job, room for the labels of _that job's_ concepts, and a clean reading order.

## What "good splitting" looks like

- **Overview** is always produced. It's the canonical answer to "what does this system look like?" — drawn at the highest level of abstraction the project supports (top-level groups + their primary inter-group edges, no internals).
- **Zoom-ins** are produced **only when the overview alone would be too dense**. Each zoom-in must be motivated by a specific question the overview can't answer ("how do the BMs talk to storage?", "what's inside the Auth BM?"), and each carries the **minimum** content needed to answer that question — every other module collapses to a single box.
- Each diagram has a focal point. The overview's focal point is the **hub group**. A zoom-in's focal point is the **subject of the zoom** (the layer being detailed, the BM being unpacked).
- Each diagram has a clear, project-specific basename: `architecture-overview.png`, `architecture-cross-module-flow.png`, `architecture-bm-card-library.png`. The titles announce the scope clearly: `"Job Flashcards — High-Level Overview (V1)"` vs `"Job Flashcards — Cross-Module Flow (V1)"`.

## Decision criteria — when to split

Phase 0 reads the input modules + dependencies and counts:

| Signal                  | Light | Dense   | Heavy |
| ----------------------- | ----- | ------- | ----- |
| Total modules           | ≤ 12  | 13 – 20 | > 20  |
| Total edges             | ≤ 15  | 16 – 25 | > 25  |
| Container nesting depth | ≤ 2   | 3       | > 3   |
| Distinct edge semantics | ≤ 3   | 4 – 5   | > 5   |

Map count → plan:

- **All Light** → one diagram, the overview. Done.
- **Any Dense** → overview + 1 zoom-in (pick the densest subgraph as the zoom-in topic).
- **Any Heavy** → overview + 2-3 zoom-ins (one per dense subgraph). At this scale, an overview that tried to show everything would have ~3 boxes per inch of canvas, well past the readability cliff.

If the architecture mixes a Heavy module-count with a Light edge-count, prefer **fewer zoom-ins, more aggressive collapsing in the overview** — the overview's job is still to fit on one page. The Light ARCHITECTURE.md case (every module trivially named) doesn't suddenly become hard to read just because there are many modules; the cliff is reached only when the modules connect densely. Use judgment.

## Standard view catalog

Start from this catalog before inventing custom views. Each view's `name` becomes part of the output basename: `<basename>-<view.name>.png`.

### `overview` (always produced)

**Goal:** the reader holds the whole system in their head after one look.

**Includes:**

- Every top-level group / layer / module category (e.g., `Presentation`, `Business Modules`, `Infrastructure`, `External I/O`).
- One box per group's _contents_, OR a small set of boxes if the group is naturally subdivided at the architecture level. **Aggressively collapse** when in doubt: a group with 5 internal modules collapses to a single box labeled with the group name, leaving the internals for a zoom-in.
- The **primary** inter-group dependencies — typically the public-API edges. Skip secondary edges (cross-cutting concerns, debug-only paths, cache reads).

**Excludes:**

- Intra-group module-to-module wiring. That's a zoom-in.
- Infrastructure adapters. That's a zoom-in.
- External I/O resources unless they're a core integration (e.g., Stripe in a payments app — yes; localStorage in a browser app — only if the persistence story is itself the highlight).

**Pattern fit:** Pattern 1 (peer groups) or Pattern 3 (layered MIM AA), depending on the architecture's natural shape. Pattern 4 if there's a single root driving everything.

### `cross-module-flow` (zoom)

**Goal:** "how does data move between business modules?"

**Includes:** every business module + the edges between them (usually labeled with the operation: "reads", "publishes", "delegates"). Layers above and below collapse to one box each (`UI ▾`, `Storage ▾`).

**Excludes:** intra-BM internals, every infrastructure adapter, every UI route.

**Pattern fit:** Pattern 1 (the BMs become peer columns) or Pattern 2 (when each BM still wants its `app/domain/infra` to be visible).

### `presentation` (zoom)

**Goal:** "what's on the user's screen and how do the components hook into the BMs?"

**Includes:** every UI route / page / shared component / hook in the Presentation layer, with the edges to BMs. Other layers collapse.

**Pattern fit:** Pattern 3 with `grid-rows: 2` (Presentation full-detail row + collapsed Business row) — or Pattern 1 if the components naturally cluster into thematic groups.

### `infrastructure` (zoom)

**Goal:** "how does the app persist state, talk to external systems, and handle I/O?"

**Includes:** every store / adapter / queue / cache / external service + the edges in/out. Presentation and Business layers collapse to one box each.

**Pattern fit:** Pattern 3 with the Infrastructure layer expanded.

### `bm/<id>` (zoom — per-BM internals)

**Goal:** "what's inside this one Business Module?"

**Includes:** the BM's `application`, `domain`, `infrastructure` children + the public-API edges from peer BMs, but every peer BM collapses to a single box. External resources the BM owns (its own DB / queue) appear; resources of other BMs do not.

**Pattern fit:** Pattern 2 with this BM expanded and the others stubbed.

Use this view sparingly — only for BMs that are themselves complex (3+ infra adapters, a non-trivial domain, or a deliberately layered application split). A BM with one repository and a thin domain doesn't need its own zoom-in.

## Phase-0 output: the diagram plan

Before any d2 source is written, the skill produces a plan:

```
Diagram plan for "Job Flashcards V1"
  Density: 17 modules, 22 edges, 3 nesting levels, 4 edge semantics → DENSE
  Decision: overview + 1 zoom-in.

  Diagrams:
    1. architecture-overview.png        — Pattern 3 layered MIM AA, presentation/business/infrastructure/external collapsed to top-level
    2. architecture-cross-module-flow.png — Pattern 1 peer columns, BM-import / BM-card-library (hub) / BM-study with their public-API edges
```

The plan is a **single artifact** the caller (and the user) sees before any rendering happens. If the plan looks wrong, the caller can override `views: [...]` to specify exactly which views to produce, or pass `views: ["overview"]` to lock to single-diagram output.

## When the caller wants exactly one diagram

Some callers (`/high-level-scoping`, simple invocations) explicitly want just one diagram. They pass `views: ["overview"]` (or omit `views` and the architecture is small enough that Phase 0 produces a plan-of-one). Phase 0 honors this — no zoom-ins, just the overview.

The opposite is also true: a caller can pass `views: ["overview", "cross-module-flow", "bm/card-library"]` to force a specific set. The skill produces exactly that set, with no density override.

## What a zoom-in is NOT

- It is **not** a copy of the overview with extra labels. The whole point of a zoom-in is that boxes outside the focus area collapse.
- It is **not** the same data filtered to a smaller scope. It uses different patterns and different abstractions when those serve the focal question better (e.g., the overview is Pattern 3 layered, the cross-module-flow is Pattern 1 peer columns).
- It is **not** "the rest of the architecture in smaller text". If you find yourself thinking "I'll just shrink this" — stop, and decide which boxes to drop.

## Don't do this

- Don't produce a zoom-in for a group that has only 1-2 modules — the overview already shows it.
- Don't produce 4+ zoom-ins on a single architecture — that's a sign the overview is wrong (it should encompass more of the structure) or the architecture itself wants splitting into multiple sub-systems.
- Don't reuse the same focal point across two zoom-ins. If two zoom-ins are both centered on the same hub, they're answering the same question — merge them or make one of them the overview.
- Don't omit the overview. Even when zoom-ins are produced, the overview is always one of them.
