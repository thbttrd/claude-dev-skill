---
name: plan-writing-verification
version: 1.0.0
description: >
  Verifies the output of /plan-writing for a specific version (V0, V1, ...) for
  completeness, DAG correctness, TDD prescription compliance, and architecture
  alignment. Spawns a fresh agent to audit all plan files in docs/V{N}/plans/ against
  the plan template, the DAG analysis rules, ARCHITECTURE.md, SPECS.md, and the
  feature files. Checks that every wave delivers a vertical slice, the DAG has
  sequential waves with parallelizable stories within each wave, every task
  prescribes steps-first TDD (BDD steps -> unit tests -> implementation), and module
  assignments match the architecture. Produces a structured compliance report with
  pass/fail verdicts and actionable recommendations. Use this skill after running
  /plan-writing, before starting /test-setup. Also triggers on: "verify the plans",
  "check plan quality", "audit the implementation plans", "are the plans ready",
  "validate plans before implementation", "check the DAG", or any request to review
  plan quality before coding begins.
---

# Plan Writing Verification

Audits the implementation plans and DAG produced by `/plan-writing` for a **specific
version** (V0, V1, ...) and produces a compliance report. This is a **quality gate**
between planning and test setup.

The verification runs in a **fresh agent** so the review has no context bias from
the planning session. The auditor reads the plan files, the DAG, the feature files,
and ARCHITECTURE.md — then checks compliance from scratch.

## When to Run

```
/repo-initialization-verification -> /plan-writing -> /plan-writing-verification -> /test-setup
```

## What Gets Verified

| Artifact         | Expected Location                           |
| ---------------- | ------------------------------------------- |
| Foundation plan  | `docs/V{N}/plans/00-foundation.md`          |
| Wave plans       | `docs/V{N}/plans/WN-slug.md` (one per wave) |
| DAG document     | `docs/V{N}/plans/DAG.md`                    |
| State file       | `docs/V{N}/plans/implementation-state.json` |
| Project tracking | `project-tracking.json`                     |
| ARCHITECTURE.md  | `docs/V{N}/architecture/ARCHITECTURE.md`    |
| SPECS.md         | `docs/V{N}/specs/SPECS.md`                  |
| Feature files    | `docs/V{N}/specs/features/*.feature`        |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are an implementation plan auditor. Your job is to verify that the plans produced
by the plan-writing skill for a specific version are complete, correct, and ready for
parallel agent execution.

## Step 0: Determine Version

Read project-tracking.json to identify the target version (V0, V1, ...).
Use the version whose `planning` field exists and was most recently written.
Set VN = the version directory name (e.g., "V0", "V1").

## Step 1: Read All Artifacts

Read these files:
1. Every file in docs/V{N}/plans/ (00-foundation.md, WN-*.md, DAG.md)
2. docs/V{N}/plans/implementation-state.json
3. docs/V{N}/architecture/ARCHITECTURE.md
4. docs/V{N}/specs/SPECS.md
5. Every .feature file in docs/V{N}/specs/features/
6. project-tracking.json
7. docs/V{N}/specs/UI-SPECS.md and docs/V{N}/specs/UI-F-*.md (if they exist)

## Verification Checklist

### A. Plan File Completeness

**A1. Version directory exists:**
- [ ] docs/V{N}/plans/ directory exists and contains plan files

**A2. Foundation plan exists:**
- [ ] docs/V{N}/plans/00-foundation.md exists and is non-empty

**A3. Wave plans exist:**
For each wave referenced in the DAG:
- [ ] A corresponding wave plan file exists: docs/V{N}/plans/WN-slug.md
- [ ] File name follows the pattern: WN-<descriptive-slug>.md (e.g., W1-core-api.md)

**A4. No orphaned plans:**
- [ ] Every plan file in docs/V{N}/plans/ corresponds to a wave in the DAG
      (except 00-foundation.md and DAG.md and implementation-state.json)

**A5. DAG.md exists:**
- [ ] docs/V{N}/plans/DAG.md exists and is non-empty
- [ ] Contains a dependency graph (Mermaid or ASCII)
- [ ] Contains a wave table
- [ ] Contains a parallel execution guide

### B. Plan Template Compliance (Per Plan)

For EACH plan file (foundation + all waves), verify it contains:

**B1. Header metadata:**
- [ ] Wave ID (e.g., "W0 - Foundation", "W1 - Core API")
- [ ] User Stories covered (US-NNN list, or "N/A" for foundation)
- [ ] Architecture module(s) — references real modules from ARCHITECTURE.md
- [ ] UI screen spec reference (or "N/A")
- [ ] Depends on — list of prior wave IDs
- [ ] Estimated task count

**B2. Context section:**
- [ ] Contains 1-2 sentences describing the wave's vertical slice
- [ ] References the User Stories (US-NNN) from SPECS.md

**B3. Architecture Notes:**
- [ ] Names specific module(s) from ARCHITECTURE.md
- [ ] Mentions data ownership or dependency rules

**B4. Prerequisites:**
- [ ] Lists specific APIs/services/types from prior waves
- [ ] If depends_on is non-empty, prerequisites section is non-empty

