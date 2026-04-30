# Palette and arrow semantics

Single source of truth for colors and arrow styles. The template's CSS variables and SVG `<marker>` definitions derive from these tables — keep them in sync.

## Box palette

Colors are semantic. Use the role column to pick; don't pick by aesthetic preference. The fill is a pale tint, the stroke is the saturated mid-tone.

| Role | Fill | Stroke | CSS class | Usage |
|---|---|---|---|---|
| Composition root / entry point | `#F3E8FF` | `#9333EA` | `.purple` | The module that owns app bootstrap (`main.ts`, `app/`, CLI entry). Also: the PRESENTATION layer in MIM AA. |
| Business-Module (pure logic, zero I/O) | `#DBEAFE` | `#2563EB` | `.blue` | Any `modules/<name>/` in MIM AA. Pure TypeScript, framework-agnostic. |
| External actor / third-party | `#E5E7EB` | `#6B7280` | `.grey` | Humans, CLI users, remote services, third-party SDKs. Rounded corners (`border-radius: 10px`). |
| Infrastructure (stores, DI container, adapters) | `#D1FAE5` | `#16A34A` | `.green` | Zustand stores, Prisma clients, Axios instances, anything that bridges BMs to I/O. |
| Subprocess / async / background job | `#FED7AA` | `#EA580C` | `.orange` | Child processes, Celery tasks, cron, background workers. Also: external systems in some layouts. |
| Data store / File I/O | `#CCFBF1` | `#0F766E` | `.teal` | localStorage, filesystem APIs, S3, RDS, Redis. |

**Hub tweak**: any box that's the visual hub of the diagram may also get `.box.hub`, which adds a thicker (3px) border. Use this in addition to the palette class, not instead of it.

**Deviations** are allowed when the diagram's semantics demand it — e.g., an external API that should look like an "external system" but is conceptually a data store. Document deviations inline as HTML comments when you make them.

## Arrow palette and semantics

Each arrow has a **semantic** that drives its stroke color, dash pattern, and label color. Different semantics stay visually distinct; same-semantic arrows stay visually identical across the diagram.

| Semantic | Stroke color | Dasharray | SVG marker ID | When to use |
|---|---|---|---|---|
| Direct call | `#6B7280` (grey) | — | `h-grey` | Default. A calls B synchronously. If in doubt, pick this. |
| Composition / ownership | `#9333EA` (purple) | — | `h-purple` | A contains / owns B. Top-down from app root to BMs. |
| Business-module use | `#2563EB` (blue) | — | `h-blue` | One BM calls another BM's public API. |
| Implements / DI injection | `#16A34A` (green) | `6 4` | `h-green` | A implements interface B, or B is injected into A. Dashed. |
| Spawns / subprocess | `#EA580C` (orange) | — | `h-orange` | A spawns a subprocess / worker B. |
| File I/O | `#0F766E` (teal) | — | `h-teal` | A reads from / writes to filesystem or data store B. |
| Async / event / persistence | `#6B7280` (grey) | `5 3` | `h-grey` | Fire-and-forget / eventual consistency / persistence middleware. Dashed. |

**Arrow labels** share their semantic color. A grey arrow's label uses the `arrow-label` class (grey italic). A purple arrow's label uses `arrow-label.purple`. Etc.

**Color by semantic, not source group.** If three different BMs all make "direct calls" to the card-library module, all three arrows are grey — they all share the same semantic. Don't color by source (blue from BM-A, green from BM-B, ...) — that scales badly and teaches the reader the wrong mental model.

## Dashed-pattern discipline

Only two dash patterns are allowed:

- `stroke-dasharray="6 4"` — for implements / DI.
- `stroke-dasharray="5 3"` — for async / persistence.

Never mix in a third pattern. If a new semantic needs a dash, reuse the closest existing one; if that's not plausible, escalate to a new solid color instead of a new dash pattern.

## Marker sizing

Every arrow uses the same marker size (`markerWidth="7"`, `markerHeight="7"`, `refX="9"`, `refY="5"`). Arrowheads that change size per semantic are harder to read.

## Legend rendering

Every legend entry uses the **exact same** marker + stroke + dash as its counterpart in the main diagram. Place as:

```
[small demo box or line segment] ——(marker)——> [text label]
```

When two entries share a color but differ in dash (e.g., solid grey for "direct call" and dashed grey for "async"), show both entries in the legend. The reader should be able to reproduce the main-diagram arrow by looking at the legend.

## Putting it all together

The palette + semantics table maps to CSS variables + SVG markers in `assets/template.html`. Any palette change here is a breaking change for existing HTML diagrams — bump the skill's MINOR version and update the CHANGELOG.
