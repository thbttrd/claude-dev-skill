---
name: spec-implementation
version: 3.0.0
description: >
  Per-Operation GREEN-phase executor with story-end wrap-up gates. For ONE
  Operation of ONE story (US-NNN Op-X) at a time, writes the minimal
  implementation that makes that Operation's failing tests pass, then
  optionally REFACTORs. Operations are sequential: RED → GREEN → REFACTOR →
  next op. Reads PLAN.md (REASONS canvas Operation X) and state.json. The
  Op-X arg is optional; with no Op-X, the skill auto-picks the next op
  whose tests are RED but implementation is pending. When invoked without
  Op-X AND all ops are GREEN, the skill enters story-end mode and runs the
  three story-level quality gates (Simplify / Code Review / Verify), then
  flips the story's phase to "green" in specs/stories.json. If invoked for
  the Foundation Story (US-000) against an empty repo where state phase =
  planned, auto-chains /repo-initialization first. Tracks progress in
  specs/story-NNN-slug/state.json. Use after /test-setup US-NNN Op-X (Op-X
  is RED). Triggers on: "implement Op-X", "GREEN Op-2 of US-001",
  "spec-implement next op", "/spec-implementation US-NNN", "/spec-implementation
  US-NNN Op-X", "run the story-end gates for US-NNN".
---

# Spec Implementation (per Operation, with story-end wrap-up gates)

Executes a story's `PLAN.md` against its pre-written failing tests, **one Operation at a time**. Each invocation processes a single Op's GREEN (and optional REFACTOR), then exits — the next invocation picks up the next Op. Once every Operation in the story is GREEN, invoking this skill **without an `Op-X` arg** runs the three story-level quality gates (Simplify, Code Review, Verify) and flips the story's project-level `phase` to `"green"`.

The story is the unit of *planning, audit, and shipping*. The Operation is the unit of *execution*. Quality gates run per story, not per Op.

The architecture principle: `specs/ARCHITECTURE.md` defines the structure. All code follows module boundaries and dependency rules — `/spec-implementation` does not invent module placements; it follows what `PLAN.md`'s Structure section prescribes.

The UI principle: mockups and screen specs define the look and feel. UI components follow `specs/DESIGN.md` tokens and the per-screen mockups in `specs/story-NNN-slug/mockups/`.

---

## Pre-Flight

| Check                                                                | Action                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                                          | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist                                  | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                                              | Ask via `AskUserQuestion` (default: stories whose `phase = red`).                                                                              |
| Story's `phase` is not `red` or `green`                              | Hard-stop unless story is `US-000` AND `phase = planned` AND repo is empty (see Foundation Auto-Chain below).                                  |
| `specs/story-NNN-slug/PLAN.md` does not exist                        | Hard-stop with the appropriate message.                                                                                                         |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop with the dependency name and the suggested fix.                                                                |
| `state.json.schema_version < 2`                                      | Run the v1 → v2 migration (see `references/state-schema.md`) atomically, then continue.                                                         |

### Foundation Auto-Chain

When `id = "US-000"`, `phase = "planned"`, and the repo is empty (no `package.json`, or only the bare git skeleton):

1. Print: `Foundation Story detected on empty repo. Chaining /repo-initialization first.`
2. Invoke `/repo-initialization` via the `Skill` tool. It will scaffold the project, run its quality gates, and return.
3. After `/repo-initialization` returns successfully, **stop** and print:
   ```
   Repo scaffolded successfully. Story US-000 is still at phase = planned (no tests written yet).
   Next steps:
     /test-setup US-000 Op-1            # write the failing tests for US-000's first Operation
     /spec-implementation US-000 Op-1   # GREEN that Operation
   ```
   Do not silently chain `/test-setup`. Surface the next step explicitly so the user can review the scaffold before tests are written on top of it.

For any other story, the user must run the prerequisite skills explicitly. The auto-chain is **only** for the Foundation Story on a fresh repo, and **only** chains `/repo-initialization`.

---

## Resolving the target Operation (or story-end mode)

The skill accepts `/spec-implementation US-NNN [Op-X]`. The picker logic:

```
If Op-X passed explicitly:
  Validate Op-X exists in PLAN.md.
  If Op-X.operation_phase = green AND not --force → "Op-X is already green. Pass --force to redo."
  Elif Op-X.operation_phase ≠ red                  → "Op-X is not RED yet. Run /test-setup US-NNN Op-X first."
  Else                                              → enter PER-OP MODE for Op-X.

If no Op-X arg:
  If any op.operation_phase = red AND implementation_status ≠ green:
    Pick first such op → enter PER-OP MODE.
  Elif all ops ∈ {green, refactored} AND quality_gates not all true:
    → enter STORY-END MODE (run Simplify + Code Review + Verify).
  Elif all gates true:
    → "Story is GREEN. Run /verification-and-validation US-NNN."
  Else:
    → "Nothing to implement. State: <summary>."
```

The picker writes its choice to `state.json.current_operation`.

---

## Integration with `specs/stories.json`

**Reading:** the target story, its phase, dependencies, plan, and feature files.

**Writing back:**

