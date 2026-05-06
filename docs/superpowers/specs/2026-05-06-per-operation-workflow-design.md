# Design: Per-Operation Workflow for the Dev Pipeline

**Date:** 2026-05-06
**Branch:** `feat/per-operation-workflow`
**Status:** Approved design — ready for implementation planning.
**Scope:** Rewrite `test-setup`, `test-setup-verification`, `spec-implementation`, and create the new `spec-implementation-verification` so each operates on **one Operation of one user story** at a time, instead of the whole story in a single sweep. Update the marketplace `README.md` and bump the four plugins from `2.0.0` to `3.0.0` (`spec-implementation-verification` ships at `1.0.0`). A small companion change to the `plan-writing` template adds an `Op` column to the Test Plan table.

---

## 1. Why change

The story-based migration (PR #1) made the **user story** the unit of planning, scoping, and verification. But inside the story, `test-setup` still writes every test for every Operation in one shot, then `spec-implementation` walks Operations sequentially under a single invocation. That works, but it doesn't match how a TDD-disciplined human develops:

1. **Real TDD interleaves RED and GREEN at the smallest meaningful unit** — one Rule, one Operation. Writing every RED for every Operation up-front decouples the test from the design choice it pins down; writing GREEN against a single test keeps each implementation step small.
2. **A failure mid-story is easier to localize when each Operation is its own RED → GREEN → REFACTOR cycle** with its own commit boundary. The current "all RED, then all GREEN" model produces large diffs and forces re-running the whole RED phase if the plan changes.
3. **The user wants finer granularity** — explicit per-op control, with the option to redo a single Operation without resetting the whole story.

This proposal threads RED → GREEN → REFACTOR through each Operation in turn, while keeping the story as the unit of *planning, audit, and shipping* (PLAN.md, quality gates, `phase = verified`).

---

## 2. Target philosophy in one paragraph

> **The story is still the unit of planning and shipping; the Operation is the unit of execution.** For each Operation in a story's PLAN.md, the agent (or human) walks RED-A → RED-B → GREEN → REFACTOR with its own commits, before moving to the next Operation. Each pipeline skill (`/test-setup`, `/test-setup-verification`, `/spec-implementation`, `/spec-implementation-verification`) accepts an optional `Op-X` arg and defaults to the next pending Operation read from the story's `state.json`. Story-level wrap-up gates (Simplify, Code Review, Verify) run only when every Operation is GREEN — invoked by `/spec-implementation US-NNN` with no `Op-X` arg. The story's project-level `phase` stays canonical (`planned → red → green → verified`); per-Operation state lives entirely in `specs/story-NNN-slug/state.json`.

---

## 3. Decisions captured (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| Q1 | Invocation model | **B — smart default**: skills take `US-NNN [Op-X]`; if `Op-X` omitted, pick the next pending Operation from `state.json`. |
| Q2 | Story-level wrap-up gates location | **B — inside `/spec-implementation`**: when invoked without `Op-X` and all Operations are GREEN, run Simplify + Code Review + Verify and flip `phase = green`. |
| Q3 | Project-level `phase` model | **A — keep coarse**: `planned → red (any op active) → green (all ops GREEN + gates) → verified`. Mid-story progress (`red (Op-2/4 GREEN)`) is rendered in `STORIES.md` from `state.json`, not stored in `phase`. |

---

## 4. Skill responsibilities (per-Operation)

| Skill | Default | Per-op duty | Story-end duty (no `Op-X`) |
|---|---|---|---|
| `/test-setup US-NNN [Op-X]` | next op where `operation_phase ∈ {pending, red_a}` | Write RED-A (BDD steps) + RED-B (unit/int tests) for that op, lazy-create stubs, run `bun test`/`bun bdd` filtered to `@US-NNN @Op-X`, MUST FAIL, commit. | "All ops are RED. Did you mean `/spec-implementation US-NNN`?" |
| `/test-setup-verification US-NNN [Op-X]` | next op where `operation_phase = red AND red_audit.verdict ≠ PASS` | Spawn fresh agent. Audit Op-X's tests + stubs only: real, RED, traceable. Write verdict to `state.json.operations[Op-X].red_audit`. | "All RED'd ops have passed verification." |
| `/spec-implementation US-NNN [Op-X]` | next op where `operation_phase = red AND implementation_status ≠ green` | Confirm RED, write minimal GREEN, run full per-story suite (`@US-NNN`), no regressions, optional REFACTOR, commit. | If all ops GREEN and gates not run: Simplify + Code Review + Verify; flip story `phase = green` in `stories.json`. Else: status report. |
| `/spec-implementation-verification US-NNN [Op-X]` *(NEW)* | next op where `operation_phase ∈ {green, refactored} AND green_audit.verdict ≠ PASS` | Spawn fresh agent. Audit Op-X's impl: tests pass, no over-implementation, architecture compliant, no regressions in earlier ops. Write to `state.json.operations[Op-X].green_audit`. | If all ops GREEN and gates passed: full-story audit before `/v-and-v`. Else: status report. |

### Phase contract on `stories.json`
- `planned → red` happens once, when Op-1 first hits RED-A.
- `red` is sticky across the whole interleaved cycle.
- `red → green` only when `/spec-implementation US-NNN` (no `Op-X`) finishes wrap-up gates.
- `green → verified` unchanged: `/v-and-v US-NNN`.
- `STORIES.md` renders mid-story progress (`red (Op-2/4 GREEN)`) computed from `state.json`. `phase` itself stays canonical.

---

## 5. State model

### `specs/story-NNN-slug/state.json` — schema additions (`schema_version: 1 → 2`)

```jsonc
{
  "story_id": "US-NNN",
  "schema_version": 2,                           // bump
  "phase_local": "test_setup | executing | verifying | verified",
  "current_operation": "Op-2",                   // NEW: cursor for the smart default

  "operations": {
    "Op-1": {
      "title": "Authenticate against the user store",
      "covers_scenarios": ["..."],
      "operation_phase": "refactored",           // NEW
      "tests_status": "red",                     // existing
      "stub_status": "created",                  // existing
      "implementation_status": "green",          // existing
      "red_audit":   { "verdict": "PASS",        // NEW
                       "at": "2026-05-06T10:14:00Z",
                       "report_path": "..." },
      "green_audit": { "verdict": "PASS",        // NEW
                       "at": "2026-05-06T11:02:00Z",
                       "report_path": "..." },
      "started_at": "...",
      "completed_at": "..."
    }
  },

  "test_plan_rows": {
    "T-01": { "type": "BDD", "op": "Op-1", "..." : "..." }   // NEW: tag rows with the op
  },

  "quality_gates": { "simplified": false, "reviewed": false, "verified": false, "..." : "..." },
  "implementation": { "started_at": "...", "completed_at": null, "operations_green": 1, "operations_total": 4, "last_commit": "..." },
  "errors": [ { "operation": "Op-X", "..." : "..." } ]
}
```

### `operation_phase` lifecycle (one cursor per Op)

```
pending → red_a (BDD steps written, RED)
       → red_b (unit/int tests written, RED)
       → red    (RED-x done, ready for GREEN)
       → green  (impl in, tests pass)
       → refactored (optional cleanup, tests still pass)
```

`/test-setup` advances `pending → red_a → red_b → red`. `/spec-implementation` advances `red → green → refactored`. The two skills never overlap on a single Op.

### Smart-default picker (shared helper)

```
/test-setup US-NNN:
  if any op.operation_phase ∈ {pending, red_a} → pick first such op
  else                                          → "All ops are RED. Did you mean /spec-implementation?"

/test-setup-verification US-NNN:
  if any op.operation_phase = red AND red_audit.verdict ≠ PASS → pick first
  else                                                         → "All RED ops verified."

/spec-implementation US-NNN:
  if any op.operation_phase = red AND implementation_status ≠ green → pick first (per-op mode)
  elif all ops green AND quality_gates not all true                 → run wrap-up (story-end mode)
  else                                                              → "Story is GREEN. Run /v-and-v US-NNN."

/spec-implementation-verification US-NNN:
  if any op ∈ {green, refactored} AND green_audit.verdict ≠ PASS → pick first
  elif all ops green AND quality_gates all true                  → story-end full audit
  else                                                           → "Nothing to verify."
```

### `specs/stories.json` — no schema change

`phase` remains `backlog | scoped | specced | planned | red | green | verified`. No new field. Mid-story progress is computed at `STORIES.md` render time from `state.json`.

### `phase_local` unchanged

`test_setup → executing → verifying → verified`. Per-op work just lives inside `executing` for longer.

---

## 6. Skill body changes (sketch)

### `/test-setup US-NNN [Op-X]` (v3.0.0)

1. **Pre-flight** (unchanged): legacy layout check, `stories.json` exists, `stories[i].phase ∈ {planned, red}`, deps verified, BDD toolchain pre-flight gate (only on the very first invocation per story — gated on `state.json` not yet existing or all ops still `pending`).
2. **Resolve Op-X** via the picker. Hard-stop if explicit Op-X is past `red` (suggest `--force` to redo).
3. **Read PLAN.md** — extract only this op's RED-A + RED-B sections + the Test Plan rows where `op = Op-X`.
4. **Write RED-A** for Op-X (BDD steps), commit `test(US-NNN): add BDD steps for Op-X — <title>`. Run `bun bdd --tags="@US-NNN @Op-X"`. MUST FAIL.
5. **Write RED-B** for Op-X (unit/integration), commit `test(US-NNN): add failing tests for Op-X — <title>`. Run `bun test --grep="@US-NNN @Op-X"`. MUST FAIL.
6. **Lazy stubs**: only files Op-X's tests import that don't yet exist. (Types/fakes already created by an earlier op are imported, not re-created.)
7. **Update `state.json`**: `Op-X.operation_phase = "red"`, `tests_status = "red"`, `stub_status = "created"`, advance `current_operation`.
8. **First-RED-of-the-story side-effect**: if `phase_local` unset, create `state.json`, set `phase_local = "test_setup"`. If `stories[i].phase = "planned"`, flip to `"red"`, append history, update `project.updated_at`, regenerate `STORIES.md`.
9. **Report + `AskUserQuestion`**: "Op-X RED'd. Next?" → `/test-setup-verification US-NNN Op-X` (recommended) | `/spec-implementation US-NNN Op-X` | RED next op | done.

### `/test-setup-verification US-NNN [Op-X]` (v3.0.0)

Audits a single op's RED-state output. Spawns fresh agent with a tighter prompt scoped to Op-X:
- Reads only the test files Op-X created/modified, plus Test Plan rows where `op = Op-X`.
- BDD toolchain wiring check runs only on first verification of the story.
- Test Reality + RED-State + Test Plan Coverage + Stubs checks scoped to Op-X.
- Writes verdict + report path to `state.json.operations[Op-X].red_audit`.
- Output: `Per-Op Verification Report — US-NNN / Op-X`.
- Triggers: "verify the tests for Op-X", "audit Op-2", `/test-setup-verification US-001 Op-2`.

### `/spec-implementation US-NNN [Op-X]` (v3.0.0)

**Two modes, decided by the picker.**

**Per-op mode (default when ops still pending):**
1. Pre-flight (unchanged), Foundation Auto-Chain (unchanged: only `US-000` + empty repo).
2. Resolve Op-X. Hard-stop if `implementation_status = green` (auto-advance unless `--force`).
3. Confirm RED for Op-X (`bun test`/`bun bdd` filtered MUST FAIL).
4. **GREEN**: implement Op-X's GREEN section in PLAN.md. Run full per-story suite (`@US-NNN`) → ALL pass; previously-verified stories' suites → no regressions. Commit `feat(US-NNN): implement Op-X — <title>`.
5. **REFACTOR** (optional, if PLAN.md prescribes): clean naming/duplication; suite still passes. Commit `refactor(US-NNN): Op-X — <what>`.
6. Update `state.json`: `Op-X.operation_phase = "refactored"` (or `"green"` if no refactor), `implementation_status = "green"`, advance `current_operation`.
7. Report + `AskUserQuestion`: `/spec-implementation-verification US-NNN Op-X` (recommended) | next op | done.

**Story-end mode (no Op-X, all ops green, gates not yet run):**
1. **Simplify** on files modified during this story → suite still passes → `quality_gates.simplified = true`.
2. **Code Review** subagent, diff range `BASE_SHA → HEAD_SHA` for the story → `quality_gates.reviewed = true`.
3. **Verify** (lint, typecheck, curl walkthrough, Playwright if UI, architecture compliance, visual compliance) → `quality_gates.verified = true`.
4. Sync to `stories.json`: `stories[i].implementation = {…}`, `phase = "green"`, history entry, `project.updated_at`, regenerate `STORIES.md`.
5. Report + `AskUserQuestion`: `/spec-implementation-verification US-NNN` (story-end audit) | `/v-and-v US-NNN` | next story | done.

### `/spec-implementation-verification US-NNN [Op-X]` (NEW, v1.0.0)

Two-mode mirror of `/spec-implementation`.

**Per-op mode:** spawn fresh agent. Read PLAN.md's Op-X section + the source files Op-X touched (from git diff between Op-X's RED commit SHA and its REFACTOR/GREEN commit SHA). Check:
- Op-X's tests pass.
- No over-implementation: production files Op-X touched don't contain logic only justified by future ops in PLAN.md.
- Architecture compliance for files Op-X touched (no cross-BM imports, modules per `ARCHITECTURE.md`).
- No regression in earlier ops (full `@US-NNN` suite green).
- Verdict to `state.json.operations[Op-X].green_audit`.