**B5. Tasks section:**
- [ ] Has at least 1 task
- [ ] Task count matches the "Estimated tasks" in the header

**B6. Completion Criteria:**
- [ ] Lists all quality gates (tests, lint, typecheck, BDD)

### C. TDD Prescription Compliance (CRITICAL)

This is the most important check. For EACH task in EVERY plan:

**C1. RED-A (BDD Step Definitions) prescribed FIRST:**
- [ ] Task explicitly describes BDD step definitions to write
- [ ] Specifies which step file to create/update
- [ ] Lists Given/When/Then patterns to bind
- [ ] States "run BDD tests -> expect FAILURE"
- [ ] Prescribes a commit: test(<scope>): add BDD steps for ...

**C2. RED-B (Unit/Integration Tests) prescribed SECOND:**
- [ ] Task explicitly describes tests to write AFTER step definitions
- [ ] Specifies which test file to create
- [ ] Names the test type (sociable unit / integration / overlapping)
- [ ] Lists specific behaviors to assert
- [ ] Names fakes needed (for sociable unit tests)
- [ ] States "run tests -> expect FAILURE"
- [ ] Prescribes a commit: test(<scope>): add failing test for ...

**C3. GREEN (Implementation) prescribed THIRD:**
- [ ] Task explicitly describes implementation AFTER tests
- [ ] Specifies which files to create/modify
- [ ] Names the module from ARCHITECTURE.md
- [ ] States "run full test suite -> ALL must pass"
- [ ] Prescribes a commit: feat(<scope>): implement ...

**C4. Order is explicit and unambiguous:**
- [ ] The RED-A -> RED-B -> GREEN sequence is clearly labeled in the task
- [ ] An implementing agent cannot misinterpret the order
- [ ] Search for any task that mentions "implement" before "test" — flag as CRITICAL

**C5. REFACTOR mentioned (optional but present):**
- [ ] Task mentions refactor step (even if "None expected")

### D. DAG Correctness

**D1. Sequential wave ordering:**
- [ ] Waves are numbered sequentially: W0 -> W1 -> W2 -> ...
- [ ] W0 is always the foundation wave
- [ ] Each wave WN depends only on waves W0 through W(N-1)

**D2. Vertical slice per wave:**
- [ ] Each wave (except W0 foundation) touches all necessary layers
      (API/routes, business logic, persistence, UI if applicable)
- [ ] No wave is purely a "backend" or "frontend" wave — each delivers
      end-to-end functionality

**D3. Story-level parallelism within waves:**
- [ ] Within a single wave, independent user stories (US-NNN) can run in parallel
- [ ] Stories within the same wave have NO dependencies on each other
- [ ] The wave plan clearly marks which stories are independent

**D4. Acyclicity:**
- [ ] No circular dependencies between waves
- [ ] Foundation (W0) has zero dependencies
- [ ] No wave depends on itself or on a later wave

**D5. DAG.md consistency:**
- [ ] DAG.md matches the implementation-state.json waves and dependency fields
- [ ] Mermaid/ASCII graph edges match the wave ordering in plans

### E. Architecture Alignment

For each plan:

**E1. Module assignment:**
- [ ] Every task's "Module" field names a module from ARCHITECTURE.md section 3
- [ ] Business logic tasks target Business-Modules (not Infra-Modules)
- [ ] Infrastructure tasks (repos, schema, bootstrap) target Infra-Modules
- [ ] No task targets a module that doesn't exist in ARCHITECTURE.md

**E2. Data ownership:**
- [ ] Tasks that create/modify database tables target the correct Infra-Module
      (the one that owns that table per ARCHITECTURE.md section 6)
- [ ] No task writes to a table owned by another module

**E3. Dependency direction:**
- [ ] No task imports from a BM's internal files (only through index.ts)
- [ ] No BM task references an Infra-Module directly

**E4. Feature-to-module mapping:**
- [ ] The module(s) listed in the plan header match the ARCHITECTURE.md mapping
      (section 3.1 shows which features each BM owns)

### F. Scenario Coverage

**F1. All user stories covered:**
For each US-NNN user story in the version (from SPECS.md / project-tracking.json):
- [ ] The user story appears in exactly one wave plan
- [ ] No user story is orphaned (in the version but not in any wave)
- [ ] No user story is duplicated across multiple waves

**F2. All scenarios covered:**
For each .feature file relevant to this version's user stories:
- [ ] Every Scenario name appears in at least one wave's task list
- [ ] No scenario is orphaned (in the feature file but not in any plan)

**F3. All Rules covered:**
- [ ] Every Rule: block in each relevant .feature file maps to at least one task

**F4. No duplicate coverage:**
- [ ] No scenario is claimed by tasks in two different wave plans
      (unless one wave provides the foundation and another consumes it)

### G. Foundation Plan Quality

**G1. Covers shared infrastructure for THIS VERSION:**
- [ ] Database schema task exists (targets Infra-Module schemas needed by this version)
- [ ] Shared types task exists (targets shared-kernel types needed by this version)
- [ ] Database connection task exists (targets shared-infra)
- [ ] Test infrastructure task exists (fixtures, fakes, factories)

