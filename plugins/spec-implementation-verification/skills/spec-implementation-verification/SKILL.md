---
name: spec-implementation-verification
version: 1.0.0
description: >
  Per-Operation verification of /spec-implementation output for GREEN-state
  compliance, no over-implementation, architecture alignment, and zero
  regressions in earlier ops. Spawns a fresh agent to audit ONE Operation's
  implementation diff: only that Op's tests pass, the impl doesn't exceed
  Op-X's scope (no logic only justified by future ops), files Op-X touched
  respect ARCHITECTURE.md module boundaries, and earlier Ops' tests still
  pass. The Op-X arg is optional; with no Op-X, the skill auto-picks the
  most recently GREEN'd Op that hasn't been audited yet from state.json.
  With no Op-X AND all ops are GREEN AND quality gates have passed, the
  skill runs a story-end full audit (every Op's tests pass, every gate
  passed, story is ready for /verification-and-validation). Produces a
  per-Op or story-end compliance report. Use after /spec-implementation
  US-NNN Op-X (Op-X is GREEN), or after /spec-implementation US-NNN
  finishes the story-end gates. Triggers on: "verify Op-X", "audit the
  GREEN state", "is Op-2 implemented correctly", "check the story
  implementation", "/spec-implementation-verification US-NNN",
  "/spec-implementation-verification US-NNN Op-X".
---

# Spec Implementation Verification (per Operation, with story-end mode)

Audits the artifacts produced by `/spec-implementation` for **one Operation of one story** (`US-NNN Op-X`) — or, in story-end mode, the entire implementation of the story before `/verification-and-validation`. Quality gate either between `/spec-implementation US-NNN Op-X` and the next Op, or between `/spec-implementation US-NNN` (story-end gates) and `/verification-and-validation US-NNN`.

The verification runs in a **fresh agent** so the review has no context bias. The audit is scoped narrowly to a single Operation in per-op mode (only files Op-X touched, only Op-X's tests, only Op-X's diff range). Story-end mode performs a full-story audit instead.

## Pre-Flight

| Check                                                | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                              | Use `AskUserQuestion` to list stories whose `phase ∈ {red, green}`.                                                                             |
| Story's `phase` is not `red` or `green`              | Hard-stop. Print: `Story US-NNN must be at least at red phase before verification. Run /spec-implementation US-NNN Op-X first.`                 |
| `state.json.schema_version < 2`                      | Hard-stop. Print: `state.json is on the v1 schema. Re-run /spec-implementation US-NNN to migrate, then re-invoke this skill.`                   |

## Resolving the target Operation (or story-end mode)

Accepts `/spec-implementation-verification US-NNN [Op-X]`. Picker logic:

```
If Op-X passed explicitly:
  Validate Op-X exists in PLAN.md.
  If Op-X.operation_phase ∉ {green, refactored} → "Op-X is not GREEN yet. Run /spec-implementation US-NNN Op-X first."
  Else                                            → enter PER-OP MODE for Op-X.

If no Op-X arg:
  If any op.operation_phase ∈ {green, refactored} AND green_audit.verdict ≠ PASS:
    Pick first such op → enter PER-OP MODE.
  Elif all ops ∈ {green, refactored} AND quality_gates all true:
    → enter STORY-END MODE.
  Elif all ops ∈ {green, refactored} AND quality_gates not all true:
    → "All ops verified, but story-end gates haven't run. Run /spec-implementation US-NNN (no Op-X) first."
  Else:
    → "Nothing to verify. State: <summary>."
```

## When to Run

```
/spec-implementation US-NNN Op-X
  → /spec-implementation-verification US-NNN Op-X     ← per-op mode
    → /test-setup US-NNN (next op)
      → ...
        → /spec-implementation US-NNN (story-end gates)
          → /spec-implementation-verification US-NNN  ← story-end mode (no Op-X)
            → /verification-and-validation US-NNN
```

---

## Execution: PER-OP MODE

**Spawn a fresh Opus agent** with the audit prompt below. The agent needs Bash access to run the test suites and inspect git diffs.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt (substitute `US-NNN` and `Op-X`):

