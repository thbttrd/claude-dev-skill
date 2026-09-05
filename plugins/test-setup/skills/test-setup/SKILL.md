---
name: test-setup
version: 3.3.0
description: >
  Per-Operation RED-phase scaffolder. For ONE Operation of ONE story (US-NNN
  Op-X) at a time, writes the BDD step definitions and unit/integration tests
  prescribed by that Operation's row(s) in PLAN.md (REASONS canvas Test Plan),
  plus the minimal source stubs the new tests need to compile. Tests are real
  — they call actual API endpoints, service methods, and functions — but
  those implementations are empty stubs, so tests fail at assertion time, not
  because of missing imports. Operates after /plan-writing US-NNN, before
  /spec-implementation US-NNN Op-X. The Op-X arg is optional; with no Op-X,
  the skill auto-picks the next pending Operation from state.json. Triggers
  on: "set up tests for US-NNN", "RED Op-2 of US-001", "scaffold the next
  failing test", "/test-setup US-NNN", "/test-setup US-NNN Op-X".
---

# Test Setup (per Operation)

Writes the BDD step definitions, unit tests, and source stubs **for one Operation of one story** at a time. When the skill finishes, that Operation is in a RED state: every test it owns runs, every test fails, and every failure points at a real behavioural gap — not a missing import or an empty `test.todo()`.

The skill reads the story's `PLAN.md` (REASONS canvas), filters the Test Plan to rows where `Op = Op-X`, and turns those rows into actual files. It also reads the matching Operation's RED-A (BDD steps) and RED-B (unit/integration) sections to know what file to write where. Stubs are created lazily — only the files this Operation's tests import that don't exist yet.

The story is the unit of _planning_; the Operation is the unit of _execution_. Every Operation cycles RED-A → RED-B → GREEN → REFACTOR independently, and the per-story `state.json` tracks each Operation's `operation_phase` cursor.

## Prerequisites

- Scoping: `specs/stories.json` exists with the target story present
- Spec: `specs/story-NNN-slug/STORY.md` + `features/F-*.feature`
- Plan: `specs/story-NNN-slug/PLAN.md` (REASONS canvas with Test Plan rows tagged with `Op` values)
- Repo scaffolded (`package.json` exists with the BDD runner wired)
- Per-story state file: `specs/story-NNN-slug/state.json` (created on first invocation if missing)

## Pre-Flight

| Check                                                                                    | Action                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                                                              | Hard-stop with the migration command.                                                                                                                                                                                                                                      |
| `specs/stories.json` does not exist                                                      | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                                                                                                                                            |
| Target story id missing                                                                  | Use `AskUserQuestion` to list stories whose `phase ∈ {planned, red}` and pick one.                                                                                                                                                                                         |
| Story's `phase` is not `planned` or `red`                                                | Hard-stop. Print: `Story US-NNN must be planned or red before test-setup. Run /plan-writing US-NNN first.`                                                                                                                                                                 |
| `specs/story-NNN-slug/PLAN.md` does not exist                                            | Hard-stop with the same message.                                                                                                                                                                                                                                           |
| BDD toolchain not wired (first invocation only)                                          | Run the **BDD Toolchain Pre-Flight** gate below. If any check fails, emit `TOOLING_NOT_READY` and stop without writing tests.                                                                                                                                              |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop with the dependency name and the suggested fix.                                                                                                                                                                                                                  |
| `state.json.schema_version < 2`                                                          | Run the v1 → v2 migration (see `references/state-schema.md`; a legacy file without an `operations` map is rebuilt from PLAN.md first) atomically, commit it, then continue.                                                                                                                                                                                    |
| `specs/autopilot.json` has `"active": true` (or env `AUTOPILOT=1`)                       | Follow `references/autopilot-contract.md` §1–2 for this whole invocation: no `AskUserQuestion`, take the _(Recommended)_ option, journal decisions and gates, stop only on the contract's hard conditions. Journaling (§3) and toolchain resolution (§4) apply regardless. |

## BDD Toolchain Pre-Flight (hard go/no-go gate)

