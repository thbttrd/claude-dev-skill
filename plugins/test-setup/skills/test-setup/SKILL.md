---
name: test-setup
version: 1.0.0
description: >
  Writes all BDD step definitions and unit tests for every plan in the DAG
  for a **specific version** (V0, V1, ...) BEFORE any implementation code
  exists. Tests are real — they call actual API endpoints, service methods,
  and functions — but those implementations are empty stubs, so the tests fail
  at assertion time, not because tests are placeholder. Creates minimal source
  stubs (files exist, exports exist, function bodies are empty) so tests
  compile and run but produce meaningful failures. Operates after /plan-writing
  completes and before /spec-implementation. Use this skill when you need to
  scaffold all tests upfront, when plans are written and you want to enter the
  RED state for the entire version before writing any production code. Triggers
  on: "write the tests", "scaffold the tests", "set up the test suite",
  "create failing tests", "RED phase for all plans", "test setup", "test setup
  for V0", or any request to write tests before implementation. Also use when
  the state file shows phase "test_setup" (resuming interrupted test
  scaffolding). Make sure to use this skill after /plan-writing-verification
  passes and before starting /spec-implementation.
---

# Test Setup

Writes all BDD step definitions and unit/integration tests for every plan in
the DAG for **one version at a time** (V0, V1, ...), plus the minimal source
stubs needed for tests to compile. When this skill finishes, the entire version
is in a RED state: every test runs, every test fails, and every failure points
at a real behavioral gap — not a missing import or an empty `test.todo()`.

**Prerequisites:** Before invoking this skill, these must be complete:

- Scoping via `/high-level-scoping` (project-tracking.json with version roadmap)
- Specs via `/spec-writing` (SPECS.md + feature files for the target version)
- Architecture via `/research-and-architecture` (ARCHITECTURE.md)
- Scaffolding via `/repo-initialization` (project structure, tooling, dependencies)
- Planning via `/plan-writing` (wave plans for the target version in `docs/V{N}/plans/`)
- State file `docs/V{N}/plans/implementation-state.json` must exist with phase `"planning"` or `"test_setup"`
- A real BDD test runner (`playwright-bdd` or `@cucumber/cucumber`) installed and
  wired so `.feature` files are parsed and bound to step definitions — enforced
  by the **BDD Toolchain Pre-Flight** gate below. `@playwright/test` alone is not
  sufficient; Gherkin pasted as comments in `*.spec.ts` does not count as BDD.

The core principle: **tests are the specification made executable**. Every test
traces back to a Gherkin scenario or a plan task. Every assertion describes a
behavior the implementation must satisfy. Nothing is speculative.

The stub principle: **source files exist so tests compile, but function bodies
are empty**. A stub service method might `throw new Error('Not implemented')`
or return a type-compatible zero value. The point is that `import { Foo } from
'@/modules/bar'` resolves, `foo.doSomething()` is callable, but the result is
wrong — triggering test failure at the assertion level, not the import level.

---

## Asking Which Version

If the user didn't specify a version, use AskUserQuestion:

- **Header: "Version"** — "Which version do you want to set up tests for?"
  - Options: one per version that has `planning.status: "planned"` in `project-tracking.json`
  - Include the version's goal and wave count in the description

---

## Integration with project-tracking.json

**`project-tracking.json` is the project-level source of truth.** This skill reads
context from it and writes progress back after test setup completes.

### Reading from project-tracking.json

On entry, read `project-tracking.json` to:

- Identify the target version and its user stories
- Check the version's `planning` field for wave structure and plan directory
- Get persona context for UI test assertions

### Writing back to project-tracking.json

After **all tests are written and verified RED** for the version, update
`project-tracking.json` (read-merge-write):

- Add `test_setup` field to the target version in `roadmap.versions`:

  ```json
  {
    "id": "V0",
    "...existing fields...": "",
    "test_setup": {
      "status": "completed",
      "waves_tested": 3,
      "bdd_step_files": 5,
      "unit_test_files": 8,
      "completed_at": "2026-04-07"
    }
  }
  ```

- Update `project.updated_at`

---

## How It Works

```
Read state → BDD toolchain gate → Plan pre-flight check → Write tests per plan (DAG order) → Verify RED state → Done
       |                                                                                                       |
       └────────────────────────────────── ralph-loop iteration ────────────────────────────────────────────┘
```

