---
name: spec-implementation
version: 1.0.0
description: >
  Autonomous GREEN-phase execution of pre-existing implementation plans for a
  **specific version** (V0, V1, ...) against pre-written failing tests, Gherkin
  .feature files, UI wireframes, and ARCHITECTURE.md. Executes wave by wave — each
  wave is a vertical slice that produces a testable end-to-end app. Tracks progress
  in both a local state file and project-tracking.json. Use this skill when tests
  are already written and failing (created by /test-setup) and you need to write
  the minimal implementation code that makes every test pass. Triggers on: "implement
  V0", "execute the plans", "make the tests pass", "run the implementation",
  "GREEN phase", or any request to execute pre-existing implementation plans for a
  version. Also use when resuming an interrupted implementation.
---

# Implementation

Executes pre-existing implementation plans for **one version at a time** by writing
the minimal code that makes all pre-written failing tests pass. Works wave by wave —
each wave is a vertical slice that produces a testable end-to-end app.

**Prerequisites:** Before invoking this skill, these must be complete:

- Scoping via `/high-level-scoping` (project-tracking.json with version roadmap)
- Specs via `/spec-writing` (SPECS.md + feature files for the target version)
- Architecture via `/research-and-architecture` (ARCHITECTURE.md)
- Scaffolding via `/repo-initialization` (project structure, tooling, dependencies)
- Planning via `/plan-writing` (wave plans for the target version in `docs/V{N}/plans/`)
- Test scaffolding via `/test-setup` (all BDD steps, unit tests, and source stubs)

The core principle: **specs are the source of truth**. Every line of code exists because
a scenario demands it.

The architecture principle: **ARCHITECTURE.md defines the structure**. All code follows
module boundaries and dependency rules.

The UI principle: **Wireframes and UI-SPECS.md define the look and feel**. All UI
components follow the design tokens and wireframe layouts.

---

## Integration with project-tracking.json

**`project-tracking.json` is the project-level source of truth.** This skill reads
context from it and writes progress back after significant milestones.

### Reading from project-tracking.json

On entry, read `project-tracking.json` to:

- Identify the target version and its user stories
- Check the version's `planning` field for wave structure
- Get persona context for UI decisions

### Writing progress back

