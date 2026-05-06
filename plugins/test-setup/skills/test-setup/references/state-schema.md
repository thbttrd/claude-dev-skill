# State Schema (v2 — per-Operation)

Two levels of state coordinate the story-based workflow:

1. **`specs/stories.json`** — project-wide source of truth (personas, epics, stories[], project-wide architecture, design system). Every skill reads it and writes its own narrow slice. Documented separately at `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`.
2. **`specs/story-NNN-slug/state.json`** — per-story execution state for inter-loop coordination. There is exactly one of these per story; it is created by `/test-setup` and updated by every downstream skill until `/verification-and-validation` flips the story to `verified`.

This document covers the per-story `state.json` only.

In **v2** (introduced by `test-setup` 3.0.0 / `spec-implementation` 3.0.0 / new `spec-implementation-verification` 1.0.0), the schema is extended so each Operation can be RED'd, audited, GREEN'd, and audited again **independently**, while keeping the story-level fields intact.

---

## Full Schema — `specs/story-NNN-slug/state.json`

```jsonc
{
  "story_id": "US-NNN",
  "schema_version": 2,
  "phase_local": "test_setup | executing | verifying | verified",
  "branch": "impl/US-NNN-slug",
  "started_at": "ISO 8601 timestamp",
  "completed_at": "ISO 8601 timestamp or null",
  "iteration": 1,

  "plan": {
    "plan_file": "specs/story-NNN-slug/PLAN.md",
    "operations_count": 4
  },

  "current_operation": "Op-2",                                  // NEW in v2: cursor for the smart-default picker

  "operations": {
    "Op-1": {
      "title": "Authenticate against the user store",
      "covers_scenarios": ["User logs in with valid credentials", "User logs in with invalid credentials"],

      "operation_phase": "refactored",                          // NEW in v2: pending | red_a | red_b | red | green | refactored
      "tests_status": "red",                                    // existing: pending | in_progress | red
      "stub_status": "created",                                 // existing: pending | created
      "implementation_status": "green",                         // existing: pending | in_progress | green | blocked

      "red_audit":   {                                          // NEW in v2: per-Op audit verdict from /test-setup-verification
        "verdict": "PASS | PASS_WITH_WARNINGS | FAIL",
        "at": "ISO 8601",
        "report_path": "specs/story-NNN-slug/verification/red-audit-Op-1.md"
      },
      "green_audit": {                                          // NEW in v2: per-Op audit verdict from /spec-implementation-verification
        "verdict": "PASS | PASS_WITH_WARNINGS | FAIL",
        "at": "ISO 8601",
        "report_path": "specs/story-NNN-slug/verification/green-audit-Op-1.md"
      },

      "started_at": "ISO 8601",
      "completed_at": "ISO 8601 or null"
    },
    "Op-2": { "...": "..." }
  },

  "test_plan_rows": {
    "T-01": {
      "type": "BDD",
      "op": "Op-1",                                             // NEW in v2: Op tag from PLAN.md's Test Plan table
      "file": "e2e/steps/auth.steps.ts",
      "written": true,
      "passing": false
    },
    "T-02": { "type": "unit", "op": "Op-1", "...": "..." }
  },

  "errors": [
    {
      "operation": "Op-1",
      "message": "Test still failing after implementation",
      "details": "Expected status 401 but got 500",
      "attempts": 1,
      "resolved": false,
      "timestamp": "ISO 8601"
    }
  ],

  "summary": {
    "operations_total": 4,
    "operations_red": 1,
    "operations_green": 0,
    "tests_written": 6,
    "last_commit": null
  }
}
```

The `phase_local` field reflects which sub-skill is operating on the story. It is distinct from the project-level `phase` in `specs/stories.json#stories[i].phase` (`backlog | scoped | specced | planned | red | green | verified`). The two evolve in lockstep but answer different questions:

- **`phase_local`** — *which skill is currently writing to this story*
- **`stories[i].phase`** — *what the project-level kanban shows for this story*

---