```
You are a per-Operation spec-implementation auditor for a story-based dev
pipeline. Your job is to verify that the GREEN implementation written for
ONE Operation (Op-X) of story US-NNN is real, scope-bounded,
architecture-compliant, and free of regressions.

## Step 1: Read the Artifacts (scoped to Op-X)

1. specs/story-NNN-slug/STORY.md (full)
2. specs/story-NNN-slug/PLAN.md — focus on:
   - The "### Operation X — <title>" section (RED-A, RED-B, GREEN, REFACTOR)
   - The Test Plan rows where Op = Op-X
   - The Structure table (which files Op-X may legitimately touch)
   - The Norms (N) section
   - The Safeguards (S) section
3. specs/story-NNN-slug/features/*.feature — scenarios named in Op-X's
   "Covers scenarios:" line
4. specs/ARCHITECTURE.md — module map, dependency direction, public APIs
5. The git diff for Op-X. Identify:
   - $RED_SHA   = SHA before Op-X's first test() commit (use git log --grep
                  "test(US-NNN): add" --grep "Op-X" — the parent of the
                  earliest matching commit)
   - $GREEN_SHA = SHA of Op-X's feat() commit
   - $REFACTOR_SHA = SHA of Op-X's refactor() commit (or $GREEN_SHA if absent)
   Use `git diff $RED_SHA..$REFACTOR_SHA` to see exactly the production-code
   files Op-X added or modified.
6. specs/story-NNN-slug/state.json — read state.operations[Op-X].
7. specs/stories.json — find the entry where id = "US-NNN".

## Step 2: GREEN-State Verification (Op-X scope)

Run the test suites:
- bun test --grep="@US-NNN.*@Op-X"  → expect: every test PASSES
- bun bdd --tags="@US-NNN and @Op-X" → expect: every test PASSES

Then run the per-story suite (covers earlier Ops):
- bun test --grep="@US-NNN"   → expect: every test PASSES (no regression in earlier Ops)
- bun bdd --tags="@US-NNN"    → expect: every test PASSES

Any test failure at this stage is a critical issue.

## Step 3: No Over-Implementation Audit

For EACH production-code file in `git diff $RED_SHA..$REFACTOR_SHA`:
- [ ] The file is in PLAN.md's Structure table (or in `<module>/__tests__/fakes/`).
- [ ] The diff implements behaviour required by Op-X's tests OR the Operation's
      GREEN section in PLAN.md. Flag any function/branch/feature that:
        - Has no test asserting it (if not infrastructure)
        - Is only justified by a future Operation's PLAN.md scope
        - Implements a Safeguard not in scope for Op-X (Safeguards belong to
          the Operation that introduces them)
- [ ] No commented-out code, no TODO/FIXME for behaviour that should be done now
- [ ] No `console.log`/debug spam left in production code
- [ ] No `any`-typed signatures unless ARCHITECTURE.md explicitly allows

## Step 4: Architecture Compliance

For each file Op-X touched:
- [ ] Belongs to the module Structure says it should
- [ ] Imports respect dependency direction (no cross-BM imports; Infra → BM is
      forbidden; BM → Infra goes through index.ts public API)
- [ ] No foreign keys / direct table references across module boundaries
- [ ] Public APIs only (no reaching into another module's internals)
- [ ] Bootstrap pattern matches ARCHITECTURE.md (e.g., getStudyService() exported
      from the Infra module's index.ts)

## Step 5: Norms + Safeguards Compliance (Op-X scope)

Norms (from PLAN.md's N section): naming, logging, defensive coding,
observability, style. For each Op-X file:
- [ ] Naming follows the convention
- [ ] Public methods log entry/exit at the prescribed level (if Norms require it)
- [ ] Inputs validated at module boundaries; internal callers trusted
- [ ] Explicit return types on exported functions (no inferred `any`)

Safeguards (from PLAN.md's second S section). Op-X may only enforce Safeguards
its tests cover. For each Safeguard the Test Plan ties to Op-X:
- [ ] Implementation honours the Safeguard
- [ ] If the Safeguard is performance-related, the bench test in Test Plan
      passes the threshold

## Step 6: Test Plan Coverage (Op-X rows)

Cross-check every Test Plan row tagged Op-X:
- [ ] Row's file exists
- [ ] Row's test passes (state.json.test_plan_rows[T-N].passing = true)
- [ ] Row's `Asserts` description matches what the test now exercises after GREEN

## Step 7: state.json (Op-X)

- [ ] state.json.operations[Op-X].operation_phase ∈ {green, refactored}
- [ ] state.json.operations[Op-X].implementation_status = "green"
- [ ] state.json.operations[Op-X].completed_at is set
- [ ] state.json.implementation.operations_green has been incremented
- [ ] state.json.implementation.last_commit matches the latest Op-X commit
- [ ] state.json.implementation.ops_completed contains "Op-X"

## Output Format

# Spec Implementation Verification Report — US-NNN / Op-X

**Date:** [today]
**Story:** US-NNN — <title>
**Operation:** Op-X — <op title>
**Diff range:** $RED_SHA..$REFACTOR_SHA
**Files modified by Op-X:** [count]
**Lines added / removed:** [+N / -M]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready to proceed (next Op, or story-end gates if Op-X is the last)
FAIL = critical issues that must be fixed before moving on

## Summary

| Area                          | Grade | Issues |
|-------------------------------|-------|--------|
| GREEN-State (Op-X)            | [PASS/FAIL] | [count] |
| GREEN-State (full @US-NNN)    | [PASS/FAIL] | [count] |
| No Over-Implementation        | [PASS/FAIL] | [count] |
| Architecture Compliance       | [PASS/FAIL] | [count] |
| Norms + Safeguards            | [PASS/FAIL] | [count] |
| Test Plan Coverage (Op-X)     | [PASS/FAIL] | [count] |
| state.json (Op-X)             | [PASS/FAIL] | [count] |

## Test Run Results

| Suite | Filter                              | Tests Run | Passed | Failed |
|-------|-------------------------------------|-----------|--------|--------|
| unit  | @US-NNN.*@Op-X                      | N         | N      | 0      |
| bdd   | @US-NNN and @Op-X                   | N         | N      | 0      |
| unit  | @US-NNN  (full per-story)           | N         | N      | 0      |
| bdd   | @US-NNN  (full per-story)           | N         | N      | 0      |

(Expected: 100% passing across all four lines.)

## Critical Issues (Must Fix)

[Each: location, what's wrong, specific fix. Common categories:
 - Tests fail (regression)
 - Production-code diff includes logic for a future Op
 - Cross-BM import detected
 - Norm violation (no `any`, naming, etc.)]

## Warnings (Should Fix)

[Stylistic, minor scope creep, cosmetic violations]

## Next Step

[Either "Ready for /spec-implementation US-NNN (next op)" if Op-X isn't the
 last, or "Ready for /spec-implementation US-NNN (story-end gates)" if it is,
 or "Fix [N] critical issues first, then re-run /spec-implementation-verification
 US-NNN Op-X"]

---
```

