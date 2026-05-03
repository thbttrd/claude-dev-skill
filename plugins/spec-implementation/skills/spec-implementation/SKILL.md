---
name: spec-implementation
version: 2.0.0
description: >
  Per-story GREEN-phase executor. For ONE story (US-NNN) at a time, writes the
  minimal implementation code that makes every pre-written failing test pass.
  Reads the story's PLAN.md (REASONS canvas Operations), executes Operations
  one at a time (RED-A → RED-B → GREEN → REFACTOR), and runs per-story quality
  gates (Simplify / Code Review / Verify) at the end. If invoked for the
  Foundation Story (US-000) against an empty repo where state phase = planned,
  auto-chains /repo-initialization first. Tracks progress in
  specs/story-NNN-slug/state.json and updates specs/stories.json on completion.
  Use this skill after /test-setup US-NNN (tests in RED state). Triggers on:
  "implement US-NNN", "make the tests pass for the story", "GREEN phase for
  US-NNN", "/spec-implementation US-NNN", or any request to execute a story's
  PLAN.md against its failing tests.
---

# Spec Implementation (per story)

Executes a story's `PLAN.md` against its pre-written failing tests, writing the minimal code that makes each Test Plan row turn green. Works **one Operation at a time** — each Operation is a TDD cycle.

The skill reads PLAN.md's **Operations** section and executes them in order:

1. Confirm RED-A and RED-B tests are failing (the previous skill, `/test-setup`, wrote them).
2. Write the GREEN implementation (minimal code) per the Operation's GREEN section.
3. Run all tests for the story; ALL must pass; no regressions in previously verified stories.
4. Optionally REFACTOR (clean naming, extract obvious duplication; tests still pass).
5. Commit the Operation as `feat(US-NNN): implement <what>` (and optionally `refactor(US-NNN): <what>`).

After all Operations are GREEN, run the per-story quality gates: Simplify, Code Review, Verify. Then transition the story's `phase` to `green` in `specs/stories.json`.

The architecture principle: `specs/ARCHITECTURE.md` defines the structure. All code follows module boundaries and dependency rules — `/spec-implementation` does not invent module placements; it follows what `PLAN.md`'s Structure section prescribes.

The UI principle: mockups and screen specs define the look and feel. UI components follow `specs/DESIGN.md` tokens and the per-screen mockups in `specs/story-NNN-slug/mockups/`.

---

## Pre-Flight

| Check                                                                | Action                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                                              | Ask via `AskUserQuestion` (default: stories whose `phase = red`).                                                                              |
| Story's `phase` is not `red`                                         | Hard-stop unless story is `US-000` AND `phase = planned` AND repo is empty (see Foundation Auto-Chain below).                                  |
| `specs/story-NNN-slug/PLAN.md` does not exist                        | Hard-stop with the appropriate message.                                                                                                         |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop with the dependency name and the suggested fix.                                                                |

### Foundation Auto-Chain

When `id = "US-000"`, `phase = "planned"`, and the repo is empty (no `package.json`, or only the bare git skeleton):

1. Print: `Foundation Story detected on empty repo. Chaining /repo-initialization first.`
2. Invoke `/repo-initialization` via the `Skill` tool. It will scaffold the project, run its quality gates, and return.
3. After `/repo-initialization` returns successfully, **stop** and print:
   ```
   Repo scaffolded successfully. Story US-000 is still at phase = planned (no tests written yet).
   Next steps:
     /test-setup US-000          # write the failing tests for the Foundation Story
     /spec-implementation US-000 # re-invoke this skill to GREEN
   ```
   Do not silently chain `/test-setup`. Surface the next step explicitly so the user can review the scaffold before tests are written on top of it.

For any other story, the user must run the prerequisite skills explicitly (`/test-setup US-NNN`). The auto-chain is **only** for the Foundation Story on a fresh repo, and **only** chains `/repo-initialization` — exactly as documented in `PROPOSAL-story-based-workflow.md` §9.

---

## Integration with `specs/stories.json`

**Reading:** the target story, its phase, dependencies, plan, and feature files.

**Writing back** at key milestones:

- After **Operation completes**: nothing in `stories.json` (operations are tracked in the per-story `state.json`).
- After **all Operations GREEN + quality gates pass**:
  - `stories[i].implementation = { started_at: <when GREEN started>, completed_at: "<today>" }`
  - `stories[i].phase = "green"`
  - Append `{ phase: "green", at: "<today>" }` to `stories[i].history`
  - Update `project.updated_at`
  - Regenerate `specs/STORIES.md`

---

## Per-Story State File

`specs/story-NNN-slug/state.json` (created by `/test-setup`, updated here):

```json
{
  "story_id": "US-NNN",
  "phase_local": "executing",
  "operations": {
    "Op-1": { "title": "...", "tests_status": "red", "implementation_status": "pending|in_progress|green" },
    "Op-2": { "title": "...", "tests_status": "red", "implementation_status": "pending" }
  },
  "quality_gates": {
    "simplified": false,
    "reviewed": false,
    "verified": false
  },
  "errors": []
}
```

Update after every Operation. Operations are sequential within a story — no parallelism. (Cross-story parallelism is governed by `depends_on_story_ids` in `specs/stories.json`, not by this skill.)

---

## Execution: GREEN Operation by Operation

For each Operation in PLAN.md:

1. **Update state**: set the Operation's `implementation_status = "in_progress"`.

2. **Confirm RED state**: run the Operation's BDD + unit tests. They must FAIL (as written by `/test-setup`). If any pass, something is off — investigate before proceeding.

