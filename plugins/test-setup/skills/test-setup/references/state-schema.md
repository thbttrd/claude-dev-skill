# State Schema

Two levels of state coordinate the story-based workflow:

1. **`specs/stories.json`** — project-wide source of truth (personas, epics, stories[], project-wide architecture, design system). Every skill reads it and writes its own narrow slice. Documented separately at `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`.
2. **`specs/story-NNN-slug/state.json`** — per-story execution state for inter-loop coordination. There is exactly one of these per story; it is created by `/test-setup` and updated by every downstream skill until `/verification-and-validation` flips the story to `verified`.

This document covers the per-story `state.json` only.

---

## Full Schema — `specs/story-NNN-slug/state.json`

```json
{
  "story_id": "US-NNN",
  "schema_version": 1,
  "phase_local": "test_setup | executing | verifying | verified",
  "branch": "impl/US-NNN-slug",
  "started_at": "ISO 8601 timestamp",
  "completed_at": "ISO 8601 timestamp or null",
  "iteration": 1,

  "plan": {
    "plan_file": "specs/story-NNN-slug/PLAN.md",
    "operations_count": 4
  },

  "operations": {
    "Op-1": {
      "title": "Authenticate against the user store",
      "covers_scenarios": ["User logs in with valid credentials", "User logs in with invalid credentials"],
      "tests_status": "pending | in_progress | red",
      "stub_status": "pending | created",
      "implementation_status": "pending | in_progress | green",
      "started_at": null,
      "completed_at": null
    },
    "Op-2": { "...": "..." }
  },

  "test_plan_rows": {
    "T-01": { "type": "BDD", "file": "e2e/steps/auth.steps.ts", "written": true, "passing": false },
    "T-02": { "type": "unit", "file": "src/modules/auth/__tests__/auth.service.test.ts", "written": true, "passing": false }
  },

  "current_operation": "Op-1",

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

The `phase_local` field reflects which sub-skill is operating on the story. It is distinct from the project-wide `phase` in `specs/stories.json#stories[i].phase` (`backlog | scoped | specced | planned | red | green | verified`). The two evolve in lockstep but answer different questions:

- **`phase_local`** — *which skill is currently writing to this story*
- **`stories[i].phase`** — *what the project-level kanban shows for this story*

---

## Phases Handled by Each Skill

| Skill                            | Reads `phase_local` | Writes `phase_local` to | Project-level `phase` set to |
| -------------------------------- | ------------------- | ----------------------- | ---------------------------- |
| `/test-setup`                    | (creates state.json) | `test_setup` → `executing` after RED done | `red` |
| `/spec-implementation`           | `executing`         | `executing` → `verifying` after GREEN done | `green` |
| `/verification-and-validation`   | `verifying`         | `verifying` → `verified` after E2E passes | `verified` |

A story's state.json is created by `/test-setup` when the project-level `phase` is `planned` (i.e., a `PLAN.md` exists). It does NOT exist before that.

---

## State Transitions (per story)

```
phase_local transitions (one per story):
  test_setup → executing → verifying → verified

operations transitions (one per Operation in PLAN.md):
  pending → in_progress → red       (RED-A and RED-B written, tests fail)
                       → green     (GREEN written, tests pass)
                       → blocked   (can retry → in_progress)

test_plan_rows transitions:
  written: false → true             (set by /test-setup)
  passing: false → true             (set by /spec-implementation when test goes green)
```

The per-story `phase_local` and the project-level `phase` advance together at each handoff:

```
Sub-skill        | phase_local | stories[i].phase
-----------------+-------------+------------------
Pre-/test-setup  | (no file)   | planned
/test-setup done | executing   | red
/spec-impl done  | verifying   | green
/V&V done        | verified    | verified
```

---

## Reading State on Entry (`/test-setup`)

```
1. Does specs/stories.json exist?
   NO  → STOP. Run /high-level-scoping first.
   YES → Read it. Find target story (CLI arg or AskUserQuestion picker).

2. What is stories[i].phase?
   backlog   → STOP. Run /spec-writing US-NNN first (and /high-level-scoping in update mode if needed).
   scoped    → STOP. Run /spec-writing US-NNN first.
   specced   → STOP. Run /plan-writing US-NNN first.
   planned   → Create specs/story-NNN-slug/state.json with phase_local = "test_setup". Begin writing tests.
   red       → state.json must exist with phase_local = "test_setup" or "executing". Resume.
   green or beyond → STOP. Tests already written.

3. Are dependencies satisfied?
   For each id in stories[i].depends_on_story_ids:
     If stories[<dep>].phase != "verified" AND stories[<dep>].is_foundation != true:
       STOP with the offending dep id and a hint to run /verification-and-validation on it.

4. Run BDD Toolchain Pre-Flight gate (see SKILL.md for the four checks).
   If any check fails → emit TOOLING_NOT_READY and stop.
```

---

## Updating State

**Always use atomic writes** — write to a temp file first, then rename:

```bash
cat > specs/story-NNN-slug/state.json.tmp << 'EOF'
{ ... }
EOF
mv specs/story-NNN-slug/state.json.tmp specs/story-NNN-slug/state.json
```

**Update frequency (per /test-setup):**

- After every Operation's RED-A is committed: bump that Operation's `tests_status` toward `in_progress` then `red`.
- After every Operation's RED-B is committed: same row.
- After every test file is written: append to `test_plan_rows` with `written: true, passing: false`.
- After every error encountered: append to `errors[]`.
- When all Operations have `tests_status = "red"`: flip `phase_local` to `"executing"` (handoff signal to `/spec-implementation`).

`specs/stories.json` is updated **once per story**, when test setup completes for the entire story:

- `stories[i].test_setup = { bdd_step_files, unit_test_files, integration_test_files, completed_at }`
- `stories[i].phase = "red"`
- Append `{ phase: "red", at: "<today>" }` to `stories[i].history`
- Update `project.updated_at`
- Regenerate `specs/STORIES.md`
