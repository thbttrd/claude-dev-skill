# Plan rewrite rules — legacy wave plan → REASONS canvas

Best-effort conversion of legacy `docs/V*/plans/W*-*.md`, `00-foundation.md`, and similar wave-style plans into the REASONS-canvas `PLAN.md` template at `specs/story-NNN-slug/PLAN.md`.

The rewrite is **lossy by design** — legacy plans were structured around tasks and waves, not around requirements/entities/approach. The job here is to give the user a syntactically-correct `PLAN.md` that downstream verifiers won't reject, with empty REASONS sections clearly stubbed and flagged for human attention.

---

## Output template

The full template lives in `plugins/plan-writing/skills/plan-writing/references/plan-template.md`. The structure (top to bottom) is:

```
# PLAN: US-NNN — <title>
> metadata header
---
## R — Requirements
## E — Entities
## A — Approach
## S — Structure
## O — Operations
## N — Norms
## S — Safeguards
---
## Test Strategy
## Test Plan
---
## Wave-style verification (kept, but per story)
## Completion criteria
```

---

## Source → target mapping

| Legacy plan section / pattern                               | Goes to                                    | How                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Top-of-file metadata (`Wave: WN`, `Stories covered: …`)     | metadata header                            | Replace with the canonical header (`Story:`, `Features:`, `Mockups:`, `Architecture:`, `Design system:`, `Depends on:`, `Generated:`).      |
| `## Definition of Done` / `## DoD`                          | `## R — Requirements`                      | Move verbatim under "Definition of Done".                                                                                                    |
| `## Acceptance Criteria` / `## AC`                          | `## R — Requirements` (AC list)             | Move under "Acceptance criteria (mirrored from STORY.md)". If items aren't checkboxed, convert to checkboxes.                                |
| `## Files affected` / `## Modules touched` / `## Files`     | `## S — Structure`                         | Convert to the canonical 3-column table (Module/file, Role, Action).                                                                         |
| `## Tasks` / `## Steps` / numbered task list                | `## O — Operations`                        | Each task becomes one Operation. Keep RED-A / RED-B / GREEN / REFACTOR sub-bullets verbatim if present. Otherwise, stub them.                |
| `## DAG` / `## Dependencies`                                | metadata header (`Depends on:` line)        | Extract upstream story IDs. Drop the legacy DAG rendering — the canonical DAG lives in `stories.json`.                                       |
| Wave subsection headers (`### Wave 1`, `### Wave 2`)        | flatten into the Operations list           | Drop the wave grouping. Concatenate operations top-to-bottom in the order they appeared.                                                     |
| `## Tests` / `## Test plan` (if any)                        | `## Test Plan` (post-REASONS section)      | Convert to the canonical 5-column table (ID, Type, Scenario/invariant, File, Asserts). Stub missing columns with `<!-- TODO -->`.            |
| Anything else                                               | preserved at the bottom under `## Original plan content (pre-migration)` | Untouched. The user reviews and decides what to lift up.                                                                                     |

---

## Stubbed sections

When the legacy plan has nothing that maps to a REASONS section, insert a stub like this:

```markdown
## E — Entities

<!-- MIGRATED: this section was not present in the legacy plan.
     Run /plan-writing US-NNN to fill it from STORY.md + ARCHITECTURE.md,
     or hand-edit. The migration set phase=planned only because legacy
     plans were the equivalent — re-running /plan-writing will overwrite. -->

| Entity | Owned by module | Key fields | Relationship |
| ------ | --------------- | ---------- | ------------ |
| TODO   | TODO            | TODO       | TODO         |
```

The same banner pattern applies to `A — Approach`, `N — Norms`, `S — Safeguards`, `Test Strategy`, and `Test Plan` when they can't be derived. The migration does **not** invent content — empty stubs with a TODO are the correct outcome.

---

## Operation rewrite

The Operations section is the most likely to carry real signal from the legacy plan. The rewrite preserves the agent's RED-A → RED-B → GREEN → REFACTOR pattern when it's present:

### Legacy form (typical)

```markdown
### Task 3 — Implement startSession()
- RED-A: write BDD steps in e2e/steps/study.steps.ts. `bun bdd` FAILS.
- RED-B: write unit test in study.service.test.ts. `bun test` FAILS.
- GREEN: implement in study.service.ts. Both pass.
- REFACTOR: extract a clock fake.
```

### Rewritten form

```markdown
### Operation 3 — Implement startSession()
**Covers scenarios:** <Scenario name(s) from .feature> <!-- TODO: confirm -->
- **RED-A (BDD steps):** write BDD steps in `e2e/steps/study.steps.ts`. `bun bdd` must FAIL. Commit: `test(US-NNN): add BDD steps for startSession`.
- **RED-B (unit/integration):** write unit test in `study.service.test.ts`. `bun test` must FAIL. Commit: `test(US-NNN): add failing tests for startSession`.
- **GREEN:** implement in `study.service.ts`. `bun test && bun bdd` PASS. Commit: `feat(US-NNN): implement startSession`.
- **REFACTOR:** extract a clock fake. `bun test && bun bdd` still PASS. Commit (optional): `refactor(US-NNN): extract clock fake`.
```

Changes applied:

- Heading: `Task N` → `Operation N`.
- Add the `**Covers scenarios:**` line. Mark with `<!-- TODO: confirm -->` if not derivable.
- Add `Commit:` lines using the canonical `feat|test|refactor(US-NNN): …` form.
- Bold the RED-A / RED-B / GREEN / REFACTOR labels and surround code identifiers with backticks.

If a legacy task has fewer than four sub-bullets, keep what's there and add `<!-- TODO: missing <RED-A|RED-B|GREEN|REFACTOR> step -->` for each missing one.

---

## Foundation plan special case

`docs/V*/plans/00-foundation.md` migrates to `specs/story-000-foundation/PLAN.md`. The Foundation Story has no real upstream dependencies — set `Depends on: —` in the header. Operations typically include schema bring-up, BM/Infra skeletons, smoke endpoint + UI page, BDD wiring; these usually carry over verbatim from the legacy foundation plan.

---

## Banner

Every rewritten plan gets this banner immediately after the metadata header (and before `---`):

```markdown
> **Migrated** from `<legacy path>` on `YYYY-MM-DD` by `/migrate-specs`.
> The REASONS sections marked `<!-- MIGRATED: ... -->` were not present in the legacy plan
> and are stubbed for review. Run `/plan-writing-verification US-NNN` to confirm the plan
> meets the canonical bar, or `/plan-writing US-NNN` to regenerate it from STORY.md.
```

The user removes this banner once they've reviewed the plan.