**Story-end mode (no Op-X, all ops green + gates passed):** spawn fresh agent. Full-story audit — every op's tests pass, every gate passed, story ready for `/v-and-v`. Mirrors what the legacy `/spec-implementation` end ought to verify.

Output template, triggers, and pre-flight pattern follow `/test-setup-verification`'s shape.

### Foundation Story (US-000)

Same per-op flow with two nuances (already enforced by PLAN.md content):
- US-000's Op-1 fully implements types/fakes/schema (test infrastructure must work) — content rule from v2 kept verbatim.
- `/spec-implementation US-000` Foundation Auto-Chain (US-000 + empty repo + planned) chains `/repo-initialization` once before any Op work, then exits with the same "next: `/test-setup US-000 Op-1`" message.

### Resume / errors / loop integration

- **Resume:** every skill reads `state.json` and the picker resolves the right Op.
- **Errors:** `state.json.errors` accumulates per-op failures; the skill can retry the same op without manual cleanup.
- **Loop signals:** each skill emits a per-op promise (`<promise>RED_COMPLETE_US-NNN_Op-X</promise>`, `<promise>GREEN_COMPLETE_US-NNN_Op-X</promise>`) plus the existing story-end signals (`<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>`).

---

## 7. Edge cases

### CLI / arg parsing
- `/test-setup US-001 Op-2` (with space) and `/test-setup US-001 op2` both accepted. Skill normalizes to `Op-N`.
- `--force` on `/test-setup US-NNN Op-X` re-RED's an op already at `red` (rare; mainly for plan changes).
- `--force` on `/spec-implementation US-NNN Op-X` re-implements an already-green op.

