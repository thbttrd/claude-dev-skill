---
name: test-setup-verification
version: 2.0.0
description: >
  Per-story verification of /test-setup output for completeness, RED-state
  compliance, BDD-runner wiring, and Test Plan traceability. Spawns a fresh
  agent to audit BDD step definition files, unit / integration tests, and
  source stubs against the story's PLAN.md (Test Plan), STORY.md, and
  features/*.feature. Confirms every test is real (calls actual code, not
  placeholders), every test fails because implementations are empty stubs
  (not because of import errors), and the project's BDD runner is wired so
  .feature files actually drive the suite (not Gherkin pasted as comments
  inside *.spec.ts). Produces a structured compliance report. Use after
  /test-setup US-NNN, before /spec-implementation US-NNN. Triggers on:
  "verify the tests for US-NNN", "check the test setup", "audit the failing
  tests", "is the story RED-ready", "/test-setup-verification US-NNN".
---

# Test Setup Verification (per story)

Audits the artifacts produced by `/test-setup` for **one story** (`US-NNN`) and produces a compliance report. Quality gate between `/test-setup` and `/spec-implementation`.

The verification runs in a **fresh agent** so the review has no context bias.

## Pre-Flight

| Check                                                | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                              | Ask the user (default: stories whose `phase = red`).                                                                                            |
| Story's `phase` is not `red`                         | Hard-stop. Print: `Story US-NNN must be in red phase before verification. Run /test-setup US-NNN first.`                                        |

## When to Run

```
/plan-writing-verification US-NNN → /test-setup US-NNN → /test-setup-verification US-NNN → /spec-implementation US-NNN
```

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. The agent needs Bash access to run the test suites.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are a test-setup auditor for a story-based dev pipeline. Your job is to
verify that the tests scaffolded for story US-NNN are real, are RED, and
correctly cover the Test Plan in PLAN.md.

## Step 1: Read the Artifacts

1. specs/story-NNN-slug/STORY.md
2. specs/story-NNN-slug/PLAN.md  (the REASONS-canvas plan; focus on the Test Plan)
3. All .feature files in specs/story-NNN-slug/features/
4. The BDD step definition files referenced in PLAN.md (typically e2e/steps/*.ts)
5. The unit/integration test files referenced in PLAN.md (typically src/modules/*/__tests__/*.test.ts)
6. The source stubs created (typically src/modules/*/<module>.service.ts, repos, route handlers)
7. specs/story-NNN-slug/state.json
8. specs/stories.json — find the entry where id = "US-NNN"

## Step 2: BDD Toolchain Wiring (hard gate)

Same four checks as /test-setup's BDD Toolchain Pre-Flight:
- [ ] package.json declares playwright-bdd or @cucumber/cucumber
- [ ] Wiring file references specs/story-*/features/**/*.feature
- [ ] Discovery dry-run lists every .feature file with exit code 0
- [ ] Every .feature file parses

If any check fails, the verdict is FAIL.

## Step 3: Test Reality Audit

For EACH test file:
- [ ] Imports from real source modules (no vi.mock(), no jest.mock())
- [ ] Calls real functions / methods / makes real HTTP requests
- [ ] Asserts specific behavioural outcomes — flag tautological assertions
      (expect(true).toBe(true), expect(undefined).toBeFalsy())
- [ ] Fails at assertion time, not at import time
- [ ] No it.skip / test.todo / commented-out tests

## Step 4: RED-State Verification

Run the test suites with the story tag filter:
- bun test --grep="@US-NNN" (or equivalent)
- bun bdd --tags="@US-NNN"

Expected: every test FAILS. If any test passes, either:
- The test is wrong (testing something not in this story's scope), OR
- The stub accidentally implements the behaviour.
Both are critical issues — flag them with file paths.

## Step 5: Test Plan Coverage

Cross-check PLAN.md's Test Plan table against the files on disk:
- [ ] Every row's file exists
- [ ] Every row has a matching test in the file (search for the assertion's keyword)
- [ ] No orphan tests (a test on disk that's not referenced in the Test Plan is a smell)

## Step 6: Stubs

Source stubs must:
- [ ] Exist at paths from PLAN.md's Structure table
- [ ] Export everything tests import
- [ ] Have empty function bodies (throw Error('Not implemented') or return zero values)
- [ ] Have complete TypeScript types/interfaces (no `any`-typed signatures unless ARCHITECTURE.md allows)
- [ ] Pass tsc --noEmit (compilation succeeds)

## Step 7: Hand-Written Fakes

For each fake referenced in PLAN.md or used by a test:
- [ ] Lives under <module>/__tests__/fakes/
- [ ] Implements the full interface
- [ ] Has working in-memory storage (not just jest.fn() stubs)
- [ ] Is shared via the test's fixture pattern (no per-test duplication)

## Step 8: state.json & stories.json

- [ ] specs/story-NNN-slug/state.json exists with phase_local = "test_setup" or "executing"
- [ ] All operations have tests_status = "red"
- [ ] specs/stories.json#stories[i].test_setup is populated with file counts + completed_at
- [ ] specs/stories.json#stories[i].phase = "red"
- [ ] history has a {phase: "red", at: ...} entry
- [ ] specs/STORIES.md reflects the new phase

## Output Format

# Test Setup Verification Report — US-NNN

**Date:** [today]
**Story:** US-NNN — <title>
**BDD step files:** [count]
**Unit/integration test files:** [count]
**Source stubs:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready for /spec-implementation US-NNN
FAIL = critical issues that must be fixed before /spec-implementation

## Summary

| Area                     | Grade | Issues |
|--------------------------|-------|--------|
| BDD Toolchain Wiring     | [PASS/FAIL] | [count] |
| Test Reality             | [PASS/FAIL] | [count] |
| RED-State                | [PASS/FAIL] | [count] |
| Test Plan Coverage       | [PASS/FAIL] | [count] |
| Stubs                    | [PASS/FAIL] | [count] |
| Hand-Written Fakes       | [PASS/FAIL] | [count] |
| State / stories.json     | [PASS/FAIL] | [count] |

## Test Run Results

| Suite | Filter | Tests Run | Passed | Failed |
|-------|--------|-----------|--------|--------|
| unit  | @US-NNN | N | 0 | N |
| bdd   | @US-NNN | N | 0 | N |

(Expected: 0 passed; every test must fail.)

## Critical Issues (Must Fix)

[Each: location, what's wrong, specific fix]

## Warnings (Should Fix)

## Next Step

[Either "Ready for /spec-implementation US-NNN" or "Fix [N] critical issues first, then re-run"]

---
```

### After the Agent Returns

1. Present the report to the user.
2. If **FAIL**: list critical issues; ask if they want to fix now (loops back into `/test-setup US-NNN` update mode).
3. If **PASS WITH WARNINGS**: show warnings; ask whether to address or proceed.
4. If **PASS**: confirm readiness and suggest running `/spec-implementation US-NNN`.

## What This Skill Does NOT Do

- It does not write or fix tests — it reports issues.
- It does not start implementation — it certifies the RED state.
- It does not check production code quality — there is none yet.