## `operation_phase` lifecycle (one cursor per Op)

The new `operation_phase` field tracks the per-Operation TDD cycle independently for every Op:

```
pending → red_a (BDD steps written, tests fail)
       → red_b (unit/integration tests written, tests fail)
       → red    (all RED-x done for this op, ready for GREEN)
       → green  (impl in, tests pass)
       → refactored (optional cleanup, tests still pass)
```

`/test-setup` advances `pending → red_a → red_b → red`. `/spec-implementation` advances `red → green → refactored`. The two skills never overlap on a single Op.

---

## Phases Handled by Each Skill

| Skill                               | Reads `phase_local` | Writes `phase_local` to                           | Project-level `phase` set to |
| ----------------------------------- | ------------------- | ------------------------------------------------- | ---------------------------- |
| `/test-setup`                       | (creates state.json) | `test_setup` (sticky until all ops `red`); flips to `executing` only when **every** Op reaches `operation_phase = "red"` | `red` (on first Op's RED-A) |
| `/test-setup-verification`          | `test_setup` or `executing` | unchanged                                          | unchanged                    |
| `/spec-implementation`              | `executing`         | `executing` (sticky until story-end gates pass); flips to `verifying` after gates | unchanged in per-op mode; `green` after story-end gates |
| `/spec-implementation-verification` | `executing` or `verifying` | unchanged                                          | unchanged                    |
| `/verification-and-validation`      | `verifying`         | `verifying` → `verified` after E2E passes         | `verified`                   |

A story's `state.json` is created by `/test-setup` when the project-level `phase` is `planned` (i.e., a `PLAN.md` exists). It does NOT exist before that.

---

## Smart-Default Picker (shared by all per-op skills)

When invoked without an explicit `Op-X` arg, each skill resolves the target Operation as follows:

```
/test-setup US-NNN:
  pick first op where operation_phase ∈ {pending, red_a}
  if none → "All ops are RED. Did you mean /spec-implementation US-NNN?"

/test-setup-verification US-NNN:
  pick first op where operation_phase = red AND red_audit.verdict ≠ PASS
  if none → "All RED'd ops have passed verification."

/spec-implementation US-NNN:
  pick first op where operation_phase = red AND implementation_status ≠ green   (per-op mode)
  elif all ops green AND quality_gates not all true                              → run story-end wrap-up
  else                                                                            → "Story is GREEN. Run /verification-and-validation US-NNN."

/spec-implementation-verification US-NNN:
  pick first op where operation_phase ∈ {green, refactored} AND green_audit.verdict ≠ PASS
  elif all ops green AND quality_gates all true                                  → run story-end full audit
  else                                                                            → "Nothing to verify."
```

The picker writes its choice to `current_operation` so subsequent invocations stay aligned across skill calls.

---

## State Transitions (per story)

```
phase_local transitions:
  test_setup → executing → verifying → verified

operation_phase transitions (one cursor per Operation):
  pending → red_a → red_b → red → green → refactored
                                      ↘ blocked (can retry → in_progress / red)

operations[Op-X] companion-field transitions (kept for backwards compat):
  tests_status:           pending → in_progress → red
  stub_status:            pending → created
  implementation_status:  pending → in_progress → green | blocked

test_plan_rows transitions:
  written: false → true             (set by /test-setup)
  passing: false → true             (set by /spec-implementation when test goes green)
```

The per-story `phase_local` and the project-level `phase` advance together at handoffs, but `phase` is sticky across the entire interleaved per-op cycle:

```
Sub-skill mode               | phase_local            | stories[i].phase
-----------------------------+------------------------+------------------
Pre-/test-setup              | (no file)              | planned
After Op-1 first RED-A       | test_setup             | red
After Op-N final RED         | executing              | red
After Op-N final GREEN+gates | verifying              | green
After /v-and-v               | verified               | verified
```

---

## Reading State on Entry (`/test-setup`)

```
1. Does specs/stories.json exist?
   NO  → STOP. Run /high-level-scoping first.
   YES → Read it. Find target story (CLI arg or AskUserQuestion picker).

2. What is stories[i].phase?
   backlog   → STOP. Run /spec-writing US-NNN first.
   scoped    → STOP. Run /spec-writing US-NNN first.
   specced   → STOP. Run /plan-writing US-NNN first.
   planned   → Create specs/story-NNN-slug/state.json with phase_local = "test_setup"; begin per-op flow.
   red       → state.json must exist with phase_local = "test_setup" or "executing". Resume per-op flow.
   green or beyond → STOP. Tests already written.

3. Are dependencies satisfied?
   For each id in stories[i].depends_on_story_ids:
     If stories[<dep>].phase != "verified" AND stories[<dep>].is_foundation != true:
       STOP with the offending dep id and a hint to run /verification-and-validation on it.

4. BDD Toolchain Pre-Flight gate (see SKILL.md for the four checks).
   Run only on first per-story invocation (state.json absent OR every op still pending).
   If any check fails → emit TOOLING_NOT_READY and stop.

5. Resolve the target Operation:
   - If invoked with explicit Op-X, validate it exists in PLAN.md and operation_phase < red.
   - Else, run the Smart-Default Picker for /test-setup.
```

---

## v1 → v2 Migration (one-shot, on entry)

When a v1 `state.json` (no `schema_version` or `schema_version: 1`) is found:

1. Walk `operations`. For each Op, derive `operation_phase` from existing fields:
   - `tests_status = "pending"` → `operation_phase = "pending"`
   - `tests_status = "in_progress"` → `operation_phase = "red_b"` (best-effort)
   - `tests_status = "red"` AND `implementation_status = "pending"` → `operation_phase = "red"`
   - `implementation_status = "green"` → `operation_phase = "green"`
2. Initialize empty `red_audit`/`green_audit` blobs (`verdict: null, at: null, report_path: null`).
3. Set `current_operation` to the first Op whose `operation_phase` is not `green`/`refactored`.
4. For each `test_plan_rows[T-N]` lacking `op`, attempt to read PLAN.md's Test Plan and back-fill the `Op` column. If the PLAN.md has no `Op` column either, leave `op` as `null` and emit a one-time warning.
5. Bump `schema_version` to `2`.
6. Atomic write (temp file + rename). No user action required.

---

## Updating State

**Always use atomic writes** — write to a temp file first, then rename:

```bash
cat > specs/story-NNN-slug/state.json.tmp << 'EOF'
{ ... }
EOF
mv specs/story-NNN-slug/state.json.tmp specs/story-NNN-slug/state.json
```

**Update frequency (per `/test-setup` per-Op invocation):**

- After Op-X's RED-A is committed → `Op-X.operation_phase = "red_a"`, `tests_status = "in_progress"`.
- After Op-X's RED-B is committed → `Op-X.operation_phase = "red_b"`, `tests_status = "in_progress"`.
- After every test file is written → append to `test_plan_rows` with `written: true, passing: false, op: "Op-X"`.
- When Op-X is fully RED → `Op-X.operation_phase = "red"`, `tests_status = "red"`, `stub_status = "created"`, advance `current_operation` to the next pending op.
- When **every** Op has reached `operation_phase = "red"` → flip `phase_local` to `"executing"` (handoff to `/spec-implementation`).
- After every error encountered → append to `errors[]`.

`specs/stories.json` is updated **once per story**, when the **first** Op reaches RED:

- `stories[i].phase = "red"` (sticky from here through `/spec-implementation`'s per-op cycles).
- Append `{ phase: "red", at: "<today>" }` to `stories[i].history` (only on the first transition).
- Update `project.updated_at`.
- Regenerate `specs/STORIES.md`.

A second `stories.json` write happens only when `/test-setup` finalizes the story-level `test_setup` block (after every Op is RED):

- `stories[i].test_setup = { bdd_step_files, unit_test_files, integration_test_files, completed_at }`.
- No history entry (already written when phase first flipped to `red`).
