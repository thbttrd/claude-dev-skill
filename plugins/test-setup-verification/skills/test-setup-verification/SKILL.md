---
name: test-setup-verification
version: 3.0.0
description: >
  Per-Operation verification of /test-setup output for completeness, RED-state
  compliance, and Test Plan traceability. Spawns a fresh agent to audit ONE
  Operation's BDD step definition files, unit / integration tests, and source
  stubs against the story's PLAN.md (Test Plan rows tagged with that Op),
  STORY.md, and features/*.feature. Confirms every test in that Operation is
  real (calls actual code, not placeholders), every test fails because
  implementations are empty stubs (not because of import errors), and the
  Operation's coverage of the Test Plan is complete. The Op-X arg is optional;
  with no Op-X, the skill auto-picks the most recently RED'd Operation that
  hasn't been audited yet from state.json. Produces a per-Op compliance report.
  Use after /test-setup US-NNN Op-X, before /spec-implementation US-NNN Op-X.
  Triggers on: "verify the tests for Op-X", "audit Op-2", "check the RED state",
  "is Op-X RED-ready", "/test-setup-verification US-NNN", "/test-setup-verification
  US-NNN Op-X".
---

# Test Setup Verification (per Operation)

Audits the artifacts produced by `/test-setup` for **one Operation of one story** (`US-NNN Op-X`) and produces a compliance report. Quality gate between `/test-setup US-NNN Op-X` and `/spec-implementation US-NNN Op-X`.

The verification runs in a **fresh agent** so the review has no context bias. The audit is scoped to a single Operation: only the test files Op-X created/modified, only the Test Plan rows tagged `Op = Op-X`, only the stubs Op-X imports that didn't exist before. Earlier Ops' tests are not re-audited (they have their own `red_audit` records); later Ops' tests are not yet expected.

## Pre-Flight

| Check                                                | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                              | Use `AskUserQuestion` to list stories whose `phase = red`.                                                                                      |
| Story's `phase` is not `red`                         | Hard-stop. Print: `Story US-NNN must be in red phase before verification. Run /test-setup US-NNN first.`                                        |
| `state.json.schema_version < 2`                      | Hard-stop. Print: `state.json is on the v1 schema. Re-run /test-setup US-NNN to migrate, then re-invoke this skill.`                            |

## Resolving the target Operation

Accepts `/test-setup-verification US-NNN [Op-X]`. The `Op-X` arg is optional and case-insensitive.

```
If Op-X passed explicitly:
  Validate Op-X exists in PLAN.md.
  If Op-X.operation_phase ≠ red → "Op-X has not been RED'd yet. Run /test-setup US-NNN Op-X first."
  Else → use Op-X.

If no Op-X passed (smart default):
  Pick the first Op where operation_phase = red AND red_audit.verdict ≠ PASS.
  If none → "All RED'd ops have passed verification. Run /spec-implementation US-NNN to start GREEN."
```

## When to Run

```
/plan-writing-verification US-NNN
  → /test-setup US-NNN Op-X
    → /test-setup-verification US-NNN Op-X     ← this skill
      → /spec-implementation US-NNN Op-X
        → /spec-implementation-verification US-NNN Op-X
          → /test-setup US-NNN (next op)        ← loop until all ops verified+green
            ...
            → /spec-implementation US-NNN (story-end gates)
              → /verification-and-validation US-NNN
```

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. The agent needs Bash access to run the test suites filtered to `@US-NNN @Op-X`.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt (substitute `US-NNN` and `Op-X`):

```
You are a per-Operation test-setup auditor for a story-based dev pipeline.
Your job is to verify that the tests scaffolded for ONE Operation (Op-X) of
story US-NNN are real, are RED, and correctly cover the rows in the story's
PLAN.md Test Plan that are tagged with this Operation.

## Step 1: Read the Artifacts (scoped to Op-X)

1. specs/story-NNN-slug/STORY.md (full)
2. specs/story-NNN-slug/PLAN.md — focus on:
   - The "### Operation X — <title>" section for the requested Op
   - The Test Plan table, but ONLY the rows where the Op column = Op-X
3. specs/story-NNN-slug/features/*.feature — focus on the scenarios named
   in the Operation's "Covers scenarios:" line and any scenario tagged @Op-X
4. The test files referenced in those filtered Test Plan rows
5. Any source stub files the test files import (read enough to verify each
   stub exists and is empty)
6. specs/story-NNN-slug/state.json — read state.operations[Op-X] for the
   recorded operation_phase and existing red_audit (if a re-audit)
7. specs/stories.json — find the entry where id = "US-NNN"

## Step 2: BDD Toolchain Wiring (first-time-per-story gate, hard)

Run only if state.json shows no prior red_audit on any earlier Op.
Otherwise skip — the toolchain is already known to be wired.

When run, the four checks (same as /test-setup's BDD Toolchain Pre-Flight):
- [ ] package.json declares playwright-bdd or @cucumber/cucumber
- [ ] Wiring file references specs/story-*/features/**/*.feature
- [ ] Discovery dry-run lists every .feature file with exit code 0
- [ ] Every .feature file parses

If any check fails, the verdict is FAIL.

## Step 3: Test Reality Audit (Op-X tests only)

For EACH test file referenced by an Op-X-tagged Test Plan row:
- [ ] Imports from real source modules (no vi.mock(), no jest.mock())
- [ ] Calls real functions / methods / makes real HTTP requests
- [ ] Asserts specific behavioural outcomes — flag tautological assertions
      (expect(true).toBe(true), expect(undefined).toBeFalsy())
- [ ] Fails at assertion time, not at import time
- [ ] No it.skip / test.todo / commented-out tests
- [ ] Carries the @US-NNN @Op-X tags (in scenario tag for BDD;
      in describe/test name for unit tests)

