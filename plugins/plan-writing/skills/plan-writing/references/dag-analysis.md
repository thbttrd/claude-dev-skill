# Vertical Slice DAG Analysis Guide

How to organize a version's user stories into vertical-slice waves where each wave
delivers testable, end-to-end functionality.

## What Is the DAG

The DAG defines the order in which waves must be executed for a **single version**.
Each wave produces a working, testable app. Waves are sequential — Wave N depends
on Wave N-1 being complete. Within a wave, independent stories can run in parallel.

```
Wave 0: Foundation (infrastructure skeleton)
Wave 1: Thinnest vertical slice (1-2 stories, end-to-end)
Wave 2: Next slice (2-3 stories, adds a workflow)
Wave 3: Polish slice (remaining stories, edge cases)
```

## How to Build the Vertical Slice DAG

### Step 1: Map Stories to End-to-End Paths

For each user story in the version, trace its full path through the stack:

| Story  | UI         | API/Route  | Service      | Data     | External |
| ------ | ---------- | ---------- | ------------ | -------- | -------- |
| US-001 | Login page | POST /auth | AuthService  | users    | OAuth    |
| US-003 | Dashboard  | GET /stats | StatsService | sessions | —        |
| US-005 | Settings   | PUT /user  | UserService  | users    | —        |

### Step 2: Identify Shared Infrastructure

Find what's shared across stories — this goes into Foundation (Wave 0):

| Shared Need          | Used by Stories | Foundation Task     |
| -------------------- | --------------- | ------------------- |
| users table          | US-001, US-005  | DB schema           |
| AuthService skeleton | US-001, US-003  | BM service skeleton |
| Test fixtures        | all             | Test infrastructure |

### Step 3: Pick the Thinnest Vertical Slice (Wave 1)

Wave 1 is the **walking skeleton within the version** — the thinnest end-to-end
path that proves the architecture works:

**Selection criteria:**

1. Pick the highest-priority story (from MoSCoW + business impact)
2. It must touch all major layers (UI + logic + data minimum)
3. It should be implementable quickly — prefer a simple flow over a complex one
4. After Wave 1, someone should be able to start the app and do one thing end-to-end

**Example:** For V0 of a task app, Wave 1 might be "US-001: User can create a task"
— this proves the DB, API, UI, and auth all work together.

### Step 4: Group Remaining Stories into Waves

For each remaining story, decide which wave it belongs to:

**Grouping principles:**

1. **Stories that share new infrastructure go together.** If US-005 and US-006 both
   need a new NotificationService, put them in the same wave.
2. **Stories that build on each other go in sequence.** If US-008 needs the data
   created by US-005's workflow, put US-008 in a later wave.
3. **Independent stories can be in the same wave** — they'll be parallelizable.
4. **Error handling and edge cases go last.** Happy paths first, sad paths later.
5. **3-4 waves per version is ideal.** More than 5 waves means the version is too big.

### Step 5: Validate — Each Wave Is a Vertical Slice

For each wave, check:

- [ ] **Vertical**: touches all necessary layers (not just backend or just frontend)
- [ ] **Complete**: no half-implementations (API without UI, or UI without backend)
- [ ] **Testable**: after this wave, new end-to-end flows can be manually exercised
- [ ] **Buildable**: all dependencies from previous waves are available
- [ ] **BDD-ready**: all Gherkin scenarios for this wave's stories will pass

**Anti-patterns to avoid:**

- Wave 1 = "set up all the database tables" (horizontal, not vertical)
- Wave 2 = "build all the API endpoints" (horizontal, not vertical)
- Wave with a UI page but no backend (broken, not testable)
- Wave with backend logic but no way to trigger it (not testable)

### Step 6: Identify Parallel Stories Within Waves

Within a wave, stories that don't share services/modules can be implemented by
separate agents in parallel:

```
Wave 2:
  Agent A: US-005 (Settings page — UserService)
  Agent B: US-006 (Notifications — NotificationService)
  Agent C: US-007 (Export — ExportService)
  ← all independent, all parallelizable
```

Stories that share the same service should be in the same agent's workload.

## DAG.md Format

The `docs/V{N}/plans/DAG.md` file must contain:

1. **Version context** — version ID, goal, stories in scope
2. **Wave overview table** — waves, stories, what becomes testable, parallelism
3. **Mermaid dependency graph** showing wave sequence
4. **Parallel execution guide** — which stories within each wave can run in parallel
5. **End-to-end verification plan** — what to test after each wave

## State in project-tracking.json

Planning state is stored in the version's `planning` field:

```json
{
  "id": "V0",
  "planning": {
    "status": "planned",
    "plan_dir": "docs/V0/plans/",
    "dag_file": "docs/V0/plans/DAG.md",
    "waves_count": 4,
    "total_tasks": 18,
    "waves": [
      { "wave": 0, "name": "Foundation", "stories": [], "tasks": 5 },
      {
        "wave": 1,
        "name": "Auth golden path",
        "stories": ["US-001"],
        "tasks": 4
      },
      {
        "wave": 2,
        "name": "Dashboard + stats",
        "stories": ["US-003", "US-005"],
        "tasks": 6
      },
      {
        "wave": 3,
        "name": "Settings + edge cases",
        "stories": ["US-008"],
        "tasks": 3
      }
    ],
    "planned_at": "2026-04-07"
  }
}
```