- After **per-op GREEN/REFACTOR**: nothing in `stories.json` (per-Op churn is in `state.json` only).
- After **story-end gates pass** (the only `stories.json` write owned by this skill):
  - `stories[i].implementation = { started_at: <when first per-op GREEN ran>, completed_at: "<today>", last_commit: "<sha>" }`
  - `stories[i].phase = "green"`
  - Append `{ phase: "green", at: "<today>" }` to `stories[i].history`
  - Update `project.updated_at`
  - Regenerate `specs/STORIES.md`

---

## Per-Story State File

`specs/story-NNN-slug/state.json` (v2). Full schema in `references/state-schema.md`. Key fields this skill writes:

- `operations[Op-X].operation_phase` — advances `red → green → refactored`
- `operations[Op-X].implementation_status` — flips to `"green"` after GREEN commit
- `operations[Op-X].green_audit` — populated by `/spec-implementation-verification`
- `current_operation` — cursor for the smart default
- `quality_gates.{simplified, reviewed, verified}` — flipped during story-end mode
- `implementation.{started_at, completed_at, operations_green, last_commit, ops_completed}` — incremental story-level summary
- `phase_local` — `executing` (sticky) → `verifying` (after story-end gates pass)

---

## Execution: PER-OP MODE

For one Operation Op-X (resolved by the picker), execute these phases in order; commit after each.

### Phase 1 — Confirm RED state (Op-X scope only)

Run the Op-X-filtered suites:

- `bun bdd --tags="@US-NNN and @Op-X"`
- `bun test --grep="@US-NNN.*@Op-X"`

