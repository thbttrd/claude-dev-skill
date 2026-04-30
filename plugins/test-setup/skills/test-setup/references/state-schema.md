# State Schema

Two levels of state are used by this skill:

1. **`docs/project-tracking.json`** — project-wide source of truth (personas, epics, roadmap, per-version planning/test/impl/qa status). **Always lives under `docs/`**, never at the repository root.
2. **`docs/V{N}/plans/implementation-state.json`** — version-scoped execution state for inter-loop coordination. There is exactly one of these per version: V0 has its own, V1 has its own, etc. Each one is frozen with its version (unlike `docs/project-tracking.json`, which evolves across versions).

`V{N}` below refers to the target version being worked on (V0, V1, V2, ...).

## Full Schema — `docs/V{N}/plans/implementation-state.json`

```json
{
  "version": "V0",
  "schema_version": 1,
  "phase": "orientation | scaffolding | planning | test_setup | executing | completed | verifying | verified",
  "branch": "impl/spec-2026-03-30-1425",
  "started_at": "ISO 8601 timestamp",
  "completed_at": "ISO 8601 timestamp or null",
  "iteration": 1,

  "specs": {
    "specs_file": "docs/V0/specs/SPECS.md",
    "feature_files": [
      "docs/V0/specs/features/F-001-study-session.feature",
      "..."
    ],
    "feature_count": 11,
    "tech_stack": {
      "runtime": "bun",
      "framework": "next.js",
      "language": "typescript",
      "orm": "drizzle",
      "database": "sqlite",
      "test_unit": "vitest",
      "test_bdd": "playwright-bdd",
      "styling": "tailwind",
      "ui_components": "shadcn/ui"
    }
  },

  "scaffolding_status": "pending | in_progress | completed | skipped",

  "waves": {
    "W0-foundation": {
      "status": "planned | tests_written | in_progress | completed",
      "tests_status": "pending | in_progress | red",
      "plan_file": "docs/V0/plans/00-foundation.md",
      "stories": [],
      "depends_on": [],
      "tasks_total": 5,
      "tasks_completed": 0,
      "current_task": 0,
      "started_at": null,
      "completed_at": null
    },
    "W1-auth-golden-path": {
      "status": "planned",
      "tests_status": "pending",
      "plan_file": "docs/V0/plans/W1-auth-golden-path.md",
      "stories": ["US-001", "US-003"],
      "depends_on": ["W0-foundation"],
      "tasks_total": 0,
      "tasks_completed": 0,
      "current_task": 0,
      "started_at": null,
      "completed_at": null
    }
  },

  "quality_gates": {
    "W0-foundation": {
      "simplified": false,
      "reviewed": false,
      "verified": false,
      "review_findings": [],
      "verification_results": {
        "tests_passed": null,
        "bdd_passed": null,
        "lint_passed": null,
        "types_passed": null
      }
    }
  },

  "current_wave": "W0-foundation",

  "errors": [
    {
      "wave": "W1-auth-golden-path",
      "task": 2,
      "error": "Test still failing after implementation",
      "details": "Expected card flip animation but component not rendering",
      "attempts": 1,
      "resolved": false,
      "timestamp": "ISO 8601"
    }
  ],

  "summary": {
    "waves_completed": 0,
    "waves_total": 4,
    "tasks_completed": 0,
    "tasks_total": 0,
    "tests_written": 0,
    "last_commit": null
  }
}
```

## Phases Handled by Each Skill

| Phase         | Skill                                                         |
| ------------- | ------------------------------------------------------------- |
| `orientation` | `/plan-writing` (reads specs, builds DAG)                     |
| `scaffolding` | `/repo-initialization` (project setup)                        |
| `planning`    | `/plan-writing` (writes plan files)                           |
| `test_setup`  | `/test-setup` (writes all failing tests + source stubs)       |
| `executing`   | `/spec-implementation` (GREEN phase + quality gates)          |
| `completed`   | `/spec-implementation` (all waves done, quality gates passed) |
| `verifying`   | `/verification-and-validation` (E2E curl + Playwright)        |
| `verified`    | `/verification-and-validation` (everything passes)            |

The `/test-setup` skill operates when phase is `"planning"` (transitions to `"test_setup"`)
or `"test_setup"` (resumes). It transitions to `"executing"` when all tests are written.

The `/spec-implementation` skill only operates when phase is `"executing"` or `"completed"`.
If the phase is earlier, it stops and directs the user to the appropriate prerequisite skill.

## State Transitions

```
Phase transitions (across skills):
  orientation → scaffolding → planning → test_setup → executing → completed → verifying → verified

Wave transitions (within a version):
  planned → tests_written → in_progress → completed
                                ↓
                             blocked (can retry → in_progress)

Test status transitions (within /test-setup):
  pending → in_progress → red

Quality gate flow (after wave tasks done):
  simplified=false → run simplify → simplified=true
  reviewed=false   → run review   → reviewed=true
  verified=false   → run verify   → verified=true
  all true → wave status = completed
```

## Reading State on Entry (test-setup)

```
1. Does docs/project-tracking.json exist?
   NO  → STOP. Run /high-level-scoping first.
   YES → Read it, identify the target version V{N}.

2. Does docs/V{N}/plans/implementation-state.json exist?
   NO  → STOP. Run /plan-writing first for V{N}.
   YES → Read it.

3. What phase?
   orientation  → STOP. Run /plan-writing first.
   scaffolding  → STOP. Run /repo-initialization first.
   planning     → Transition to "test_setup", begin writing tests for V{N}.
   test_setup   → Resume from where the previous iteration left off.
   executing    → STOP. Tests already written.
   completed    → STOP. Tests already written.
```

## Reading State on Entry (spec-implementation)

```
1. Read docs/project-tracking.json → identify target version V{N}.
2. Does docs/V{N}/plans/implementation-state.json exist?
   NO  → STOP. Run /repo-initialization and /plan-writing first.
   YES → Read it.

3. What phase?
   orientation  → STOP. Run /plan-writing first.
   scaffolding  → STOP. Run /repo-initialization first.
   planning     → STOP. Run /plan-writing first.
   test_setup   → STOP. Run /test-setup to finish writing tests.
   executing    → Run pre-flight plan check:
                   - Verify all wave plan files exist under docs/V{N}/plans/
                   - If any missing → revert phase to "planning", stop
                   - If all present → find current_wave, resume its current_task
   completed    → Output completion promise (ralph-loop) or report done

4. Are there unresolved errors?
   YES → Attempt to resolve the most recent one first
   NO  → Continue normal flow
```

## Updating State

**Always use atomic writes** — write to a temp file first, then rename:

```bash
# Write to temp, then move (prevents corruption on interruption)
cat > docs/V{N}/plans/implementation-state.json.tmp << 'EOF'
{ ... }
EOF
mv docs/V{N}/plans/implementation-state.json.tmp docs/V{N}/plans/implementation-state.json
```

**Update frequency:**

- After every task completion
- After every quality gate step
- After every wave status change
- After every phase transition
- After every error encountered

`docs/project-tracking.json` is updated at wave boundaries only (not per task), so it stays focused on project-level progress. See `docs/project-tracking.json`'s `roadmap.versions[VN].test_setup` / `.implementation` / `.qa` blocks for the per-version rollup.
