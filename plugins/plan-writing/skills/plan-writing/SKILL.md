---
name: plan-writing
version: 2.1.0
description: >
  Plans the implementation of one **user story** at a time (US-NNN) — not a
  release, not a wave. Reads the story's STORY.md + features + the project-wide
  ARCHITECTURE.md and produces a single PLAN.md in the **REASONS canvas**
  format (Requirements / Entities / Approach / Structure / Operations / Norms /
  Safeguards) plus an explicit Test Strategy and Test Plan. Plans are dry —
  zero code. Each Operation prescribes RED-A → RED-B → GREEN → REFACTOR. The
  story DAG lives in specs/stories.json (depends_on_story_ids); this skill
  does not produce any DAG artifact of its own. Use this skill after a story
  is specced (phase = specced), before /test-setup. Triggers on: "plan US-NNN",
  "plan this story", "write the plan", "/plan-writing US-NNN", or any request
  to produce an implementation plan for a single story.
---

# Plan Writing (story-based, REASONS canvas)

Plans the implementation of **one story at a time** (`US-NNN`). Reads the story's spec from `specs/story-NNN-slug/STORY.md` + its `.feature` files, the project-wide architecture from `specs/ARCHITECTURE.md`, and produces a single `specs/story-NNN-slug/PLAN.md` in the **REASONS canvas** format.

The plan is a **structured prompt** an agent (or human) can execute autonomously: it captures the WHY (Requirements), the WHAT (Entities, Approach, Structure), and the HOW (Operations, Test Strategy, Test Plan), with non-negotiable boundaries (Safeguards) at the end. RED → GREEN → REFACTOR is preserved at the **Operation** level inside the plan; the story is the unit of *planning* and the operation is the unit of *execution*.

There is no separate `00-foundation.md`, no `WN-…md`, no `DAG.md`, no `implementation-state.json` per version. The DAG lives in `specs/stories.json#stories[i].depends_on_story_ids`. Per-story execution state lives in `specs/story-NNN-slug/state.json` (created by `/test-setup` and updated as the story progresses).

---

## Pre-Flight

| Check                                                | Action                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                                   |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                        |
| Target story id missing                              | Use `AskUserQuestion` to list stories whose `phase = specced` and pick one.                                                                            |
| Story's `phase` is not `specced` (or `planned` for re-runs) | Hard-stop. Print: `Story US-NNN must be specced before planning. Run /spec-writing US-NNN first.`                                                |
| `specs/story-NNN-slug/STORY.md` does not exist       | Hard-stop with the same message.                                                                                                                        |
| `specs/ARCHITECTURE.md` does not exist               | Hard-stop. Print: `No specs/ARCHITECTURE.md found. Run /research-and-architecture first.`                                                              |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop. Print which dependency is missing and what to do (`/spec-implementation US-XXX` or similar). |

---

## Integration with `specs/stories.json`

**Reading:**

- The target story (`stories[i]` where `id = "US-NNN"`)
- Its `depends_on_story_ids` — every dependency must already be `verified` (or `is_foundation: true`)
- `architecture.modules` and `architecture.detailed_modules` — the module map this story will sit inside
- `personas` and the relevant epic — for context on user goals

**Writing back** (read-merge-write):

- `stories[i].artifacts.plan = "specs/story-NNN-slug/PLAN.md"`
- `stories[i].planning = { operations_count: <N>, planned_at: "<today>" }`
- `stories[i].phase = "planned"`
- Append `{ phase: "planned", at: "<today>" }` to `stories[i].history`
- Update `project.updated_at`
- Regenerate `specs/STORIES.md` from the updated tracker

NEVER delete or overwrite fields owned by another skill.

---

## Phase 1: Read Inputs

Read **only** what's relevant to the target story:

- `specs/story-NNN-slug/STORY.md` — the User Story, AC, Rules, INVEST table, links to mockups (if UI)
- `specs/story-NNN-slug/features/F-*.feature` — Gherkin scenarios (every Rule, every scenario)
- `specs/story-NNN-slug/ui/UI-F-*.md` (if UI) — per-screen specs
- `specs/story-NNN-slug/mockups/UI-F-*.html` (if UI) — visual ground truth
- `specs/ARCHITECTURE.md` — module map, dependency graph, data ownership, testing strategy, ADRs
- `specs/PROJECT.md` — NFRs, glossary, tech-stack pointer
- `specs/DESIGN.md` (if UI) — design tokens
- `specs/stories.json` — full context, including dependencies that this story builds on

---

## Phase 2: Build the REASONS Canvas

For each section of the canvas, draft content from the inputs. Read `references/plan-template.md` for the exact template structure.

### R — Requirements

- Pull the User Story and AC from `STORY.md`.
- Restate the Definition of Done in concrete, testable terms.
- Mirror the AC checkboxes for traceability.

### E — Entities

- For each domain object the story touches: name, owning module, key fields, relationships.
- Mark NEW entities explicitly. If the story introduces a non-trivial new entity, this is a signal the architecture needs a re-pass via `/research-and-architecture`.

### A — Approach

- Articulate the strategy in 1-3 paragraphs at the level of "we route X through Y because Z".
- List 1-3 alternatives that were considered and rejected, each with a one-sentence reason.
- Surface trade-offs explicitly — what we're knowingly leaving on the table.

### S — Structure

- Build a table of every file the story creates or modifies, with role and action.
- State the dependency direction in plain language and confirm it doesn't violate `specs/ARCHITECTURE.md`.
- Reference the bootstrap pattern (e.g., `getStudyService()`).

