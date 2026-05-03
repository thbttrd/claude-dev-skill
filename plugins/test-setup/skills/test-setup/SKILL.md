---
name: test-setup
version: 2.0.0
description: >
  Per-story RED-phase scaffolder. For ONE story (US-NNN) at a time, writes all
  BDD step definitions and unit/integration tests prescribed by the story's
  PLAN.md (REASONS canvas Test Plan), plus the minimal source stubs required
  for tests to compile. Tests are real — they call actual API endpoints,
  service methods, and functions — but those implementations are empty stubs,
  so tests fail at assertion time, not because of missing imports or empty
  test.todo() placeholders. Operates after /plan-writing US-NNN, before
  /spec-implementation US-NNN. Triggers on: "set up tests for US-NNN", "scaffold
  the tests for the story", "create failing tests", "RED phase for US-NNN",
  "/test-setup US-NNN".
---

# Test Setup (per story)

Writes all BDD step definitions and unit/integration tests for **one story** (`US-NNN`), plus the minimal source stubs needed for tests to compile. When this skill finishes, the story is in a RED state: every test runs, every test fails, and every failure points at a real behavioural gap — not a missing import or an empty `test.todo()`.

The skill reads the story's `PLAN.md` (REASONS canvas) and turns its **Test Plan** table into actual files. Every Test Plan row becomes one test; every Operation contributes its RED-A and RED-B entries. The Test Strategy section dictates the testing patterns (fakes, doubles, determinism, coverage).

## Prerequisites

- Scoping: `specs/stories.json` exists with the target story present
- Spec: `specs/story-NNN-slug/STORY.md` + `features/F-*.feature`
- Plan: `specs/story-NNN-slug/PLAN.md` (REASONS canvas with a populated Test Plan)
- Repo scaffolded (`package.json` exists with the BDD runner wired)
- Per-story state file: `specs/story-NNN-slug/state.json` (created if missing)

## Pre-Flight

| Check                                                | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                              | Use `AskUserQuestion` to list stories whose `phase = planned` and pick one.                                                                    |
| Story's `phase` is not `planned`                     | Hard-stop. Print: `Story US-NNN must be planned before test-setup. Run /plan-writing US-NNN first.`                                            |
| `specs/story-NNN-slug/PLAN.md` does not exist        | Hard-stop with the same message.                                                                                                                |
| BDD toolchain not wired                              | Run the **BDD Toolchain Pre-Flight** gate below. If any check fails, emit `TOOLING_NOT_READY` and stop without writing tests.                  |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop with the dependency name and the suggested fix.                                                                |

## BDD Toolchain Pre-Flight (hard go/no-go gate)

(Same four checks as the legacy skill: BDD dependency declared in `package.json` (`playwright-bdd` or `@cucumber/cucumber`); wiring file consumes `.feature` files at `specs/story-*/features/**/*.feature`; discovery dry-run succeeds; every `.feature` file parses. If any fails, emit `TOOLING_NOT_READY` with specific remediation steps and stop.)

The wiring path changes from the legacy `docs/V{N}/specs/features/**/*.feature` to **`specs/story-*/features/**/*.feature`** — this is the only behavioural change to the gate.

---

## Integration with `specs/stories.json`

**Reading:**

- The target story (`stories[i]` where `id = "US-NNN"`)
- Its `phase` (must be `planned`)
- Its `depends_on_story_ids` — every dependency must be `verified` (or `is_foundation`)

**Writing back** after all tests are written and verified RED:

- `stories[i].test_setup = { bdd_step_files: <count>, unit_test_files: <count>, integration_test_files: <count>, completed_at: "<today>" }`
- `stories[i].phase = "red"`
- Append `{ phase: "red", at: "<today>" }` to `stories[i].history`
- Update `project.updated_at`
- Regenerate `specs/STORIES.md`

---

## Per-Story State File

`specs/story-NNN-slug/state.json` tracks fine-grained execution state. Schema:

```json
{
  "story_id": "US-NNN",
  "phase_local": "test_setup",
  "operations": {
    "Op-1": { "title": "...", "tests_status": "pending|in_progress|red", "stub_status": "pending|created" },
    "Op-2": { "title": "...", "tests_status": "pending", "stub_status": "pending" }
  },
  "errors": []
}
```

The `phase_local` field is internal and reflects which sub-skill is operating on the story (`test_setup | executing | verifying`). It is distinct from the project-wide `phase` in `specs/stories.json`.

Update `state.json` after each Operation's tests are committed. This enables ralph-loop resumption.

---

## Execution: Writing Tests Per Operation

Process Operations in PLAN.md order. For each Operation:

### Phase 1 — Write BDD Step Definitions (RED-A)