The **BDD toolchain gate** is a hard go/no-go: if `.feature` files are not wired
to a real runner, the skill stops with `TOOLING_NOT_READY` and reverts phase to
`"planning"`. Tests are never written against a fake BDD setup.

### Input Documents

| Document          | Purpose                                            | Location                                    |
| ----------------- | -------------------------------------------------- | ------------------------------------------- |
| SPECS.md          | Feature IDs, rules, tech stack                     | `docs/V{N}/specs/SPECS.md`                  |
| `*.feature` files | Gherkin scenarios — behavioral specs               | `docs/V{N}/specs/features/`                 |
| ARCHITECTURE.md   | Module structure, dependency rules, data ownership | `docs/V{N}/architecture/ARCHITECTURE.md`    |
| UI-SPECS.md       | Design system tokens, component patterns           | `docs/V{N}/specs/UI-SPECS.md`               |
| Wireframe PNGs    | Per-screen layout, interaction, accessibility      | `docs/V{N}/specs/wireframes/`               |
| Plan files        | Implementation plans (foundation + wave plans)     | `docs/V{N}/plans/`                          |
| State file        | Inter-loop state tracking                          | `docs/V{N}/plans/implementation-state.json` |
| project-tracking  | Project-level source of truth                      | `project-tracking.json`                     |

---

## State Management

Two levels of state:

1. **`project-tracking.json`** — project-level progress (versions, epics, stories)
2. **`docs/V{N}/plans/implementation-state.json`** — version-level execution state (waves, tasks)

The local state file handles fine-grained inter-loop coordination. `project-tracking.json`
is updated when test setup completes for the entire version.

**On every entry:**

1. Read `project-tracking.json` — get version context
2. Read `docs/V{N}/plans/implementation-state.json` — it **must** exist
3. If phase is `"planning"` → transition to `"test_setup"`, begin work
4. If phase is `"test_setup"` → resume from where the previous iteration left off
5. If phase is `"executing"` or `"completed"` → **stop**. Tests are already written.
6. If phase is earlier (`"orientation"`, `"scaffolding"`) → **stop**. Run prerequisite skills first.

**Update local state after every plan's tests are committed.** Update `project-tracking.json`
after all plans are done.

The state file tracks per-wave test scaffolding progress:

```json
{
  "version": "V0",
  "phase": "test_setup",
  "waves": {
    "W0-foundation": {
      "status": "tests_written",
      "plan_file": "docs/V0/plans/00-foundation.md",
      "tests_status": "red",
      "stories": [],
      "depends_on": []
    },
    "W1-auth-golden-path": {
      "status": "planned",
      "plan_file": "docs/V0/plans/W1-auth-golden-path.md",
      "tests_status": "pending",
      "stories": ["US-001", "US-003"],
      "depends_on": ["W0-foundation"]
    },
    "W2-dashboard-and-stats": {
      "status": "planned",
      "plan_file": "docs/V0/plans/W2-dashboard-and-stats.md",
      "tests_status": "pending",
      "stories": ["US-005", "US-006"],
      "depends_on": ["W0-foundation", "W1-auth-golden-path"]
    }
  }
}
```

The `tests_status` field tracks: `"pending"` → `"in_progress"` → `"red"` (tests written and failing).

**Update the state file after every wave's tests are committed.** This is the
handoff mechanism between ralph-loop iterations.

---

## BDD Toolchain Pre-Flight (Hard Go/No-Go Gate)

This gate runs **before** the plan pre-flight check below and **before any test
is written**. Its job is to prove the project actually has a working BDD runner
that parses `.feature` files and binds them to step definitions. Without this
proof, `.feature` files become decorative the moment nothing enforces drift
between them and the test suite — Gherkin pasted as comments inside `*.spec.ts`
is exactly the failure mode this gate prevents.

Run all four checks. If **any** fails: emit the `TOOLING_NOT_READY` report
(format below), revert phase to `"planning"`, and **stop**. Do not write step
definitions, unit tests, or source stubs against an unwired BDD setup.

### Check 1 — A real BDD dependency is declared

Read `package.json`. The project must declare one of these as a `dependencies`
or `devDependencies`:

- `playwright-bdd` (recommended for Next.js / Playwright projects — keeps the
  Playwright runner, generates `.spec.ts` files from `.feature` at test time)