### O — Operations

- Walk the Gherkin Rules; group them into operations (default: one Rule = one operation).
- For each operation, prescribe RED-A → RED-B → GREEN → REFACTOR with concrete file paths, test types, fakes needed, and exact commit messages.
- Aim for ≤ 6 operations. If you need more, the story is too big — surface it to the user with `AskUserQuestion`: "This story has N rules requiring M operations. Should we split into multiple stories?"

### N — Norms

- Pull the cross-cutting norms from `specs/ARCHITECTURE.md`'s Best Practices section and the project's `CLAUDE.md`.
- List **only what is load-bearing for this story** — naming, logging, defensive coding, observability, style, architecture compliance.

### S — Safeguards

- Identify the bright lines: invariants the story MUST preserve, performance limits, security rules, data rules.
- Each Safeguard MUST be observable — the Test Plan will have a row for each one (or a clear note explaining why a Safeguard cannot be tested directly, e.g., "no destructive migration" is enforced by code review, not a test).

---

## Phase 3: Test Strategy

Capture the *how* of testing for this story:

- Test pyramid for the story (BDD, sociable unit, integration, bench)
- Doubles policy (hand-written fakes only)
- Test data approach
- Determinism rules
- Coverage target
- Performance assertions

Anchor to `specs/ARCHITECTURE.md`'s Testing Strategy section. Document only **overrides** specific to this story.

---

## Phase 4: Test Plan

Build a row-per-test table. Each row:

- Has an id (`T-01`, `T-02`, …)
- Has an `Op` value (`Op-1`, `Op-2`, …) matching one of the Operations defined above
- Names the test type (`BDD | unit | integration | bench`)
- References a Gherkin scenario, an AC id, or a Safeguard — the Asserts column makes the link concrete
- Names the file path where the test lives

Every Gherkin scenario gets at least one BDD row. Every AC gets at least one row (BDD or unit). Every Safeguard with an observable assertion gets a row (often a bench or integration test).

**No untraceable rows.** A test that doesn't reference a spec artifact is a test without a reason.

**Every row MUST have an `Op` value.** The per-Operation skills (`/test-setup US-NNN Op-X`, `/spec-implementation US-NNN Op-X`, `/spec-implementation-verification US-NNN Op-X`) filter the table by this column to know which tests to write, implement, or audit for the requested Operation. A row with no `Op` value can never be picked up by these skills.

---

## Phase 5: Write `PLAN.md`

Assemble the canvas + Test Strategy + Test Plan + Verification + Completion Criteria into `specs/story-NNN-slug/PLAN.md` using `references/plan-template.md`. Apply the rules in the template's "Rules for the planner" section.

---

## Phase 6: Update `specs/stories.json`

Read the existing file, merge in:

- `stories[i].artifacts.plan = "specs/story-NNN-slug/PLAN.md"`
- `stories[i].planning = { operations_count: <count from Operations>, planned_at: "<today>" }`
- `stories[i].phase = "planned"`
- Append a history entry: `{ phase: "planned", at: "<today>" }`
- Update `project.updated_at`

Regenerate `specs/STORIES.md` so the kanban shows the new phase.

---

## Phase 7: Report

1. Verify `PLAN.md` exists and is non-empty.
2. Report to the user:
   - Story: US-NNN — title
   - Operations count
   - Test Plan row count (BDD / unit / integration / bench breakdown)
   - Files to be created / modified
3. Use `AskUserQuestion`:
   - **Header: "Next"** — "Plan for US-NNN is ready. What's next?"
     - "Run plan verification (Recommended)" — `/plan-writing-verification US-NNN`
     - "Move to /test-setup US-NNN" — start the RED phase
     - "Adjust the plan" — describe changes; loop back
     - "Plan another story" — pick a new story

---

## Foundation Story (US-000)

The Foundation Story uses the **same template**. What's different is the content:

- **Approach** describes the walking-skeleton path (one BM, one Infra, one route, one page, one Gherkin scenario).
- **Structure** is the largest of any plan — it lists the entire scaffold's wiring (DB schema, BM/Infra skeletons, shared kernel, test infrastructure, smoke endpoint, smoke UI).
- **Operations** include repo-init handoff (`/repo-initialization` chain) if the repo is empty, then schema bring-up, then the smoke endpoint + UI, then the BDD wiring.
- **Test Plan** has one BDD row (the smoke scenario) and a few unit/integration rows for the shared kernel and infrastructure utilities.
- **Safeguards** are sparse but present: "the dev environment runs", "type-check passes", "lint passes".

---

## Key Design Principles

### One plan per story

There is exactly one `PLAN.md` per story. Period. Stories are the unit of planning.

### Plans are dry (zero code)

Plans describe *what* to build and *what to test*, never *how*. If you find yourself writing actual code in a plan — stop. Describe the component, don't implement it.

### TDD is non-negotiable

Every Operation prescribes: BDD steps first (RED-A), unit/integration tests second (RED-B), implementation third (GREEN), refactor fourth (optional). The cycle is explicit.

### Architecture compliance is baked in

Every Operation specifies which module the code belongs to. Cross-module imports are forbidden by `specs/ARCHITECTURE.md`'s rules; the plan reinforces them in the Norms and Safeguards sections.

### One Rule ≈ one Operation

The Gherkin `Rule:` block is the natural unit of work. By default, one Rule maps to one Operation.

### The plan is the durable artifact

When reality diverges, fix the plan first, then the code. This keeps intent and implementation aligned (the principle from Martin Fowler's structured-prompt-driven-development article).
