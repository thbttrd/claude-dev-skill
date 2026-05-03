---
name: verification-and-validation
version: 2.0.0
description: >
  Per-story end-to-end verification of a completed implementation. Runs the
  full automated test suite, starts the application, exercises every API
  endpoint with curl, walks every UI scenario via Playwright MCP, and FIXES
  any deviation found. Operates on ONE story (US-NNN) at a time; when
  everything passes, flips the story's phase to verified and writes the QA
  report to specs/story-NNN-slug/verification/qa-report.md. Use after
  /spec-implementation US-NNN (story phase = green). Optional --all-pending
  flag to walk every green story in turn. Triggers on: "verify the app",
  "validate US-NNN", "run E2E verification for the story", "test the
  running app", "check everything works for US-NNN", or any request to
  certify a green story as verified.
---

# Verification & Validation (per story)

Performs a real end-to-end verification of **one story** by exercising the running application — not just running automated tests, but actually using the app as a real user would. Tests APIs with `curl` and UI with Playwright MCP. **Fixes any deviation on the spot** before moving on.

The core principle: **the running app must match the story's spec**. Every Gherkin scenario must be reproducible by hand. If the app deviates, fix it immediately — don't just log it.

## Pre-Flight

| Check                                                | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing AND no `--all-pending` flag  | Ask via `AskUserQuestion` (default: stories whose `phase = green`).                                                                            |
| Story's `phase` is not `green`                       | Hard-stop. Print: `Story US-NNN must be green before verification. Run /spec-implementation US-NNN first.`                                     |

### `--all-pending` mode

When invoked as `/verification-and-validation --all-pending`, the skill walks every story whose `phase = green` in DAG order (respecting `depends_on_story_ids`). For each story, it runs the full single-story flow below. If any story fails verification, it stops on that one (leaving downstream stories in `green`) and surfaces the failure for the user to address.

---

## How It Works (single-story flow)

```
Read state → Automated suite (baseline) → Start app → API verification (curl)
  → UI verification (Playwright MCP) → README check (last story only)
  → Write qa-report.md → Update stories.json → Output completion signal
       ↑                                                              |
       └──────────────────── loop iteration ──────────────────────────┘
```

Each loop iteration picks up where the last left off by reading `specs/story-NNN-slug/state.json`.

### Input Documents

| Document          | Purpose                                                       | Location                                              |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| STORY.md          | Acceptance criteria, Rules                                    | `specs/story-NNN-slug/STORY.md`                       |
| `*.feature` files | Gherkin scenarios — behavioural specs                         | `specs/story-NNN-slug/features/`                      |
| PLAN.md           | Test Plan, Verification checklist                             | `specs/story-NNN-slug/PLAN.md`                        |
| ARCHITECTURE.md   | Module structure, API routes, dependency rules                | `specs/ARCHITECTURE.md`                               |
| DESIGN.md         | Design system tokens (UI stories)                             | `specs/DESIGN.md`                                     |
| Mockups           | Per-screen visual ground truth (UI stories)                   | `specs/story-NNN-slug/mockups/`                       |
| State file        | Per-story verification progress                               | `specs/story-NNN-slug/state.json`                     |
| Tracker           | Project-level progress                                        | `specs/stories.json`                                  |

---

## State Management

`specs/story-NNN-slug/state.json` gains a `verification` block:

```json
{
  "story_id": "US-NNN",
  "phase_local": "verifying",
  "verification": {
    "automated_suite": { "status": "passed", "completed_at": "..." },
    "app_running": true,
    "api_verification": { "scenarios_tested": 5, "passed": 5, "failed": 0 },
    "ui_verification": { "scenarios_tested": 3, "passed": 3, "failed": 0, "screenshots": ["..."] },
    "issues_fixed": [{ "scenario": "...", "fix_commit": "<sha>" }],
    "completed_at": null
  }
}
```

**On every entry:**