3. **GREEN: Write minimal implementation**:
   - Follow PLAN.md's GREEN section: file paths, what each file does, how it connects.
   - Place code in the correct module per `specs/ARCHITECTURE.md` and PLAN.md's Structure section.
   - For UI: follow `specs/story-NNN-slug/mockups/UI-F-*.html` + `specs/DESIGN.md` tokens.
   - No features beyond what the tests demand.
   - Run all tests for the story → ALL must pass.
   - Run the full test suite (filtered to story tag + previously verified stories) → no regressions.
   - Commit: `feat(US-NNN): implement <what>` (or `feat(foundation): <what>` for shared infrastructure inside US-000).

4. **REFACTOR (if PLAN.md prescribes one)**:
   - Clean obvious duplication, improve names.
   - Ensure module boundary compliance (no cross-BM imports introduced).
   - Run full suite again — still passes.
   - Commit: `refactor(US-NNN): <what>`.

5. **Update state**: set the Operation's `implementation_status = "green"`.

### Parallelism within a Story

There is none. Operations within a story are sequential. The DAG-level parallelism happens between stories, not within them.

### When an Operation Fails

1. Log the error in `state.json.errors`.
2. If a downstream Operation depends on this one (PLAN.md typically orders Operations so they don't), pause the story and surface the issue.
3. If running outside ralph-loop, ask the user; otherwise mark the story `blocked` and exit so the next loop iteration can retry.

---

## After All Operations Are GREEN: Quality Gates

The three gates run **once per story** (not per wave; waves are gone).

### Gate 1 — Simplify

Invoke `/simplify` (or the marketplace's Simplify skill) on files created/modified during this story. Re-run the full test suite afterwards; everything must still pass. Update `state.json.quality_gates.simplified = true`.

### Gate 2 — Code Review

Dispatch a code-review subagent. The review's diff range is `BASE_SHA → HEAD_SHA` for this story (the SHA before the first `feat(US-NNN):` commit through the latest `refactor(US-NNN):` commit). Act on critical findings; warnings are at the user's discretion. Update `state.json.quality_gates.reviewed = true`.

### Gate 3 — Story Verification (end-to-end)

Run the per-story Verification checklist from PLAN.md:

1. `bun test` — all unit + integration tests pass (story + previously verified stories).
2. `bun bdd` — all Gherkin scenarios for this story pass; previously verified stories don't regress.
3. `bun lint && bun typecheck` — clean.
4. Start the app: `bun dev`.
5. Run the per-story `curl` walkthrough (`./verification/curl-walkthrough.sh` if present).
6. (If UI) Run the Playwright walkthrough described in STORY.md AC. Use Playwright MCP if available.
7. Verify architecture compliance: files in correct modules, no cross-module violations.
8. (If UI) Verify visual compliance: mockup layouts followed, design tokens applied.

Update `state.json.quality_gates.verified = true`.

---

## Story Completion

When all Operations are `implementation_status = "green"` and all three quality gates passed:

1. Mark `state.json.phase_local = "green"`.
2. Update `specs/stories.json`: set `stories[i].implementation`, flip `phase` to `"green"`, append history.
3. Regenerate `specs/STORIES.md`.
4. **Output**: `<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>` so a ralph-loop can detect.
5. Use `AskUserQuestion`:
   - **Header: "Done"** — "US-NNN is GREEN. What's next?"
     - "Run /verification-and-validation US-NNN (Recommended)" — the final E2E pass that flips `phase` to `verified`
     - "Pick the next story" — based on `stories.json`, propose stories whose dependencies are now satisfied
     - "Code review another round" — re-dispatch the review subagent
     - "Done for now"

---

## Autonomous Loop Execution

The skill is designed for a bash loop that invokes `claude -p` repeatedly:

```bash
#!/bin/bash
STORY="${1:-US-001}"
MAX_ITERATIONS=30
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== Iteration $ITERATION ==="

  OUTPUT=$(claude -p "Use the spec-implementation skill to execute the plan for $STORY. \
    Read specs/story-${STORY:3}-*/state.json to determine where you left off. \
    Follow: pre-flight → GREEN per Operation → quality gates → story completion." \
    --dangerously-skip-permissions)

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "IMPLEMENTATION_COMPLETE_$STORY"; then
    echo "=== $STORY complete at iteration $ITERATION ==="
    break
  fi

  sleep 2
done
```

Each iteration should complete one meaningful unit of work: one Operation, one quality gate, or the final story completion.

---

## Commit Rules

Conventional Commits. Scope is the user story id (`US-NNN`). For shared infrastructure inside US-000, use `foundation` as scope.

```
test(US-001): add failing test for login validation
feat(US-001): implement login form and auth flow
refactor(US-001): extract form validation helper
fix(US-003): correct percentage calculation
refactor(foundation): extract shared DB connection pool
chore(US-001): transition to green, all tests passing
```

NEVER add a `Co-Authored-By` trailer.

---

## Decision Rules

### When to use subagents

- **Code Review gate (Gate 2)**: always — fresh context prevents blind spots.
- **Simplify gate (Gate 1)**: inline (lightweight).
- **Verify gate (Gate 3)**: inline (just running commands).

### When to ask the user

- Ralph-loop mode: never — decide and document in `state.json`.
- Outside the loop: ask when tests are ambiguous about expected behaviour, or when the architecture would need to change to make a test pass (re-invoke `/research-and-architecture` for a divergence ADR).

### When to skip a quality gate

Never. All three gates are mandatory for every story.
