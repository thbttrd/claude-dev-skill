---
name: plan-writing-verification
version: 2.0.0
description: >
  Per-story verification of the output of /plan-writing for completeness,
  REASONS-canvas compliance, TDD prescription, Test Plan traceability, and
  architecture alignment. Spawns a fresh agent to audit
  specs/story-NNN-slug/PLAN.md against the plan template, the story's
  STORY.md + .feature files, and specs/ARCHITECTURE.md. Checks that every
  REASONS section is populated, every Operation prescribes RED-A → RED-B →
  GREEN → REFACTOR, every Test Plan row is traceable to a scenario / AC /
  safeguard, and module assignments respect ARCHITECTURE.md. Produces a
  structured compliance report. Use this skill after running /plan-writing
  US-NNN, before /test-setup US-NNN. Triggers on: "verify the plan", "check
  plan quality", "audit the plan", "is the plan ready", "validate plan
  before test-setup", "/plan-writing-verification US-NNN".
---

# Plan Writing Verification (per story)

Audits the implementation plan for **one story** and produces a compliance report. Quality gate between `/plan-writing` and `/test-setup`.

The verification runs in a **fresh agent** so the review has no context bias from the planning session. The auditor reads the plan, the spec, the architecture, and checks compliance from scratch.

## Pre-Flight

| Check                                                 | Action                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                           | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                   | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                               | Ask the user which story to verify (default: stories whose `phase = planned`).                                                                  |
| `specs/story-NNN-slug/PLAN.md` does not exist         | Hard-stop. Print: `Story US-NNN has no PLAN.md yet. Run /plan-writing US-NNN first.`                                                            |

## When to Run

```
/spec-writing-verification US-NNN → /plan-writing US-NNN → /plan-writing-verification US-NNN → /test-setup US-NNN
```

## What Gets Verified

| Artifact      | Expected Location                                              |
| ------------- | -------------------------------------------------------------- |
| PLAN.md       | `specs/story-NNN-slug/PLAN.md`                                 |
| STORY.md      | `specs/story-NNN-slug/STORY.md` — for cross-checks             |
| Feature files | `specs/story-NNN-slug/features/F-NNN-*.feature`                |
| Architecture  | `specs/ARCHITECTURE.md` — for module-assignment compliance     |
| Tracker       | `specs/stories.json` — for phase + dependency cross-checks     |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are a plan quality auditor for a story-based dev pipeline. Your job is
to verify that PLAN.md for story US-NNN is complete, REASONS-canvas-compliant,
TDD-prescriptive, and architecturally sound.

## Step 1: Read the Artifacts

1. specs/story-NNN-slug/PLAN.md
2. specs/story-NNN-slug/STORY.md
3. specs/story-NNN-slug/features/F-NNN-*.feature
4. specs/ARCHITECTURE.md
5. specs/PROJECT.md (for NFR cross-checks)
6. specs/stories.json — find the entry where id = "US-NNN" for cross-checks

Reference: <plan-writing plugin>/skills/plan-writing/references/plan-template.md

## Verification Checklist

### A. REASONS Canvas Completeness

PLAN.md must contain ALL of these sections in order:
- [ ] R — Requirements (Problem, DoD, AC mirror)
- [ ] E — Entities (table with module ownership)
- [ ] A — Approach (chosen approach + alternatives + trade-offs)
- [ ] S — Structure (file table + dependency direction)
- [ ] O — Operations (numbered, ordered, ≤ 6 by default)
- [ ] N — Norms (load-bearing for this story)
- [ ] S — Safeguards (invariants, perf, security, data)
- [ ] Test Strategy
- [ ] Test Plan (table with id, type, scenario/AC/safeguard, file, asserts)
- [ ] Verification (per-story checklist)
- [ ] Completion Criteria (checkboxes)

For each section: PASS or FAIL with the specific issue.

### B. Operations Quality (Per Operation)

For EACH Operation in the plan, verify:

- [ ] Has a descriptive title and "Covers scenarios" line referencing real Gherkin scenarios
- [ ] Has a Module reference matching a module in specs/ARCHITECTURE.md
- [ ] Prescribes all four phases:
  - [ ] RED-A: BDD step bindings, real Playwright/request actions, MUST FAIL, commit message
  - [ ] RED-B: unit/integration test, fakes listed, MUST FAIL, commit message
  - [ ] GREEN: minimal implementation, file paths, full-suite PASS, commit message
  - [ ] REFACTOR: optional, but if listed must include "still PASS" + commit message
- [ ] Commit message scope is `US-NNN` for story work or `foundation` for the Foundation Story

### C. Test Plan Traceability

