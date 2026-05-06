# State Schema (v2 — per-Operation, GREEN side)

Two levels of state coordinate the story-based workflow:

1. **`specs/stories.json`** — project-wide source of truth (personas, epics, stories[], architecture, design system). Documented at `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`.
2. **`specs/story-NNN-slug/state.json`** — per-story execution state. Created by `/test-setup`; consumed and updated by `/spec-implementation` during the GREEN phase; updated again by `/verification-and-validation`. Frozen at `phase_local: "verified"` once the story ships.

This document covers the per-story `state.json` from `/spec-implementation`'s perspective. The shared schema reference lives at `plugins/test-setup/skills/test-setup/references/state-schema.md`; the additions made during the GREEN phase are below.

---

## What changes in v2 for `/spec-implementation`

`/spec-implementation` now has two modes, decided by the smart-default picker:

- **Per-op mode** (default while ops are still `red`) — implements one Operation, runs the per-story suite filtered to `@US-NNN`, optionally REFACTORs, commits.
- **Story-end mode** (no `Op-X` arg, all ops at `green` or `refactored`) — runs the three story-level quality gates (Simplify, Code Review, Verify) and flips `stories[i].phase` to `"green"`.

The state schema picks up two cross-skill additions from v2 (documented in full in `test-setup`'s reference): the per-Op `operation_phase` cursor and the per-Op `red_audit` / `green_audit` blobs. The `quality_gates` and `implementation` blocks below are owned exclusively by `/spec-implementation`.

---

## Schema additions during `/spec-implementation`

### `quality_gates` (story-level, written only in story-end mode)

After **every** Operation has reached `operation_phase ∈ {green, refactored}`, the three quality gates run **once per story**. The block lives at the top level of `state.json`:

```json
"quality_gates": {
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
```

### `implementation` block (per story, written incrementally)

```json
"implementation": {
  "started_at": "ISO 8601 timestamp",         // first time per-op mode runs
  "completed_at": "ISO 8601 or null",         // set when story-end gates pass
  "operations_green": 1,                       // bumped after every per-op GREEN
  "operations_total": 4,
  "last_commit": "abc1234",                    // bumped on every commit
  "ops_completed": ["Op-1"]                    // ordered list of green'd ops
}
```

### `errors[]`

Same shape as `/test-setup`'s schema, scoped per Operation:

```json
"errors": [
  {
    "operation": "Op-2",
    "message": "Test still failing after GREEN",
    "details": "Expected redirect after login but response is 500",
    "attempts": 1,
    "resolved": false,
    "timestamp": "ISO 8601"
  }
]
```

---

## Smart-Default Picker (`/spec-implementation`)

```
/spec-implementation US-NNN [Op-X]:
  if Op-X passed explicitly:
    if Op-X.operation_phase = green AND not --force → "Op-X is already green. Pass --force to redo."
    elif Op-X.operation_phase ≠ red                 → "Op-X is not RED yet. Run /test-setup US-NNN Op-X first."
    else                                              → enter per-op mode for Op-X.

  if no Op-X arg:
    if any op.operation_phase = red AND implementation_status ≠ green:
      pick first such op → enter per-op mode.
    elif all ops ∈ {green, refactored} AND quality_gates not all true:
      enter story-end mode → run Simplify + Code Review + Verify.
    elif all gates true:
      "Story is GREEN. Run /verification-and-validation US-NNN."
    else:
      "Nothing to implement. State: <summary>."
```

The picker writes its choice to `current_operation`.

---

## State Transitions (`/spec-implementation`)

```
phase_local at entry:                executing
phase_local during per-op cycles:    executing (sticky)
phase_local after story-end gates:   verifying

Per Operation (sequential, not parallel within a story):
  operation_phase: red → green                          (per-op mode default path)
                       → refactored                     (if PLAN.md prescribes a refactor)
                       → blocked (can retry → red)

Quality gate flow (story-end mode, after every operation_phase ∈ {green, refactored}):
  simplified = false  → run /simplify             → simplified = true
  reviewed   = false  → run code-review subagent  → reviewed   = true
  verified   = false  → run story Verification    → verified   = true
  all true → state.json.phase_local = "verifying"
            stories[i].phase         = "green"
```

---

## Reading State on Entry (`/spec-implementation`)

```
1. Does specs/stories.json exist?
   NO  → STOP. Run /high-level-scoping first.
   YES → Read it. Find target story (CLI arg or AskUserQuestion picker).

2. What is stories[i].phase?
   backlog/scoped/specced → STOP. Run /spec-writing US-NNN first.
   planned                → STOP, EXCEPT: Foundation Auto-Chain (see SKILL.md):
                             if id == "US-000" AND repo is empty,
                             chain /repo-initialization first; then exit
                             with a message instructing the user to run
                             /test-setup US-000 Op-1 then re-invoke this skill.
   red                    → state.json must exist with phase_local = "executing".
                             Run the smart-default picker (per-op mode unless
                             all ops green and gates pending → story-end mode).
   green                  → If gates not all true, enter story-end mode.
                             Else, story already shipped to green; STOP.
   verified               → STOP. Story already shipped.

3. Are dependencies satisfied?
   For each id in stories[i].depends_on_story_ids:
     If stories[<dep>].phase != "verified" AND stories[<dep>].is_foundation != true:
       STOP with the offending dep id and a hint.

4. Schema migration check:
   If schema_version missing or = 1, run the v1 → v2 migration documented in
   plugins/test-setup/skills/test-setup/references/state-schema.md.

5. Are there unresolved errors in state.json.errors?
   YES → Attempt to resolve the most recent one first.
   NO  → Continue with the picker's chosen mode.
```

---

## Sync Protocol: `state.json` → `specs/stories.json`

**Per-op mode never writes to `stories.json`.** All per-op churn lives in `state.json` only.

**Story-end mode (single sync, at story boundary):**

1. All Operations have `operation_phase ∈ {green, refactored}`.
2. All three `quality_gates.{simplified, reviewed, verified}` are `true`.
3. `state.json.phase_local` advances `executing → verifying`.

**What to sync:**

1. Read `specs/stories.json`.
2. Set `stories[i].implementation = { started_at, completed_at, last_commit }`.
3. Set `stories[i].phase = "green"`.
4. Append `{ phase: "green", at: "<today>" }` to `stories[i].history`.
5. Update `project.updated_at`.
6. Write back (read-merge-write, never overwrite other fields).
7. Regenerate `specs/STORIES.md` from the updated tracker.

---

## Updating State

**Always use atomic writes** — write to a temp file first, then rename:

```bash
cat > specs/story-NNN-slug/state.json.tmp << 'EOF'
{ ... }
EOF
mv specs/story-NNN-slug/state.json.tmp specs/story-NNN-slug/state.json
```

**Update frequency (`/spec-implementation` per-op mode):**

- After GREEN commit → `Op-X.operation_phase = "green"`, `Op-X.implementation_status = "green"`, `summary.operations_green++`, `implementation.operations_green++`, `implementation.last_commit = <sha>`, `implementation.ops_completed.append("Op-X")`. Mark `test_plan_rows[T-N].passing = true` for every row with `op = Op-X`.
- After REFACTOR commit (optional) → `Op-X.operation_phase = "refactored"`, update `implementation.last_commit`.
- After every error encountered → append to `errors[]`.
- Advance `current_operation` to the next pending op.

**Update frequency (`/spec-implementation` story-end mode):**

- After Simplify finishes → `quality_gates.simplified = true`, update `implementation.last_commit`.
- After Code Review finishes → `quality_gates.reviewed = true`, populate `quality_gates.review_findings`.
- After Verify finishes → `quality_gates.verified = true`, populate `quality_gates.verification_results`.
- When all three flip to true → `phase_local = "verifying"`, `implementation.completed_at = <now>`, then sync to `specs/stories.json`.

`specs/stories.json` is updated **once per story** at the story-end gate completion, NOT per Operation. Per-Operation churn lives in `state.json` only.
