---
name: verification-and-validation
version: 1.0.0
description: >
  Full end-to-end verification of a completed implementation for a **specific version**
  (V0, V1, ...) against specs, feature files, wireframes, and UI specs. Starts the
  application, tests every API endpoint with curl, exercises every UI scenario via
  Playwright MCP, and fixes any deviation found. Use this skill after /implementation
  has completed for the target version (all waves done, all quality gates passed).
  Triggers on: "verify the app", "validate the implementation", "verify V0",
  "run E2E verification", "test the running app", "check everything works", or
  any request to verify a completed implementation against its specs. Also use
  when resuming an interrupted verification — the state file tells you where you
  left off.
---

# Verification & Validation

Performs a full real end-to-end verification of every User Story and feature for
**one version at a time** by exercising the running application — not just running
automated tests, but actually using the app as a real user would. Tests APIs with
`curl` and UI with Playwright MCP.
**Fixes any deviation on the spot** before moving on.

Works as a single invocation or inside an autonomous bash loop for multi-iteration
execution.

**Prerequisites:** Before invoking this skill, these must be complete:

- Implementation via `/implementation` for the target version (all waves completed, all quality gates passed)
- State file `docs/V{N}/plans/implementation-state.json` must exist with phase `"completed"`
- `docs/project-tracking.json` must exist

The core principle: **the running app must match the specs**. Every Gherkin scenario
must be reproducible by hand (curl for API, Playwright for UI). If the app deviates
from the spec, fix it immediately — don't just log it.

---

## Asking Which Version to Verify

If the user didn't specify a version, use AskUserQuestion:

- **Header: "Version"** — "Which version do you want to verify?"
  - Options: one per version that has `implementation.status: "completed"` in `project-tracking.json`
  - Include the version's goal and story count in the description

Once the version is known (e.g., V0), all paths in this skill use `VN` = the target
version identifier (V0, V1, V2, ...).

---

## How It Works (The Big Picture)

```
Read state → Automated suite (baseline) → Start app → API verification (curl)
  → UI verification (Playwright MCP) → README check → Summary
  → Write back to project-tracking.json → Done
       ↑                                                              |
       └──────────────────── loop iteration ──────────────────────────┘
```

Each loop iteration picks up where the last left off by reading the state file.

### Input Documents

| Document          | Purpose                                                       | Location                                    |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------- |
| SPECS.md          | User story IDs, rules, API contracts, NFRs                    | `docs/V{N}/specs/SPECS.md`                  |
| `*.feature` files | Gherkin scenarios — behavioral specs                          | `docs/V{N}/specs/features/`                 |
| ARCHITECTURE.md   | Module structure, API routes, dependency rules                | `docs/V{N}/architecture/ARCHITECTURE.md`    |
| UI-SPECS.md       | Design system tokens, component patterns, responsive strategy | `docs/V{N}/specs/UI-SPECS.md`               |
| Wireframe PNGs    | Per-screen layout and visual reference                        | `docs/V{N}/specs/wireframes/`               |
| State file        | Inter-loop state tracking                                     | `docs/V{N}/plans/implementation-state.json` |
| Project tracking  | Project-level progress across versions                        | `project-tracking.json`                     |

---

## State Management

This skill extends the existing `docs/V{N}/plans/implementation-state.json` by adding a
`verification` block. It does **not** create a separate state file.

```json
{
  "phase": "verifying",
  "verification": {
    "automated_suite": { "status": "passed", "completed_at": "..." },
    "app_running": true,
    "api_verification": {
      "US-001": { "scenarios_tested": 5, "passed": 5, "failed": 0 },
      "US-003": { "scenarios_tested": 3, "passed": 2, "failed": 1 }
    },
    "ui_verification": {
      "US-001": {
        "scenarios_tested": 5,
        "passed": 5,
        "failed": 0,
        "screenshots": ["docs/e2e/US-001-scenario-1.png"]
      }
    },
    "readme_complete": false,
    "completed_at": null
  }
}
```

**On every entry (start of skill or loop iteration):**

1. Read `project-tracking.json` — identify the target version and its user stories
2. Read `docs/V{N}/plans/implementation-state.json` — it **must** exist
3. If phase is `"completed"` → transition to `"verifying"`, initialize the `verification` block, proceed
4. If phase is `"verifying"` → resume from where the last iteration left off (check which steps are done)
5. If phase is `"verified"` → output `VERIFICATION_COMPLETE` and report done
6. If phase is `"executing"` or earlier → **stop**. Implementation is not finished yet. Run `/implementation` first.

**Update the state file after every significant action** (user story verified, issue fixed,
step completed).

---