**G2. Module skeletons scoped to this version:**
- [ ] For each Business-Module used by this version's waves, the foundation plan
      includes a task to create the service skeleton with DI interfaces
- [ ] For each Infra-Module used by this version's waves, the foundation plan
      includes a task to create repository implementations and the bootstrap function
- [ ] Does NOT include skeletons for modules not touched by this version

**G3. Enables wave 1:**
- [ ] Foundation plan produces everything that W1 plans list as prerequisites
- [ ] If a W1 plan says "Uses CardCatalogService from foundation", then
      foundation has a task that creates CardCatalogService

### H. Parallelizability

**H1. Inter-wave sequencing:**
- [ ] Waves execute sequentially: W0 must complete before W1 starts, etc.
- [ ] Each wave's prerequisites are fully satisfied by prior waves

**H2. Intra-wave parallelism:**
For each pair of independent stories within the same wave:
- [ ] They don't modify the same files (no merge conflicts)
- [ ] They target different modules (or different parts of the same module)
- [ ] They have no implicit ordering between them

**H3. Self-containment:**
- [ ] Each plan contains enough context for an independent agent to execute it
      without reading other plans (except knowing prior wave APIs are available)

### I. Project Tracking Verification

**I1. planning field written back:**
- [ ] project-tracking.json has the version's `planning` field populated
- [ ] planning.plan_dir matches "docs/V{N}/plans/"
- [ ] planning.dag_file matches "docs/V{N}/plans/DAG.md"
- [ ] planning.waves_count matches the actual number of waves (including foundation)
- [ ] planning.total_tasks matches the sum of tasks across all wave plans
- [ ] planning.planned_at is a valid ISO timestamp

## Output Format

---

# Plan Writing Verification Report

**Date:** [today]
**Version:** [VN]
**Plans found:** [count] (1 foundation + [N] wave plans)
**DAG waves:** [count]
**Total tasks across all plans:** [count]
**Max parallelism:** [highest independent story count in any wave]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = all plans complete, DAG valid, TDD prescribed, ready for /test-setup
PASS WITH WARNINGS = minor issues that won't block /test-setup
FAIL = critical issues (missing TDD prescription, invalid DAG, missing plans)

## Summary

| Area | Grade | Critical | Warnings |
|------|-------|----------|----------|
| A. Plan Completeness | [A-F] | [count] | [count] |
| B. Template Compliance | [A-F] | [count] | [count] |
| C. TDD Prescription | [A-F] | [count] | [count] |
| D. DAG Correctness | [A-F] | [count] | [count] |
| E. Architecture Alignment | [A-F] | [count] | [count] |
| F. Scenario Coverage | [A-F] | [count] | [count] |
| G. Foundation Quality | [A-F] | [count] | [count] |
| H. Parallelizability | [A-F] | [count] | [count] |
| I. Project Tracking | [A-F] | [count] | [count] |

## DAG Overview

```

[Reproduce the wave table from DAG.md]

```

## Wave Summary

| Wave | Plan File | User Stories | Tasks | Layers Touched |
|------|-----------|-------------|-------|----------------|
| W0 | 00-foundation.md | N/A | [N] | infra, shared |
| W1 | W1-slug.md | US-001, US-002 | [N] | API, BM, IM, UI |
| W2 | W2-slug.md | US-003 | [N] | API, BM, IM, UI |

## Scenario Coverage Matrix

| User Story | Scenarios in .feature | Scenarios in plans | Coverage |
|------------|----------------------|-------------------|----------|
| US-001 | [N] | [M] | [M/N]% |

## TDD Compliance Summary

| Plan | Tasks | All prescribe RED-A? | All prescribe RED-B? | All prescribe GREEN? | Order explicit? |
|------|-------|---------------------|---------------------|---------------------|----------------|
| 00-foundation | [N] | [YES/NO] | [YES/NO] | [YES/NO] | [YES/NO] |
| W1-slug | [N] | [YES/NO] | [YES/NO] | [YES/NO] | [YES/NO] |

## Critical Issues (Must Fix)

[For each:]
- **ID:** [V-XX]
- **Area:** [which checklist area]
- **Plan:** [which plan file]
- **Task:** [which task number, if applicable]
- **Issue:** [what's wrong]
- **Fix:** [specific action to take]

## Warnings (Should Fix)

[Same format]

## Recommendations

[Any suggestions beyond strict compliance]

## Next Step

[Either "Ready for /test-setup -- dispatch wave 0 (foundation) first" or
 "Fix [N] critical issues first, then re-run /plan-writing-verification"]

---
```

### After the Agent Returns

1. Present the report to the user
2. If **FAIL**: list critical issues, ask if they want to fix them
3. If **PASS WITH WARNINGS**: show warnings, ask if they want to address or proceed
4. If **PASS**: confirm readiness and suggest proceeding to `/test-setup`

## What This Skill Does NOT Do

- It does not write or fix plans — it only reports issues
- It does not execute any plan — it verifies they're ready for execution
- It does not validate code — there's no code yet, only plans