Runs **only on the first per-story invocation** (when `state.json` is absent OR every Op's `operation_phase = "pending"`). Subsequent per-Op invocations skip this gate.

Four checks (unchanged from v2): BDD dependency declared in `package.json` (`playwright-bdd` or `@cucumber/cucumber`); wiring file consumes `.feature` files at `specs/story-*/features/**/*.feature`; discovery dry-run succeeds; every `.feature` file parses. If any fails, emit `TOOLING_NOT_READY` with specific remediation steps. Under autopilot this is hard stop `tooling_not_ready` (contract §2).

---

## Resolving the target Operation

The skill accepts `/test-setup US-NNN [Op-X]`. The `Op-X` arg is optional and case-insensitive (`Op-2`, `op2`, `Op2` all normalize to `Op-2`).

```
If Op-X passed explicitly:
  Validate Op-X exists in PLAN.md.
  If Op-X.operation_phase ≥ red AND not --force → "Op-X is already RED. Pass --force to redo."
  Else → use Op-X.

If no Op-X passed (smart default):
  Pick the first Op where operation_phase ∉ {red, green, refactored} (i.e. the cursor rule: current_operation = first Op not yet RED-complete for this skill; the shared rule across skills is "first Op not yet GREEN").
  If none → "All ops are RED. Did you mean /spec-implementation US-NNN?"
```

The chosen Op-X is written to `state.json.current_operation`.

**Pre-existing RED suite.** On a repo onboarded by `/migrate-specs`, or after a v1 `/test-setup`, the tests for Op-X may already exist. Before Phase 2: if every file named in Op-X's RED-A and RED-B sections exists and the Op-filtered suites (contract §4 — tag, then scenario names, then file paths) run RED, do not rewrite them. Record the `test_plan_rows` for Op-X (`written: true, passing: false`), journal the decision `pre-existing RED suite for Op-X: <n> files, <m> failing`, skip Phases 2–4 and continue at Phase 5. If one of those suites is green, Op-X is not RED: fall through to the normal phases for the rows that are green. The picker itself is unchanged — an Op the migration already marked `red` is not re-picked (it says so); this branch covers Ops still `pending` whose files exist.

---

## Integration with `specs/stories.json`

**Reading:**

- The target story (`stories[i]` where `id = "US-NNN"`)
- Its `phase` (must be `planned` or `red`)
- Its `depends_on_story_ids` — every dependency must be `verified` (or `is_foundation: true`)

**Writing back:**

The story's project-level `phase` flips from `planned → red` **on the first Op's first RED-A**, then stays sticky through all subsequent per-Op invocations. Subsequent invocations only update `state.json`, never `stories.json`.

On that first transition:

- Set `stories[i].phase = "red"`.
- Append `{ phase: "red", at: "<today>" }` to `stories[i].history`.
- Update `project.updated_at`.
- Regenerate `specs/STORIES.md`.

When the **last** Op of the story reaches `operation_phase = "red"`, write the story-level `test_setup` summary block:

- `stories[i].test_setup = { bdd_step_files: <count>, unit_test_files: <count>, integration_test_files: <count>, completed_at: "<today>" }`.
- No new history entry.
- Regenerate `specs/STORIES.md` (so it shows the up-to-date `test_setup` counts).

---

## Per-Story State File

`specs/story-NNN-slug/state.json` (v2). Full schema in `references/state-schema.md`. Key per-Op fields:

- `current_operation` — cursor for the smart default
- `operations[Op-X].operation_phase` — `pending → red_a → red_b → red → green → refactored`
- `operations[Op-X].red_audit` — populated by `/test-setup-verification`
- `test_plan_rows[T-N].op` — the Op tag from PLAN.md's Test Plan

Update `state.json` after every commit. The picker reads `current_operation` to resume on the next invocation.

---

## Execution: One Operation, RED-A then RED-B then stubs

The skill operates on **one Operation per invocation**. Process the following phases in order; commit after each.

### Phase 1 — Read the slice of PLAN.md that matters

Read PLAN.md and extract:

- The `### Operation X — <title>` section for the chosen Op (RED-A description, RED-B description, GREEN/REFACTOR descriptions for context only).
- The Test Plan rows where the `Op` column equals the chosen Op's id.
- The Structure table (full — needed to know which files exist and which need stubbing).
- The Test Strategy (read-only — guides patterns: hand-written fakes, determinism, etc.).

If a Test Plan row has no `Op` value (legacy v1 plan), fall back to matching by scenario name from the Op's `Covers scenarios:` line.

Rows typed `manual` are not written. Record each as `test_plan_rows[T-N] = { type: "manual", op: "Op-X", file: <qa-report path>, written: false, passing: false }`. If every row of Op-X is manual, skip Phases 2–4, set `Op-X.tests_status = "manual"`, and treat Op-X as RED in Phase 5; journal the decision.

### Phase 2 — Write RED-A (BDD step definitions)

For every BDD-typed Test Plan row tagged `Op-X`, create or update the step definition file referenced in the row (typically `e2e/steps/<feature-slug>.steps.ts`). The Operation's RED-A description in PLAN.md states the exact bindings.

Step definitions must contain real Playwright/`request` interactions — navigation, clicks, form fills, real DOM/API assertions. NOT empty callbacks with comments. UI tests use `page`, API-only steps use `request`, shared setup steps live in `e2e/steps/shared-state.ts`.

**Never edit `specs/**/*.feature`.** Select this Operation's scenarios per `references/autopilot-contract.md` §4: by `@Op-X` tag if the feature files already carry one, otherwise by scenario name from the Operation's `Covers scenarios:` line.

Run `<BDD>` with the Op filter (§4). **Every selected scenario MUST FAIL** at assertion time, not at compile time. Commit:

```
test(US-NNN): add BDD steps for Op-X — <operation title>
```

Journal: `node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "test(US-NNN): add BDD steps for Op-X"` (contract §3, §5).

Update `state.json`: `Op-X.operation_phase = "red_a"`, `Op-X.tests_status = "in_progress"`. For each `T-N` row written, append/update `test_plan_rows[T-N] = { type: "BDD", op: "Op-X", file: <path>, written: true, passing: false }`.

### Phase 3 — Write RED-B (unit / integration / bench)

For every non-BDD Test Plan row tagged `Op-X`, write the test at the file path the row prescribes. Use the test type from the row (sociable unit with fakes, integration with real DB, bench).

Tests must:

- Import from real source modules (no `vi.mock()`)
- Call actual functions/methods or make actual HTTP requests
- Assert specific behavioural outcomes (no `expect(true).toBe(true)`)
- Fail because the implementation is empty — not because the test itself is broken

**Tag each test with `@US-NNN @Op-X`.** For Vitest/Jest, the tag goes in the `describe()` or `test()` name (e.g., `describe("@US-NNN @Op-2 startSession", …)`). The runner filter `<TEST> -t "@US-NNN.*@Op-X"` (§4) selects only this Operation's unit/integration tests.

Hand-written fakes are fully functional in-memory implementations placed under `<module>/__tests__/fakes/`. Fakes are test infrastructure, not production code; they must work correctly so test failures point at the service under test, not at broken fakes.

Run `<TEST> -t "@US-NNN.*@Op-X"`. **Every selected test MUST FAIL** at assertion time. Commit:

```
test(US-NNN): add failing tests for Op-X — <operation title>
```

Journal: `node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "test(US-NNN): add failing tests for Op-X"` (contract §3, §5).

Update `state.json`: `Op-X.operation_phase = "red_b"`. Update `test_plan_rows[T-N]` for the rows just written.

### Phase 4 — Lazy stubs (only what Op-X's tests import)

For Op-X's tests to compile, the source files they import must exist. Create minimal stubs **only for files that don't already exist** (an earlier Op may have already stubbed them). Reference PLAN.md's Structure table for canonical paths.

Stub rules:

1. Files exist at paths from `specs/ARCHITECTURE.md` and PLAN.md's Structure table.
2. Exports exist for everything Op-X's tests import.
3. Function bodies are empty: throw `Error('Not implemented')` for value-returning functions, return type-compatible zero values otherwise.
4. Types are complete (no runtime behaviour, must be real).
5. Fakes are complete (must work correctly).
6. Index files re-export the public API.

What gets stubbed vs. fully implemented:

| Artifact                    | Fully Implemented | Why                                            |
| --------------------------- | ----------------- | ---------------------------------------------- |
| TypeScript types/interfaces | Yes               | No runtime behaviour, needed for compilation   |
| Constants                   | Yes               | Simple values, needed by tests and fakes       |
| Pure utility functions      | Yes               | Small, pure, testable independently            |
| Fakes (test infrastructure) | Yes               | Must work correctly for tests to be meaningful |
| Service classes             | Stub only         | These are what the tests are testing           |
| Repository implementations  | Stub only         | Production code                                |
| Route handlers              | Stub only         | Production code                                |
| UI components               | Stub only         | Production code                                |

If Phase 4 created any new file, commit:

```
chore(US-NNN): add stubs for Op-X — <operation title>
```

(If no new files were created — Op-X's stubs all existed from earlier Ops — skip the commit.)

### Phase 5 — Verify Op-X is fully RED

Re-run **only** the Op-X-filtered suites:

- `<BDD>` Op filter → every scenario FAIL at assertion time.
- `<TEST> -t "@US-NNN.*@Op-X"` → every test FAIL at assertion time.

A test that passes in RED _by nature_ (it pins an external tool's semantics and no repo file can make it fail) is allowed if journaled as a decision naming the test.

If any test passes, either:

- The test is wrong (asserting something unrelated to Op-X), or
- An earlier Op accidentally implemented the behaviour (unlikely; flag it).

Fix and re-run. Then update `state.json`:

- `Op-X.operation_phase = "red"`
- `Op-X.tests_status = "red"`
- `Op-X.stub_status = "created"`
- `Op-X.completed_at = <now>` (RED-side)
- Advance `current_operation` to the first Op whose `operation_phase ∉ {green, refactored}` (the shared cursor rule), or `null` if every Op is GREEN.

### Phase 6 — `stories.json` sync (only on transitions)

**On the first Op's first RED-A** (i.e., `stories[i].phase = "planned"` going in):

- Flip `stories[i].phase = "red"`, append history, update `project.updated_at`, regenerate `STORIES.md`. (See "Integration with stories.json" above.)

**On the last Op's RED completion** (i.e., every Op now `operation_phase = "red"`):

- Write `stories[i].test_setup` summary block.
- Set `state.json.phase_local = "executing"` (handoff signal to `/spec-implementation`).
- Regenerate `STORIES.md`.

**On every other invocation:** no `stories.json` write. State churn lives in `state.json`.

### Phase 7 — Self-Review, Report and offer next step

**Self-review (mandatory).** Before reporting, verify and print as a compact checked list:

- [ ] Every test written for Op-X maps to a Test Plan row tagged `Op-X` — no orphan tests, no skipped rows
- [ ] Every test calls real code paths (actual imports, actual endpoints) — no placeholder bodies, no `test.todo`, no tautological assertions
- [ ] The suite was actually run: Op-X's tests fail **at assertion time** (not import errors, not missing files); earlier Ops' tests still pass
- [ ] Stubs are lazy — files and exports exist, bodies are empty; no accidental implementation

Fix failures before proceeding. This is the default RED gate; `/test-setup-verification` is an opt-in deep audit on top of it.

Journal the self-review: `node "$LEDGER" log --kind gate --gate self-review --verdict <PASS|PASS_WITH_WARNINGS> --story US-NNN --op Op-X --stage test-setup --summary "<n>/4 checks"` (contract §3, §5). Any unchecked item not fixed → `ledger backlog add --title "<unchecked item>" --severity warning --kind <bug|test-gap|refactor> --story US-NNN --op Op-X`.

Output a short summary:

```
US-NNN — Op-X RED'd
  BDD scenarios:    N (file: e2e/steps/...)
  Unit/int tests:   M (files: ...)
  New stubs:        K (files: ...)
  Operation phase:  red
  Story phase:      red  (Op-X / N total)
```

Outside autopilot, use `AskUserQuestion`:

- **Header: "Next"** — "Op-X is RED. What's next?"
  - "Move to GREEN — run /spec-implementation US-NNN Op-X" (Recommended)
  - "Deep-audit the RED state — /test-setup-verification US-NNN Op-X" (opt-in; worth it for `US-000` and full-rigor Ops with tricky test infrastructure)
  - "RED the next Op — /test-setup US-NNN" (auto-picks next pending op)
  - "Done for now"

Under autopilot (contract §2), skip the question and emit `<promise>RED_COMPLETE_US-NNN_Op-X</promise>`; if every Op is now RED also emit `<promise>TEST_SETUP_COMPLETE_US-NNN</promise>`.

---

## Foundation Story (US-000)

Same per-Op flow with one nuance: foundation Operations often produce test infrastructure that later stories' tests depend on (fakes, fixtures, schema). For US-000:

- **Types, constants, utilities, schema** → fully implement during stub phase (trivial; downstream tests need them).
- **Fakes and test infrastructure** → fully implement (all stories depend on them).
- **Service skeletons, repository impls, bootstrap functions** → stub only.
- **The smoke endpoint and smoke UI page** → stub only (these are what GREEN will implement).

The mix lives at the file level — within US-000's first Op, some files are fully working (types, schema, fakes), others are stubs (services, repos, the smoke path).

---

## Decision Rules

### What makes a test "real"

- Calls actual code (no `vi.mock()`, no `jest.mock()` at the module level).
- Asserts a behavioural outcome (no tautologies).
- Uses hand-written fakes for collaborators that can't run in-process (DB, network).
- Fails for the right reason — assertion failure, not import error, not undefined symbol.

### What makes a test a placeholder (forbidden)

- `expect(true).toBe(true)`, `expect(undefined).toBeFalsy()`.
- `it.todo("…")`, commented-out tests.
- `vi.mock("…")` of the module under test.
- Tests that pass without the implementation existing.

### Asking vs deciding

See `references/autopilot-contract.md` §2. Outside autopilot, use `AskUserQuestion` when a Gherkin scenario is ambiguous about what to assert, or when a Test Plan row's file path or assertion is unclear. Under autopilot, take the reading closest to the scenario text and journal it.

---

## Commit Rules

All commits follow Conventional Commits.

```
test(US-NNN): add BDD steps for Op-X — <operation title>
test(US-NNN): add failing tests for Op-X — <operation title>
chore(US-NNN): add stubs for Op-X — <operation title>
```

For the Foundation Story, scope is `US-000` (or `foundation` for shared-infrastructure setup that isn't behaviour-specific).

---

## What this skill does NOT do

- It does not implement source code (`/spec-implementation` does that).
- It does not loop over multiple Operations in a single invocation — one invocation, one Op.
- It does not run the full test suite across all Ops — only Op-X's filtered subset.
- It does not run lint, typecheck, Simplify, or Code Review — those are story-end gates owned by `/spec-implementation`.
