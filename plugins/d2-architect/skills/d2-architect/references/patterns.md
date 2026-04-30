# Architecture Diagram Patterns

Four templates tuned for the kinds of architecture diagrams this skill produces. **Adapt one — don't build from scratch.** All patterns implement the four composition principles from `SKILL.md` (title, legend, hub-central, vertical-leaning).

All absolute icon paths assume the skill is installed at `${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/`.

---

## Module color rule (applies to every pattern)

Every module fill must be a **tint of its category color** — never pure white, and never the same neutral grey across categories. The category (Presentation, Business Module, Infrastructure, External, Data, Actor) is the most load-bearing piece of information on the diagram; using fill alone the reader can group modules at a glance, even before reading any label.

For each category, pick a 3-tier tint progression from a single hue (Tailwind's 50 / 100 / 200 / 600 scale is a clean starting point):

| Tier            | Tailwind | Used for                                                             |
| --------------- | -------- | -------------------------------------------------------------------- |
| **container**   | 50       | The layer / group / column wrapper that holds modules.               |
| **fill-light**  | 100      | Default non-hub module fill.                                         |
| **fill-medium** | 200      | Hub module fill (the most-connected node — see "Central placement"). |
| **stroke**      | 600      | Border + matching arrow stroke + text accent.                        |

The hub module additionally gets a **3 px stroke** (vs 2 px on peers) to make its emphasis robust to colorblindness or grayscale prints.

**Why this scale:** the lightest tier still carries enough chroma to read as the category color on a white page, and the three tints stack visibly without any one tier looking muddy. A flat fill (`#FFFFFF`) on a colored container reads as "uncolored" and forces the reader to decode the border alone — which fails when modules are small or the diagram is reduced for embedding. A colored fill is one less cognitive step.

**Exception — the External I/O container** stays neutral (grey, dashed) so the modules _inside_ announce themselves with their own brand colors (S3 orange, Postgres teal, etc.). The neutral wrapper signals "outside the system boundary"; per-resource colors signal what the resource is.

The standard palette and CSS classes for the polish phase are in `references/html-template.md` → "Standard palette". The same hex values appear in the d2 templates below.

---

## Pattern 1 — High-level product modules

Used by `/high-level-scoping`. A flat view of the functional modules a user would recognize at product level. No databases, no infrastructure internals.

**Scope**: 4–8 modules, grouped into 2–4 thematic columns, simple dependency lines, optionally an external 3rd-party group.

**Layout engine**: prefer **`dagre`** — respects declaration order, produces tighter layouts for flat graphs.

### Template (adapt this)

```d2
# Meal Planner — High-Level Architecture (V0)
# Modules a user interacts with and how they relate.

title: "Meal Planner — High-Level Architecture (V0)" {
  shape: text
  near: top-center
  style.font-size: 40
  style.bold: true
}

# 3-column grid at root level. Title and legend are positioned with `near:`
# so they don't become grid cells. Put the HUB group in the middle cell.
grid-columns: 3

# 3-tier tint per group (no-white rule, see "Module color rule" below):
# - container fill = lightest (Tailwind 50)
# - non-hub module fill = light tint (Tailwind 100)
# - hub module fill = medium tint (Tailwind 200) + 3px stroke
# All three tints share the same hue so the group reads as one cluster.

data: "Data & Content" {
  style.fill: "#FFF7ED"           # orange-50 — lightest tint
  style.stroke: "#EA580C"
  direction: down

  # Every module is an explicit rectangle — markdown labels would otherwise
  # render as borderless text. Always set `shape: rectangle` with `|md`.
  m_import: |md
    **M-001**

    Import
  | {
    shape: rectangle
    style.fill: "#FED7AA"          # orange-100 — non-hub module
    style.stroke: "#EA580C"
    style.stroke-width: 2
    style.border-radius: 4
  }
  m_editor: |md
    **M-002**

    Recipes
  | {
    shape: rectangle
    style.fill: "#FED7AA"          # orange-100 — non-hub module
    style.stroke: "#EA580C"
    style.stroke-width: 2
    style.border-radius: 4
  }

  # Invisible edge forces vertical stacking when no real edge exists between siblings.
  m_import -> m_editor: {style.opacity: 0}
}

# Hub column — placed 2nd of 3 so it lands in the middle cell.
core: "Core" {
  style.fill: "#F0F9FF"            # sky-50 — lightest tint
  style.stroke: "#0284C7"
  direction: down

  # Hub module — medium tint of the same hue + thicker stroke to draw the eye.
  m_planner: |md
    **M-003**

    Meal Planner
  | {
    shape: rectangle
    style.fill: "#BAE6FD"          # sky-200 — hub module
    style.stroke: "#0284C7"
    style.stroke-width: 3
    style.border-radius: 4
  }
  m_shopping: |md
    **M-004**

    Shopping List
  | {
    shape: rectangle
    style.fill: "#E0F2FE"          # sky-100 — non-hub module
    style.stroke: "#0284C7"
    style.stroke-width: 2
    style.border-radius: 4
  }
  m_notif: |md
    **M-005**

    Notifications
  | {
    shape: rectangle
    style.fill: "#E0F2FE"          # sky-100 — non-hub module
    style.stroke: "#0284C7"
    style.stroke-width: 2
    style.border-radius: 4
  }

  m_planner -> m_shopping: {style.stroke: "#16A34A"; style.stroke-width: 2}
  m_shopping -> m_notif: {style.stroke: "#16A34A"; style.stroke-width: 2}
}

intel: "Insights" {
  style.fill: "#FAF5FF"            # purple-50 — lightest tint
  style.stroke: "#9333EA"
  direction: down

  m_stats: |md
    **M-006**

    Stats
  | {
    shape: rectangle
    style.fill: "#F3E8FF"          # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }
  m_recs: |md
    **M-007**

    Recommendations
  | {
    shape: rectangle
    style.fill: "#F3E8FF"          # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }

  m_stats -> m_recs: {style.stroke: "#9333EA"; style.stroke-width: 2}
}

# ── Cross-group dependencies — arrows colored by source group for quick tracing.
data.m_import -> core.m_planner: {style.stroke: "#EA580C"; style.stroke-width: 2}
data.m_editor -> core.m_planner: {style.stroke: "#EA580C"; style.stroke-width: 2}
intel.m_stats -> core.m_planner: {style.stroke: "#9333EA"; style.stroke-width: 2}
intel.m_recs -> core.m_planner: "async read" {
  style.stroke-dash: 5
  style.stroke: "#6B7280"
}

# ── Legend (mandatory). Use `near: bottom-center` so the legend sits directly
# under the diagram with minimal horizontal whitespace. `bottom-right` forces
# the canvas to widen and leaves a large empty gap.
legend: Legend {
  near: bottom-center
  style.fill: "#FFFFFF"
  style.stroke: "#6B7280"

  s1: " "
  s2: |md
    **Direct dependency**

    (writes to / reads from)
  |
  s1 -> s2: {style.stroke-width: 2}

  d1: " "
  d2: |md
    **Indirect / async**

    (reads analytics from)
  |
  d1 -> d2: {style.stroke-dash: 5; style.stroke: "#6B7280"}
}
```

### Styling rules for Pattern 1

- **Title**: `near: top-center`, `font-size: 40`, bold. Format: `"<Project> — <Scope>"`.
- **Groups**: 2–4 columns arranged via `grid-columns: N` at root level (NOT wrapped in a labeled container — the wrapper label becomes visible). Each column has `direction: down` so its modules stack vertically. Hub group goes in the middle cell.
- **Module shapes**: every module must have `shape: rectangle` + `style.fill: <category light tint>` + `style.stroke: <group-color>` + `style.stroke-width: 2` (3 for the hub). Markdown labels (`|md`) render as borderless text without this — forgetting `shape: rectangle` is the most common way to get invisible modules. **Never use `style.fill: "#FFFFFF"`** — see the "Module color rule" at the top of this file.
- **Module labels** (`|md`): use an **empty line** between the M-ID and the name to force a visual line break. Single `\n` in markdown does not render as a break.
- **Hub module**: medium-tint fill of the same hue + thicker stroke (3px) to draw the eye — the hub is declared first in the middle column so it sits at the top of its column, where incoming arrows from other groups naturally converge.
- **Colors**: each group gets a distinct trio of fills + a stroke (Tailwind-style 50 / 100 / 200 / 600). Container fill = 50, non-hub module fill = 100, hub module fill = 200, stroke = 600. Arrow strokes match the source group's stroke color.
- **Arrow styling**: direct deps = 2px solid colored; indirect/async = 5-dash grey (`#6B7280`).
- **Invisible edges for sibling ordering**: when two modules in a group have no real dependency between them but still need vertical stacking (e.g., `m_import` and `m_editor` in Data), add an invisible edge: `m_import -> m_editor: {style.opacity: 0}`. Dagre arranges by flow; without an edge hint, it may place siblings side-by-side within their cell.
- **No databases, caches, or infra.** Those belong in Pattern 2.
- **User-facing verbs** on arrow labels: "plans", "orders", "sends" — never protocol names.
- **Legend is mandatory** when the diagram uses more than one line style or uses colored arrows beyond a single default. Place `near: bottom-center` so the legend tucks directly under the diagram. Avoid `near: bottom-right` — it widens the canvas and leaves a large horizontal gap between the diagram and legend.

---

## Pattern 2 — Detailed MIM AA architecture

Used by `/research-and-architecture`. Each Business-Module is a container with `application`, `domain`, and `infrastructure` (when it has I/O) children. Cross-module arrows touch `.application` only — never `.domain` or `.infrastructure`.

**Scope**: 3–6 Business-Modules, each with 1–3 Infrastructure children, plus shared/standalone modules and external services.

**Layout engine**: prefer **`elk`** — handles the deep container nesting Pattern 2 requires. `dagre` falls apart with >1 level of nesting.

### Template (adapt this)

```d2
# Meal Planner — Detailed MIM AA Architecture (V0)

title: "Meal Planner — Detailed MIM AA Architecture (V0)" {
  shape: text
  near: top-center
  style.font-size: 40
  style.bold: true
}

direction: down

client: UI Layer {
  web: Web App {
    icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/dev/react.svg
  }
}

auth: Auth BM {
  app: Application
  domain: Domain
  infra: Infrastructure {
    db: Auth DB {
      icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/rds.svg
    }
  }
  app -> domain
  app -> infra
}

planning: Meal Planning BM {
  app: Application
  domain: Domain
  infra: Infrastructure {
    db: Plans DB {
      icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/rds.svg
    }
    cache: Plans Cache {
      icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/elasticache.svg
    }
  }
  app -> domain
  app -> infra
}

shopping: Shopping List BM {
  app: Application
  domain: Domain
  infra: Infrastructure {
    db: Lists DB {
      icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/rds.svg
    }
    queue: Order Queue {
      icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/sqs.svg
    }
  }
  app -> domain
  app -> infra
}

external: External {
  grocery: Grocery Provider {
    shape: cloud
    style.stroke-dash: 3
  }
}

client.web -> auth.app: "authenticate"
client.web -> planning.app: "plan meals"
client.web -> shopping.app: "manage lists"
planning.app -> auth.app: "read user"
shopping.app -> planning.app: "read meal plan"
shopping.infra.queue -> external.grocery: "submit order"

# ── Legend (mandatory)
legend: Legend {
  near: bottom-right
  style.fill: "#FFFFFF"
  style.stroke: "#6B7280"

  s1: " "
  s2: "Public-API call"
  s1 -> s2: {style.stroke-width: 2}

  d1: " "
  d2: "External / 3rd-party"
  d1 -> d2: {style.stroke-dash: 3}
}
```

### Styling rules for Pattern 2

- **Title**: same convention as Pattern 1.
- **Every BM is a container** with `app` (public API), `domain` (pure logic, no I/O), and `infra` (I/O adapters when present). Don't show `infra` if the BM has no I/O.
- **Cross-module arrows touch `.app` only.** Not `.domain`, not `.infra`. This visually enforces MIM AA's public-API rule.
- **Infra children**: branded icons (`aws/rds.svg`) when the module maps to a specific named service, or shape hints (`cylinder`, `queue`, `stored_data`) when generic.
- **External services**: `external` group, `shape: cloud`, `style.stroke-dash: 3`.
- **Domain children never have cross-module arrows.** Domain logic should be self-contained.
- **Layout**: `direction: down` typical; `elk` layout engine.
- **Legend** documents the meaning of any non-obvious line styles (dashed = external, etc.).

---

## Pattern 3 — Layered MIM AA

Used when the architecture is best read as horizontal layers (e.g., `PRESENTATION → BUSINESS MODULES → INFRASTRUCTURE → EXTERNAL I/O`) rather than as a handful of peer BMs with internal structure. Common for frontend-heavy V0 apps, Next.js / Zustand / localStorage stacks, and any system whose key grouping axis is **responsibility tier** rather than per-module internals. The layer container expresses the infrastructure-vs-business distinction directly, so individual modules don't need their own `app/domain/infra` subdivision.

**Scope**: 3–5 horizontal layers, each containing 2–5 modules. Cross-layer arrows carry semantic colors (e.g., "calls" / "persist" / "reads files").

**Layout engine**: prefer **`elk`** — handles the nested containers cleanly.

### When to pick Pattern 3 vs Pattern 2

- Pick **Pattern 3** when the architecture reads as stacked layers AND individual modules don't need their own app/domain/infra subdivision — because the layer container already carries that meaning.
- Pick **Pattern 2** when BMs have rich internal structure (application, domain, infrastructure children) and the story you want to tell is the cross-BM interaction surface.
- In doubt for a frontend V0: Pattern 3 is usually simpler and closer to what readers expect.

### Template (adapt this)

```d2
# Job Flashcards — V0 Architecture (MIM AA)
# Layered MIM AA: Presentation → Business Modules → Infrastructure → External I/O

title: "Job Flashcards — V0 Architecture (MIM AA)" {
  shape: text
  near: top-center
  style.font-size: 40
  style.bold: true
}

# grid-rows at root forces vertical layer stacking.
# grid-columns inside each layer forces horizontal module placement.
# This is the ONE safe case of `grid-*` at two levels — they're orthogonal axes.
grid-rows: 4

# ─── Layer 1 — Presentation
# 3-tier purple: container = purple-50, modules = purple-100, hub = purple-200.
presentation: "PRESENTATION — Next.js App Router + React" {
  style.fill: "#FAF5FF"            # purple-50 — lightest tint
  style.stroke: "#9333EA"
  style.stroke-width: 2
  grid-columns: 4

  app: |md
    **app/ (routes)**
  | {
    shape: rectangle
    style.fill: "#F3E8FF"           # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }

  components: |md
    **components/ (UI)**
  | {
    shape: rectangle
    style.fill: "#F3E8FF"           # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }

  hooks: |md
    **hooks/ (bridge)**
  | {
    shape: rectangle
    style.fill: "#F3E8FF"           # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }

  mdlib: |md
    **react-markdown**

    with rehype-highlight
  | {
    shape: rectangle
    style.fill: "#F3E8FF"           # purple-100 — non-hub module
    style.stroke: "#9333EA"
    style.stroke-width: 2
    style.border-radius: 4
  }
}

# ─── Layer 2 — Business Modules
# 3-tier blue: container = blue-50, modules = blue-100, hub = blue-200.
# bm_library is the hub here (every other BM calls into it).
business: "BUSINESS MODULES — Pure TypeScript, Zero I/O" {
  style.fill: "#EFF6FF"            # blue-50 — lightest tint
  style.stroke: "#2563EB"
  style.stroke-width: 2
  grid-columns: 3

  bm_import: |md
    **BM-import**

    markdown parser

    validator · category mapper
  | {
    shape: rectangle
    style.fill: "#DBEAFE"           # blue-100 — non-hub module
    style.stroke: "#2563EB"
    style.stroke-width: 2
    style.border-radius: 4
  }

  bm_library: |md
    **BM-card-library**

    card model · CRUD getCards()

    organization by topic · replaceAll()
  | {
    shape: rectangle
    style.fill: "#BFDBFE"           # blue-200 — HUB module (most-connected)
    style.stroke: "#2563EB"
    style.stroke-width: 3            # +1 px to mark it as the hub
    style.border-radius: 4
  }

  bm_study: |md
    **BM-study**

    SM-2 algorithm

    queue builder · session mgr
  | {
    shape: rectangle
    style.fill: "#DBEAFE"           # blue-100 — non-hub module
    style.stroke: "#2563EB"
    style.stroke-width: 2
    style.border-radius: 4
  }
}

# ─── Layer 3 — Infrastructure
# 3-tier green: container = green-50, modules = green-100. No hub here —
# all three stores are peers, so none gets the hub treatment.
infrastructure: "INFRASTRUCTURE — Zustand Stores + Persist Middleware" {
  style.fill: "#ECFDF5"            # green-50 — lightest tint
  style.stroke: "#16A34A"
  style.stroke-width: 2
  grid-columns: 3

  use_import: |md
    **useImportStore**
  | {
    shape: rectangle
    style.fill: "#D1FAE5"           # green-100 — non-hub module
    style.stroke: "#16A34A"
    style.stroke-width: 2
    style.border-radius: 4
  }

  use_card: |md
    **useCardStore**

    persist → localStorage
  | {
    shape: rectangle
    style.fill: "#D1FAE5"           # green-100 — non-hub module
    style.stroke: "#16A34A"
    style.stroke-width: 2
    style.border-radius: 4
  }

  use_study: |md
    **useStudyStore**

    persist → localStorage
  | {
    shape: rectangle
    style.fill: "#D1FAE5"           # green-100 — non-hub module
    style.stroke: "#16A34A"
    style.stroke-width: 2
    style.border-radius: 4
  }
}

# ─── Layer 4 — External I/O (browser resources the stores talk to)
# Neutral dashed container — the inner boxes keep their own brand colors.
external: "EXTERNAL I/O" {
  style.fill: "#FAFAF9"
  style.stroke: "#737373"
  style.stroke-width: 1
  style.stroke-dash: 3
  grid-columns: 2

  fs_api: |md
    **File System Access API**

    (+ browser-fs-access)
  | {
    shape: rectangle
    style.fill: "#FFF7ED"
    style.stroke: "#EA580C"
    style.stroke-width: 2
    style.border-radius: 4
  }

  local_storage: |md
    **localStorage**
  | {
    shape: rectangle
    style.fill: "#CCFBF1"
    style.stroke: "#0F766E"
    style.stroke-width: 2
    style.border-radius: 4
  }
}

# ─── Cross-layer arrows — colored by SEMANTIC, not by source group.
# Layered architectures carry meaning in the direction; reader's eye
# follows the arrow color to group related operations.
infrastructure.use_import -> business.bm_import: "calls" {
  style.stroke: "#16A34A"
  style.stroke-width: 2
  style.font-color: "#16A34A"
}
infrastructure.use_card -> business.bm_library: "calls" {
  style.stroke: "#16A34A"
  style.stroke-width: 2
  style.font-color: "#16A34A"
}
infrastructure.use_study -> business.bm_study: "calls" {
  style.stroke: "#16A34A"
  style.stroke-width: 2
  style.font-color: "#16A34A"
}
infrastructure.use_import -> external.fs_api: "reads files" {
  style.stroke: "#EA580C"
  style.stroke-width: 2
  style.font-color: "#EA580C"
}
infrastructure.use_card -> external.local_storage: "persist" {
  style.stroke: "#0F766E"
  style.stroke-width: 2
  style.font-color: "#0F766E"
}
infrastructure.use_study -> external.local_storage: "persist" {
  style.stroke: "#0F766E"
  style.stroke-width: 2
  style.font-color: "#0F766E"
}

# ─── Legend (mandatory — colored arrows in use)
legend: Legend {
  near: bottom-center
  style.fill: "#FFFFFF"
  style.stroke: "#6B7280"

  c1: " "
  c2: "calls (BM delegation)"
  c1 -> c2: {style.stroke: "#16A34A"; style.stroke-width: 2}

  r1: " "
  r2: "reads files"
  r1 -> r2: {style.stroke: "#EA580C"; style.stroke-width: 2}

  p1: " "
  p2: "persist"
  p1 -> p2: {style.stroke: "#0F766E"; style.stroke-width: 2}
}
```

### Styling rules for Pattern 3

- **Title**: same convention as Patterns 1 and 2.
- **Grid structure**: `grid-rows: N` at root (N = number of layers) + `grid-columns: M` inside each layer (M = modules in that layer). This is the ONE safe case where `grid-*` appears at two levels — root and per-layer are orthogonal axes and do not interfere. The broader "only one grid per diagram" warning still applies to cases where the two grids would compete on the same axis.
- **Layer labels**: all-caps header `"LAYER_NAME — technology / role"` (e.g., `"PRESENTATION — Next.js App Router + React"`). The em-dash separates the _what_ from the _how_ and scans as a subtitle.
- **Layer colors** (convention, tune to the project) — three-tier tint per layer (container / non-hub module / hub module):
  - Presentation purple: container `#FAF5FF` (purple-50) / module `#F3E8FF` (purple-100) / hub `#E9D5FF` (purple-200) / stroke `#9333EA` (purple-600).
  - Business Modules blue: container `#EFF6FF` (blue-50) / module `#DBEAFE` (blue-100) / hub `#BFDBFE` (blue-200) / stroke `#2563EB` (blue-600).
  - Infrastructure green: container `#ECFDF5` (green-50) / module `#D1FAE5` (green-100) / hub `#A7F3D0` (green-200) / stroke `#16A34A` (green-600).
  - External I/O: neutral grey dashed (`#FAFAF9` / `#737373`, `stroke-dash: 3`) — individual resources inside keep their own brand colors (e.g., File System API orange, localStorage teal).
- **Module shapes**: identical to Pattern 1 — `shape: rectangle` + light-tint fill (NEVER pure white) + layer-colored stroke + 2px stroke-width (3px on the hub) + 4px border-radius.
- **Cross-layer arrows**: color by **semantic meaning**, not source group. `"calls"` = layer-green, `"persist"` = teal, `"reads files"` = orange. This differs from Pattern 1 (color by source group) because in a layered view the layer boundaries are already visually explicit; the new information the reader needs is _what kind_ of cross-layer operation they're seeing.
- **Arrow labels**: the _action_, not the protocol. "calls" / "persist" / "reads files" — never "HTTP GET" / "localStorage.setItem()".
- **Legend is mandatory**: documents arrow-color semantics. `near: bottom-center` for tight placement.
- **No invisible edges needed**: `grid-columns: M` inside each layer forces module ordering by declaration. The `m_a -> m_b: {style.opacity: 0}` trick from Pattern 1 isn't needed here.
- **Markdown list-marker gotcha**: lines starting with `+ ` or `- ` inside `|md` labels render as bullet points. For detail lines like "+ rehype-highlight", replace with "with rehype-highlight" or the middle-dot separator "· rehype-highlight". See `references/d2-syntax.md`.

---

## Pattern 4 — Tree / Hierarchical Fan-Out

Used when the architecture has a single root (an actor, CLI, entry point, webhook endpoint) that fans out through successive layers to leaf resources. Unlike Pattern 3's uniform layers, Pattern 4 allows variable-depth branches — one branch may be 2 levels deep while another is 4. Common for CLI tools, event routers, and any "one caller → many services → their data" topology.

**Scope**: 6–12 total nodes arranged as a tree, 3–5 levels deep, with 2–4 top-level branches from the root.

**Layout engine**: **`dagre`**, non-negotiable. Elk optimizes edge crossings as a global objective and will pull the root into a corner when it has many outgoing edges; dagre's layered algorithm ranks nodes by longest-path from a source and places each rank in its own row, which is exactly the tree shape.

### When to pick Pattern 4 vs Pattern 1

- Pick **Pattern 4** when you'd describe the architecture as "a root drives everything" AND different branches have different depths.
- Pick **Pattern 1** when you have 2–4 peer thematic groups of modules at roughly the same abstraction level, with no single "root" above them.
- Quick test: can you name the root? ("Developer", "Webhook", "API Gateway") → Pattern 4. Can you name the groups instead? ("Data", "Core", "Insights") → Pattern 1.

### Template (adapt this)

```d2
# claude-sddw — High-Level Architecture (V0)
# Tree: Developer → CLI → 3 modules → their data; M-001 also persists state to logs.

title: "claude-sddw — High-Level Architecture (V0)" {
  shape: text
  near: top-center
  style.font-size: 40
  style.bold: true
}

# No grid. No wrapper containers. Dagre layers by edge direction and produces
# the tree shape directly — adding grid constraints actively fights the layout.
direction: down

developer: Developer {
  shape: rectangle
  style.fill: "#E5E7EB"
  style.stroke: "#6B7280"
  style.stroke-width: 2
  style.border-radius: 8
}

m004: |md
  **M-004: CLI Interface**
| {
  shape: rectangle
  style.fill: "#DBEAFE"
  style.stroke: "#2563EB"
  style.stroke-width: 2
  style.border-radius: 4
}

m002: |md
  **M-002: Workflow Authoring**
| {
  shape: rectangle
  style.fill: "#F3E8FF"
  style.stroke: "#9333EA"
  style.stroke-width: 2
  style.border-radius: 4
}

# Hub — the deepest branch, darker fill + 3px stroke.
m001: |md
  **M-001: Pipeline Engine**
| {
  shape: rectangle
  style.fill: "#E9D5FF"
  style.stroke: "#9333EA"
  style.stroke-width: 3
  style.border-radius: 4
}

m003: |md
  **M-003: Feature Registry**
| {
  shape: rectangle
  style.fill: "#F3E8FF"
  style.stroke: "#9333EA"
  style.stroke-width: 2
  style.border-radius: 4
}

config: |md
  **workflow.config.ts**

  with prompts
| {
  shape: rectangle
  style.fill: "#CCFBF1"
  style.stroke: "#0F766E"
  style.stroke-width: 2
  style.border-radius: 4
}

subprocess: |md
  **claude -p subprocess**

  (stream-json)
| {
  shape: rectangle
  style.fill: "#FED7AA"
  style.stroke: "#EA580C"
  style.stroke-width: 2
  style.border-radius: 4
}

specs: |md
  **SPECS.md**

  with registry state
| {
  shape: rectangle
  style.fill: "#CCFBF1"
  style.stroke: "#0F766E"
  style.stroke-width: 2
  style.border-radius: 4
}

logs: |md
  **logs/**

  with pipeline state JSON
| {
  shape: rectangle
  style.fill: "#CCFBF1"
  style.stroke: "#0F766E"
  style.stroke-width: 2
  style.border-radius: 4
}

# Edges alone carry all structure.
developer -> m004
m004 -> m002: "loads config"
m004 -> m001: "runs"
m004 -> m003: "reads status"
m002 -> config: "reads"
m001 -> subprocess: "spawns"
m003 -> specs: "parses"
subprocess -> logs: "stream JSON" {
  style.stroke: "#EA580C"
  style.font-color: "#EA580C"
  style.stroke-width: 2
}
# Cross-cut: M-001 writes to logs directly, bypassing the subprocess.
# Dashed to distinguish from the primary tree flow.
m001 -> logs: "persists state" {
  style.stroke-dash: 5
  style.stroke: "#6B7280"
  style.font-color: "#6B7280"
}

legend: Legend {
  near: bottom-center
  style.fill: "#FFFFFF"
  style.stroke: "#6B7280"

  s1: " "
  s2: "Direct call"
  s1 -> s2: {style.stroke-width: 2}

  d1: " "
  d2: "Async / persistence"
  d1 -> d2: {style.stroke-dash: 5; style.stroke: "#6B7280"}

  j1: " "
  j2: "Stream JSON output"
  j1 -> j2: {style.stroke: "#EA580C"; style.stroke-width: 2}
}
```

### Styling rules for Pattern 4

- **Title**: same convention as Patterns 1–3.
- **No containers, no grid**. The edges carry all structure. Wrapping branches in lane containers or adding `grid-columns` directives makes the engine fight the natural tree shape. If you find yourself reaching for either, step back: either the shape isn't actually a tree (pick a different pattern) or you're over-engineering.
- **Actor shape** (for `Developer`, `User`, external systems): prefer `shape: rectangle` with neutral grey fill (`#E5E7EB`) + rounded corners (`style.border-radius: 8`). The built-in `shape: person` renders as a cloud-like blob in theme 0, not a stick figure — a frequent aesthetic miss.
- **Hub highlighting**: the branch with the most depth (or the intermediate node with the most outgoing edges) gets the darker fill + 3px stroke treatment, same as Patterns 1 and 3.
- **Semantic arrow colors** (like Pattern 3): color by _kind_ of operation — orange for stream/output, dashed grey for async/persistence, default solid for direct call. The arrow family is the same whether the architecture is layered (Pattern 3) or tree-shaped (Pattern 4).
- **Cross-cutting dashed arrows**: when a node writes/reads to a distant node in the same branch, bypassing intermediate steps (e.g., M-001 → logs, skipping subprocess), render it dashed. It's a tell-tale motif of this pattern — the primary branch is the "happy path"; the dashed arrow is the "also, this".
- **Legend**: mandatory when ≥2 arrow styles in use. `near: bottom-center`.
- **Layout engine**: dagre, always. See the next subsection for why.

### Why elk misreads Pattern 4 (and dagre gets it right)

If you try Pattern 4 with elk, the root node (Developer, M-004) ends up in the bottom-left corner, with the rest of the tree sprawling to the upper right. The reason: elk minimizes total edge-length as a global objective. A node with many outgoing edges to distant children is "cheaper" (shorter total edges) when placed near the geographic center of its sinks, which for a top-down tree happens to be bottom-left of a wide module row.

Dagre's layered algorithm is different: it ranks every node by longest-path-from-source, and each rank gets its own row. For a tree, longest-path IS the depth, so every node lands on the correct layer and the root is at the top. No global objective for dagre to minimize against the tree shape.

Moral: if a diagram looks tree-shaped in your head but the engine keeps scrambling it, **check the engine before you change the graph**. A one-character swap (`elk` → `dagre`) sometimes saves an hour of layout wrangling.

---

## Choosing a direction

| Situation                                                  | Root-level directive      | Inside each group / layer                           |
| ---------------------------------------------------------- | ------------------------- | --------------------------------------------------- |
| 2–4 thematic columns of modules (Pattern 1 norm)           | `grid-columns: N` at root | `direction: down` + invisible-edge sibling ordering |
| 3–5 stacked layers (Pattern 3 norm)                        | `grid-rows: N` at root    | `grid-columns: M` per layer                         |
| Root-driven tree, variable-depth branches (Pattern 4 norm) | `direction: down` only    | — (no containers, no grid)                          |
| Client → Server → Data flow (Pattern 2 nested BMs)         | `direction: down`         | per-BM `direction: down`                            |
| Orchestrator above workers                                 | `direction: down`         | —                                                   |
| Pub/sub fan-out (one publisher → many consumers)           | `direction: right`        | —                                                   |

When unsure for a product-level diagram: Pattern 1 (`grid-columns` at root). For a tier/layer diagram: Pattern 3 (`grid-rows` at root + `grid-columns` per layer). For a CLI or entry-point-driven tree: Pattern 4 (direction alone, nothing else). Patterns 1, 3, and 4 are all A4-friendly by construction.

## Layout engine selection

| Pattern                                                                  | Engine  | Reason                                                                                                                    |
| ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pattern 1 (high-level)                                                   | `dagre` | Respects declaration order; tighter layouts for flat graphs                                                               |
| Pattern 2 (MIM AA detailed, nested BMs)                                  | `elk`   | Handles deep container nesting; BMs with app/domain/infra work cleanly                                                    |
| Pattern 3 (layered MIM AA)                                               | `elk`   | Respects the grid-rows / grid-columns constraints and routes cross-layer arrows without pulling layer containers sideways |
| Pattern 4 (tree / hierarchical fan-out)                                  | `dagre` | Layered algorithm ranks nodes by longest-path from root; elk pulls the root to a corner when it has many outgoing edges   |
| When `dagre` produces overlapping edges on Pattern 2/3                   | `elk`   | Always the fallback for dense nested graphs                                                                               |
| When `elk` produces a massive sprawl on Pattern 1 or scrambles Pattern 4 | `dagre` | Better for simple structures and root-driven trees                                                                        |

## Don't do this

- Skip the title — makes the diagram ambiguous when embedded without surrounding prose.
- Skip the legend when using colored arrows or non-obvious line styles — readers can't infer conventions.
- Place the hub module at the edge — central placement is a visual affordance for the reader's eye.
- Use `grid-rows: N` or `grid-columns: N` on every container — only use on the ONE wrapper that defines column structure. Applying it broadly flips the whole diagram horizontal (learned in v1.0.0 → v1.1.0 iteration). The Pattern 3 exception (root `grid-rows` + per-layer `grid-columns`) is explicitly orthogonal axes.
- Add grid constraints or wrapper containers to a natural tree shape (Pattern 4 territory). The engine will fight you. If you're wrapping branches in lane containers or adding `grid-columns` just to force positioning, switch to `dagre` first — a one-character swap often replaces an hour of layout wrangling.
- Use reserved keywords as identifiers. `left`, `right`, `middle`, `up`, `down`, and `center` are d2-reserved (direction / `near:` values). They'll compile fine as container names but fail with `reserved keywords are prohibited in edges` the moment any edge references them. Use semantic names (`workflow_lane`, not `left`).
- Use `shape: person` for actor nodes in theme 0 — it renders as a cloud-like blob, not a stick figure. Prefer `shape: rectangle` with grey fill + rounded corners.
- Put every shape in its own container (visual noise, zero signal).
- Decorative icons that don't match meaning (S3 icon on a RAM cache).
- Draw every possible HTTP hop. Show the **important** dependencies.
- Use `--layout=tala` (Terrastruct's commercial engine, not bundled with d2). If the aesthetic matters and you're willing to install the separate binary, it can produce better routing than dagre/elk on dense graphs, but it's not the default path — the three engines baked into d2 are `dagre` and `elk`.
- Add `style.shadow: true` to every shape — reserve it for the key node you want to emphasize.
