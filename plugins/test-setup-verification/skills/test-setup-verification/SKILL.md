---
name: test-setup-verification
version: 1.0.0
description: >
  Verifies the output of /test-setup for completeness, correctness, and RED-state
  compliance for a specific version (V0, V1, ...). Spawns a fresh agent to audit all
  BDD step definition files, unit test files, and source stubs against the wave plan
  files, .feature files, and ARCHITECTURE.md.
  Confirms that every test is real (calls actual functions/APIs), that no tests are
  placeholder (empty bodies, test.todo, tautological assertions), that all tests fail
  because implementations are empty stubs (not because of import errors or missing
  files), that step definition coverage is complete, **and that the project uses a real
  BDD runner (playwright-bdd or @cucumber/cucumber) wired so .feature files actually
  drive the test suite — not Gherkin pasted as comments inside *.spec.ts files**.
  Produces a structured compliance report with pass/fail verdicts and actionable
  recommendations. Use this skill after
  running /test-setup, before starting /spec-implementation. Also triggers on: "verify
  the tests", "check the test setup", "audit the failing tests", "are the tests ready",
  "validate test setup before implementation", or any request to review test scaffolding
  quality. Make sure to use this skill after /test-setup completes and before starting
  /spec-implementation.
---

# Test Setup Verification

Audits the artifacts produced by `/test-setup` for a **specific version** (V0, V1, ...)
and produces a compliance report. This is a **quality gate** between test-setup and
spec-implementation.

The verification runs in a **fresh agent** (via the Agent tool) so the review has
no context bias from the generation session. The auditor only sees the artifacts,
the rules, and the plan files — not the conversation that produced them.

## When to Run

```
/plan-writing → /plan-writing-verification → /test-setup → /test-setup-verification → /spec-implementation
```

Run this after `/test-setup` completes. The report will either clear the tests
for the implementation phase or list specific items to fix first.

## What Gets Verified

| Artifact               | Expected Location                                                             |
| ---------------------- | ----------------------------------------------------------------------------- |
| BDD step definitions   | `e2e/steps/*.steps.ts`                                                        |
| Unit/integration tests | `src/modules/**/*.test.ts`                                                    |
| Source stubs           | `src/modules/**/*.ts` (service, repository, route files)                      |
| Fake implementations   | `src/modules/**/__tests__/fakes/fake-*.ts`                                    |
| BDD runner declaration | `package.json` — must list `playwright-bdd` or `@cucumber/cucumber`           |
| BDD runner wiring      | `playwright.config.ts` (`defineBddConfig`) OR `cucumber.js` / `cucumber.json` |
| State file             | `docs/V{N}/plans/implementation-state.json`                                   |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. Do not perform the audit
inline — the fresh context is the point.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are a test scaffolding quality auditor. Your job is to verify that the output
of the test-setup skill is complete, correct, and in a proper RED state — meaning
every test runs and fails because the implementation doesn't exist yet, not because
tests are broken or placeholder.

## Artifacts to Audit

Read these files:
1. `docs/V{N}/plans/implementation-state.json` — check phase and per-wave tests_status
2. Every wave plan file in `docs/V{N}/plans/` (e.g. `W0-foundation.md`, `W1-auth-golden-path.md`) — extract expected tests per task
3. Every .feature file in `docs/V{N}/specs/features/` — extract expected step definitions
4. Every step definition file in `e2e/steps/`
5. Every unit/integration test file in `src/modules/**/*.test.ts`
6. Source stubs in `src/modules/` — verify exports exist
7. Fake implementations in `src/modules/**/__tests__/fakes/`
8. `docs/V{N}/architecture/ARCHITECTURE.md` — verify module placement
9. `package.json` — confirm `playwright-bdd` or `@cucumber/cucumber` is declared (Section J)
10. `playwright.config.ts` (or `.js`) and/or `cucumber.js` / `cucumber.json` — confirm `.feature` wiring (Section J)
11. Any `e2e/tests/F-*.spec.ts` files — flag as decorative-BDD smell if they replay .feature scenarios as plain Playwright code (Section J)

## Verification Checklist

### A. State File Correctness

- [ ] State file exists at `docs/V{N}/plans/implementation-state.json`
- [ ] Phase is `"executing"` (test-setup should have transitioned it)
- [ ] Every wave entry (e.g. `"W0-foundation"`, `"W1-auth-golden-path"`) has `tests_status: "red"`
- [ ] No waves have `tests_status: "pending"` or `"in_progress"`

### B. BDD Step Definition Coverage

For EACH .feature file in `docs/V{N}/specs/features/`:
- [ ] A corresponding step definition file exists in `e2e/steps/`
- [ ] Every Given/When/Then step pattern in the .feature file has a binding
      in the step definition file