### PLAN.md changes mid-flight
- If PLAN.md is edited after some ops are GREEN (e.g., Op-3 added late), `state.json` is reconciled on next entry: new ops appear with `operation_phase = "pending"`. Existing ops keep their state. `summary.operations_total` rebases.
- If an op is removed from PLAN.md but already done, leave it in `state.json` with `removed_from_plan: true`; don't delete history.

### Story-end gate scopes (unchanged from today)
- **Simplify**: walks files modified during the story (`git diff BASE_SHA..HEAD --name-only` minus `specs/**`).
- **Code Review subagent**: diff range `BASE_SHA → HEAD_SHA` for the story (`BASE_SHA` = parent of the first `test(US-NNN):` commit).
- **Verify**: lint, typecheck, curl walkthrough, Playwright (if UI), architecture compliance, visual compliance.

These triggers via the new "all ops green" auto-detection inside `/spec-implementation`; the scopes themselves don't change.

### `/v-and-v` interaction
Unchanged. Still story-level. Still flips `phase = verified`, writes `qa-report.md`. The new per-op skills hand off to it via the same "Story is GREEN" prompt.

### Schema migration
- `state.json` v1 → v2: one-time migration on first entry.
  - If `schema_version` missing or `1`: walk `operations`, derive `operation_phase` from existing fields (e.g., `tests_status="red" + implementation_status="pending"` → `operation_phase="red"`). Add empty `red_audit`/`green_audit` blobs. Set `current_operation` to first non-green op. Bump `schema_version` to 2. Atomic write. No user action.