## Step 1: Automated Test Suite (Sanity Baseline)

Run the full automated suite to confirm nothing is broken before manual E2E:

```bash
bun test              # all unit + integration tests
bun run bdd           # all Gherkin BDD tests
bun lint              # linter — no errors
bunx tsc --noEmit     # type checker — no errors
```

All must pass before proceeding. If any fail, **fix the issue first**, re-run, and
only continue once everything is green.

Update state: `verification.automated_suite.status = "passed"`

---

## Step 2: Start the Application

Start the app in the background so it's available for E2E verification:

```bash
bun dev &
```

Wait for the server to be ready (check the health endpoint or stdout confirmation).

Update state: `verification.app_running = true`

---

## Step 3: API Verification with curl

For **every API endpoint** defined in SPECS.md and exercised by the feature files, run real
HTTP requests with `curl` and verify the responses match expected behavior.

### Walkthrough Order

Follow **wave order** from the implementation plan — Wave 0 (foundation) first, then
Wave 1 stories, then Wave 2 stories, etc. This ensures data dependencies are satisfied
(earlier waves create prerequisite data that later waves depend on).

Read `docs/V{N}/plans/implementation-state.json` to get the wave structure and the user
stories assigned to each wave.

### How to proceed

1. Re-read SPECS.md and all `features/*.feature` files to extract every API interaction
   (POST, GET, PUT, PATCH, DELETE endpoints, request bodies, expected status codes, response shapes)

2. For each user story (US-001 through US-NNN), walking through waves in order (Wave 1
   stories first, Wave 2 next, etc.), translate each Gherkin scenario step into a `curl`
   command:

   ```bash
   # Creating a resource (POST)
   curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/resource \
     -H "Content-Type: application/json" \
     -d '{"field": "value"}'

   # Fetching a resource (GET)
   curl -s -w "\n%{http_code}" http://localhost:3000/api/resource/1

   # Updating a resource (PUT/PATCH)
   curl -s -w "\n%{http_code}" -X PATCH http://localhost:3000/api/resource/1 \
     -H "Content-Type: application/json" \
     -d '{"field": "updated_value"}'

   # Deleting a resource (DELETE)
   curl -s -w "\n%{http_code}" -X DELETE http://localhost:3000/api/resource/1
   ```

3. For each curl call, verify:
   - **Status code** matches expected (200, 201, 204, 400, 404, etc.)
   - **Response body** contains the expected data structure and values
   - **Side effects** are real — a POST actually creates data that a subsequent GET returns
   - **Error scenarios** — send invalid data, missing fields, non-existent IDs, and confirm
     the API returns proper error responses as specified in the feature files

4. Chain requests to test **full user workflows** across stories within and across waves:
   - Create prerequisite data in Wave 1 stories, then use it in Wave 2 story scenarios
   - Follow the exact sequence a real user would (e.g., create deck -> add cards -> start session)

5. **If any API call returns unexpected results:**
   - **Stop and diagnose** — read the relevant source code, identify the deviation
   - **Fix the implementation** — update the source to match the spec
   - **Re-run automated tests** — ensure the fix doesn't break anything
   - **Re-verify the failing scenario with curl** — confirm it now works
   - **Commit the fix** — `fix(US-NNN): <what was corrected>`

6. Record results in state:
   ```json
   "api_verification": {
     "US-001": { "scenarios_tested": 5, "passed": 5, "failed": 0 },
     "US-003": { "scenarios_tested": 3, "passed": 3, "failed": 0 }
   }
   ```

---

## Step 4: UI End-to-End Verification with Playwright MCP

Use the **Playwright MCP server** to open the application in a real browser and walk through
every User Story scenario as a real user would — clicking, typing, navigating, and verifying
visual outcomes.

### Wireframe Reference

For each screen, load the corresponding wireframe PNG from `docs/V{N}/specs/wireframes/` to
understand the expected layout. Compare the live app against the wireframe for:

- Element placement and visual hierarchy
- Component structure and groupings
- Responsive behavior as specified in UI-SPECS.md

### How to proceed

1. Re-read SPECS.md, all `features/*.feature` files, UI-SPECS.md, and the wireframe PNGs
   in `docs/V{N}/specs/wireframes/` for the relevant screens