- [ ] No orphan step definitions (bindings without corresponding .feature steps)

### C. Step Definition Quality (Per File)

For EACH step definition file in `e2e/steps/`:

**Not Placeholder:**
- [ ] No step callbacks with empty bodies (just `{}` or only comments)
- [ ] No `// TODO` or `// FIXME` comments as the only content
- [ ] No steps that do nothing (empty async functions)

**Real Interactions:**
- [ ] UI-facing steps use `page` fixture (navigation, clicks, assertions)
- [ ] API-facing steps use `request` fixture (HTTP calls, status checks)
- [ ] Given steps that seed data make actual API calls or direct DB inserts
- [ ] When steps perform actual user actions (click, fill, navigate, submit)
- [ ] Then steps make actual assertions (`expect(...)` on page content or responses)

**Assertion Quality:**
- [ ] Then steps use `expect()` with specific matchers (not `toBeTruthy()` on nothing)
- [ ] Assertions reference specific DOM elements (via `data-testid`, role, text)
- [ ] API assertions check status codes AND response body structure

### D. Unit Test Coverage

For EACH wave plan file in `docs/V{N}/plans/`:
- [ ] Every task that specifies RED-B tests has a corresponding test file
- [ ] Test files are co-located with their module (as per ARCHITECTURE.md)
- [ ] Test file naming follows convention: `<module>.test.ts`

### E. Unit Test Quality (Per File)

For EACH test file in `src/modules/**/*.test.ts`:

**Not Placeholder:**
- [ ] No `it.skip(...)` or `it.todo(...)` calls
- [ ] No empty test bodies
- [ ] No tautological assertions (`expect(true).toBe(false)`, `expect(1).toBe(1)`)
- [ ] No commented-out test bodies

**Real Tests:**
- [ ] Tests import from actual source modules (the stubs)
- [ ] Tests instantiate actual service/class under test
- [ ] Tests call actual methods on the service
- [ ] Tests use `expect()` with specific matchers on the return value
- [ ] Sociable unit tests inject fakes (not `vi.mock()` or `jest.mock()`)

**Fake Quality:**
- [ ] Fakes implement the full repository/dependency interface
- [ ] Fakes have working in-memory storage (Map, Array)
- [ ] Fakes are not just `jest.fn()` or `vi.fn()` stubs
- [ ] Each fake has its own file in `__tests__/fakes/`

### F. Source Stub Correctness

For EACH module referenced by tests:
- [ ] The source file exists at the path defined in ARCHITECTURE.md
- [ ] All exports referenced by tests are present
- [ ] Service classes have correct constructor signatures (accept dependencies)
- [ ] Method signatures match the interfaces tests expect
- [ ] Method bodies are empty (throw 'Not implemented' or return zero values)
- [ ] Method bodies do NOT contain real implementation logic

### G. Types and Constants

- [ ] All TypeScript types/interfaces referenced by tests are fully defined
- [ ] Constants used by tests are defined with correct values
- [ ] Module `index.ts` files re-export the public API
- [ ] No `any` type annotations on stub signatures (use proper types)

### H. Architecture Compliance

- [ ] Test files are in the correct module directories
- [ ] No cross-module imports that bypass public APIs (import from index.ts only)
- [ ] Fakes are inside the BM module's `__tests__/fakes/` directory
- [ ] Step definition files are in `e2e/steps/`

### I. RED State Verification

This is the most critical check. Run (or analyze the output of):

1. `bun run test` — ALL unit tests should FAIL
   - [ ] Zero tests pass (or only infrastructure tests that are supposed to pass,
         like schema validation)
   - [ ] Failures are assertion errors or thrown 'Not implemented' errors
   - [ ] Failures are NOT import/module resolution errors
   - [ ] Failures are NOT TypeScript compilation errors
   - [ ] Failures are NOT timeout errors from broken test setup

2. `bun run bdd` — ALL BDD tests should FAIL
   - [ ] Failures are navigation errors, missing elements, or wrong status codes
   - [ ] Failures are NOT step definition binding errors
   - [ ] Failures are NOT missing step definitions
   - [ ] Failures are NOT Playwright configuration errors

Note: For RED state verification, you may need to actually run the test commands
and analyze the output. If running them is not feasible, analyze the code
statically and report what you expect the failure modes to be.

### J. BDD Runner Wiring (Drift Detection — Critical)

This section verifies that `.feature` files are not decorative — that the BDD
runner actually parses them, executes them, and fails when scenarios drift
between the `.feature` file and the step definitions. **A failure in this
section is always critical** (`TOOLING_GAP` category) and cannot be downgraded
to a warning: tooling gaps make every other check in this report unverifiable.