Read the Gherkin scenarios referenced by this Operation from `specs/story-NNN-slug/features/F-*.feature`. Create or update step definition files at the path specified in PLAN.md (typically `e2e/steps/<feature-slug>.steps.ts`).

Step definitions must contain real Playwright/`request` interactions — navigation, clicks, form fills, real DOM/API assertions. They are NOT empty callbacks with comments.

(Same patterns as the legacy skill — UI tests use `page`, API-only steps use `request`, shared setup steps live in `e2e/steps/shared-state.ts`. See the per-Operation RED-A description in PLAN.md for the exact bindings.)

### Phase 2 — Write Unit/Integration Tests (RED-B)

Write tests at the file path specified in the Operation's RED-B section. Use the test type prescribed (sociable unit with fakes, integration with real DB, bench).

Tests must:

- Import from real source modules (no `vi.mock()`)
- Call actual functions/methods or make actual HTTP requests
- Assert specific behavioural outcomes (no `expect(true).toBe(true)`)
- Fail because the implementation is empty — not because the test itself is broken

Hand-written fakes are fully functional in-memory implementations placed under `<module>/__tests__/fakes/`. Fakes are test infrastructure, not production code; they must work correctly so that test failures point at the service under test, not at broken fakes.

### Phase 3 — Create Source Stubs

For tests to compile, the source files they import must exist. Create minimal stubs for every module, service, repository, type, and route handler referenced.

Stub rules (same as legacy):

1. Files exist at paths from `specs/ARCHITECTURE.md` and PLAN.md's Structure table
2. Exports exist for everything tests import
3. Function bodies are empty: throw `Error('Not implemented')` for value-returning functions, return type-compatible zero values otherwise
4. Types are complete (no runtime behaviour, must be real)
5. Fakes are complete (must work correctly)
6. Index files re-export the public API

What gets stubbed vs. fully implemented:

| Artifact                    | Fully Implemented | Why                                            |
| --------------------------- | ----------------- | ---------------------------------------------- |
| TypeScript types/interfaces | Yes               | No runtime behaviour, needed for compilation    |
| Constants                   | Yes               | Simple values, needed by tests and fakes       |
| Pure utility functions      | Yes               | Small, pure, testable independently            |
| Fakes (test infrastructure) | Yes               | Must work correctly for tests to be meaningful |
| Service classes             | Stub only         | These are what the tests are testing           |
| Repository implementations  | Stub only         | Production code                                |
| Route handlers              | Stub only         | Production code                                |
| UI components               | Stub only         | Production code                                |

### Commit After Each Operation

```
test(US-NNN): add failing BDD steps and unit tests for <operation title>
```

Update `state.json`: set the Operation's `tests_status = "red"`, `stub_status = "created"`.

### When All Operations Are Done

1. **Run the full test suite for this story** — `bun test` and `bun bdd` filtered by tag `@US-NNN`. Confirm all tests fail at assertion time (not compilation errors).
2. **Verify no test passes** — if any does, either the test is wrong (testing something not in this story's scope) or the stub accidentally implements the behaviour. Fix and re-run.
3. **Transition state**: set `state.json.phase_local = "executing"` (handoff to `/spec-implementation`).
4. **Update `specs/stories.json`** — write `test_setup` block, set `phase = "red"`, append history.
5. **Regenerate `specs/STORIES.md`**.
6. **Commit the transition**: `chore(US-NNN): transition to red, all tests RED`.

If running in a ralph-loop, output `<promise>TEST_SETUP_COMPLETE</promise>` for the loop to detect.

---

## Foundation Story (US-000)

Same flow with one nuance: foundation tasks often produce the test infrastructure that later stories' tests depend on (fakes, fixtures, schema). For US-000:

- **Types, constants, utilities, schema** → fully implement (trivial; downstream tests need them).
- **Fakes and test infrastructure** → fully implement (all stories depend on them).
- **Service skeletons, repository impls, bootstrap functions** → stub only.
- **The smoke endpoint and smoke UI page** → stub only (these are what GREEN will implement).

This means foundation has a mix: some files are fully working (types, schema, fakes), others are stubs (services, repos, the smoke path).

---

## Decision Rules

(Same as the legacy skill: what makes a test "real", what makes it a placeholder, when to create a shared steps file, when to ask the user. Inside a ralph-loop: never ask — decide and document in `state.json`. Outside the loop: ask when a Gherkin scenario is ambiguous about what to assert, or when the Test Plan row is unclear about which behaviours to test.)

---

## Commit Rules

All commits follow Conventional Commits. NEVER add a `Co-Authored-By` trailer.

```
test(US-NNN): add failing BDD steps and unit tests for <operation>
chore(US-NNN): transition to red, all tests RED
```

For the Foundation Story, scope is `US-000` (or `foundation` for shared-infrastructure setup that isn't behaviour-specific).