### Backwards compat
- The new skills accept story-level invocations (`/test-setup US-001` with no Op-X) and behave like a per-op call against the next pending op.
- We do **not** keep an "all-ops-at-once" mode. v2 callers who scripted `/test-setup US-001` expecting all RED at once will now get one op RED'd at a time. Plugin version bump (`2.0.0 → 3.0.0`) signals the breaking change.

### `spec-implementation-verification` plugin layout
Ships as a new plugin under `plugins/spec-implementation-verification/` mirroring `plugins/test-setup-verification/`'s layout. New `plugin.json`, separate version timeline, starts at `1.0.0`.

### Per-op tagging in tests (companion change to `/plan-writing`)
- BDD scenarios get an `@Op-N` annotation on the scenario or rule.
- Unit/integration tests get `@Op-N` in the `describe` or `test` name (suite filter uses substring match).
- `PLAN.md`'s Test Plan table gains an `Op` column. Small change to `plugins/plan-writing/skills/plan-writing/references/plan-template.md`. Existing PLAN.md files without the `Op` column degrade gracefully: `/test-setup` falls back to its existing "first row referencing this Operation's scenario" heuristic.

---

## 8. Documentation updates outside the skills

### `README.md` (top-level marketplace catalog)
- "Per-story loop" table:
  - `test-setup` 2.0.0 → 3.0.0; description rewritten to reflect per-op invocation.
  - `test-setup-verification` 2.0.0 → 3.0.0; description rewritten.
  - `spec-implementation` 2.0.0 → 3.0.0; description rewritten.
  - **Add row** `spec-implementation-verification` 1.0.0.
