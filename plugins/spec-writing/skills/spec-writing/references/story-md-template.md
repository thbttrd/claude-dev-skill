# `STORY.md` Template

Each story owns a `STORY.md` at `specs/story-NNN-slug/STORY.md`. It is the **human-readable spec** of the story — the WHY (User Story), the WHAT (Acceptance Criteria), and the rules summary. The Gherkin scenarios live in sibling `.feature` files; the implementation plan lives in `PLAN.md`.

`STORY.md` is owned and updated by `/spec-writing`. Other skills read it but never rewrite it.

---

## Template

```markdown
# US-NNN — <Story title>

> **Epic:** [E-NNN — Epic title](../../specs/PROJECT.md#epics) · **Priority:** must-have · **Business impact:** high
> **Phase:** specced · **Foundation:** false · **Depends on:** US-XXX, US-YYY (or "—" for the Foundation Story)
> **Mockups:** [`mockups/UI-F-NNN-screen.html`](./mockups/UI-F-NNN-screen.html) · **Screen specs:** [`ui/UI-F-NNN-screen.md`](./ui/UI-F-NNN-screen.md) · (omit if no UI)
> **Specified:** YYYY-MM-DD by `/spec-writing`

---

## User Story

As a **<persona/role>**
I want to **<action or capability>**
So that **<concrete user benefit>**

## INVEST Check

| Letter           | Status | Note                                                            |
| ---------------- | ------ | --------------------------------------------------------------- |
| **I**ndependent  | ✅     | Depends only on verified upstream stories listed above.         |
| **N**egotiable   | ✅     | Outcome-focused; no UI clicks or tech choices baked into AC.    |
| **V**aluable     | ✅     | "So that …" describes a real user benefit, not filler.          |
| **E**stimable    | ✅     | AC are concrete enough that a human could size the work.         |
| **S**mall        | ✅     | Fits in a single agent loop (~≤ 6 plan operations).             |
| **T**estable     | ✅     | Each AC has at least one drafted Gherkin scenario.              |

If any letter is `❌`, address it before transitioning the story past `scoped`. The full INVEST gate runs at the top of `/spec-writing`; this table is the durable record of its outcome.

## Acceptance Criteria

Each AC is testable. The `.feature` files in `./features/` translate these into Gherkin scenarios.

- [ ] AC-1 — <concrete, observable behaviour>
- [ ] AC-2 — <concrete, observable behaviour>
- [ ] AC-3 — <…>

## Rules

Plain-English summary of the business rules this story enforces. Each rule maps to a `Rule:` block in the corresponding `.feature` file with at least one happy-path and one sad-path scenario.

- **R-1** — <rule statement>. Sad path: <what must be rejected/handled>.
- **R-2** — <rule statement>. Sad path: <…>.

## Feature files

| ID    | File                                       | Covers rules     |
| ----- | ------------------------------------------ | ---------------- |
| F-001 | [`features/F-001-<slug>.feature`](./features/F-001-<slug>.feature) | R-1, R-2     |
| F-002 | [`features/F-002-<slug>.feature`](./features/F-002-<slug>.feature) | R-3 (optional split) |

## Out of scope

Things this story is explicitly NOT doing. Helps reviewers and downstream skills (especially `/plan-writing`) avoid scope creep.

- Feature X — handled by US-NNN
- Edge case Y — deferred to backlog (no story yet)

## Notes

Any context that doesn't fit elsewhere — references to research docs, screenshots from discovery, links to ADRs in `specs/ARCHITECTURE.md`.
```

---

## Rules for the writer (`/spec-writing`)

- The Foundation Story (`US-000`) uses the same template. Its `Depends on` is `—`, its persona is typically `developer`, and its AC describe the walking skeleton (build passes, smoke endpoint, smoke UI, single Gherkin scenario).
- INVEST flags are recorded here AND mirrored to `stories[i].invest` in `specs/stories.json`. The two MUST stay consistent — `/spec-writing` writes both atomically.
- Rule IDs (`R-1`, `R-2`, …) are local to the story. They appear in the `Feature file → Covers rules` mapping table and as `Rule:` block titles inside the `.feature` files.
- Acceptance criteria are not repeated inside `.feature` files — they're translated into Gherkin scenarios. The AC list in `STORY.md` is the human view; the scenarios are the executable view.
- "Out of scope" is encouraged. Empty is a smell — every non-trivial story has things it deliberately leaves out.
- This template intentionally has no version-pinned paths and no version segment in any link. If you find yourself writing `docs/V{N}/…`, the migration is incomplete — stop and run `node scripts/migrate-tracking.mjs`.
