---
name: spec-implementation
version: 3.3.0
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

The story is the unit of _planning, audit, and shipping_. The Operation is the unit of _execution_. Quality gates run per story, not per Op.

The architecture principle: `specs/ARCHITECTURE.md` defines the structure. All code follows module boundaries and dependency rules — `/spec-implementation` does not invent module placements; it follows what `PLAN.md`'s Structure section prescribes.

The UI principle: mockups and screen specs define the look and feel. UI components follow `specs/DESIGN.md` tokens and the per-screen mockups in `specs/story-NNN-slug/mockups/`.

---

## Pre-Flight

| Check                                                                                    | Action                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                                                              | Hard-stop with the migration command.                                                                                                                                                                                                                                      |
| `specs/stories.json` does not exist                                                      | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                                                                                                                                            |
| Target story id missing                                                                  | Ask via `AskUserQuestion` (default: stories whose `phase = red`).                                                                                                                                                                                                          |
| Story's `phase` is not `red` or `green`                                                  | Hard-stop unless story is `US-000` AND `phase = planned` AND repo is empty (see Foundation Auto-Chain below).                                                                                                                                                              |
| `specs/story-NNN-slug/PLAN.md` does not exist                                            | Hard-stop with the appropriate message.                                                                                                                                                                                                                                    |
| Any dependency in `depends_on_story_ids` is not `verified` and not `is_foundation: true` | Hard-stop with the dependency name and the suggested fix.                                                                                                                                                                                                                  |
| `state.json.schema_version < 2`                                                          | Run the v1 → v2 migration (see `references/state-schema.md`) atomically, then continue.                                                                                                                                                                                    |
| `specs/autopilot.json` has `"active": true` (or env `AUTOPILOT=1`)                       | Follow `references/autopilot-contract.md` §1–2 for this whole invocation: no `AskUserQuestion`, take the _(Recommended)_ option, journal decisions and gates, stop only on the contract's hard conditions. Journaling (§3) and toolchain resolution (§4) apply regardless. |

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
  If any op.operation_phase = red (or tests_status = "manual" and implementation_status ≠ green):
    Pick first such op → enter PER-OP MODE.
  Elif all ops ∈ {green, refactored} AND quality_gates not all true:
    → enter STORY-END MODE (run Simplify + Code Review + Verify).
  Elif all gates true:
    → "Story is GREEN. Run /verification-and-validation US-NNN."
  Else:
    → "Nothing to implement. State: <summary>."
```

The cursor rule is shared: `current_operation` = first Op whose `operation_phase ∉ {green, refactored}`; `null` only when every Op is GREEN.

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

- `<BDD>` with the Op filter (contract §4)
- `<TEST> -t "@US-NNN.*@Op-X"`

Both MUST FAIL (these were written by `/test-setup US-NNN Op-X`). If any test passes, something is off — investigate before proceeding (likely an earlier Op accidentally implemented this Op's behaviour, or the test is misclassified).

Ops whose rows are all `manual` have nothing to run here; proceed to GREEN (the deliverable is the artefact the manual rows describe).

### Phase 2 — GREEN: write the minimum implementation

Read PLAN.md's `### Operation X — <title>` section, focusing on the GREEN sub-section. It states the file paths to create/modify and what each file should do.

Constraints:

- Place code in the correct module per `specs/ARCHITECTURE.md` and PLAN.md's Structure section.
- For UI: follow `specs/story-NNN-slug/mockups/UI-F-*.html` + `specs/DESIGN.md` tokens.
- No features beyond what Op-X's tests demand. Do not implement behaviour that's only justified by future Operations.
- Reuse types, fakes, utilities, and stubs from earlier Operations — do not redeclare.

After writing the code, run:

- `<TEST> -t "@US-NNN"` and `<BDD>` (story filter) — Op-X's tests pass; earlier Ops' tests still pass.
- Regression baseline (contract §4): `RPT=$(mktemp) && node "$LEDGER" regress --base HEAD --runner vitest --cmd "<TEST> --reporter=json --outputFile=$RPT" --report-file "$RPT"` and the cucumber equivalent. Exit 0 required. A regression in a story already `verified` is hard stop `regression` under autopilot; otherwise back out and re-think.

If anything fails:

- If failures are in Op-X's own tests, the implementation is wrong — fix it.
- If failures are in earlier Ops', the implementation likely violated a module boundary or shared invariant — fix it.
- If failures are in previously verified stories, this is a regression — back out and re-think.

When green, commit:

```
feat(US-NNN): implement Op-X — <operation title>
```

(Or `feat(foundation): <what>` for shared infrastructure inside US-000.)

Journal: `node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "feat(US-NNN): implement Op-X"` (contract §3, §5).

### Phase 3 — REFACTOR (optional, only if PLAN.md prescribes)

