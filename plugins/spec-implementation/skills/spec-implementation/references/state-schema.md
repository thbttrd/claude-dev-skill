# State Schema

Two levels of state tracking:

1. **`docs/project-tracking.json`** — project-level progress across versions, epics, stories. **Always lives under `docs/`**, never at the repository root.
2. **`docs/V{N}/plans/implementation-state.json`** — version-level execution state for inter-loop coordination. One per version; frozen once the version completes.

---

## Local State: `docs/V{N}/plans/implementation-state.json`

This file tracks fine-grained execution progress within a single version.

### Full Schema

```json
{
  "version": "V0",
  "phase": "executing | completed",
  "branch": "impl/V0-2026-04-07",
  "started_at": "ISO 8601 timestamp",
  "completed_at": "ISO 8601 timestamp or null",
  "iteration": 1,

  "waves": {
    "W0-foundation": {
      "status": "completed | in_progress | planned | blocked",
      "plan_file": "docs/V0/plans/00-foundation.md",
      "stories": [],
      "tasks_total": 5,
      "tasks_completed": 5,
      "current_task": 0,
      "started_at": "ISO 8601",
      "completed_at": "ISO 8601"
    },
    "W1-auth-golden-path": {
      "status": "in_progress",
      "plan_file": "docs/V0/plans/W1-auth-golden-path.md",
      "stories": ["US-001", "US-003"],
      "tasks_total": 8,
      "tasks_completed": 3,
      "current_task": 4,
      "started_at": "ISO 8601",
      "completed_at": null
    },
    "W2-dashboard-and-stats": {
      "status": "planned",
      "plan_file": "docs/V0/plans/W2-dashboard-and-stats.md",
      "stories": ["US-005", "US-006"],
      "tasks_total": 6,
      "tasks_completed": 0,
      "current_task": 0,
      "started_at": null,
      "completed_at": null
    }
  },

  "quality_gates": {
    "W0-foundation": {
      "simplified": true,
      "reviewed": true,
      "verified": true
    },
    "W1-auth-golden-path": {
      "simplified": false,
      "reviewed": false,
      "verified": false,
      "review_findings": [],
      "verification_results": {
        "tests_passed": null,
        "bdd_passed": null,
        "lint_passed": null,
        "types_passed": null,
        "app_boots": null,
        "e2e_flows_passed": null
      }
    }
  },

  "current_wave": "W1-auth-golden-path",

  "errors": [
    {
      "wave": "W1-auth-golden-path",
      "task": 4,
      "story": "US-001",
      "error": "Test still failing after implementation",
      "details": "Expected redirect after login but response is 500",
      "attempts": 1,
      "resolved": false,
      "timestamp": "ISO 8601"
    }
  ],

  "summary": {
    "waves_completed": 1,
    "waves_total": 3,
    "tasks_completed": 8,
    "tasks_total": 19,
    "stories_completed": 0,
    "stories_total": 4,
    "last_commit": "abc1234"
  }
}
```

---

## Project-Level State: `docs/project-tracking.json`

Updated at wave boundaries (not per task). Fields added by this skill:

### On each version (in `roadmap.versions`):

```json
{
  "id": "V0",
  "name": "Walking Skeleton",
  "goal": "...",
  "user_story_ids": ["US-001", "US-003", "US-005", "US-006"],
  "planning": { "...": "added by /plan-writing" },
  "implementation": {
    "status": "not_started | in_progress | completed",
    "current_wave": 1,
    "waves_completed": 0,
    "started_at": "2026-04-07",
    "completed_at": null
  }
}
```

### On each user story (in `epics[].user_stories[]`):

```json
{
  "id": "US-001",
  "title": "...",
  "implementation": {
    "status": "not_started | in_progress | completed",
    "version": "V0",
    "wave": 1,
    "completed_at": null
  }
}
```

### On each epic (in `epics[]`):

```json
{
  "id": "E-001",
  "title": "...",
  "implementation_progress": {
    "stories_total": 5,
    "stories_completed": 2,
    "percentage": 40
  }
}
```

---

## Phase Transitions

```
Local state phases (within a version):
  executing → completed

Wave transitions:
  planned → in_progress → completed
                ↓
             blocked (can retry → in_progress)

Quality gate flow (after wave tasks done):
  simplified=false → run simplify → simplified=true
  reviewed=false   → run review   → reviewed=true
  verified=false   → run verify   → verified=true
  all true → wave status = completed → update project-tracking.json
```

---

## Reading State on Entry

```
1. Does docs/project-tracking.json exist?
   NO  → STOP. Run /high-level-scoping first.
   YES → Read it, identify target version V{N}.

2. Does docs/V{N}/plans/implementation-state.json exist?
   NO  → STOP. Run /plan-writing and /test-setup for this version first.
   YES → Read it.

3. What phase?
   executing → Run pre-flight check:
     - Verify all wave plan files exist in docs/V{N}/plans/
     - If any missing → stop, run /plan-writing
     - If all present → find current_wave, resume current_task
   completed → Output IMPLEMENTATION_COMPLETE

4. Are there unresolved errors?
   YES → Attempt to resolve the most recent one first
   NO  → Continue normal flow
```

---

## Sync Protocol: Local State → project-tracking.json

**When to sync (wave boundary):**

1. All tasks in the wave are complete
2. All 3 quality gates pass
3. Wave verification passes

**What to sync:**

1. Read `project-tracking.json`
2. For each story in the completed wave:
   - Find the story in `epics[].user_stories[]`
   - Set `implementation.status = "completed"`, `implementation.wave = N`, `implementation.completed_at`
3. For each epic that has stories in this wave:
   - Recompute `implementation_progress` (count completed vs total)
4. Update version's `implementation.current_wave` and `waves_completed`
5. If all waves done: set version `implementation.status = "completed"`
6. Update `project.updated_at`
7. Write back (read-merge-write, never overwrite other fields)

---

## Updating State

**Always use atomic writes** — write to a temp file first, then rename:

```bash
cat > docs/V{N}/plans/implementation-state.json.tmp << 'EOF'
{ ... }
EOF
mv docs/V{N}/plans/implementation-state.json.tmp docs/V{N}/plans/implementation-state.json
```

**Update frequency:**

- Local state: after every task completion, quality gate step, wave status change, error
- project-tracking.json: after every wave completion (not per task)