2. For each user story (following wave order — Wave 1 first, Wave 2 next, etc.), for each
   Gherkin scenario, translate the steps into Playwright MCP actions:

   **Navigation:**
   - Use `mcp__playwright__browser_navigate` to go to the relevant page
   - Use `mcp__playwright__browser_snapshot` to capture the accessibility
     snapshot and understand the current page state

   **Interactions — follow the Gherkin "When" steps:**
   - Use `mcp__playwright__browser_click` to click buttons, links, menu items
   - Use `mcp__playwright__browser_fill_form` to fill in form fields
   - Use `mcp__playwright__browser_type` for typing into inputs
   - Use `mcp__playwright__browser_select_option` for dropdowns
   - Use `mcp__playwright__browser_press_key` for keyboard shortcuts (Enter, Escape, etc.)
   - Use `mcp__playwright__browser_hover` for hover interactions

   **Verification — follow the Gherkin "Then" steps:**
   - Use `mcp__playwright__browser_snapshot` after each action to read the
     current page state and verify expected elements, text, and structure are present
   - Use `mcp__playwright__browser_take_screenshot` to capture visual evidence
     of the state at key verification points
   - Use `mcp__playwright__browser_evaluate` to check DOM state, local storage,
     or JavaScript values when needed
   - Use `mcp__playwright__browser_network_requests` to verify API calls were
     made correctly from the UI
   - Use `mcp__playwright__browser_console_messages` to check for JavaScript
     errors or warnings

3. **Walk through scenarios in wave order** (following data dependencies):
   - Start with Wave 1 stories (foundation/prerequisite user journeys)
   - Then Wave 2 stories, Wave 3, etc.
   - This ensures data created in earlier wave scenarios is available for later ones

4. **For each scenario, follow this pattern:**

   ```
   a. Navigate to the starting page
   b. Take a snapshot to confirm initial state ("Given" steps)
   c. Compare layout against the wireframe PNG from docs/V{N}/specs/wireframes/
   d. Perform all user actions ("When" steps)
   e. Take a snapshot and/or screenshot after each action
   f. Verify all expected outcomes ("Then" steps) by reading the snapshot
   g. If the scenario involves error cases, verify error messages are displayed
   ```

5. **Cross-story workflows:** After testing each story individually, test the full
   user journey that spans multiple stories end-to-end (e.g., create content -> study it
   -> review results -> see statistics).

6. **If any UI verification fails:**
   - **Stop and diagnose** — take a screenshot, read the snapshot, inspect console messages
     and network requests to understand what went wrong
   - **Fix the implementation** — update the source (component, route, handler) to match the spec
   - **Re-run automated tests** — ensure the fix doesn't break anything
   - **Re-verify with curl** (if the fix touches API logic) — confirm API still works
   - **Re-verify with Playwright** — confirm the UI scenario now passes
   - **Commit the fix** — `fix(US-NNN): <what was corrected>`

7. Record results in state:
   ```json
   "ui_verification": {
     "US-001": {
       "scenarios_tested": 5, "passed": 5, "failed": 0,
       "screenshots": ["docs/e2e/US-001-scenario-1.png"]
     }
   }
   ```

---

## Step 5: README.md Completeness Check

Before declaring the project complete, verify that `README.md` is a **complete onboarding
document** for a new developer joining the project. A new dev should be able to go from
zero to running the app and contributing code using only the README.

**Read `README.md` and verify it contains all of the following sections:**

1. **Project name and description** — what the app does, in plain language
2. **Tech stack** — runtime, framework, language, database, ORM, styling, test tools
3. **Prerequisites** — exact tools and minimum versions (e.g., `bun >= 1.x`, `node >= 20`)
4. **Installation** — step-by-step: clone, install deps, env setup (`.env.example` -> `.env`),
   database setup (migrations, seed data if any)
5. **Running the app** — dev server command, default port, how to verify it's running
6. **Running tests** — all test commands:
   - Unit/integration: `bun test`
   - BDD/E2E: `bun run bdd`
   - Linter: `bun lint`
   - Type checker: `bunx tsc --noEmit`
7. **Project structure** — directory tree with one-line descriptions of key directories
8. **Features overview** — list of all features with brief descriptions
9. **API reference** (if applicable) — endpoints, methods, request/response shapes,
   or a pointer to where this is documented
10. **Deployment** — how to build for production (`bun run build`), environment variables
    required in production, any deployment notes
11. **Contributing** — branch naming convention, commit conventions (conventional commits),
    how to run checks before pushing

**If any section is missing, incomplete, or still contains `<!-- TODO -->` markers:**

- Update `README.md` to fill in all gaps using knowledge gained during implementation
- Remove all TODO markers — every section must be fully written
- Commit: `docs: finalize README with complete onboarding guide`

Update state: `verification.readme_complete = true`

---

## Step 6: Verification Summary & Completion

After all API and UI verifications pass and README is complete:

Write a QA report summary to `docs/V{N}/qa-report.md` — one file per version, so the historical record of what V{N} looked like at completion is preserved inside V{N}'s own docs directory. Include: test suite results, scenarios tested per story, issues found/fixed (with commit SHAs), and a final verdict.