### After the Agent Returns (per-op mode)

1. Persist the report to `specs/story-NNN-slug/verification/green-audit-Op-X.md`.
2. Update `state.json.operations[Op-X].green_audit`:
   ```json
   { "verdict": "PASS|PASS_WITH_WARNINGS|FAIL",
     "at": "<ISO 8601>",
     "report_path": "specs/story-NNN-slug/verification/green-audit-Op-X.md" }
   ```
3. Present the report's summary to the user.
4. If **FAIL**: list critical issues; ask if they want to fix now (loops back into `/spec-implementation US-NNN Op-X --force`).
5. If **PASS WITH WARNINGS**: show warnings; ask whether to address or proceed.
6. If **PASS**: confirm readiness. Suggest:
   - If Op-X is the last Op (every Op now `green` or `refactored`): "Run `/spec-implementation US-NNN` (no Op-X) to trigger the story-end gates."
   - Otherwise: "Run `/test-setup US-NNN` to RED the next Op."

If running in a ralph-loop, skip the AskUserQuestion and emit `<promise>GREEN_AUDIT_COMPLETE_US-NNN_Op-X</promise>`.

---

## Execution: STORY-END MODE

Triggered when called with no `Op-X` arg, every Op is `green` or `refactored`, and `state.json.quality_gates.{simplified, reviewed, verified}` are all `true`. Confirms the story is ready to be flipped to `verified` by `/verification-and-validation`.