## Step 4: RED-State Verification (Op-X scope only)

Run the test suites with the Op filter:
- bun bdd --tags="@US-NNN and @Op-X"
- bun test --grep="@US-NNN.*@Op-X"

Expected: every test selected by these filters FAILS at assertion time.
If any test passes, either:
- The test is wrong (testing something not in this Operation's scope), OR
- A stub from this or an earlier Op accidentally implements the behaviour, OR
- An earlier Op's GREEN side-effect already implements the behaviour
  (in which case the test would belong to that earlier Op, not Op-X).

Any pass on this filtered run is a critical issue — flag with file paths.

DO NOT run the full @US-NNN suite — earlier Ops may already be GREEN, which
is expected. Only Op-X's filter must show all-fail.

## Step 5: Test Plan Coverage (Op-X rows only)

Cross-check PLAN.md's Test Plan rows where Op = Op-X against the files on disk:
- [ ] Every row's file exists
- [ ] Every row has a matching test in the file (search for the assertion's
      keyword or scenario name)
- [ ] Tests carry the @Op-X tag

If a row has no `Op` column (legacy v1 PLAN.md), accept the row if its scenario
name matches the Operation's "Covers scenarios:" line. Flag the missing column
as a warning (recommend re-running /plan-writing for the column).

## Step 6: Stubs

Source stubs imported by Op-X's tests must:
- [ ] Exist at paths from PLAN.md's Structure table
- [ ] Export everything Op-X's tests import
- [ ] Have empty function bodies (throw Error('Not implemented') or return zero values)
- [ ] Have complete TypeScript types/interfaces (no `any`-typed signatures
      unless ARCHITECTURE.md allows)
- [ ] Pass tsc --noEmit (compilation succeeds for the whole project)

Do NOT flag stubs that already existed before Op-X — those belong to earlier Ops
and were verified by their own audits.

## Step 7: Hand-Written Fakes

For each fake referenced by an Op-X test:
- [ ] Lives under <module>/__tests__/fakes/
- [ ] Implements the full interface
- [ ] Has working in-memory storage (not just jest.fn() stubs)
- [ ] Is shared via the test's fixture pattern (no per-test duplication)

## Step 8: state.json

- [ ] specs/story-NNN-slug/state.json.operations[Op-X].operation_phase = "red"
- [ ] tests_status = "red"
- [ ] stub_status = "created"
- [ ] test_plan_rows[T-N].written = true for every Op-X-tagged row
- [ ] test_plan_rows[T-N].passing = false (no row that's tagged Op-X may pass yet)

## Output Format

# Test Setup Verification Report — US-NNN / Op-X

**Date:** [today]
**Story:** US-NNN — <title>
**Operation:** Op-X — <op title>
**Op-X test files audited:** [count]
**Op-X stubs audited:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready for /spec-implementation US-NNN Op-X
FAIL = critical issues that must be fixed before GREEN

## Summary

| Area                     | Grade | Issues |
|--------------------------|-------|--------|
| BDD Toolchain Wiring     | [PASS/FAIL/SKIPPED] | [count] |
| Test Reality (Op-X)      | [PASS/FAIL] | [count] |
| RED-State (Op-X filter)  | [PASS/FAIL] | [count] |
| Test Plan Coverage (Op-X)| [PASS/FAIL] | [count] |
| Stubs (new in Op-X)      | [PASS/FAIL] | [count] |
| Hand-Written Fakes       | [PASS/FAIL] | [count] |
| state.json (Op-X)        | [PASS/FAIL] | [count] |

## Test Run Results (Op-X filter)

| Suite | Filter                              | Tests Run | Passed | Failed |
|-------|-------------------------------------|-----------|--------|--------|
| unit  | @US-NNN.*@Op-X                      | N         | 0      | N      |
| bdd   | @US-NNN and @Op-X                   | N         | 0      | N      |

(Expected: 0 passed; every test selected by the filter must fail.)

## Critical Issues (Must Fix)

[Each: location, what's wrong, specific fix]

## Warnings (Should Fix)

## Next Step

[Either "Ready for /spec-implementation US-NNN Op-X" or
 "Fix [N] critical issues first, then re-run /test-setup-verification US-NNN Op-X"]

---
```

### After the Agent Returns

1. Persist the report to `specs/story-NNN-slug/verification/red-audit-Op-X.md`.
2. Update `state.json.operations[Op-X].red_audit`:
   ```json
   { "verdict": "PASS|PASS_WITH_WARNINGS|FAIL",
     "at": "<ISO 8601>",
     "report_path": "specs/story-NNN-slug/verification/red-audit-Op-X.md" }
   ```
3. Present the report's summary to the user.
4. If **FAIL**: list critical issues; ask if they want to fix now (loops back into `/test-setup US-NNN Op-X` with `--force`).
5. If **PASS WITH WARNINGS**: show warnings; ask whether to address or proceed.
6. If **PASS**: confirm readiness and suggest running `/spec-implementation US-NNN Op-X`.

If running in a ralph-loop, skip the AskUserQuestion and emit `<promise>RED_AUDIT_COMPLETE_US-NNN_Op-X</promise>` for the loop to detect.

## What This Skill Does NOT Do

- It does not write or fix tests — it reports issues.
- It does not start implementation — it certifies one Operation's RED state.
- It does not re-audit earlier Operations — they have their own `red_audit` records.
- It does not check production code quality — there is none yet (stubs are empty by design).
- It does not run the full `@US-NNN` suite — only the `@Op-X` filter. Cross-Op regressions are checked by `/spec-implementation` and `/spec-implementation-verification`.
