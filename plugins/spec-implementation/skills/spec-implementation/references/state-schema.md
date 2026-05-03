# State Schema

Two levels of state coordinate the story-based workflow:

1. **`specs/stories.json`** — project-wide source of truth (personas, epics, stories[], architecture, design system). Documented at `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`.
2. **`specs/story-NNN-slug/state.json`** — per-story execution state. Created by `/test-setup`; consumed and updated by `/spec-implementation` during GREEN; updated again by `/verification-and-validation`. Frozen at `phase_local: "verified"` once the story ships.

This document covers the per-story `state.json` from `/spec-implementation`'s perspective. The shared schema is documented in `plugins/test-setup/skills/test-setup/references/state-schema.md`; the additions made during the GREEN phase are below.

---

## Schema additions during `/spec-implementation`

### `quality_gates` (story-level)

After all Operations are GREEN, the three quality gates run **once per story** (not per wave; waves are gone). The block lives at the top level of `state.json`:

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

### `implementation` block (per story)

```json
"implementation": {
  "started_at": "ISO 8601 timestamp",
  "completed_at": "ISO 8601 timestamp or null",
  "operations_green": 4,
  "operations_total": 4,
  "last_commit": "abc1234"
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

## State Transitions (`/spec-implementation`)

```
phase_local at entry: executing
phase_local at exit:  verifying

Per Operation (sequential, not parallel within a story):
  pending → in_progress → green
                        → blocked (can retry → in_progress)

Quality gate flow (after every Operation is green):
  simplified = false  → run /simplify           → simplified = true
  reviewed   = false  → run code-review subagent → reviewed   = true
  verified   = false  → run story Verification    → verified   = true
  all true → state.json.phase_local = "verifying"
            stories[i].phase = "green"
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
                             /test-setup US-000 then re-invoke this skill.
   red                    → state.json must exist with phase_local = "executing".
                             Resume from current_operation.
   green                  → All Operations done; check quality gates.
   verified               → STOP. Story already shipped.

3. Are dependencies satisfied?
   For each id in stories[i].depends_on_story_ids:
     If stories[<dep>].phase != "verified" AND stories[<dep>].is_foundation != true:
       STOP with the offending dep id and a hint.

4. Are there unresolved errors in state.json?
   YES → Attempt to resolve the most recent one first.
   NO  → Continue normal flow.
```

---

## Sync Protocol: `state.json` → `specs/stories.json`

**When to sync (story boundary):**

1. All Operations have `implementation_status = "green"`.
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

**Update frequency (`/spec-implementation`):**

- After every Operation completes GREEN: update that Operation's `implementation_status` and the `summary.operations_green` counter.
- After every commit: update `summary.last_commit`.
- After every quality gate finishes: flip the corresponding `quality_gates.<name>` flag.
- After all gates pass: flip `phase_local` to `"verifying"` and sync to `specs/stories.json`.
- After every error encountered: append to `errors[]`.

`specs/stories.json` is updated **once per story** at completion, NOT per Operation. Per-Operation churn lives in `state.json` only.