If the Operation's REFACTOR sub-section is non-empty, perform it now: clean obvious duplication, improve names, extract helpers — without changing behaviour.

After refactoring:

- `<TEST> -t "@US-NNN"` — still passes.
- `<BDD>` (story filter) — still passes.
- Module boundary compliance — no cross-BM imports introduced.

Commit:

```
refactor(US-NNN): Op-X — <what>
```

Journal: `node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "refactor(US-NNN): Op-X"` (contract §3, §5).

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
- For every `test_plan_rows[T-N]` where `op = "Op-X"` and `type ≠ "manual"`: set `passing = true`.
- Advance `current_operation` to the first Op whose `operation_phase ∉ {green, refactored}`, or `null` if every Op is now GREEN.

### Phase 5 — Self-Review, Report and offer next step

**Self-review (mandatory).** Before reporting, verify and print as a compact checked list:

- [ ] Op-X's tests all pass, and the full per-story suite was re-run — earlier Ops' tests still pass
- [ ] The implementation stays inside Op-X's scope — no logic justified only by a future Op
- [ ] Every file touched sits in the module PLAN.md assigns it to; no cross-module imports
- [ ] Lint + typecheck clean

Fix failures before proceeding. This is the default GREEN gate; `/spec-implementation-verification` is an opt-in deep audit on top of it.

Journal the self-review: `node "$LEDGER" log --kind gate --gate self-review --verdict <PASS|PASS_WITH_WARNINGS> --story US-NNN --op Op-X --stage spec-implementation --summary "<n>/4 checks"` (contract §3, §5). Any unchecked item not fixed → `node "$LEDGER" backlog add --title "<unchecked item>" --severity warning --kind <bug|test-gap|refactor> --story US-NNN --op Op-X`.

```
US-NNN — Op-X GREEN
  Files implemented:  N (<paths>)
  Optional REFACTOR:  Yes/No
  Operation phase:    green | refactored
  Story progress:     <K of N> Ops GREEN
  Next pending op:    Op-(X+1) | (none — story-end gates available)
```

Outside autopilot, use `AskUserQuestion`:

- **Header: "Next"** — "Op-X is GREEN. What's next?"
  - "Move to next op — /test-setup US-NNN" (Recommended; auto-picks next pending op for RED)
  - "Deep-audit Op-X — /spec-implementation-verification US-NNN Op-X" (opt-in; worth it for `US-000` and full-rigor Ops touching security, data rules, or tricky invariants)
  - "Run story-end gates" (only shown when every op is GREEN — Simplify + Code Review + Verify)
  - "Done for now"

Under autopilot (contract §2), skip the question and emit `<promise>GREEN_COMPLETE_US-NNN_Op-X</promise>`; if every Op is now GREEN also emit `<promise>STORY_OPS_COMPLETE_US-NNN</promise>` so autopilot knows story-end mode is next.

### When an Operation Fails

1. Log the error in `state.json.errors[]`.
2. Set `Op-X.implementation_status = "blocked"`. Leave `operation_phase` at `red`.
3. Journal `--kind action --summary "Op-X blocked: <error>"`. Outside autopilot ask the user; under autopilot retry once from Phase 1 (journal `retry 1/2`), then a second time (`retry 2/2`); still failing → hard stop `op_blocked` (contract §2).

---

## Execution: STORY-END MODE

Triggered when the picker resolves to "all ops green AND quality_gates not all true". Runs **once per story**.

### Gate 1 — Simplify

If `state.json.quality_gates.simplified` is already `true` (the `/autopilot` conductor ran the `lazy-simplifier` stage), skip this gate.

`BASE_SHA` is the parent of the first `test(US-NNN):` commit (the very first commit of `/test-setup US-NNN Op-1`).

Otherwise, dispatch the agent:

```
Agent({ subagent_type: "lazy-simplifier", prompt: "Simplify story US-NNN. BASE_SHA=<sha>." })
```

The agent scopes itself to `git diff $BASE_SHA..HEAD | grep -v '^specs/'`, re-runs the full per-story suite plus `ledger regress` — everything must still pass — commits its own simplifications, journals the gate, and sets `state.json.quality_gates.simplified = true` itself; this skill does not write either.

After the agent returns, re-read `state.json.quality_gates.simplified`. If it is not `true`, treat the gate as failed: outside autopilot, ask the user; under autopilot, journal an action and run the fallback below once.

**Fallback** (the Agent tool refuses `subagent_type: "lazy-simplifier"` — `autopilot` is not installed — or the gate failed above): invoke the marketplace's Simplify skill (or `/simplify`) on files modified during this story inline.

```bash
git diff --name-only $BASE_SHA..HEAD | grep -v '^specs/'
```