After **each wave completes** (not each task — that's too granular), update
`project-tracking.json` (read-merge-write):

- Update the version's `implementation` field:

  ```json
  {
    "id": "V0",
    "implementation": {
      "status": "in_progress | completed",
      "current_wave": 2,
      "waves_completed": 1,
      "started_at": "2026-04-07",
      "completed_at": null
    }
  }
  ```

- Update each user story's `implementation` field when its wave completes:

  ```json
  {
    "id": "US-001",
    "implementation": {
      "status": "completed",
      "wave": 1,
      "completed_at": "2026-04-08"
    }
  }
  ```

- Update each epic's progress (compute from its stories):

  ```json
  {
    "id": "E-001",
    "implementation_progress": {
      "stories_total": 5,
      "stories_completed": 2,
      "percentage": 40
    }
  }
  ```

- Update `project.updated_at`

---

## State Management

Two levels of state:

1. **`project-tracking.json`** — project-level progress (versions, epics, stories)
2. **`docs/V{N}/plans/implementation-state.json`** — version-level execution state (waves, tasks, quality gates)

The local state file handles fine-grained inter-loop coordination. `project-tracking.json`
is updated at wave boundaries for project-level visibility.

Read `references/state-schema.md` for the full local state schema.

### On every entry:

1. Read `project-tracking.json` — get version context
2. Read `docs/V{N}/plans/implementation-state.json` — it **must** exist
3. If it doesn't exist → **stop**. Run `/plan-writing` and `/test-setup` first
4. If phase is `"executing"` → run pre-flight check, resume from current wave/task
5. If phase is `"completed"` → output `IMPLEMENTATION_COMPLETE`
6. If phase is earlier → **stop** and tell the user which skill to run

**Update local state after every task.** Update `project-tracking.json` after every wave.

---

## Asking Which Version to Implement

If the user didn't specify a version, use AskUserQuestion:

- **Header: "Version"** — "Which version do you want to implement?"
  - Options: one per version that has `planning.status: "planned"` in `project-tracking.json`
  - Include the version's goal and wave count in the description

---

## Pre-Flight Check

Before execution begins, verify on every entry:

1. All wave plan files exist in `docs/V{N}/plans/`
2. Foundation plan exists: `docs/V{N}/plans/00-foundation.md`
3. BDD step definitions and unit tests exist for the current wave's scenarios
4. Run the current wave's tests — they should be failing (RED state)

If any plan file is missing → revert phase to `"planning"`, stop.

---

## Execution (GREEN Phase)

**Goal:** Execute waves sequentially, making pre-written failing tests pass.

### Picking the Next Wave

1. Read the local state file
2. Find the next wave where `status` is `"planned"` or `"in_progress"`
3. Waves are sequential: Wave N depends on Wave N-1 being complete
4. Set it as `current_wave` in state

### Executing a Wave's Tasks

For each task in the wave plan:

1. **Update state** — set `current_task`, status to `"in_progress"`

2. **Identify the failing tests** — read the task to find which BDD scenarios and
   unit tests cover it. Run them to confirm RED state.

3. **GREEN: Write minimal implementation**
   - Write the simplest code that makes ALL failing tests pass
   - Follow ARCHITECTURE.md module boundaries
   - For UI: follow wireframes from `docs/V{N}/specs/wireframes/` + design tokens from UI-SPECS.md
   - No features beyond what the tests demand
   - **Run all tests — they MUST pass**
   - **Run the full test suite** — no regressions
   - **Commit**: `feat(<scope>): implement <what>`

4. **REFACTOR (light touch)**
   - Clean obvious duplication, improve names
   - Ensure module boundary compliance
   - **If changes: commit** `refactor(<scope>): <what>`

5. **Update local state** — mark task completed, advance `current_task`

### Parallel Tasks Within a Wave

If the wave plan marks stories as parallelizable (separate agents), dispatch them
using the `superpowers:dispatching-parallel-agents` pattern. Each agent gets one
story's tasks from the wave.

### When a Task Fails

1. Log the error in the state file's `errors` array
2. Move to the next task if independent
3. If blocked: mark `"blocked"` with reason
4. Next iteration will see the block and retry

---

## Wave Completion & Verification

When all tasks in a wave are done:

### Quality Gates (per wave)

#### Gate 1: Simplify

Invoke `/simplify` on files created/modified during this wave.
After: run full test suite. Update state: `quality_gates[wave].simplified = true`

#### Gate 2: Code Review

Dispatch a code review subagent (BASE_SHA → HEAD_SHA for this wave).
Act on critical findings. Update state: `quality_gates[wave].reviewed = true`

#### Gate 3: Wave Verification (end-to-end)

Run the wave's verification checklist from the plan:

1. **Run full test suite** — all tests pass (including previous waves)
2. **Run BDD suite** for this wave's scenarios
3. **Run linter + type checker** — no errors
4. **Start the app** — verify it boots
5. **Test end-to-end flows** from the wave plan's verification section:
   - Each flow listed in the plan must be manually exercisable
   - Use Playwright MCP if available to automate these checks
6. **Verify architecture compliance** — files in correct modules, no cross-module violations
7. **Verify UI compliance** — wireframe layouts followed, design tokens applied

Update state: `quality_gates[wave].verified = true`

### After Wave Verification Passes

1. Mark wave as `"completed"` in local state
2. **Update project-tracking.json:**
   - Mark all user stories in this wave as `implementation.status: "completed"`
   - Update the version's `implementation.current_wave` and `waves_completed`
   - Recompute each epic's `implementation_progress`
   - Update `project.updated_at`
3. Move to the next wave

---

## Version Completion

When all waves are `"completed"` and all quality gates passed:

1. **Update local state:**

   ```json
   { "phase": "completed", "completed_at": "2026-04-08T..." }
   ```

2. **Update project-tracking.json:**
   - Set version's `implementation.status: "completed"` and `implementation.completed_at`
   - Verify all user stories in this version have `implementation.status: "completed"`

3. **Output:** `IMPLEMENTATION_COMPLETE`

4. **Use AskUserQuestion for next step:**
   - **Header: "Done"** — "Version [VN] implementation is complete. What's next?"
     - "Run verification & validation (Recommended)" — description: "Full E2E test pass via /verification-and-validation"
     - "Plan the next version" — description: "Run /spec-writing then /plan-writing for [VN+1]"
     - "Review the code" — description: "Run a comprehensive code review before shipping"
     - "Ship it" — description: "Create a release / deploy"

---

## Autonomous Loop Execution

This skill is designed for a bash loop that invokes `claude -p` repeatedly.

### Example Loop Script

```bash
#!/bin/bash
VERSION="${1:-V0}"
MAX_ITERATIONS=50
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== Iteration $ITERATION ==="

  OUTPUT=$(claude -p "Use the implementation skill to execute the plans for version $VERSION. \
    Read docs/$VERSION/plans/implementation-state.json to determine where you left off. \
    Follow: pre-flight → GREEN phase → quality gates → wave completion → next wave." \
    --dangerously-skip-permissions)

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "IMPLEMENTATION_COMPLETE"; then
    echo "=== Version $VERSION complete at iteration $ITERATION ==="
    break
  fi

  sleep 2
done
```

### Iteration Budget

Each iteration should complete **one meaningful unit of work**:

- One wave's tasks (if small, 3-5 tasks)
- One quality gate cycle
- One wave verification

---

## Commit Rules

All commits follow [Conventional Commits](https://www.conventionalcommits.org/).

### Scope Convention

Use the **user story ID** as scope: `feat(US-001): implement login form`

For foundation/shared work: `feat(foundation): set up auth service skeleton`

### Examples

```
test(US-001): add failing test for login validation
feat(US-001): implement login form and auth flow
refactor(US-001): extract form validation helper
test(US-003): add failing test for dashboard stats
feat(US-003): implement dashboard with stat cards
fix(US-003): correct percentage calculation
refactor(foundation): extract shared DB connection pool
```

---

## Decision Rules

### When to Use Subagents

- **Code review gate:** Always — fresh context prevents blind spots
- **Parallel stories within a wave:** Dispatch separate agents per independent story
- **Simplify gate:** Inline (lightweight)
- **Verification gate:** Inline (just running commands)

### When to Ask the User

In autonomous loop mode: **never** — decide and document in state.
Outside the loop: ask when tests or architecture are ambiguous.

### When to Skip a Quality Gate

Never. All three gates are mandatory for every wave.