1. Stop the development server

2. Produce a verification report summarizing:
   - Total user stories verified: N/N
   - Total scenarios tested (API): X passed, Y failed
   - Total scenarios tested (UI): X passed, Y failed
   - Any issues found and fixed during verification (with commit SHAs)
   - Screenshots captured as evidence
   - README completeness: confirmed

3. **Update local state** (`docs/V{N}/plans/implementation-state.json`):

   ```json
   {
     "phase": "verified",
     "verification": {
       "...": "...",
       "completed_at": "2026-04-10T..."
     }
   }
   ```

4. **Write back to `project-tracking.json`** (read-merge-write, never overwrite other fields):

   Update the target version in `roadmap.versions`:

   ```json
   {
     "id": "V0",
     "verification": {
       "status": "passed",
       "verified_at": "2026-04-10",
       "stories_tested": 4,
       "scenarios_passed": 23,
       "scenarios_failed": 0
     }
   }
   ```

   Also update `project.updated_at` to the current timestamp.

5. **Output the completion signal** so the loop script can detect it:

   ```
   VERIFICATION_COMPLETE
   ```

---

## Autonomous Loop Execution

This skill is designed to be driven by a bash loop script that invokes `claude -p`
repeatedly, with each invocation reading the state file to determine where to resume.

### Example Loop Script

```bash
#!/bin/bash
VERSION=${1:?"Usage: $0 <version> (e.g., V0)"}
MAX_ITERATIONS=30
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== Iteration $ITERATION ==="

  OUTPUT=$(claude -p "Use the verification-and-validation skill to verify the completed implementation for version $VERSION. \
    Read docs/$VERSION/plans/implementation-state.json to determine where you left off. \
    Follow the skill steps: automated suite → start app → API curl verification → \
    UI Playwright verification → README check → summary → write back to project-tracking.json. \
    Fix any deviation you find before moving on." \
    --dangerously-skip-permissions)

  echo "$OUTPUT"

  # Stop if verification is complete
  if echo "$OUTPUT" | grep -q "VERIFICATION_COMPLETE"; then
    echo "=== Verification complete at iteration $ITERATION ==="
    break
  fi

  sleep 2
done
```

### How Each Iteration Works

1. The bash script invokes `claude -p` with the verification prompt and the target version
2. Claude reads the state file at `docs/V{N}/plans/implementation-state.json` → determines which step to resume
3. Does meaningful work (verifies one story's API scenarios, or one story's UI scenarios,
   or fixes a deviation)
4. Updates the state file
5. If all done → writes back to `project-tracking.json`, outputs `VERIFICATION_COMPLETE` (the bash script detects this and stops)
6. If not done → the script loops and invokes `claude -p` again

### Iteration Budget

Each iteration should aim to complete **one meaningful unit of work**:

- Run the automated suite baseline (Step 1-2)
- Verify one user story's API scenarios with curl (part of Step 3)
- Verify one user story's UI scenarios with Playwright (part of Step 4)
- Fix a deviation and re-verify the affected story

Don't try to do everything in one iteration. Let the loop handle continuity.

### The Fix-Then-Verify Loop

When a deviation is found (API returns wrong status code, UI shows wrong element, etc.):

1. Diagnose the root cause by reading the relevant source code
2. Fix the implementation
3. Run `bun test` to ensure no regressions
4. Re-run the specific curl or Playwright verification that failed
5. Commit the fix: `fix(US-NNN): <what was corrected>`
6. Continue to the next scenario

This is the key value of this skill: it doesn't just report problems, it **fixes them**.

---

## Commit Rules

All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
**Never** add a `Co-Authored-By` trailer — commits are authored solely by the developer.

Fixes discovered during verification use the `fix` type:

```
fix(US-001): correct status code for duplicate resource creation
fix(US-003): fix missing error message on empty form submission
fix(US-005): align card layout with wireframe grid spec
docs: finalize README with complete onboarding guide
```

---

## Decision Rules

### When to Fix vs. When to Flag

- **Always fix** — this skill's mandate is to leave the app matching its specs. If the
  deviation is clearly a bug or missed requirement, fix it.
- **Flag only** if the spec itself seems wrong (contradictory scenarios, impossible
  requirements). Log it in `state.verification.issues` and note that the spec needs
  review — but still implement the best interpretation.

### When to Ask the User

In autonomous loop mode, **never ask** — make a decision, fix the issue, and document
the decision in the state file.

Outside the loop:

- Ask when a spec seems contradictory
- Ask when a fix would require changing the architecture