For EACH row in the Test Plan, verify:

- [ ] Has an id (T-01, T-02, …)
- [ ] Has a type (BDD | unit | integration | bench)
- [ ] References a real Gherkin scenario, AC id from STORY.md, or Safeguard from PLAN.md
- [ ] Has a concrete file path
- [ ] Has a non-vague assertion description

Cross-checks:
- [ ] Every Gherkin scenario in the story's .feature files has at least one BDD row
- [ ] Every AC in STORY.md has at least one row (BDD or unit)
- [ ] Every Safeguard with an observable assertion has at least one row
- [ ] No untraceable rows (every row references a spec artifact)

### D. Architecture Compliance

- [ ] Every module referenced in Structure exists in specs/ARCHITECTURE.md (or is marked NEW with a clear note)
- [ ] No cross-BM imports introduced (BM-A's plan does not directly import from BM-B's internals)
- [ ] Dependency direction matches ARCHITECTURE.md (Infra → BM, never BM → Infra)
- [ ] No infrastructure types in BM public APIs
- [ ] Bootstrap pattern matches the architecture's bootstrap section
- [ ] Data ownership claims align with specs/ARCHITECTURE.md's data ownership map

### E. Story & Spec Alignment

- [ ] Plan's "Depends on" line matches stories[i].depends_on_story_ids
- [ ] Every dependency listed is `verified` or `is_foundation: true`
- [ ] Plan's AC mirror matches STORY.md's Acceptance Criteria 1:1
- [ ] Operations cover every Rule in the story's .feature files
- [ ] Mockup links resolve (if UI)

### F. Norms & Safeguards Quality

- [ ] Norms list is non-empty and load-bearing (not generic boilerplate copied from CLAUDE.md)
- [ ] Safeguards has at least one invariant entry
- [ ] Performance Safeguards have measurable targets (units, p95/p99 specifics)
- [ ] Security Safeguards name specific mechanisms

### G. specs/stories.json Integration

- [ ] stories[i].artifacts.plan points at PLAN.md and the file exists
- [ ] stories[i].planning.operations_count matches the count of Operations in PLAN.md
- [ ] stories[i].planning.planned_at is a valid date
- [ ] stories[i].phase is `planned` (or beyond — `red`/`green`/`verified` are acceptable for re-audits)
- [ ] stories[i].history has a `{phase: "planned", at: ...}` entry
- [ ] project.updated_at was bumped recently

### H. Size & Splitability

- [ ] Operations count ≤ 6 (default ceiling). If higher, flag as WARNING and recommend splitting the story.
- [ ] Test Plan row count is reasonable (rough thumb: 2-4 rows per Operation)

## Output Format

Produce this exact report structure:

---

# Plan Writing Verification Report — US-NNN

**Date:** [today]
**Story:** US-NNN — <title>
**PLAN.md:** specs/story-NNN-slug/PLAN.md
**Operations:** [count]
**Test Plan rows:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready for /test-setup US-NNN
PASS WITH WARNINGS = minor issues; consider fixing
FAIL = critical issues that must be fixed before /test-setup

## Summary

| Area | Grade | Issues |
|------|-------|--------|
| A. REASONS Canvas Completeness | [PASS/FAIL] | [count] |
| B. Operations Quality          | [PASS/FAIL] | [count] |
| C. Test Plan Traceability      | [PASS/FAIL] | [count] |
| D. Architecture Compliance     | [PASS/FAIL] | [count] |
| E. Story & Spec Alignment      | [PASS/FAIL] | [count] |
| F. Norms & Safeguards Quality  | [PASS/FAIL] | [count] |
| G. stories.json Integration    | [PASS/FAIL] | [count] |
| H. Size & Splitability         | [PASS/FAIL] | [count] |

## Critical Issues (Must Fix)

[Each: location (file:section), issue, specific fix]

## Warnings (Should Fix)

## Recommendations

## Next Step

[Either "Ready for /test-setup US-NNN" or "Fix [N] critical issues, then re-run /plan-writing-verification US-NNN"]

---
```

### After the Agent Returns

1. Present the report to the user.
2. If **FAIL**: list critical issues; ask if they want to fix now (loops back into `/plan-writing US-NNN` update mode).
3. If **PASS WITH WARNINGS**: show warnings; ask whether to address or proceed.
4. If **PASS**: confirm readiness and suggest running `/test-setup US-NNN`.

## What This Skill Does NOT Do

- It does not rewrite or fix the plan — it reports issues.
- It does not assess whether the chosen Approach is the best one — it checks structural quality.
- It does not replace human review — it catches mechanical issues a human might miss.