**Spawn a fresh Opus agent** with the story-end audit prompt below.

### Agent Prompt (story-end)

```
You are a story-end spec-implementation auditor. Your job is to verify that
story US-NNN is fully and correctly implemented, with all quality gates
passed, and is ready for /verification-and-validation.

## Step 1: Read the Artifacts

1. specs/story-NNN-slug/STORY.md
2. specs/story-NNN-slug/PLAN.md — full
3. All .feature files in specs/story-NNN-slug/features/
4. specs/story-NNN-slug/state.json
5. specs/stories.json — find the entry where id = "US-NNN"
6. specs/ARCHITECTURE.md
7. The full diff for the story: BASE_SHA = parent of the first
   `test(US-NNN):` commit; HEAD_SHA = latest commit on the story
8. The per-op green-audit reports under specs/story-NNN-slug/verification/

## Step 2: Per-Op Coverage

- [ ] Every Op in PLAN.md has operation_phase ∈ {green, refactored}
- [ ] Every Op has a green_audit verdict of PASS or PASS_WITH_WARNINGS
- [ ] No Op has unresolved errors in state.json.errors[]

## Step 3: Quality Gates Verification

- [ ] state.json.quality_gates.simplified = true
- [ ] state.json.quality_gates.reviewed = true
- [ ] state.json.quality_gates.verified = true
- [ ] state.json.quality_gates.review_findings — confirm critical findings
      are addressed (any with status: open is a FAIL)
- [ ] state.json.quality_gates.verification_results — every check passing

## Step 4: Full Test Suite

- [ ] bun test       → all unit + integration tests pass
- [ ] bun bdd        → all Gherkin scenarios pass (story + previously verified)
- [ ] bun lint && bun typecheck → clean

## Step 5: state.json + stories.json

- [ ] state.json.phase_local = "verifying"
- [ ] state.json.implementation.completed_at is set
- [ ] specs/stories.json#stories[i].phase = "green"
- [ ] specs/stories.json#stories[i].implementation populated
- [ ] history has a {phase: "green", at: ...} entry
- [ ] specs/STORIES.md reflects the new phase

## Output Format

# Story-End Spec Implementation Verification — US-NNN

**Date:** [today]
**Story:** US-NNN — <title>
**Ops:** [N total, M green, K refactored]
**Diff range:** $BASE_SHA..$HEAD_SHA
**Files modified:** [count]
**Lines added / removed:** [+N / -M]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready for /verification-and-validation US-NNN
FAIL = critical issues to fix before /v-and-v

## Summary

| Area                          | Grade | Issues |
|-------------------------------|-------|--------|
| Per-Op Coverage               | [PASS/FAIL] | [count] |
| Quality Gates                 | [PASS/FAIL] | [count] |
| Full Test Suite               | [PASS/FAIL] | [count] |
| state.json + stories.json     | [PASS/FAIL] | [count] |

## Critical Issues (Must Fix)

## Warnings

## Next Step

[Either "Ready for /verification-and-validation US-NNN" or
 "Fix [N] critical issues first, then re-run this skill"]
```

### After the Agent Returns (story-end mode)

1. Persist the report to `specs/story-NNN-slug/verification/green-audit-story-end.md`.
2. Present the report's summary to the user.
3. If **FAIL**: list critical issues. The user may need to re-run `/spec-implementation US-NNN` (story-end mode with `--force`) or fix specific Ops.
4. If **PASS** or **PASS WITH WARNINGS**: confirm readiness and suggest running `/verification-and-validation US-NNN`.

If running in a ralph-loop, emit `<promise>GREEN_AUDIT_COMPLETE_US-NNN</promise>`.

---

## What This Skill Does NOT Do

- It does not write or fix implementation code — it reports issues.
- It does not start `/verification-and-validation` — it certifies readiness.
- It does not run the curl walkthrough or Playwright walkthrough — those belong to `/verification-and-validation`.
- It does not flip `phase` to `verified` — `/verification-and-validation` does that after running the running-app E2E checks.
- It does not re-audit earlier Ops in per-op mode — those have their own `green_audit` records. The full per-`@US-NNN` test run, however, will catch any regression earlier Ops introduced.