- "Philosophy" paragraph: add a sentence that "the story is the unit of planning and shipping; the Operation is the unit of execution" to capture the new layer.
- Optionally add a small section "Per-Operation cycle" describing the RED-A → RED-B → GREEN → REFACTOR rhythm at Operation granularity.

### `PROPOSAL-story-based-workflow.md`
Append a short "Follow-up: per-Operation execution" section pointing at this design doc. Keep the original proposal intact as the historical artifact.

### `plugins/plan-writing/skills/plan-writing/references/plan-template.md`
Add an `Op` column to the Test Plan table. Add a one-line note in "Rules for the planner" reminding to tag every Test Plan row with the Operation it belongs to.

### `plugins/{test-setup,spec-implementation}/skills/<name>/references/state-schema.md`
Document the v2 schema additions (`current_operation`, per-op `operation_phase`, `red_audit`, `green_audit`, `Op`-tagged Test Plan rows).

### Plugin `CHANGELOG.md`
Each affected plugin gets a `## [3.0.0]` entry (Keep-a-Changelog format) noting the per-op breaking change. New `spec-implementation-verification` plugin gets a `## [1.0.0] — initial release` entry.

---

## 9. Out of scope / non-goals

- **No changes to `/plan-writing` semantics** — the only change is the Test Plan template's new `Op` column.
- **No changes to `/v-and-v`, `/repo-initialization`, `/spec-writing`, `/research-and-architecture`, or any project-wide skill.**
- **No new skill beyond `spec-implementation-verification`.**
- **No CLI flags beyond `--force` for retry semantics.** No `--all-ops` mode that runs everything in one go — that's exactly the model we're moving away from.
- **No persistent in-flight pause/resume marker** beyond what `state.json` already provides.

---

## 10. Implementation order (rough)

The implementation plan will sequence these:

1. Update `references/state-schema.md` files in `test-setup` and `spec-implementation` to document v2.
2. Add `Op` column to `plan-writing`'s `references/plan-template.md`.
3. Rewrite `test-setup` SKILL.md per §6.
4. Rewrite `test-setup-verification` SKILL.md per §6.
5. Rewrite `spec-implementation` SKILL.md per §6.
6. Create `plugins/spec-implementation-verification/` (new plugin scaffold + SKILL.md).
7. Bump versions in all four plugin manifests; add `CHANGELOG.md` entries.
8. Update `README.md` (catalog + philosophy + new section).
9. Append follow-up section to `PROPOSAL-story-based-workflow.md`.
10. Self-review, commit on `feat/per-operation-workflow`, open PR.

---

## TL;DR

Make Operations the unit of execution while keeping the story the unit of planning and shipping. Each of `test-setup`, `test-setup-verification`, `spec-implementation`, and the new `spec-implementation-verification` accepts an optional `Op-X` arg and defaults to the next pending Operation from `state.json`. `state.json` gains a per-op `operation_phase` cursor and `red_audit`/`green_audit` blobs; `stories.json` doesn't change. Story-level wrap-up gates (Simplify, Code Review, Verify) live inside `/spec-implementation` when invoked without `Op-X` after all Operations are GREEN. Plugin versions bump from 2.0.0 → 3.0.0; `spec-implementation-verification` ships at 1.0.0. README and the plan template get matching updates. No backwards-compat for the all-ops-at-once mode — the plugin major bump signals the break.
