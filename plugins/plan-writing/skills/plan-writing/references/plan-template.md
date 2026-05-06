# PLAN.md Template — REASONS Canvas

Each story owns a `PLAN.md` at `specs/story-NNN-slug/PLAN.md`. It is a **structured prompt** an agent can execute autonomously, organised around the **REASONS canvas** (Requirements / Entities / Approach / Structure / Operations / Norms / Safeguards) plus an explicit **Test Strategy** and **Test Plan**.

Inspired by [Martin Fowler — Structured Prompt-Driven Development](https://martinfowler.com/articles/structured-prompt-driven/). Plans are dry — they describe *what* to build and *what to test*, never *how*. If you find yourself writing actual code in a plan, stop. Describe the component, don't implement it.

The plan is the durable artifact. When the implementation reality diverges from the plan, **fix the plan first, then update the code** — keeping intent and implementation aligned.

---

## File location

```
specs/story-NNN-slug/PLAN.md
```

One plan per story. There is no `00-foundation.md`, no `WN-…md`, no `DAG.md` — the DAG lives in `specs/stories.json` as each story's `depends_on_story_ids`. The Foundation Story (`US-000`) has its own `PLAN.md` like every other story; the only thing that distinguishes it is what's in its **Operations** (schema bring-up, BM/Infra skeletons, smoke endpoint + UI page) and the depth of its **Structure** (the entire scaffold's wiring).

---

## Template

```markdown
# PLAN: US-NNN — <Story title>

> **Story:** [STORY.md](./STORY.md) · **Features:** see `./features/F-*.feature`
> **Mockups:** [`mockups/UI-F-NNN-screen.html`](./mockups/UI-F-NNN-screen.html) (omit if no UI)
> **Architecture:** [`specs/ARCHITECTURE.md`](../ARCHITECTURE.md) · **Design system:** [`specs/DESIGN.md`](../DESIGN.md) (if UI)
> **Depends on:** US-XXX (verified), US-YYY (verified) — or "—" for the Foundation Story
> **Generated:** YYYY-MM-DD by `/plan-writing` · **Phase target:** planned → red → green → verified

---

## R — Requirements

What problem are we solving, and what is the Definition of Done?

- **Problem:** <one paragraph drawn from STORY.md's User Story + context>
- **Definition of Done:**
  - Every Gherkin scenario in `./features/F-*.feature` passes via the BDD runner.
  - Every unit test for the story's modules passes.
  - The Test Plan below has every row green.
  - Manual `curl` walkthrough matches the AC; UI walkthrough via Playwright matches the mockup (if UI).
  - `state.json.phase = "verified"` after `/verification-and-validation US-NNN`.
- **Acceptance criteria** (mirrored from STORY.md, traceability):
  - [ ] AC-1 — <observable behaviour>
  - [ ] AC-2 — <observable behaviour>

## E — Entities

Domain entities involved in this story and how they relate. Reference (don't redefine) entities owned by other modules — link to the owning module's section in `specs/ARCHITECTURE.md`.

| Entity     | Owned by module       | Key fields                          | Relationship                            |
| ---------- | --------------------- | ----------------------------------- | --------------------------------------- |
| Session    | BM-study              | id, userId, cards[], startedAt      | belongs_to User, has_many Card          |
| Card       | BM-cards (existing)   | (see ARCHITECTURE.md#bm-cards)      | belongs_to Subtopic                     |

If the story introduces a new entity, mark it as **NEW** and update `specs/ARCHITECTURE.md`'s data ownership map accordingly (re-invoke `/research-and-architecture` if the change is non-trivial).

## A — Approach

The strategy to satisfy the requirements. Surface the trade-offs explicitly so reviewers can challenge them.

- **Chosen approach:** <1-3 paragraphs describing the strategy at the level of "we route X through Y because Z". No code.>
- **Alternatives rejected:**
  - <Alt 1> — rejected because <reason>.
  - <Alt 2> — rejected because <reason>.
- **Trade-offs accepted:** <what we knowingly leave on the table — e.g., "no caching layer in this story; revisit when load > N rps">.

## S — Structure

Where the change fits in the system. Files to create or modify, dependencies, contracts. Reference `specs/ARCHITECTURE.md` for the canonical module map; the table below lists what *this story* touches.

| Module / file                                          | Role                | Action      |
| ------------------------------------------------------ | ------------------- | ----------- |
| `src/modules/study/study.service.ts`                   | BM service          | modify      |
| `src/modules/study/types.ts`                           | BM types            | extend      |
| `src/modules/study-sessions/repo.ts`                   | Infra repo          | create      |
| `src/modules/study-sessions/schema.ts`                 | DB schema           | extend      |
| `src/app/study/page.tsx`                               | UI entrypoint       | create      |
| `src/app/api/study/sessions/route.ts`                  | API entrypoint      | create      |
| `e2e/steps/study-session.steps.ts`                     | BDD steps           | create      |
| `src/modules/study/__tests__/study.service.test.ts`    | unit tests          | create      |
| `src/modules/study-sessions/__tests__/repo.int.test.ts` | integration tests  | create      |

**Dependency direction:** `study (BM) → study-sessions (Infra)` only. No cross-BM imports introduced. Bootstrap goes through `getStudyService()` exported from `study-sessions/index.ts`, matching the pattern in `specs/ARCHITECTURE.md`.

## O — Operations

Concrete, ordered steps the agent will execute. Each operation is one TDD cycle (RED-A → RED-B → GREEN → REFACTOR). One operation maps to one Gherkin Rule by default; complex Rules may need two operations.

### Operation 1 — <descriptive title>

**Covers scenarios:** <Scenario name(s) from .feature file>
**Module:** <module name from Structure>

- **RED-A (BDD steps):** create/modify `e2e/steps/study-session.steps.ts`. Bind `Given <pattern>`, `When <pattern>`, `Then <pattern>` to real Playwright/`request` actions (real navigation, real API calls, real DOM assertions — no empty-callback placeholders). Run `bun bdd` → MUST FAIL. Commit: `test(US-NNN): add BDD steps for <scenario>`.
- **RED-B (unit/integration):** create `<test file path>`. Test type: <sociable unit with fakes | integration with real DB>. Assert <behaviour>. Hand-written fakes: <list>. Run `bun test` → MUST FAIL. Commit: `test(US-NNN): add failing tests for <scenario>`.
- **GREEN:** implement the minimum in `<source file path>` to pass both. Place code in the correct module per Structure. Run `bun test && bun bdd` → ALL PASS. Commit: `feat(US-NNN): implement <what>`.
- **REFACTOR (optional):** clean obvious duplication, naming. `bun test && bun bdd` still PASS. Commit: `refactor(US-NNN): <what>`.

### Operation 2 — …

(Repeat for every Rule the story has. Aim for ≤ 6 operations — if the story needs more, the INVEST `S` (Small) check probably failed and the story should have been split during `/spec-writing`.)

## N — Norms

Cross-cutting engineering norms that apply to this story. Pull from `specs/ARCHITECTURE.md`'s Best Practices section and from the project's `CLAUDE.md`. List only what is **load-bearing** for this story; don't restate the whole rulebook.

- **Naming:** kebab-case files, PascalCase classes, camelCase functions.
- **Logging:** every public service method emits one structured log line at debug level on entry and exit.
- **Defensive coding:** validate inputs at module boundaries; trust internal callers.
- **Observability:** every API route emits one structured log line per request with the story id (`US-NNN`) tagged.
- **Style:** no `any` types; explicit return types on exported functions.
- **Architecture compliance:** no cross-BM imports; no foreign keys across modules; all inter-module access through the module's `index.ts` public API.

## S — Safeguards

Non-negotiable boundaries — invariants, performance limits, security rules. These are *bright lines*: if a Safeguard is violated, the implementation is wrong, regardless of what the tests say.

- **Invariants:** <e.g., "a Session cannot have zero cards", "a Card cannot belong to two Subtopics">.
- **Performance:** <e.g., "`startSession()` p95 ≤ 200 ms with 1 000 cards seeded — assert via the bench test in the Test Plan">.
- **Security:** <e.g., "session creation requires an authenticated user; users cannot read other users' sessions">.
- **Data:** <e.g., "no destructive migration on existing tables; only additive schema changes">.

---

## Test Strategy

How testing is approached for this story (the *how*, not the *what*). Anchored to `specs/ARCHITECTURE.md`'s Testing Strategy section — overrides only.

- **Test pyramid for this story:**
  - 1 BDD scenario per Gherkin scenario (Playwright via playwright-bdd) — exercises the running app end-to-end.
  - Sociable unit tests for BM services, with hand-written fakes for repos.
  - Integration tests for Infra repos against a real test database.
  - Bench tests for any performance Safeguard.
- **Doubles policy:** hand-written fakes only. No `vi.mock()`, no `jest.fn()`. Fakes live in `<module>/__tests__/fakes/`.
- **Test data:** seeded via the `request` fixture in BDD; via fake constructors in unit tests; via SQL fixtures in integration tests.
- **Determinism:** all tests must be deterministic. No real network. No real time — inject a clock fake when time matters.
- **Coverage target:** every Gherkin scenario reaches GREEN; line coverage on touched BM modules ≥ 90%.
- **Performance assertions:** the perf invariants in Safeguards have a dedicated benchmark test.

## Test Plan

The exact tests to write for this story (the *what*). Each row is one test, traceable to a scenario or invariant **and tagged with the Operation that owns it**. `/test-setup US-NNN [Op-X]` reads only the rows whose `Op` column matches the requested Operation; `/spec-implementation US-NNN [Op-X]` makes those rows green; `/verification-and-validation US-NNN` re-runs the whole table as part of the QA pass.

| ID    | Op    | Type         | Scenario / invariant                                  | File                                                            | Asserts                                                       |
| ----- | ----- | ------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| T-01  | Op-1  | BDD          | "User starts a session with cards due"                | e2e/steps/study-session.steps.ts                                | UI shows first due card after navigation                      |
| T-02  | Op-1  | BDD          | "User starts a session with no cards due"             | e2e/steps/study-session.steps.ts                                | Empty-state message visible                                   |
| T-03  | Op-1  | unit         | startSession orders cards by difficulty               | src/modules/study/__tests__/study.service.test.ts                | session.cards[0].difficulty === "beginner"                    |
| T-04  | Op-2  | unit         | submitRating updates the card's interval              | src/modules/study/__tests__/study.service.test.ts                | review.nextDueAt advances by SRS algorithm                    |
| T-05  | Op-3  | integration  | sessions repo persists and re-reads a session         | src/modules/study-sessions/__tests__/repo.int.test.ts            | created session returned identically by findById              |
| T-06  | Op-2  | bench        | Safeguard: startSession p95 ≤ 200ms @ 1k cards        | src/modules/study/__tests__/study.service.bench.ts               | p95 ≤ 200ms                                                   |

Each row references a Gherkin scenario (by name), an AC (by id), or a Safeguard. Untraceable rows are not allowed — every test must justify its existence by referencing the spec.

The `Op` column anchors each test to the Operation that introduces it, so per-Operation skills (`/test-setup US-NNN Op-X`, `/spec-implementation US-NNN Op-X`, `/spec-implementation-verification US-NNN Op-X`) can filter the table deterministically. Multiple rows may share the same `Op`. Every row MUST have an `Op` value; rows with no Operation owner are flagged by `/plan-writing-verification`.

---

## Verification (per story)

After all Operations are GREEN:

1. `bun test` — all unit + integration tests pass (story + previously verified stories).
2. `bun bdd` — all Gherkin scenarios for this story pass; previously verified stories don't regress.
3. `bun lint && bun typecheck` — clean.
4. Start the app: `bun dev`. Run `curl` walkthrough (script in `./verification/curl-walkthrough.sh` if needed).
5. Run the Playwright walkthrough described in STORY.md AC-N (if UI).
6. Write `./verification/qa-report.md` summarising tests passed, scenarios verified, fixes applied.

## Completion criteria

- [ ] Every operation completed in RED-A → RED-B → GREEN → REFACTOR order.
- [ ] Every row in the Test Plan is GREEN.
- [ ] Architecture compliance: no cross-BM imports, no foreign keys across modules, no infrastructure types in BM public APIs.
- [ ] UI matches `mockups/UI-F-NNN-*.html` (visual diff via Playwright if UI).
- [ ] No regressions in previously verified stories.
- [ ] `state.json.phase = "verified"`; `specs/stories.json#stories[i].phase = "verified"`.
- [ ] `specs/STORIES.md` regenerated to reflect the new phase.
```

---

## Rules for the planner (`/plan-writing`)

- **Plans are dry — zero code.** Describe components and contracts, not implementations.
- **One plan per story.** Period.
- **Reference, don't restate.** Architecture goes in `specs/ARCHITECTURE.md`. STORY.md owns the User Story. PLAN.md lives in the *gap* between them: how to actually do this story.
- **Operations ≤ 6 by default.** If a story needs more, suspect the INVEST `S` check missed something — surface it back to `/spec-writing` for a split.
- **Test Plan rows must be traceable.** Every row points to a scenario, an AC, or a Safeguard. No untraceable tests.
- **Every Test Plan row MUST have an `Op` value** matching one of the Operations defined above. The per-Operation skills filter the table by this column — rows with no Operation owner can never be picked up by `/test-setup US-NNN Op-X`.
- **Safeguards are non-negotiable.** They override the Test Plan in case of conflict — if a Safeguard is violated by an otherwise-passing implementation, the implementation is wrong.
- **The plan is the durable artifact.** When reality diverges, fix the plan first, then the code.