1. Read `specs/stories.json` — confirm target story phase = `green`.
2. Read `state.json` — must exist (`/test-setup` and `/spec-implementation` created/updated it).
3. If `phase_local = "green"` → transition to `"verifying"`, initialise the `verification` block, proceed.
4. If `phase_local = "verifying"` → resume from where the last iteration left off.
5. If `phase_local = "verified"` → output `VERIFICATION_COMPLETE_US-NNN` and stop.

Update `state.json` after every significant action (scenario verified, issue fixed, step completed).

---

## Step 1: Automated Test Suite (Sanity Baseline)

Run the full automated suite filtered to this story (and stories already `verified`, to catch regressions):

```bash
bun test
bun run bdd
bun lint
bunx tsc --noEmit
```

All must pass before proceeding. If any fails, **fix the issue first**, re-run, and only continue once everything is green.

Update state: `verification.automated_suite.status = "passed"`.

---

## Step 2: Start the Application

```bash
bun dev &
```

Wait for the server to be ready. Update state: `verification.app_running = true`.

---

## Step 3: API Verification with `curl`

For every API endpoint exercised by this story's `.feature` files, run real HTTP requests with `curl` and verify the responses match expected behaviour.

(Same patterns as the legacy skill — POST/GET/PUT/PATCH/DELETE, status code + response body + side effects + error scenarios. Chain requests to test full workflows. The story's PLAN.md Verification section may include a `verification/curl-walkthrough.sh` script — use it.)

If a curl call returns unexpected results:

1. **Stop and diagnose** — read the relevant source code, identify the deviation.
2. **Fix the implementation** — update the source to match the spec.
3. **Re-run automated tests** — ensure the fix doesn't break anything.
4. **Re-verify the failing scenario with curl** — confirm it now works.
5. **Commit the fix**: `fix(US-NNN): <what was corrected>`.
6. **Append to `state.json.verification.issues_fixed`**: `{ scenario, fix_commit }`.

Record results in state.

---

## Step 4: UI End-to-End Verification with Playwright MCP

Use Playwright MCP to open the app in a real browser and walk every UI scenario as a real user would.

### Reference Materials

For each screen, load the corresponding mockup PNG/HTML from `specs/story-NNN-slug/mockups/` to understand the expected layout. Compare the live app against the mockup for element placement, visual hierarchy, component structure, and responsive behaviour per `specs/DESIGN.md`.

### How to proceed

(Same as the legacy skill: navigate via `mcp__playwright__browser_navigate`, snapshot via `browser_snapshot`, interact via `browser_click` / `browser_fill_form` / `browser_type` / `browser_select_option` / `browser_press_key` / `browser_hover`, verify via `browser_snapshot` + `browser_take_screenshot` + `browser_evaluate` + `browser_network_requests` + `browser_console_messages`.)

For each Gherkin scenario:

1. Navigate to the starting page.
2. Take a snapshot to confirm initial state ("Given" steps).
3. Compare layout against the mockup.
4. Perform all user actions ("When" steps).
5. Take a snapshot/screenshot after each action.
6. Verify all expected outcomes ("Then" steps).
7. If error cases, verify error messages display correctly.

If a UI scenario fails:

1. **Stop and diagnose** — screenshot, snapshot, console messages, network requests.
2. **Fix the implementation** — update the component, route, or handler.
3. **Re-run automated tests** — no regressions.
4. **Re-verify with curl** (if the fix touches API logic).
5. **Re-verify with Playwright** — confirm the UI scenario now passes.
6. **Commit**: `fix(US-NNN): <what was corrected>`.

Record results in state.

---

## Step 5: README check (only when verifying the LAST story in DAG order)

When the story being verified is the highest-id story whose dependencies are all `verified`, run a README completeness check. (Skipped for intermediate stories — the README is updated story-by-story, but the full audit happens once a release-worthy state is reached.)

(Same as legacy: verify `README.md` has all 11 required sections — project name, tech stack, prereqs, install, running the app, running tests, project structure, features overview, API reference, deployment, contributing — and no `<!-- TODO -->` markers.)

If gaps: update `README.md`, commit `docs: finalize README with complete onboarding guide`.

---

## Step 6: Verification Summary & Completion

Stop the dev server.

Write `specs/story-NNN-slug/verification/qa-report.md`:

```markdown
# QA Report — US-NNN

**Date:** YYYY-MM-DD
**Story:** US-NNN — <title>
**Phase:** verified

## Test Suite

| Suite              | Result | Time   |
| ------------------ | ------ | ------ |
| Unit + integration | ✅ N/N | <Ns>   |
| BDD (@US-NNN)      | ✅ N/N | <Ns>   |
| BDD (regression)   | ✅ N/N | <Ns>   |
| Lint               | ✅      |        |
| Typecheck          | ✅      |        |

## Scenarios Verified

| Scenario                                  | API (curl) | UI (Playwright) | Notes |
| ----------------------------------------- | ---------- | --------------- | ----- |
| <Scenario name>                           | ✅         | ✅              |       |

## Issues Found and Fixed

| Issue                          | Fix Commit | Notes |
| ------------------------------ | ---------- | ----- |
| <description>                  | <sha>      |       |

## Screenshots

| Scenario | File |
| -------- | ---- |
| <name>   | `verification/screenshots/<file>.png` |

## Verdict

PASS — Story US-NNN matches its spec end-to-end.
```

### Update state and tracker

1. `state.json`:
   ```json
   { "phase_local": "verified", "verification": { "...": "...", "completed_at": "<ISO>" } }
   ```
2. `specs/stories.json`:
   ```json
   "stories[i]": {
     "verification": {
       "qa_report": "specs/story-NNN-slug/verification/qa-report.md",
       "scenarios_passed": <N>,
       "scenarios_failed": 0,
       "verified_at": "<today>"
     },
     "phase": "verified",
     "history": [..., { "phase": "verified", "at": "<today>" }]
   }
   ```
   Update `project.updated_at`.
3. Regenerate `specs/STORIES.md`.

### Output completion signal

```
VERIFICATION_COMPLETE_US-NNN
```

Use `AskUserQuestion`:

- **Header: "Done"** — "US-NNN is verified. What's next?"
  - "Verify the next story (Recommended if any are green)" — picks the next `green` story whose deps are all `verified`
  - "Pick a new story to plan" — list stories with all deps `verified` and `phase = scoped|backlog`
  - "Open a release / deploy" — outside this skill's scope; the user handles it
  - "Done for now"

---

## Autonomous Loop Execution

```bash
#!/bin/bash
STORY="${1:-US-001}"
MAX_ITERATIONS=30
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  OUTPUT=$(claude -p "Use the verification-and-validation skill for $STORY. \
    Read specs/story-${STORY:3}-*/state.json to determine where you left off. \
    Follow: automated suite → start app → curl → Playwright → fix any deviation \
    → write qa-report.md → update stories.json." \
    --dangerously-skip-permissions)
  echo "$OUTPUT"
  if echo "$OUTPUT" | grep -q "VERIFICATION_COMPLETE_$STORY"; then
    break
  fi
  sleep 2
done
```

Each iteration completes one meaningful unit of work: the automated baseline, one story's API scenarios, one story's UI scenarios, or a fix-and-verify cycle for a found deviation.

---

## Commit Rules

Conventional Commits. Fixes use `fix` type with `US-NNN` scope:

```
fix(US-001): correct status code for duplicate resource creation
fix(US-003): align card layout with mockup grid spec
docs: finalize README with complete onboarding guide
```

NEVER add a `Co-Authored-By` trailer.

---

## Decision Rules

### When to fix vs. when to flag

- **Always fix** — this skill's mandate is to leave the app matching its spec.
- **Flag only** if the spec itself seems wrong (contradictory scenarios, impossible AC). Log it in `state.json.verification.issues` and note that the spec needs review — but still implement the best interpretation.

### When to ask the user

- Ralph-loop mode: never — make a decision, fix the issue, document in state.
- Outside the loop:
  - Ask when a spec seems contradictory.
  - Ask when a fix would require an architecture change (re-invoke `/research-and-architecture` for an ADR).

### When to skip Step 5 (README check)

Skip when the story being verified is not the highest-id story with all dependencies verified. The README check runs once per release-ready state, not once per story.