Both MUST FAIL (these were written by `/test-setup US-NNN Op-X`). If any test passes, something is off — investigate before proceeding (likely an earlier Op accidentally implemented this Op's behaviour, or the test is misclassified).

### Phase 2 — GREEN: write the minimum implementation

Read PLAN.md's `### Operation X — <title>` section, focusing on the GREEN sub-section. It states the file paths to create/modify and what each file should do.

Constraints:

- Place code in the correct module per `specs/ARCHITECTURE.md` and PLAN.md's Structure section.
- For UI: follow `specs/story-NNN-slug/mockups/UI-F-*.html` + `specs/DESIGN.md` tokens.
- No features beyond what Op-X's tests demand. Do not implement behaviour that's only justified by future Operations.
- Reuse types, fakes, utilities, and stubs from earlier Operations — do not redeclare.

After writing the code, run:

- `bun test --grep="@US-NNN"` — full per-story suite. Op-X's tests must pass; earlier Ops' tests must still pass.
- `bun bdd --tags="@US-NNN"` — same.
- For previously verified stories, run their tags too (or run the unfiltered suite if it's fast enough). NO regressions allowed.

If anything fails:

- If failures are in Op-X's own tests, the implementation is wrong — fix it.
- If failures are in earlier Ops', the implementation likely violated a module boundary or shared invariant — fix it.
- If failures are in previously verified stories, this is a regression — back out and re-think.

When green, commit:

```
feat(US-NNN): implement Op-X — <operation title>
```

(Or `feat(foundation): <what>` for shared infrastructure inside US-000.)

### Phase 3 — REFACTOR (optional, only if PLAN.md prescribes)

If the Operation's REFACTOR sub-section is non-empty, perform it now: clean obvious duplication, improve names, extract helpers — without changing behaviour.

After refactoring:

- `bun test --grep="@US-NNN"` — still passes.
- `bun bdd --tags="@US-NNN"` — still passes.
- Module boundary compliance — no cross-BM imports introduced.

Commit:

```
refactor(US-NNN): Op-X — <what>
```

### Phase 4 — Update state.json (per-op)

After GREEN (and optional REFACTOR):

- `Op-X.operation_phase = "refactored"` (or `"green"` if no refactor done)
- `Op-X.implementation_status = "green"`
- `Op-X.completed_at = <now>`
- `summary.operations_green++`, `summary.last_commit = <sha>`
- `implementation.operations_green++`
- `implementation.last_commit = <sha>`
- `implementation.ops_completed.append("Op-X")`
- `implementation.started_at = <now>` (only on the very first GREEN; do not overwrite if already set)
- For every `test_plan_rows[T-N]` where `op = "Op-X"`: set `passing = true`
- Advance `current_operation` to the next op where `operation_phase = "red"`, or `null` if every Op is now GREEN

### Phase 5 — Report and offer next step

```
US-NNN — Op-X GREEN
  Files implemented:  N (<paths>)
  Optional REFACTOR:  Yes/No
  Operation phase:    green | refactored
  Story progress:     <K of N> Ops GREEN
  Next pending op:    Op-(X+1) | (none — story-end gates available)
```

Use `AskUserQuestion`:

- **Header: "Next"** — "Op-X is GREEN. What's next?"
  - "Verify Op-X — run /spec-implementation-verification US-NNN Op-X" (Recommended)
  - "Move to next op — /test-setup US-NNN" (auto-picks next pending op for RED)
  - "Run story-end gates" (only shown when every op is GREEN — Simplify + Code Review + Verify)
  - "Done for now"

If running in a ralph-loop, skip the AskUserQuestion and emit `<promise>GREEN_COMPLETE_US-NNN_Op-X</promise>`. If every Op is now GREEN, also emit `<promise>STORY_OPS_COMPLETE_US-NNN</promise>` so the loop knows story-end mode is next.

### When an Operation Fails

1. Log the error in `state.json.errors[]`.
2. Set `Op-X.implementation_status = "blocked"`. Leave `operation_phase` at `red`.
3. If running outside ralph-loop, ask the user; otherwise mark and exit so the next loop iteration can retry.

---

## Execution: STORY-END MODE

Triggered when the picker resolves to "all ops green AND quality_gates not all true". Runs **once per story**.

### Gate 1 — Simplify

Invoke the marketplace's Simplify skill (or `/simplify`) on files modified during this story.

```bash
git diff --name-only $BASE_SHA..HEAD | grep -v '^specs/'
```

`BASE_SHA` is the parent of the first `test(US-NNN):` commit (the very first commit of `/test-setup US-NNN Op-1`). Re-run the full per-story suite (`bun test --grep="@US-NNN"` + `bun bdd --tags="@US-NNN"`) afterwards; everything must still pass. If Simplify made commits, also run the unfiltered suite to confirm no other regressions.

Update `state.json.quality_gates.simplified = true`.

### Gate 2 — Code Review

Dispatch a code-review subagent. The diff range is `BASE_SHA → HEAD_SHA` for this story (the SHA before the first `test(US-NNN):` commit through the latest `refactor(US-NNN):` or `feat(US-NNN):` commit).

The reviewer audits the whole story's diff for:

- Architecture compliance (no cross-BM imports, module boundaries respected, public APIs only).
- Norms compliance (naming, logging, defensive coding per PLAN.md's N section).
- Safeguards compliance (invariants, performance, security, data rules from PLAN.md's second S section).
- Code quality (no obvious bugs, no missed edge cases, no over-implementation beyond Op scope).

Act on critical findings; warnings are at the user's discretion. Update `state.json.quality_gates.reviewed = true`. Persist findings to `state.json.quality_gates.review_findings`.

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

Populate `state.json.quality_gates.verification_results` with each check's outcome.

Update `state.json.quality_gates.verified = true`.

### Story Completion

When all three `quality_gates.{simplified, reviewed, verified}` are `true`:

1. `state.json.phase_local = "verifying"`.
2. `state.json.implementation.completed_at = <now>`.
3. Sync to `specs/stories.json`:
   - `stories[i].implementation = { started_at, completed_at, last_commit }` (and any other fields preserved).
   - `stories[i].phase = "green"`.
   - Append `{ phase: "green", at: "<today>" }` to `stories[i].history`.
   - Update `project.updated_at`.
4. Regenerate `specs/STORIES.md`.
5. Emit `<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>` for ralph-loop detection.
6. Use `AskUserQuestion`:
   - **Header: "Done"** — "US-NNN is GREEN. What's next?"
     - "Run /spec-implementation-verification US-NNN" — story-end full audit (Recommended)
     - "Run /verification-and-validation US-NNN" — final E2E pass that flips `phase` to `verified`
     - "Pick the next story" — based on `stories.json`, propose stories whose dependencies are now satisfied
     - "Done for now"

---

## Autonomous Loop Execution

Designed for a bash loop that invokes `claude -p` repeatedly:

```bash
#!/bin/bash
STORY="${1:-US-001}"
MAX_ITERATIONS=30
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== Iteration $ITERATION ==="

  OUTPUT=$(claude -p "Use the spec-implementation skill on $STORY. \
    Read specs/story-${STORY:3}-*/state.json to determine where you left off. \
    Follow: pre-flight → smart-default picker → per-op mode OR story-end mode → state.json updates." \
    --dangerously-skip-permissions)

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "IMPLEMENTATION_COMPLETE_$STORY"; then
    echo "=== $STORY complete at iteration $ITERATION ==="
    break
  fi

  sleep 2
done
```

Each iteration completes exactly one meaningful unit of work: one Operation's GREEN+REFACTOR, one quality gate, or the final story sync.

---

## Commit Rules

Conventional Commits. Scope is the user story id (`US-NNN`). For shared infrastructure inside US-000, use `foundation` as scope.

```
feat(US-001): implement Op-1 — login form and auth flow
refactor(US-001): Op-1 — extract form validation helper
feat(US-001): implement Op-2 — submit handler with retry
fix(US-003): correct percentage calculation
refactor(foundation): extract shared DB connection pool
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

### `--force`

`--force` re-implements an Op already at `green` or `refactored`. Useful when PLAN.md is edited mid-flight and an Op's expected behaviour changed. Without `--force`, the picker would skip the op.

---

## What this skill does NOT do

- It does not write tests (`/test-setup` does that).
- It does not flip `phase` to `verified` (`/verification-and-validation` does that).
- It does not loop over multiple Operations in a single per-op invocation — one invocation, one Op (or one story-end gates pass).
- It does not skip the story-end gates — they are mandatory for every story.