**Toolchain declaration:**

- [ ] `package.json` declares `playwright-bdd` **or** `@cucumber/cucumber` as a
      dependency or devDependency (not just `@playwright/test`)
- [ ] A wiring file exists and references `docs/V{N}/specs/features/`:
      `playwright.config.ts` calling `defineBddConfig({ features: ... })`,
      OR `cucumber.js` / `cucumber.json` with `paths` pointing at the .feature folder

**Step definition binding API:**

- [ ] Step definition files use the runner's binding API:
      - playwright-bdd: `const { Given, When, Then } = createBdd(test)`
      - cucumber: `import { Given, When, Then } from '@cucumber/cucumber'`
- [ ] No step definition file uses plain `test('...', async ({ page }) => {...})`
      blocks with Gherkin pasted as comments — that is the "decorative BDD"
      smell this gate exists to catch
- [ ] No `e2e/tests/F-*.spec.ts` (or similar) files exist that replay
      .feature scenarios as plain Playwright code in parallel to the steps
      directory. If they exist, list them — they prove `.feature` files are
      not the source of truth

**Drift probe (proves the runner enforces step coverage):**

- [ ] Probe procedure: temporarily inject a fake step into one .feature file
      (e.g. add `Given a step that does not exist anywhere in the codebase`
      to a single Scenario), run `bun run bdd`, confirm it fails with an
      "undefined step" / "step definition not found" / "missing step" error,
      then revert the .feature file to its original state.
- [ ] If `bun run bdd` ignores the fake step or silently skips it: **FAIL**
      — drift detection is broken; `.feature` files are not enforced
- [ ] If running the probe is not feasible in the audit environment: report
      this explicitly and downgrade J to UNVERIFIED rather than PASS.
      UNVERIFIED on J still blocks `/spec-implementation`.

## Output Format

Produce this exact report structure:

---

# Test Setup Verification Report

**Date:** [today]
**Version:** [VN]
**State file phase:** [phase value]
**Step definition files found:** [count]
**Unit test files found:** [count]
**Waves with tests_status "red":** [count]/[total]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL | FAIL — TOOLING_GAP]

PASS = all checks pass, ready for /spec-implementation
PASS WITH WARNINGS = minor issues that won't block implementation
FAIL = critical issues that must be fixed before proceeding
FAIL — TOOLING_GAP = Section J failed; .feature files are not wired to a real
                     BDD runner. This verdict overrides any other PASS verdict —
                     all other sections are unverifiable until tooling is fixed.
                     Re-run /test-setup once playwright-bdd or @cucumber/cucumber
                     is installed and wired.

## Summary

| Area | Grade | Issues |
|------|-------|--------|
| A. State File | [PASS/FAIL] | [count] |
| B. Step Definition Coverage | [PASS/FAIL] | [count] |
| C. Step Definition Quality | [PASS/FAIL] | [count] |
| D. Unit Test Coverage | [PASS/FAIL] | [count] |
| E. Unit Test Quality | [PASS/FAIL] | [count] |
| F. Source Stub Correctness | [PASS/FAIL] | [count] |
| G. Types and Constants | [PASS/FAIL] | [count] |
| H. Architecture Compliance | [PASS/FAIL] | [count] |
| I. RED State Verification | [PASS/FAIL] | [count] |
| J. BDD Runner Wiring | [PASS/FAIL/UNVERIFIED] | [count] |

## Critical Issues (Must Fix)

[List each critical issue with:]
- **Location:** file path and line/section
- **Issue:** what's wrong
- **Fix:** specific action to take

## Warnings (Should Fix)

[List each warning with same format]

## Placeholder Test Violations

[List any tests identified as placeholder, with file path and line number.
For each, explain WHY it's considered placeholder and what a real test looks like.]

## Missing Coverage

[List any .feature scenarios or wave plan tasks that lack corresponding tests.
For each, specify which test file should exist and what it should assert.]

## Recommendations

[Suggestions for improvement]

## Next Step

[Either "Ready for /spec-implementation" or "Fix [N] critical issues first,
then re-run /test-setup-verification"]

---
```

### After the Agent Returns

1. Present the report to the user
2. If the verdict is **FAIL**: list the critical issues and ask if they want to fix them now
3. If the verdict is **PASS WITH WARNINGS**: show warnings and ask if they want to address them or proceed
4. If the verdict is **PASS**: confirm readiness and suggest running `/spec-implementation`

## What This Skill Does NOT Do

- It does not rewrite or fix the tests — it only reports issues
- It does not run the actual test suite (though it may recommend doing so) — it audits the code
- It does not assess test design quality beyond the checklist — it checks structural correctness
- It does not replace human review — it catches mechanical issues
