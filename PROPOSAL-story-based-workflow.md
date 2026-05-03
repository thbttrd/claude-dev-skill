# Proposal: Story-Based Workflow for the Dev Pipeline

**Branch:** `feat/story-based-workflow`
**Status:** Draft for review — no skills changed yet.
**Goal:** Re-architect the 13-skill dev pipeline (`high-level-scoping` → `verification-and-validation`) so the unit of planning, specification, implementation, and verification is the **user story**, not a numbered release. Eliminate `docs/V0/`, `docs/V1/`, … directories and the wave abstraction. Adopt a REASONS-canvas plan format inspired by [Martin Fowler — Structured Prompt-Driven Development](https://martinfowler.com/articles/structured-prompt-driven/).

---

## 1. Why change

The current pipeline assumes:

- A roadmap is a sequence of **versions** (V0, V1, V2). Every doc lives under `docs/V{N}/`.
- For N ≥ 1, each version is **seeded by duplicating** `docs/V{N-1}/` wholesale → the project carries N frozen copies of every spec / arch / plan / wireframe.
- Inside a version, the implementation unit is the **wave** — a horizontal grouping of stories (`docs/V{N}/plans/W1-…md`, `W2-…md`).
- The plan template is a list of **tasks** with RED-A / RED-B / GREEN / REFACTOR sections.

This produces:

- Heavy doc duplication on every version cut. A 6-feature project on V3 ships **4 × the docs**, most of them stale.
- A versioned mental model where adding a single feature requires picking "which version it lands in" before specifying it.
- Plans that read as task lists rather than structured prompts an agent can execute.
- Sprawling `project-tracking.json` with a `roadmap.versions[]` array as the central organising key.

The proposed model treats each **story** as the atomic unit. A story is INVEST-compliant (Independent, Negotiable, Valuable, Estimable, Small, Testable). It owns its own spec, mockups, plan, tests, and verification report. The "version" is implicit — it's the set of stories whose status is `verified`.

---

## 2. Target philosophy in one paragraph

> **A project is a backlog of INVEST stories. Each story is a self-contained slice with its own spec, plan, tests, and verification report living under `specs/story-NNN-slug/`. The first story (STORY-00) is the Foundation Story — a walking skeleton that proves the architecture end-to-end. Every subsequent story is a vertical slice that adds value on top of what is already verified. The plan for each story is a structured prompt in REASONS-canvas format (Requirements / Entities / Approach / Structure / Operations / Norms / Safeguards) plus an explicit Test Strategy and Test Plan, designed so an agent can execute it autonomously through RED → GREEN → REFACTOR.**

---

## 3. Folder layout: before vs after

### Before (current)

```
docs/
├── project-tracking.json
├── V0/
│   ├── specs/{SPECS.md, DESIGN.md, features/, mockups/, UI-F-*.md}
│   ├── architecture/{ARCHITECTURE.md, *.png}
│   ├── plans/{00-foundation.md, DAG.md, W1-*.md, W2-*.md, implementation-state.json}
│   └── qa-report.md
├── V1/        # full duplicate of V0 then mutated
└── V2/ ...
```

### After (proposed)

```
specs/
├── stories.json                       # NEW: master tracker (replaces project-tracking.json)
├── STORIES.md                         # NEW: human-readable kanban index
├── ARCHITECTURE.md                    # project-wide, evolves over time (no version dup)
├── architecture.png                   # project-wide diagrams
├── architecture-detailed.png
├── DESIGN.md                          # project-wide design system
├── PROJECT.md                         # project overview, NFRs, glossary, tech stack
├── story-000-foundation/
│   ├── STORY.md                       # the INVEST story (As a / I want / So that + AC)
│   ├── PLAN.md                        # NEW: REASONS-canvas structured prompt
│   ├── features/F-000-walking-skeleton.feature
│   ├── mockups/                       # optional, populated by /ui-specs
│   ├── verification/qa-report.md
│   └── state.json                     # per-story phase + checkpoints
├── story-001-user-auth-golden-path/
│   ├── STORY.md
│   ├── PLAN.md
│   ├── features/F-001-*.feature
│   ├── mockups/UI-F-001-*.html (+ -mobile.html)
│   ├── ui/UI-F-001-*.md
│   ├── verification/qa-report.md
│   └── state.json
├── story-002-…/
└── …
```

Key properties:

- **`docs/` is gone.** Everything is under `specs/`.
- **No version directories.** A "version" is now a query: `select stories where state.phase = 'verified'`.
- **No version snapshot rule.** Old stories don't get duplicated when new ones are added — they stay as they were the day they were verified, frozen by their state, not by being copied.
- **One folder per story.** A story owns its spec, plan, tests metadata, and verification report.
- **Project-level docs at the root of `specs/`.** ARCHITECTURE.md, DESIGN.md, PROJECT.md, stories.json, STORIES.md.

---

## 4. Tracking model: `specs/stories.json` + `specs/STORIES.md`

Replaces `docs/project-tracking.json` (which conflates personas, epics, modules, and a release roadmap).

### `specs/stories.json` (machine-readable)

```jsonc
{
  "project": {
    "name": "…",
    "description": "…",
    "created_at": "2026-05-03",
    "updated_at": "2026-05-03"
  },
  "personas":  [ { "id": "P-001", "name": "…", … } ],
  "epics":     [ { "id": "E-001", "title": "…", "persona_ids": ["P-001"], "story_ids": ["US-000","US-001"], "priority": "must-have" } ],
  "stories": [
    {
      "id": "US-000",
      "slug": "foundation",
      "title": "Foundation: walking skeleton",
      "is_foundation": true,
      "epic_id": "E-001",
      "as_a": "developer",
      "i_want": "an end-to-end app skeleton wired through every layer",
      "so_that": "the architecture is proven and ready for feature work",
      "priority": "must-have",
      "business_impact": "high",
      "invest": { "i": true, "n": true, "v": true, "e": true, "s": true, "t": true },
      "acceptance_criteria": ["…", "…"],
      "depends_on_story_ids": [],
      "phase": "verified",   // backlog | scoped | specced | planned | red | green | verified
      "artifacts": {
        "story_doc": "specs/story-000-foundation/STORY.md",
        "plan":      "specs/story-000-foundation/PLAN.md",
        "feature_files": ["specs/story-000-foundation/features/F-000-walking-skeleton.feature"],
        "mockups":   [],
        "qa_report": "specs/story-000-foundation/verification/qa-report.md"
      },
      "history": [
        { "phase": "scoped",   "at": "2026-05-03" },
        { "phase": "specced",  "at": "2026-05-03" },
        { "phase": "verified", "at": "2026-05-04" }
      ]
    }
    // …
  ],
  "architecture": {
    "modules":          [ { "id": "M-001", … } ],
    "detailed_modules": [ { "id": "BM-001", … } ],
    "tech_stack":       { … },
    "adrs":             [ … ],
    "diagram_path":          "specs/architecture.png",
    "detailed_diagram_path": "specs/architecture-detailed.png",
    "architecture_doc":      "specs/ARCHITECTURE.md"
  }
}
```

### `specs/STORIES.md` (human-readable kanban)

A pure rendering of `stories.json` for quick scanning. Stays in sync via the skill that touches it (manual edits OK; the skill regenerates the table on every status transition).

```md
# Stories

| ID     | Title                          | Epic   | Priority   | Phase     | Depends on |
| ------ | ------------------------------ | ------ | ---------- | --------- | ---------- |
| US-000 | Foundation: walking skeleton   | E-001  | must-have  | verified  | —          |
| US-001 | User auth golden path          | E-001  | must-have  | green     | US-000     |
| US-002 | Dashboard with stat cards      | E-002  | should-have | planned  | US-001     |
| US-003 | Account settings + edge cases  | E-003  | could-have | backlog   | US-001     |
```

The phase column **is** the version. Want to know what's shippable? Filter `phase = verified`. Want a release notes draft? List stories that flipped to `verified` since the last tag.

---

## 5. Pipeline at a glance

```
                   project-level (one-time / evolves)
   ┌─────────────────────────────────────────────────────────────┐
   │  /high-level-scoping   →  personas, epics, story backlog,    │
   │                            project-wide arch sketch,          │
   │                            stories.json + STORIES.md          │
   │  /research-and-architecture →  specs/ARCHITECTURE.md          │
   │  /ui-specs (project-wide bits) →  specs/DESIGN.md             │
   │  /repo-initialization  →  scaffolds the empty repo            │
   └─────────────────────────────────────────────────────────────┘
                            │
                            ▼  for each story (DAG order)
   ┌─────────────────────────────────────────────────────────────┐
   │ /spec-writing US-NNN          → STORY.md + features/*.feature│
   │ /ui-specs US-NNN              → mockups/ + UI-F-*.md (if UI) │
   │ /spec-writing-verification …  → audits the spec for INVEST + │
   │                                  Gherkin completeness         │
   │ /plan-writing US-NNN          → PLAN.md (REASONS canvas +     │
   │                                  Test Strategy + Test Plan)   │
   │ /plan-writing-verification …  → audits the plan               │
   │ /test-setup US-NNN            → RED state for the story       │
   │ /test-setup-verification …    → audits tests are real & RED   │
   │ /spec-implementation US-NNN   → GREEN: minimal impl that      │
   │                                  passes the tests + REFACTOR  │
   │ /verification-and-validation US-NNN → curl + Playwright walk- │
   │                                  through, fixes deviations    │
   └─────────────────────────────────────────────────────────────┘
                            │
                            ▼
   stories.json: phase ← "verified"; STORIES.md regenerates
```

The Foundation Story (`US-000`) is the first to walk through this pipeline. Every other story follows the same loop and only depends on previously verified stories (per `depends_on_story_ids`).

---

## 6. Per-skill changes

### 6.1 Summary table

| Skill                                  | Operates on               | Inputs from                               | Outputs into                                                                     | Major change                                                                                  |
| -------------------------------------- | ------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/high-level-scoping`                  | project (one-time)        | discovery interview                       | `specs/stories.json`, `specs/STORIES.md`, `specs/PROJECT.md`, `specs/architecture.png` | Drops `roadmap.versions`. Produces a **DAG of stories** instead. Emits Foundation Story (US-000). |
| `/spec-writing`                        | one story (`US-NNN`)      | `specs/stories.json`, persona context     | `specs/story-NNN-slug/STORY.md` + `features/F-NNN-*.feature`                     | Per-story scope. Adds **INVEST gate** before generation. No version directory.                 |
| `/spec-writing-verification`           | one story                 | the story dir                             | review report (inline)                                                           | Audits INVEST + Gherkin (no version snapshotting).                                             |
| `/ui-specs`                            | project-wide DESIGN.md (once) + per-story screens | the story dir, `specs/DESIGN.md` | `specs/DESIGN.md` (once), `specs/story-NNN-slug/{mockups, ui/UI-F-*.md}`         | Splits into project-wide (DESIGN.md) and per-story (screens).                                  |
| `/research-and-architecture`           | project-wide              | `specs/PROJECT.md`, `specs/stories.json`  | `specs/ARCHITECTURE.md`, `specs/architecture-detailed.png`                       | One project-wide ARCHITECTURE.md that **evolves** as new modules are needed.                   |
| `/research-and-architecture-verification` | project-wide           | `specs/ARCHITECTURE.md`, stories          | review report                                                                    | No version segmentation.                                                                       |
| `/repo-initialization`                 | project (one-time)        | `specs/ARCHITECTURE.md`, Foundation STORY | scaffolded repo                                                                  | Driven by Foundation Story (US-000), not by V0.                                                |
| `/repo-initialization-verification`    | project (one-time)        | repo state                                | review report                                                                    | Same shape, no version segmentation.                                                           |
| `/plan-writing`                        | one story (`US-NNN`)      | the story dir + `specs/ARCHITECTURE.md`   | `specs/story-NNN-slug/PLAN.md`                                                   | **REASONS canvas** instead of wave plan. **One plan per story**, no `WN-…md`.                  |
| `/plan-writing-verification`           | one story                 | PLAN.md                                   | review report                                                                    | Audits REASONS sections + Test Strategy + Test Plan, not waves.                                |
| `/test-setup`                          | one story                 | PLAN.md, feature files                    | step defs + unit tests + source stubs (RED)                                      | Per-story RED phase. Updates `state.json.phase = "red"`.                                       |
| `/test-setup-verification`             | one story                 | tests + stubs                             | review report                                                                    | Per-story.                                                                                    |
| `/spec-implementation`                 | one story                 | PLAN.md + RED tests                       | source code + GREEN tests                                                        | No more waves. One story = one GREEN run. Updates `phase = "green"` on success.                |
| `/verification-and-validation`         | one story (or full repo)  | running app + STORY.md + features         | `specs/story-NNN-slug/verification/qa-report.md`                                 | Per-story `curl` + Playwright walkthrough. Updates `phase = "verified"` on success.            |

### 6.2 Detail per skill — what concretely changes

For each skill, the concrete edit list (high level — exact diffs come during implementation):

#### `/high-level-scoping`
- Drop "Phase 4: Roadmap — Vertical Slices" version-by-version interview. Replace with **"Phase 4: Story DAG"** — interview produces a flat backlog of INVEST stories, plus per-story `depends_on_story_ids`, plus the explicit **Foundation Story** (`US-000`).
- Output `specs/stories.json` (new schema) + `specs/STORIES.md` + `specs/PROJECT.md` (extracts the project-level overview from what is currently in `SPECS.md`).
- Drop the `docs/V0/architecture/` path. Diagram + arch overview go to `specs/architecture.png` and `specs/ARCHITECTURE.md`.
- Drop the `roadmap.versions[]` array everywhere.
- Replace the JSON schema reference (`references/json-schema.md`) accordingly.

#### `/spec-writing`
- Accept a story arg: `/spec-writing US-001` (or `/spec-writing story-001` as alias). If no arg, ask via `AskUserQuestion` from the unscoped/unspecced stories.
- Add **INVEST gate** as Phase 0. For the chosen story, walk through I-N-V-E-S-T checks before doing any further interview. If the story fails INVEST (e.g., not Small), offer to split it into multiple stories — which triggers a recursive scoping update in `stories.json`.
- Drop "version snapshot" rule and "ensuring version directory" section.
- Output to `specs/story-NNN-slug/{STORY.md, features/F-NNN-*.feature}`.
- Drop `SPECS.md` per version (project-wide overview moves to `specs/PROJECT.md`, owned by `/high-level-scoping`).

#### `/ui-specs`
- Split: **project-wide DESIGN.md** (one-time per project; re-runnable to change brand) lives at `specs/DESIGN.md`. **Per-story mockups + screen specs** live under `specs/story-NNN-slug/`.
- Drop "version snapshot rule".
- Skill arg: `/ui-specs US-NNN` (per-story) or `/ui-specs --design-system` (project-wide).

#### `/research-and-architecture`
- Output `specs/ARCHITECTURE.md` once. Re-invocable to **extend** when a new story requires a new module / breaks an existing dependency boundary. Edits in place; ADRs accumulate over time.
- Drop "version snapshot" rule and the V{N} pinning of paths.
- Drop "specified_in_version" / "detailed_in_version" fields.

#### `/repo-initialization`
- Triggered explicitly by the Foundation Story workflow (or implicitly if the user invokes `/spec-implementation US-000` and the repo is empty).
- Reads `specs/ARCHITECTURE.md` (no version) and `specs/story-000-foundation/STORY.md` for context.
- All directory references drop the `docs/V{N}/` segment.

#### `/plan-writing`
- Accept `/plan-writing US-NNN`. One plan output: `specs/story-NNN-slug/PLAN.md`.
- Replace the **wave plan template** with the **REASONS-canvas plan template** (see §7 below).
- Drop `00-foundation.md`, `WN-…md`, `DAG.md`, `implementation-state.json` at the version level.
- The "DAG" is now a property of `stories.json` (`depends_on_story_ids`), not a per-version artifact. If a visual is wanted, generate `specs/STORIES-DAG.png` via `d2-architect` (optional).

#### `/test-setup`
- Per-story. Reads PLAN.md's Test Strategy + Test Plan + Operations sections.
- BDD toolchain pre-flight gate stays — same go/no-go behaviour, but checks `specs/story-NNN-slug/features/` instead of `docs/V{N}/specs/features/`.
- State: `specs/story-NNN-slug/state.json.phase = "red"` on success.

#### `/spec-implementation`
- Per-story. No more waves; the operations list inside PLAN.md is the execution order.
- Quality gates (Simplify / Code-Review / Verify) run **once per story** (at the end), not once per wave.
- State: `phase = "green"` on success.

#### `/verification-and-validation`
- Per-story by default (`/verification-and-validation US-NNN`).
- Optional `/verification-and-validation --all-pending` to walk through every story still in `green` and try to flip them to `verified`.
- Output: `specs/story-NNN-slug/verification/qa-report.md`.
- State: `phase = "verified"` on success.

#### Verification skills (`*-verification`)
- All take a story arg `US-NNN`. Drop version arg.
- Audit content scoped to the story dir.

---

## 7. The new plan: REASONS canvas + Test Strategy + Test Plan

The plan template moves from a flat task list to a **structured prompt** an agent can execute. Layout based on the [REASONS canvas](https://martinfowler.com/articles/structured-prompt-driven/) extended with explicit testing sections.

### File: `specs/story-NNN-slug/PLAN.md`

```markdown
# PLAN: US-NNN — <story title>

> **Story:** [STORY.md](./STORY.md) · **Features:** [F-NNN-*.feature](./features/F-NNN-….feature) · **Mockups:** [UI-F-NNN-*.html](./mockups/UI-F-NNN-….html)
> **Architecture:** [specs/ARCHITECTURE.md](../ARCHITECTURE.md) · **Design system:** [specs/DESIGN.md](../DESIGN.md)
> **Depends on:** US-000 (verified)
> **Generated:** YYYY-MM-DD by /plan-writing

---

## R — Requirements

What problem are we solving, and what is the Definition of Done?

- **Problem:** <one paragraph from the story>
- **DoD:** Every Gherkin scenario in `features/F-NNN-*.feature` passes via the BDD runner; every unit test for the story's modules passes; manual `curl` walkthrough matches the AC; UI walkthrough via Playwright matches the mockup.
- **Acceptance criteria** (mirrored from STORY.md):
  - [ ] AC-1 …
  - [ ] AC-2 …

## E — Entities

Domain entities involved and how they relate.

| Entity   | Owned by module | Key fields                        | Relationship                      |
| -------- | --------------- | --------------------------------- | --------------------------------- |
| Session  | BM-study        | id, userId, cards[], startedAt    | belongs_to User, has_many Card    |
| Card     | BM-cards        | id, question, answer, difficulty  | belongs_to Subtopic               |

## A — Approach

The strategy chosen, with alternatives explicitly considered.

- **Chosen approach:** <1-2 paragraphs describing the strategy>.
- **Alternatives rejected:**
  - <Alt 1> — rejected because <reason>.
  - <Alt 2> — rejected because <reason>.
- **Trade-offs accepted:** <what we are knowingly leaving on the table>.

## S — Structure

Where the change fits in the system. Files to create or modify, dependencies, contracts.

| Module / file                                | Role          | Action  |
| -------------------------------------------- | ------------- | ------- |
| `src/modules/study/study.service.ts`         | BM service    | modify  |
| `src/modules/study/types.ts`                 | BM types      | extend  |
| `src/modules/study-sessions/repo.ts`         | Infra repo    | create  |
| `src/app/study/page.tsx`                     | UI entrypoint | create  |
| `e2e/steps/study-session.steps.ts`           | BDD steps     | create  |

Dependency direction: study (BM) → study-sessions (Infra) only. No cross-BM imports.

## O — Operations

Concrete, ordered steps the agent will execute. Each operation is a TDD cycle.

### Operation 1 — <title>
**Covers scenarios:** <Scenario name(s) from .feature>
- **RED-A (BDD steps):** create/modify `e2e/steps/study-session.steps.ts`; bind `Given <pattern>`, `When <pattern>`, `Then <pattern>` to real Playwright/request actions; `bun bdd` must FAIL. Commit: `test(US-NNN): add BDD steps for <scenario>`.
- **RED-B (unit/integration):** create `src/modules/study/study.service.test.ts`; assert <behaviour>; use `FakeReviewRepository`; `bun test` must FAIL. Commit: `test(US-NNN): add failing tests for <scenario>`.
- **GREEN:** implement the minimum in `study.service.ts` to pass both. `bun test && bun bdd` PASS. Commit: `feat(US-NNN): implement <what>`.
- **REFACTOR:** clean obvious duplication, naming. `bun test && bun bdd` still PASS. Commit (optional): `refactor(US-NNN): <what>`.

### Operation 2 — …

## N — Norms

Cross-cutting engineering norms that apply to this story.

- Naming: kebab-case files, PascalCase classes, camelCase functions.
- Logging: every public service method logs entry + exit at debug level.
- Defensive coding: validate inputs at module boundaries; trust internal callers.
- Observability: every API route emits one structured log line per request.
- Style: no `any` types; explicit return types on exported functions.

## S — Safeguards

Non-negotiable boundaries — invariants, perf limits, security rules.

- **Invariants:** a Session cannot have zero cards; a Card cannot belong to two Subtopics.
- **Performance:** `startSession()` p95 ≤ 200 ms with 1 000 cards seeded.
- **Security:** session creation requires an authenticated user; users cannot read other users' sessions.
- **Data:** no destructive migration on existing tables; only additive schema changes.

---

## Test Strategy

How testing is approached for this story (the *how*, not the *what*).

- **Test pyramid:**
  - 1 BDD scenario per Gherkin scenario (Playwright via playwright-bdd) — exercises the running app end-to-end.
  - Sociable unit tests for BM services (Vitest), with hand-written fakes for repos.
  - Integration tests for Infra repos against a real test database (sqlite in-memory).
- **Doubles policy:** hand-written fakes only — no `vi.mock()`. Fakes live in `<module>/__tests__/fakes/`.
- **Test data:** seeded via the `request` fixture in BDD; via fake constructors in unit tests.
- **Determinism:** all tests must be deterministic; no real network, no real time. Inject a clock fake when time matters.
- **Coverage target:** every Gherkin scenario reaches GREEN; line coverage on BM modules ≥ 90%.
- **Performance assertions:** the perf invariants in Safeguards have a dedicated benchmark test.

## Test Plan

The exact tests to write for this story (the *what*). Each row is one test, traceable to a scenario or invariant.

| ID    | Type        | Scenario / invariant                              | File                                    | Asserts                                              |
| ----- | ----------- | ------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| T-01  | BDD         | "User starts a session with cards due"            | e2e/steps/study-session.steps.ts        | UI shows first due card after navigation             |
| T-02  | BDD         | "User starts a session with no cards due"         | e2e/steps/study-session.steps.ts        | Empty-state message visible                          |
| T-03  | unit        | startSession orders cards by difficulty           | study.service.test.ts                   | session.cards[0].difficulty === "beginner"           |
| T-04  | unit        | submitRating updates the card's interval          | study.service.test.ts                   | review.nextDueAt advances by SRS algorithm           |
| T-05  | integration | sessions repo persists and re-reads a session     | study-sessions.repo.int-test.ts         | created session returned identically by findById     |
| T-06  | bench       | Safeguard: startSession p95 ≤ 200ms @ 1k cards    | study.service.bench.ts                  | p95 ≤ 200ms                                          |

---

## Wave-style verification (kept, but per story)

After all operations are GREEN:

1. `bun test` — all unit + integration tests pass.
2. `bun bdd` — all Gherkin scenarios for this story pass (and previous stories don't regress).
3. `bun lint && bun typecheck` — clean.
4. Start app: `bun dev`. Hit `curl` against the new endpoints (script in `verification/curl-walkthrough.sh`).
5. Run the Playwright walkthrough described in STORY.md AC-N.
6. Write `verification/qa-report.md`.

## Completion criteria

- [ ] Every operation completed RED-A → RED-B → GREEN → REFACTOR.
- [ ] All tests in the Test Plan pass.
- [ ] Architecture compliance: no cross-BM imports, no foreign keys across modules.
- [ ] UI matches `mockups/UI-F-NNN-*.html` (visual diff via Playwright if the screen exists).
- [ ] No regressions in previously verified stories.
- [ ] `state.json.phase = "verified"`.
```

This template is the same for any story, including the Foundation Story. Foundation differs only in **Operations** (database schema bring-up, BM/Infra skeletons, shared kernel, test infrastructure) and in the AC of the STORY itself ("the dev environment runs end-to-end with one trivial happy path").

---

## 8. INVEST integration in `/spec-writing`

A new **Phase 0 — INVEST Gate** runs before any discovery / generation. For the chosen story:

| Letter | Question                                                                          | Auto-check                                                                       | Failure handling                                                                                                  |
| ------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **I**ndependent | Does this story depend on a not-yet-`verified` story not listed in `depends_on_story_ids`? | Cross-check against `stories.json`.                                              | Surface dependency, ask whether to add it or to merge stories.                                                    |
| **N**egotiable  | Is the story prescriptive about *how* (UI clicks, exact tech)?                    | Heuristic scan of the story body for technical jargon.                            | Suggest rephrasing toward outcomes; ask the user to confirm.                                                      |
| **V**aluable    | Is there a "So that <user benefit>" with a concrete benefit?                       | Required field in STORY.md.                                                       | Block until "So that" is filled with a real outcome.                                                              |
| **E**stimable   | Are the AC concrete enough to size the story?                                      | Heuristic: ≥ 2 AC, no AC contains "etc." / "and so on".                           | Ask for tighter AC.                                                                                               |
| **S**mall       | Will this fit in one focused agent loop (rough thumb: ≤ ~6 operations)?            | LLM judgement after drafting AC; can also use a story-points field if user opts in. | Offer to split into N stories. If user accepts, generate the new story stubs and update `stories.json` accordingly. |
| **T**estable    | Can each AC be turned into at least one Gherkin scenario?                          | Walk AC list, draft a Gherkin skeleton, check declarative-language rules.         | Block until each AC has a draftable scenario.                                                                     |

The gate is interactive (`AskUserQuestion`); it never silently rewrites the story.

---

## 9. The Foundation Story (US-000)

`US-000` is special only in role, not in shape. It is generated automatically by `/high-level-scoping` and uses the same files as any other story.

- **As a** developer, **I want** the project's architecture proven end-to-end through a single thinnest path, **so that** all subsequent stories can layer on top without surprises.
- **AC examples:**
  - The repo builds, tests run, type-check passes.
  - One smoke endpoint (e.g., `GET /health`) returns 200 from a real server.
  - One smoke UI route renders a page that hits one BM service that hits one Infra repo against a real DB.
  - A single Gherkin scenario (`features/F-000-walking-skeleton.feature`) walks through that path.
- **Plan:** uses the standard REASONS template; Operations include repo init, schema bring-up, the smoke endpoint + page, the BDD wiring.
- **Implementation:** when running `/spec-implementation US-000` against an empty repo, the skill chains `/repo-initialization` first, then proceeds with the GREEN phase.

This collapses the current "V0 walking skeleton + foundation wave + plain-old-foundation-plan" into a single story with the same lifecycle as everything else.

---

## 10. Migration: how we roll this out

We can land this in 8 PRs / commits on `feat/story-based-workflow`, each individually mergeable and testable:

1. **Schema + tracker.** Introduce `specs/stories.json` schema + `specs/STORIES.md` index. Provide a one-shot conversion script `scripts/migrate-tracking.mjs` that reads an existing `docs/project-tracking.json` and emits the new files.
2. **`/high-level-scoping` rewrite.** Drop the `roadmap.versions[]` flow; emit story DAG; write to `specs/`. Add Foundation Story emission. Update `references/json-schema.md`.
3. **`/research-and-architecture` rewrite.** Targets `specs/ARCHITECTURE.md` (no version segment). Re-invocable / additive. Drop `specified_in_version`.
4. **`/spec-writing` rewrite.** Accept `US-NNN` arg. Add INVEST gate (Phase 0). Output to `specs/story-NNN-slug/`. Drop version SPECS.md per version (move project-wide bits to `specs/PROJECT.md`).
5. **`/ui-specs` rewrite.** Split into project-wide DESIGN.md (re-runnable) + per-story screens.
6. **`/repo-initialization` rewrite.** Drive from Foundation Story; drop V{N} pinning.
7. **`/plan-writing` rewrite + new template.** Replace `references/plan-template.md` with REASONS template. Generate `specs/story-NNN-slug/PLAN.md`. Drop `WN-…md`, `DAG.md`, `00-foundation.md`. Update `references/dag-analysis.md` to apply at the story-DAG level.
8. **`/test-setup`, `/spec-implementation`, `/verification-and-validation` rewrites.** Per-story scope. Drop wave loops. Update `state.json` to live per-story. Update all the `*-verification` skills in lock-step (small follow-up commit per pair).

Each PR includes:
- The skill source change.
- The corresponding `references/*.md` updates.
- A note in `CHANGELOG.md` for the affected plugin.
- A `version` bump in the SKILL.md frontmatter (`1.0.0` → `2.0.0` because of the breaking IO change).

We will **not** maintain backwards compatibility with the `docs/V{N}/` layout — the migration script is the upgrade path. This keeps the skill bodies small and the story-based philosophy uncompromised.

---

## 11. Decisions (originally open questions)

All seven items confirmed. Recording them here so the doc is the authoritative record going into implementation:

1. **Story IDs.** ✅ Keep `US-NNN`. Folder slug is `story-NNN-slug/`; file paths still read naturally and existing tooling stays stable.
2. **Tracker format.** ✅ Keep both. `specs/stories.json` is the machine source of truth; `specs/STORIES.md` is the regenerated human-readable kanban.
3. **Project-wide overview.** ✅ Keep `specs/PROJECT.md` separate from `specs/ARCHITECTURE.md`. PROJECT.md owns NFRs, glossary, and a tech-stack pointer.
4. **Foundation skill behaviour.** ✅ `/spec-implementation US-000` auto-invokes `/repo-initialization` when the repo is empty AND `state.phase = "planned"`; otherwise it hard-stops with the missing prerequisite.
5. **Migration of `project-tracking.json`.** ✅ Best-effort `scripts/migrate-tracking.mjs` + a `specs/MIGRATION.md` for edge cases. Skills hard-stop on detected legacy layout (`docs/V*/` or `docs/project-tracking.json` present) with a one-line migration command in the error message.
6. **Loss of mid-version "wave verification".** ✅ Acceptable. Per-story verification is finer, not coarser; `state.phase` per story already gives the same observability. No substitute is added.
7. **`/loop` and `ralph-loop` integrations.** ✅ Keep, retargeted. The loop's per-story `state.json` lives at `specs/story-NNN-slug/state.json`. Stories with many operations (e.g., the Foundation Story) still benefit from the iteration budget.

---

## 12. What this proposal does NOT change

To keep the diff bounded:

- The d2-architect / html-architect skills are untouched. They keep producing diagrams; only the **paths they're invoked with** change (no more `docs/V{N}/architecture/`).
- The MIM AA architecture approach in `/research-and-architecture` is unchanged in substance — only its output path and "version snapshot" rule are dropped.
- The Gherkin / Cucumber / playwright-bdd toolchain pre-flight gate in `/test-setup` is unchanged.
- The conventional commits + Husky + Claude hooks scaffolded by `/repo-initialization` are unchanged.
- The discovery-checklist / specs-template / feature-file-template references are reused as-is (only the paths around them change).

---

## TL;DR

Move from "version + wave + docs/V{N}/" to "story + REASONS plan + specs/story-NNN-slug/". One folder per story, one tracker (`specs/stories.json`), one Foundation Story (`US-000`) instead of a V0 walking skeleton, RED/GREEN/REFACTOR preserved at the operation level inside each story's PLAN.md, INVEST enforced at spec time, and a single project-wide ARCHITECTURE.md that evolves over time. 8 commits to roll out, with a migration script for any existing project on the old layout.