Re-run the full per-story suite (`<TEST> -t "@US-NNN"` + `<BDD>` story filter) afterwards; everything must still pass. If Simplify made commits, also run the unfiltered suite to confirm no other regressions.

Update `state.json.quality_gates.simplified = true`. Journal the gate: `node "$LEDGER" log --kind gate --gate simplify --verdict PASS --summary "<n> files simplified"`. Every simplification deliberately not applied → `node "$LEDGER" backlog add --title "<one line>" --kind simplification --severity info`.

### Gate 2 — Code Review

If `state.json.quality_gates.reviewed` is already `true` (the `/autopilot` conductor ran the `story-reviewer` stage), skip this gate.

Otherwise, dispatch the agent:

```
Agent({ subagent_type: "story-reviewer", prompt: "Review story US-NNN. BASE_SHA=<sha>." })
```

The diff range is `BASE_SHA → HEAD_SHA` for this story (the SHA before the first `test(US-NNN):` commit through the latest `refactor(US-NNN):` or `feat(US-NNN):` commit). The reviewer audits the whole story's diff for:

- Architecture compliance (no cross-BM imports, module boundaries respected, public APIs only).
- Norms compliance (naming, logging, defensive coding per PLAN.md's N section).
- Safeguards compliance (invariants, performance, security, data rules from PLAN.md's second S section).
- Code quality (no obvious bugs, no missed edge cases, no over-implementation beyond Op scope).

The agent fixes criticals in place, files warnings as backlog items, persists the ids in `state.json.quality_gates.review_findings[]`, journals the gate verdict, and sets `state.json.quality_gates.reviewed = true` itself; this skill does not write any of those.

After the agent returns, re-read `state.json.quality_gates.reviewed`. If it is not `true`, treat the gate as failed: outside autopilot, ask the user; under autopilot, journal an action and run the fallback below once.

**Fallback** (the Agent tool refuses `subagent_type: "story-reviewer"` — `autopilot` is not installed — or the gate failed above): dispatch a `general-purpose` subagent with the same audit bullet list above.

Act on critical findings. Every warning not acted on → `node "$LEDGER" backlog add --title "<one line>" --kind <bug|refactor|…> --severity warning --gate code-review --report <path>`; persist the ids in `state.json.quality_gates.review_findings[]`. Journal the gate verdict. Update `state.json.quality_gates.reviewed = true`.

### Gate 3 — Story Verification (end-to-end)

Run the per-story Verification checklist from PLAN.md:

1. `<TEST>` — unit + integration (story + previously verified stories) — evaluated through `node "$LEDGER" regress --base $BASE_SHA …` (contract §4): zero regressions.
2. `<BDD>` — same, cucumber runner.
3. `<LINT> && <TYPES>` — clean (skip with a journaled decision if the script is absent).
4. Architecture compliance: files in the modules PLAN.md's Structure assigns; no cross-module imports (`<LINT>` boundary rules if present, else grep imports).

Live-app checks (start the app, `curl`, Playwright, visual compliance) belong to `/verification-and-validation` only — do not duplicate them here.

Populate `state.json.quality_gates.verification_results` with `{ tests_regressions, bdd_regressions, lint_passed, types_passed, architecture_ok }`.

Update `state.json.quality_gates.verified = true`. Journal the gate: `node "$LEDGER" log --kind gate --gate verify --verdict PASS --summary "<n>/4 checks"` (contract §3, §5).

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
5. Emit `<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>`.
6. Outside autopilot, use `AskUserQuestion`:
   - **Header: "Done"** — "US-NNN is GREEN. What's next?"
     - "Run /verification-and-validation US-NNN (Recommended)" — the mandatory final E2E pass that flips `phase` to `verified`
     - "Run /spec-implementation-verification US-NNN" — opt-in story-end deep audit on top of the three gates just passed; worth it for `US-000` and high-stakes full-rigor stories
     - "Pick the next story" — based on `stories.json`, propose stories whose dependencies are now satisfied
     - "Done for now"

---

## Autonomous Loop Execution

Unattended runs are driven by `/autopilot` (see `references/autopilot-contract.md`). The legacy `claude -p` bash loop still works: it just needs `AUTOPILOT=1` in the environment.

```bash
#!/bin/bash
STORY="${1:-US-001}"
MAX_ITERATIONS=30
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== Iteration $ITERATION ==="

  OUTPUT=$(AUTOPILOT=1 claude -p "Use the spec-implementation skill on $STORY. \
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

---

## Decision Rules

### When to use subagents

Gate 1: lazy-simplifier agent. Gate 2: story-reviewer agent. Gate 3: inline.

### When to ask the user

- Under autopilot: never (contract §2).
- Outside autopilot: ask when tests are ambiguous about expected behaviour, or when the architecture would need to change to make a test pass (re-invoke `/research-and-architecture` for a divergence ADR).

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