- `@cucumber/cucumber` (full Cucumber.js — replaces the Playwright runner with
  Cucumber's, with Playwright as the browser driver)

`@playwright/test` alone is **not** sufficient. Custom in-house wrappers do not
count unless they themselves depend on `playwright-bdd` or `@cucumber/cucumber`.

### Check 2 — A wiring file consumes `.feature` files

Confirm one of the following exists and references `docs/V{N}/specs/features/`:

- **playwright-bdd**: `playwright.config.ts` (or `.js`) imports
  `playwright-bdd` and calls `defineBddConfig({ features:
'docs/V{N}/specs/features/**/*.feature', steps: 'e2e/steps/**/*.ts' })`
  (or equivalent), and `playwright.config.ts`'s `testDir` points at the
  generated test directory.
- **cucumber**: `cucumber.js` or `cucumber.json` (or `package.json` `cucumber`
  field) lists `docs/V{N}/specs/features/**/*.feature` under `paths` and
  `e2e/steps/**/*.ts` under `require` / `import`.

A `package.json` `bdd` script alias that calls `playwright test` without any
of the above wiring **counts as missing**.

### Check 3 — A discovery dry-run succeeds

Run the runner in discovery-only mode and confirm it lists every `.feature`
file in `docs/V{N}/specs/features/` without error:

- **playwright-bdd**: `bunx bddgen` — must regenerate one `.spec.js` (or
  `.spec.ts`) per `.feature` file with exit code 0; count generated files and
  confirm the count matches `ls docs/V{N}/specs/features/*.feature | wc -l`.
- **cucumber**: `bunx cucumber-js --dry-run` — must list every scenario from
  every `.feature` with exit code 0; failure messages such as "undefined step"
  at this stage are **expected** (steps are not yet written) and do not fail
  this gate; what fails the gate is a parser/config error.

A non-zero exit code from a parser/config error, a generated/listed count that
does not match the number of `.feature` files = check fails.

### Check 4 — Every `.feature` file parses

For each `*.feature` file in `docs/V{N}/specs/features/`:

- It exists on disk and is non-empty
- It begins with a `Feature:` line (after optional tags)
- Gherkin syntax is valid (no malformed `Scenario` / `Given` / `When` / `Then`
  keywords)

If Check 3 succeeded with the correct count, this is implicitly proven and the
check passes. Otherwise, parse each `.feature` manually and fail-fast on the
first syntactically broken file.

### TOOLING_NOT_READY Report Format

If any check fails, emit this report to the user **and** append it to the state
file's `errors` array:

```
TOOLING_NOT_READY — /test-setup gate failed for V{N}

Check 1 — BDD dependency declared:    [PASS | FAIL]
Check 2 — Wiring file present:        [PASS | FAIL]
Check 3 — Discovery dry-run:          [PASS | FAIL — <error excerpt>]
Check 4 — All .feature files parse:   [PASS | FAIL — <which file, what error>]

Required action before /test-setup can proceed:
- [If 1 failed] Run `bun add -D playwright-bdd` (or `bun add -D @cucumber/cucumber`).
- [If 2 failed] Wire .feature files via `defineBddConfig()` in playwright.config.ts
                (or create cucumber.js / cucumber.json).
- [If 3 failed] Fix the runner configuration so discovery succeeds.
- [If 4 failed] Fix the listed .feature files.

Phase reverted to "planning". Re-run /test-setup once tooling is ready.
```

After emitting the report, **stop**. The user must add the missing tooling
before invoking `/test-setup` again.

---

## Plan Pre-Flight Check

After the BDD toolchain gate passes, verify plan availability:

1. Read the state file and enumerate all entries in `state.waves`
2. For each wave entry, confirm the file at `plan_file` exists on disk and is non-empty
3. Confirm `docs/V{N}/plans/00-foundation.md` exists
4. For each `features/*.feature` file referenced by the waves, confirm a matching plan file exists in `docs/V{N}/plans/`

If any plan file is missing: log the error, set phase back to `"planning"`, stop.

---

## Execution: Writing Tests Per Plan

Process plans in **DAG order** (wave 0, then wave 1, etc.). Within each wave,
plans can be processed in any order — but all plans in a wave should have their
tests written before moving to the next wave. This matters because later waves'
tests may import stubs created during earlier waves.

### For Each Plan

Read the plan file. For each task in the plan, execute two phases:

#### Phase 1: Write BDD Step Definitions (RED-A)

Read the Gherkin scenarios referenced by this task from the `.feature` file.
Create or update step definition files that bind to the Given/When/Then steps.

**What "real" BDD steps look like:**

BDD step definitions must contain actual Playwright interactions — navigation,
clicks, form fills, assertions on page content. They exercise the running
application as a real user would. They are NOT empty callbacks with comments.

```typescript
// WRONG — this is a placeholder, not a real test
Given("there are {int} cards due for review", async ({}, count: number) => {
  // Seed cards with due review states
});

// RIGHT — this calls a real API to seed data, then verifies
Given(
  "there are {int} cards due for review",
  async ({ request }, count: number) => {
    // Seed test data via the API
    for (let i = 0; i < count; i++) {
      const response = await request.post("/api/cards", {
        data: {
          question: `Test question ${i}`,
          answer: `Test answer ${i}`,
          subtopicId: "1",
          difficulty: "beginner",
        },
      });
      expect(response.status()).toBe(201);
    }
  },
);

When("I start a study session", async ({ page }) => {
  await page.goto("/study/session");
  await page.waitForLoadState("networkidle");
});

Then(
  "I should see the question side of the first due card",
  async ({ page }) => {
    const question = page.locator('[data-testid="card-question"]');
    await expect(question).toBeVisible();
    await expect(question).not.toBeEmpty();
  },
);
```

The step definitions call real endpoints and assert real DOM state. Since the
routes, pages, and components don't exist yet (or are empty stubs), these steps
will fail — either the API returns a non-201 status, the page shows nothing, or
the expected elements aren't found.

**Mapping rules:**

- Each `.feature` file gets a corresponding step definition file:
  `docs/V{N}/specs/features/F-001-study-session.feature` → `e2e/steps/study-session.steps.ts`
- Step definitions use the project's BDD framework (playwright-bdd by default)
- Use `page` for UI interactions, `request` for API calls
- Use `data-testid` attributes for element selection (the UI specs and wireframes define these)
- For UI screen specs, reference the wireframe PNGs in `docs/V{N}/specs/wireframes/` to
  understand expected layout, element placement, and interaction patterns
- For API-only features (no UI), steps use `request` exclusively to call REST endpoints
- Shared setup steps (seeding data, resetting state) go in a shared steps file

**For API-focused features (e.g., REST API, import/export):**

Steps call the API directly and assert response status codes and body shapes:

```typescript
When("I create a card via the API with:", async ({ request }, dataTable) => {
  const row = dataTable.hashes()[0];
  const response = await request.post("/api/cards", {
    data: {
      question: row.question,
      answer: row.answer,
      subtopicId: row.subtopicId,
      difficulty: row.difficulty,
    },
  });
  sharedState.lastResponse = response;
  sharedState.lastResponseBody = await response.json();
});

Then("the response status should be {int}", async ({}, status: number) => {
  expect(sharedState.lastResponse.status()).toBe(status);
});
```

#### Phase 2: Write Unit/Integration Tests (RED-B)

Write Vitest tests that assert the behaviors described in the Gherkin scenarios.
Tests must import from the modules defined in ARCHITECTURE.md and call real
service methods.

**What "real" unit tests look like:**

Unit tests instantiate the actual service class, inject hand-written fakes for
dependencies, call service methods, and assert on return values. The service
class exists (as a stub) but its methods have empty bodies — so the assertions
fail because the method returns `undefined` or throws instead of the expected value.

```typescript
// WRONG — this is a placeholder
it("returns due cards ordered by difficulty", async () => {
  // TODO: implement when service exists
});

// RIGHT — this calls the real service, which has an empty body
import { StudyServiceImpl } from "./study.service";
import { FakeReviewRepository } from "./__tests__/fakes/fake-review-repository";

it("returns due cards ordered by difficulty", async () => {
  const reviewRepo = new FakeReviewRepository();
  const sessionRepo = new FakeSessionRepository();
  const service = new StudyServiceImpl(reviewRepo, sessionRepo, cardCatalog);

  // Seed fakes with test data
  reviewRepo.addDueCard("1", { difficulty: "advanced" });
  reviewRepo.addDueCard("2", { difficulty: "beginner" });

  const session = await service.startSession();

  // This fails because StudyServiceImpl.startSession() body is empty
  expect(session.cards).toHaveLength(2);
  expect(session.cards[0].difficulty).toBe("beginner");
  expect(session.cards[1].difficulty).toBe("advanced");
});
```

**Testing patterns to follow:**

- **Sociable unit tests** for BM services: inject fakes, call service methods
- **Integration tests** for Infra-Modules: use real test database
- **Route handler tests** for API routes: use `fetch` or supertest-style calls
- **Hand-written fakes** for repository interfaces: in-memory implementations
  that store data in arrays/maps. Fakes must be functional — they implement the
  full interface with working in-memory storage, not just `jest.fn()` stubs.

**Fakes are real implementations:**

```typescript
// Fake that actually works — stores data in memory
export class FakeCardRepository implements CardRepository {
  private cards: Map<string, Card> = new Map();
  private nextId = 1;

  async create(input: CreateCardInput): Promise<Card> {
    const card: Card = {
      id: String(this.nextId++),
      ...input,
      imageUrls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cards.set(card.id, card);
    return card;
  }

  async findById(id: string): Promise<Card | null> {
    return this.cards.get(id) ?? null;
  }

  // ... all interface methods with real in-memory behavior
}
```

#### Phase 3: Create Source Stubs

For tests to compile, the source files they import must exist. Create minimal
stubs for every module, service, repository, type, and route handler referenced
by the tests.

**Stub rules:**

1. **Files exist** at the paths defined in ARCHITECTURE.md
2. **Exports exist** — every class, function, type, and constant that tests import is exported
3. **Function bodies are empty** — methods either:
   - `throw new Error('Not implemented')` (for functions that must return a value)
   - Return a type-compatible zero value (empty array, null, undefined)
   - The key: the function signature is correct, but the body does nothing useful
4. **Types are complete** — TypeScript types, interfaces, and enums are fully defined
   (they have no runtime behavior, so they should be real, not stubs)
5. **Fakes are complete** — hand-written fakes are fully functional in-memory
   implementations. Fakes are test infrastructure, not production code — they
   should work correctly so that test failures point at the service under test,
   not at broken fakes.
6. **Index files re-export** — each module's `index.ts` exports its public API

**What gets stubbed vs. what gets fully implemented:**

| Artifact                    | Fully Implemented | Why                                            |
| --------------------------- | ----------------- | ---------------------------------------------- |
| TypeScript types/interfaces | Yes               | No runtime behavior, needed for compilation    |
| Constants                   | Yes               | Simple values, needed by tests and fakes       |
| Utility functions (pure)    | Yes               | Small, pure, testable independently            |
| Fakes (test infrastructure) | Yes               | Must work correctly for tests to be meaningful |
| Service classes             | Stub only         | These are what the tests are testing           |
| Repository implementations  | Stub only         | Implementation is production code              |
| Route handlers              | Stub only         | Implementation is production code              |
| UI components               | Stub only         | Implementation is production code              |
| Server Actions              | Stub only         | Implementation is production code              |

**Stub example:**

```typescript
// src/modules/study/study.service.ts — STUB
import type { ReviewRepository } from "./types";
import type { SessionRepository } from "./types";

export class StudyServiceImpl {
  constructor(
    private reviewRepo: ReviewRepository,
    private sessionRepo: SessionRepository,
    private cardCatalog: CardCatalogDependency,
  ) {}

  async startSession(): Promise<StudySession> {
    throw new Error("Not implemented");
  }

  async submitRating(
    sessionId: string,
    cardId: string,
    rating: Rating,
  ): Promise<void> {
    throw new Error("Not implemented");
  }

  async endSession(sessionId: string): Promise<SessionSummary> {
    throw new Error("Not implemented");
  }
}
```

The type signature is correct (so TypeScript compiles and tests can call it),
but the body throws — so the test's `expect(session.cards).toHaveLength(2)`
fails with an unhandled error, which is a real test failure pointing at a real gap.

### Commit After Each Wave

After writing all tests (BDD steps + unit tests) and stubs for a wave:

```
test(<scope>): add failing BDD steps and unit tests for <wave name>
```

Where `<scope>` is the user story ID (e.g., `US-001`) for feature waves, or
`foundation` for wave 0.

This captures the entire RED state for that wave in one commit. The commit
message uses the `test` type because only test files and stubs are being added.

Update the state file: set the wave's `tests_status` to `"red"`.

### When All Waves Are Done

When every wave has `tests_status: "red"`:

1. **Run the full test suite** — `bun run test` — confirm all unit tests fail
   (not compilation errors, but actual test assertion failures or thrown errors)
2. **Run the BDD suite** — `bun run bdd` — confirm all BDD tests fail
   (navigation failures, missing elements, wrong status codes — real behavioral gaps)
3. **Verify no tests pass** — if any test passes, either:
   - The test is wrong (testing something that shouldn't pass yet) — fix it
   - The stub accidentally implements the behavior — make the stub emptier
4. **Transition the state** — set `phase` to `"executing"` in local state file
5. **Update project-tracking.json** — write back the `test_setup` field (see Integration section)
6. **Commit the state transition** — `chore: transition to executing phase, all tests RED`

If in a ralph-loop, output:

```
<promise>TEST_SETUP_COMPLETE</promise>
```

---

## Ordering: What Gets Written First

The execution order within a plan follows the plan's task order. Across plans,
follow DAG order. But there's an important nuance about **what to fully
implement vs. stub**:

### Wave 0 (Foundation) — Special Handling

Foundation tasks often produce infrastructure that later tests depend on:

- **Types, constants, utilities** → fully implement (they're trivial and tests need them)
- **Database schema** → fully implement (integration tests need real tables)
- **Fakes and test infrastructure** → fully implement (all tests depend on them)
- **Service skeletons** → stub only (they're what feature tests will exercise)
- **Repository implementations** → stub only (production code)
- **Bootstrap functions** → stub only (production code)

This means foundation has a mix: some tasks produce fully working code (types,
schema, fakes), while others produce stubs (services, repos).

### Waves 1+ (Features)

For feature plans:

- Write BDD step definitions (real Playwright interactions)
- Write unit tests (real assertions with fakes)
- Create service/route stubs if they don't exist yet
- Do NOT write any implementation code

---

## Ralph-Loop Integration

```
/ralph-loop "Use the test-setup skill to write all failing tests for VN.
Read docs/V{N}/plans/implementation-state.json to determine where you left off.
Process waves in DAG order: write BDD steps, unit tests, and source stubs."
--max-iterations 30 --completion-promise "TEST_SETUP_COMPLETE"
```

### How Each Iteration Works

1. Read state file (`docs/V{N}/plans/implementation-state.json`) → find next wave with `tests_status: "pending"` or `"in_progress"`
2. Write all tests for that wave (BDD steps + unit tests + stubs)
3. Commit the tests
4. Update state file
5. If all waves have `tests_status: "red"` → run verification, update `project-tracking.json`, output completion promise
6. If not done → the ralph-loop feeds the prompt again

### Iteration Budget

Each iteration should complete **one wave's tests** (all tasks in that wave's plan).
Small waves (1-3 tasks) might allow 2 waves per iteration. Large waves (6+ tasks)
might need multiple iterations for one wave — track progress via `current_task`.

---

## Decision Rules

### What Makes a Test "Real"

A test is real if ALL of these are true:

- It imports from actual source modules (not mocked, not `vi.mock()`)
- It calls actual functions/methods on the service or makes actual HTTP requests
- It asserts specific behavioral outcomes (not `expect(true).toBe(true)`)
- It fails because the implementation doesn't exist or is empty — not because
  the test itself is broken or incomplete

### What Makes a Test "Placeholder" (Avoid These)

- Empty test body: `it('should work', () => {})`
- Skip markers: `it.skip(...)`, `it.todo(...)`
- Tautological assertions: `expect(true).toBe(false)` to force failure
- Comment-only bodies: `// TODO: implement`
- Tests that don't call any production code

### When to Create a Shared Steps File

If multiple feature step definitions need the same setup (seeding cards, resetting
the database, logging in), create a shared steps file (`e2e/steps/shared-state.ts`
or `e2e/steps/shared-setup.steps.ts`) with common Given steps.

### When to Ask the User

In ralph-loop mode: **never ask** — make a decision and document it in state.
Outside ralph-loop:

- Ask when a Gherkin scenario is ambiguous about what to assert
- Ask when a plan task doesn't specify which behaviors to test

---

## Commit Rules

All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
**Never** add a `Co-Authored-By` trailer.

### Format

```
test(<scope>): <short description>
```

### Examples

```
test(foundation): add failing unit tests for shared-kernel utilities
test(US-001): add failing BDD steps and unit tests for auth golden path
test(US-005): add failing BDD steps for dashboard and stats
test(US-009): add failing API tests for card management endpoints
chore: transition to executing phase, all tests RED
```
