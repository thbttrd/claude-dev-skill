# `autopilot` plugin Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `autopilot` plugin — `/autopilot US-NNN [--until US-MMM] [--stop-policy …]` drives one story (or a DAG-ordered chain) through spec → plan → per-Op RED/GREEN → story-end gates → E2E without a human, using a deterministic stage machine, one fresh subagent per stage, and four bundled agents — plus the `spec-writing` INVEST rework and the small seams the pipeline skills still lack.

**Architecture:** One zero-dependency Node script (`autopilot.mjs`) owns everything deterministic: pre-flight, `specs/autopilot.json`, the stage resolver (`next`), retry/no-progress accounting and the stop report. It dynamically imports the installed `ledger.mjs` for journaling, so there is one journal writer. The `/autopilot` skill is a thin conductor loop in the main session: `next` → dispatch a subagent with a three-line prompt → grep the sentinel → `stage-end` → repeat. Agent stages (`invest`, `simplify`, `code-review`, the three verifier audits) run bundled agents from the conductor, because a subagent cannot spawn agents; the producing skills detect from the trackers that the conductor already ran a gate and skip it.

**Tech Stack:** Node ≥ 20 (`node:test`, stdlib only), Claude Code agents (`plugins/autopilot/agents/*.md` with `name`/`description`/`tools`/`model` frontmatter), bash + jq + yq marketplace scripts, Keep-a-Changelog + SemVer per plugin via `scripts/bump.sh`.

**Spec:** `docs/superpowers/specs/2026-08-30-autopilot-design.md` §4 (and §2.2 rule 3, §7, §8, §9 where they concern the conductor). Plan 1 (`docs/superpowers/plans/2026-08-30-dev-ledger-and-autopilot-contract.md`) shipped §2–3. Plan 3 (§5) is later.

**Deviations from the spec (decided while planning):**

- **Agent stages are conductor-owned.** Claude Code subagents cannot spawn subagents. §4.3 has `/spec-writing` (running inside the per-stage subagent) call `invest-assessor`, and `/spec-implementation` story-end call `lazy-simplifier` + `story-reviewer`; neither is possible one level down. So the stage machine gains `invest`, `simplify` and `code-review` stages that the conductor runs with the bundled agents, and the verifier stages run `story-verifier` directly. `/spec-writing` skips Phase 0 when `stories[i].invest` is already all-true with a `checked_at`; `/spec-implementation` story-end skips Gate 1/2 when `state.json.quality_gates.simplified/reviewed` is already true. Outside autopilot both skills call the agents themselves (they run in the main session, which has the Agent tool).
- **Missing sentinels added.** `plan-writing`, `spec-writing-verification` and `plan-writing-verification` emit no completion sentinel today, and the two verifiers never persist their report. They get `PLAN_COMPLETE_US-NNN`, `SPEC_AUDIT_COMPLETE_US-NNN`, `PLAN_AUDIT_COMPLETE_US-NNN`, and the reports land at `specs/story-NNN-slug/verification/{spec,plan}-audit.md` (the file's existence is how `next` knows the stage ran).
- **§8 "fixture project driven by `claude -p` in CI"** is replaced by `node --test` over the stage machine with fixture trackers (deterministic, runs in CI every push). The live end-to-end run is a manual dogfood step.
- **`model: inherit`** for the four agents (fresh context is the point, not a model change). The one existing agent in the repo pins `opus`; this is a deliberate difference.
- **No canonical contract edit.** Conductor-only stop reasons (`stage_no_sentinel`, `stage_no_progress`, `preflight_failed`) are documented in the autopilot skill, not in `autopilot-contract.md` (editing it would force 12 patch releases for one sentence).
- **Spec/plan verifier stages run for every story; the per-Op green audit only for `rigor: full`** — exactly what the §4.1 diagram shows.

## Global Constraints

- Node ≥ 20, stdlib only in `autopilot.mjs`; the only import outside stdlib is a dynamic `import()` of the located `ledger.mjs`.
- `specs/autopilot.json` is rewritten whole (2-space indent, trailing newline). `specs/journal.jsonl` is written only through `ledger.mjs`'s `log()`.
- Stop reasons: contract §2 set (`verifier_fail | op_blocked | regression | spec_contradiction | tooling_not_ready | split_required`) plus conductor's `stage_no_sentinel | stage_no_progress | preflight_failed | story_end | until_reached | user_stop`.
- Stage names (exact): `invest | spec-writing | spec-writing-verification | plan-writing | plan-writing-verification | repo-initialization | test-setup | spec-implementation | spec-implementation-verification | simplify | code-review | verification-and-validation`.
- Sentinels (exact, matched with or without a `<promise>…</promise>` wrapper): see Task 3's `STAGES` table. Every pipeline skill keeps its existing sentinel text.
- Every plugin touched gets `scripts/bump.sh <name> <kind>` + a filled CHANGELOG line; `scripts/validate.sh` must exit 0 before every commit; CI's `changelog-bump-guard` requires the CHANGELOG diff.
- `autopilot` joins `PIPELINE_PLUGINS` (carries a verbatim contract copy; SKILL.md references it).
- Commit messages: Conventional Commits, scope = plugin name (`feat(autopilot): …`), `chore(scripts): …` for marketplace scripts. Branch `feat/autopilot-plan2` in `/home/ttadmin/Codes/claude-dev-skill`. Marketplace scripts are bash — run them as `bash scripts/x.sh` from fish.
- Process rules from Plan 1's review: briefs describe behaviour + tests, implementers write the code; before closing any fix, `grep -rn` the whole repo for the literal string being changed.

---

## File structure

```
plugins/autopilot/
├── .claude-plugin/plugin.json
├── CHANGELOG.md
├── README.md
├── agents/
│   ├── invest-assessor.md          # read-only; six-letter table + INVEST_VERDICT line
│   ├── story-verifier.md           # performs a *-verification skill's audit inline, persists report, journals, files warnings
│   ├── lazy-simplifier.md          # story-end Gate 1: ponytail ladder over the story diff, commits, flips quality_gates.simplified
│   └── story-reviewer.md           # story-end Gate 2: architecture/Norms/Safeguards review, fixes criticals, flips quality_gates.reviewed
└── skills/autopilot/
    ├── SKILL.md                    # the conductor loop
    ├── references/autopilot-contract.md   # synced copy (never edited here)
    └── scripts/
        ├── autopilot.mjs           # preflight | start | next | stage-start | stage-end | stop | report
        ├── autopilot.test.mjs      # node --test
        └── fixtures/mini-project/specs/{stories.json,PROJECT.md,ARCHITECTURE.md,story-000-foundation/PLAN.md}
scripts/_lib.sh                     # + autopilot in PIPELINE_PLUGINS
scripts/validate.sh                 # + contract check over every copy on disk; + agents frontmatter check
scripts/uninstall-local.sh          # + unlinks every skills/*/ dir (deferred minor)
.github/workflows/ci.yml            # + autopilot tests
plugins/spec-writing/skills/spec-writing/SKILL.md            # Phase 0 via invest-assessor (3.0.0)
plugins/spec-implementation/skills/spec-implementation/SKILL.md   # Gates 1–2 via agents; skip when conductor ran them
plugins/plan-writing/skills/plan-writing/SKILL.md            # PLAN_COMPLETE sentinel
plugins/spec-writing-verification/skills/spec-writing-verification/SKILL.md   # persist report + sentinel
plugins/plan-writing-verification/skills/plan-writing-verification/SKILL.md   # persist report + sentinel
plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs      # formatBacklog([]) prints a line (deferred minor)
README.md, CHANGELOG.md, .claude-plugin/marketplace.json     # catalog + versions
```

---

### Task 1: Scaffold the plugin; marketplace scripts learn about agents and a 12th pipeline plugin

**Files:**
- Create: `plugins/autopilot/**` (via `scripts/new-skill.sh`), `plugins/autopilot/agents/.gitkeep`-free (dir created in Task 5)
- Modify: `scripts/_lib.sh` (`PIPELINE_PLUGINS`)
- Modify: `scripts/validate.sh` (section 5; new section 6)
- Modify: `scripts/uninstall-local.sh` (skills loop)
- Modify: `.github/workflows/ci.yml` (test step — added now, the test file arrives in Task 2)

**Interfaces:**
- Produces: `plugins/autopilot/skills/autopilot/` for every later task; `scripts/validate.sh` fails on any agent file whose frontmatter `name` ≠ filename or lacks `description`; on any `references/autopilot-contract.md` copy anywhere under `plugins/` that differs from canonical.

- [ ] **Step 1: Scaffold**

```bash
cd /home/ttadmin/Codes/claude-dev-skill
bash scripts/new-skill.sh autopilot "Unattended driver for the story pipeline. /autopilot US-NNN [--until US-MMM] runs spec → plan → per-Operation RED/GREEN → story-end gates → E2E for one story or a DAG-ordered chain, one fresh subagent per stage, never asking a question: warnings become backlog items, hard failures stop the run, every step is journaled. Bundles the invest-assessor, story-verifier, lazy-simplifier and story-reviewer agents. Triggers on \"/autopilot\", \"run the pipeline unattended\", \"autopilot US-003\", \"resume autopilot\"."
mkdir -p plugins/autopilot/skills/autopilot/scripts/fixtures/mini-project/specs plugins/autopilot/agents
```

`new-skill.sh` also inserts the `marketplace.json` entry (verify with `jq '.plugins[] | select(.name=="autopilot")' .claude-plugin/marketplace.json`).

- [ ] **Step 2: Add `autopilot` to the roster and sync the contract**

In `scripts/_lib.sh` append `autopilot` to the `PIPELINE_PLUGINS=(…)` array, then `bash scripts/sync-contract.sh` → `plugins/autopilot/skills/autopilot/references/autopilot-contract.md` appears. Add one line to the scaffolded SKILL.md body so the validate check passes for now: `Follows \`references/autopilot-contract.md\`.` (Task 6 rewrites the file.)

- [ ] **Step 3: validate.sh — contract drift over every copy on disk, agents frontmatter**

Replace section 5's roster loop body so it does two things: (a) for each roster name, require the copy exists and the SKILL.md references it (as today); (b) separately, `find "$ROOT/plugins" -path '*/references/autopilot-contract.md'` and compare **every** hit's sha256 to the canonical — a copy in a plugin not on the roster must fail too (`fail "$copy: differs from canonical (run scripts/sync-contract.sh)"`). Then add:

```bash
# 6. Bundled agents: frontmatter name matches file name, description present
for agent in "$ROOT"/plugins/*/agents/*.md; do
  [ -f "$agent" ] || continue
  aname="$(basename "$agent" .md)"
  [ "$(skill_field "$agent" name)" = "$aname" ] || fail "$agent: frontmatter name ≠ $aname"
  [ -n "$(skill_field "$agent" description)" ] || fail "$agent: frontmatter description missing"
done
```

Run `bash scripts/validate.sh` → exit 0 (the d2-architect agent already conforms).

- [ ] **Step 4: uninstall-local.sh unlinks every skill dir of a plugin**

Replace the single `unlink_if_ours "$HOME/.claude/skills/$name"` with a loop over `"$plugin_dir/skills/"*/` calling `unlink_if_ours "$HOME/.claude/skills/$(basename "$skill_src")"` (mirror of `install-local.sh`'s loop). Verify: `bash scripts/install-local.sh dev-ledger && bash scripts/uninstall-local.sh dev-ledger` removes both `~/.claude/skills/dev-ledger` and `~/.claude/skills/backlog`; re-run `bash scripts/install-local.sh dev-ledger` afterwards to restore the live links.

- [ ] **Step 5: CI runs the autopilot tests**

In `.github/workflows/ci.yml` after the dev-ledger test step add:

```yaml
      - name: autopilot unit tests
        run: node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore(scripts): scaffold autopilot plugin; validate agents + every contract copy; uninstall all skill dirs"
```

---

### Task 2: `autopilot.mjs` — locate the ledger, read trackers, `preflight`

**Files:**
- Create: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs`
- Create: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
- Create: `plugins/autopilot/skills/autopilot/scripts/fixtures/mini-project/specs/{stories.json,PROJECT.md,ARCHITECTURE.md}`

**Interfaces:**
- Produces (ESM exports, used by Tasks 3–4 and the tests):
  - `locateLedger(override = process.env.LEDGER)` → absolute path to `ledger.mjs` or `null`. Search order: `override`; then the first `*/dev-ledger/scripts/ledger.mjs` under `~/.claude/skills` and `~/.claude/plugins` (follow symlinks, skip paths containing `archive`); then the in-repo sibling `../../../../dev-ledger/skills/dev-ledger/scripts/ledger.mjs` relative to `autopilot.mjs` (so tests and a repo checkout work without an install).
  - `loadLedger(path)` → `await import(pathToFileURL(path))` (returns the module: `log`, `findSpecsDir`, `parseArgs`, `readBacklog`, `readJournal`, `filterJournal`).
  - `readJson(p)`, `writeJson(p, obj)` (2-space, trailing newline, temp-file + rename).
  - `storyDir(specs, id)` → `specs/story-NNN-slug` resolved from `stories[i].slug` (fallback: glob `story-NNN-*`).
  - `readState(specs, id)` → parsed `state.json` or `null`.
  - `readAutopilot(specs)` → parsed `autopilot.json` or `null`.
  - `preflight(specs, opts)` → `{ ok: true, target, until, stop_policy, warnings: [] }` or `{ ok: false, errors: [string] }`. `opts = { target, until?, stop_policy?, skip_arch_check?, force?, ledger? }`.
  - `DEFAULT_POLICY = "hard-failures+story-end"`, `POLICIES = ["hard-failures", "hard-failures+story-end"]`.
  - `main(argv)` → exit code; subcommand `preflight` wired now (prints the JSON, exit 0/1). Same realpath main-guard as `ledger.mjs` so the symlinked install works.

**Pre-flight rules (all collected, not first-fail):**

| Check | Error text (exact prefix) |
| --- | --- |
| `specs/stories.json` missing | `no specs/stories.json — run /high-level-scoping first (autopilot will not run it)` |
| `specs/ARCHITECTURE.md` missing | `no specs/ARCHITECTURE.md — run /research-and-architecture first (autopilot will not run it)` |
| target id not in `stories[]` | `unknown story US-NNN` |
| target `phase` = `backlog` | `US-NNN is still in backlog — run /high-level-scoping update mode to scope it` |
| target `phase` = `verified` and no `--until` | `US-NNN is already verified — pass --until US-MMM to continue past it` |
| `--until` id unknown, or `until` < target (numeric) | `--until US-MMM …` |
| any dep in `depends_on_story_ids` not `verified` and not `is_foundation` | `dependency US-DDD of US-NNN is <phase>, not verified` |
| `architecture.tech_stack` and `architecture.adrs` both absent, and not `--skip-arch-check` | `ARCHITECTURE.md has not been through /research-and-architecture (no tech_stack/adrs in stories.json) — pass --skip-arch-check for a migrated repo` |
| `git status --porcelain` non-empty, ignoring `specs/autopilot.json`, `specs/journal.jsonl`, `specs/backlog.json` | `working tree not clean: <first 3 paths>` |
| `autopilot.json.active === true` and not `--force` | `another run is active (run_id …) — pass --force to take over` |
| `locateLedger()` null | `dev-ledger not installed: /plugin install dev-ledger@claude-dev-skill` |
| `stop_policy` not in `POLICIES` | `--stop-policy must be hard-failures|hard-failures+story-end` |

`--skip-arch-check` and `--force` used → push a note into `warnings` (Task 4's `start` journals them as decisions).

- [ ] **Step 1: Write the fixture**

`fixtures/mini-project/specs/stories.json` — schema 2.0.0 shape with three stories: `US-000` (`slug: foundation`, `is_foundation: true`, `rigor: full`, `phase: scoped`, `invest` all `false`/`checked_at: null`, 2 AC, `depends_on_story_ids: []`), `US-001` (`slug: hello`, `rigor: light`, `phase: scoped`, deps `[US-000]`), `US-002` (`slug: bye`, `rigor: light`, `phase: scoped`, deps `[US-001]`); `architecture: { modules: [...one...], diagram_path, tech_stack: { "runtime": "node" }, adrs: [] }`. `PROJECT.md` and `ARCHITECTURE.md`: two lines each. No `state.json` in the fixture — tests create it.

- [ ] **Step 2: Write the failing tests**

Test helper `fixtureProject()` copies `fixtures/mini-project` into `mkdtempSync(join(tmpdir(), "autopilot-"))`, runs `git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init`, returns `{ root, specs }`. Helper `setStory(specs, id, patch)` read-merge-writes one story. Helper `writeState(specs, id, state)`.

```js
test("locateLedger falls back to the in-repo sibling and honours the override", ...)
  // override wins; with override=null and HOME pointed at an empty temp dir, returns the repo sibling path (existsSync true)
test("preflight passes on the fixture target US-000", ...)
  // { ok: true, target: "US-000", until: "US-000", stop_policy: DEFAULT_POLICY }
test("preflight collects every failure instead of stopping at the first", ...)
  // delete ARCHITECTURE.md + set US-000 phase backlog + dirty tree (write a file) → errors.length === 3, each matched by regex
test("preflight blocks on an unverified dependency and on an already-verified target without --until", ...)
test("preflight demands --skip-arch-check when stories.json has neither tech_stack nor adrs", ...)
  // remove both → error; with skip_arch_check → ok + warnings[0] mentions skip-arch-check
test("preflight ignores the run's own bookkeeping files in the clean-tree check", ...)
  // write specs/autopilot.json + specs/journal.jsonl + specs/backlog.json untracked → ok
test("preflight refuses a second active run unless --force", ...)
test("CLI: preflight prints JSON and exits 1 on failure", ...)
  // spawnSync node autopilot.mjs preflight US-999 --specs <specs> → status 1, JSON.parse(stdout).ok === false
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
Expected: every test fails with `ERR_MODULE_NOT_FOUND` / missing export.

- [ ] **Step 4: Implement**

Write `autopilot.mjs` with the exports above. Reuse `parseArgs` and `findSpecsDir` from the loaded ledger module in `main` (so `--specs` and `LEDGER_SPECS` behave identically to the ledger CLI); `main` is `async` because of the dynamic import — the main-guard does `main(argv).then(code => process.exit(code), err => { stderr; exit 1 })`. `preflight` is synchronous apart from `locateLedger`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
Expected: all pass. `bash scripts/validate.sh` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add plugins/autopilot && git commit -m "feat(autopilot): autopilot.mjs preflight + fixture project"
```

---

### Task 3: `autopilot.mjs next` — the stage resolver

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs`
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
- Create: `plugins/autopilot/skills/autopilot/scripts/fixtures/mini-project/specs/story-000-foundation/PLAN.md` (headings `### Operation 1 — a`, `### Operation 2 — b` only; used to count Ops when `state.json` is absent)

**Interfaces:**
- Produces:
  - `STAGES` — ordered table, one entry per stage name: `{ skill, agent, sentinel }` where `agent ∈ { "general-purpose", "invest-assessor", "story-verifier", "lazy-simplifier", "story-reviewer" }` and `sentinel` is a template with `US-NNN` / `Op-X` placeholders:

    | stage | skill invoked | agent | sentinel |
    | --- | --- | --- | --- |
    | `invest` | — (agent reads trackers) | `invest-assessor` | `INVEST_VERDICT: (PASS\|RE-TIER (light\|full)\|SPLIT\|FAIL .*)` (regex; the verdict text after the colon is what `stage-end --verdict` receives) |
    | `spec-writing` | `spec-writing` | `general-purpose` | `SPEC_COMPLETE_US-NNN` |
    | `spec-writing-verification` | `spec-writing-verification` | `story-verifier` | `SPEC_AUDIT_COMPLETE_US-NNN` |
    | `plan-writing` | `plan-writing` | `general-purpose` | `PLAN_COMPLETE_US-NNN` |
    | `plan-writing-verification` | `plan-writing-verification` | `story-verifier` | `PLAN_AUDIT_COMPLETE_US-NNN` |
    | `repo-initialization` | `repo-initialization` | `general-purpose` | `REPO_INIT_COMPLETE` |
    | `test-setup` | `test-setup` | `general-purpose` | `RED_COMPLETE_US-NNN_Op-X` |
    | `spec-implementation` (with op) | `spec-implementation` | `general-purpose` | `GREEN_COMPLETE_US-NNN_Op-X` |
    | `spec-implementation-verification` | `spec-implementation-verification` | `story-verifier` | `GREEN_AUDIT_COMPLETE_US-NNN_Op-X` |
    | `simplify` | — | `lazy-simplifier` | `SIMPLIFY_COMPLETE_US-NNN` |
    | `code-review` | — | `story-reviewer` | `REVIEW_COMPLETE_US-NNN` |
    | `spec-implementation` (no op, story-end) | `spec-implementation` | `general-purpose` | `IMPLEMENTATION_COMPLETE_US-NNN` |
    | `verification-and-validation` | `verification-and-validation` | `general-purpose` | `VERIFICATION_COMPLETE_US-NNN` |

  - `matchSentinel(text, stage, story, op)` → `null` or the matched string (accepts a `<promise>…</promise>` wrapper or bare text; for `invest` returns the verdict string after `INVEST_VERDICT: `). Also detects `AUTOPILOT_STOP_<reason>` in any stage: returns `{ stop: reason }`.
  - `nextStage(specs, ap)` → one of
    - `{ story, stage, op, skill, agent, sentinel, rigor, args }` (`args` = `"US-NNN"` or `"US-NNN Op-X"`; `op: null` when not per-Op),
    - `{ done: true, reason: "story_end" | "until_reached", story }`,
    - `{ stop: true, reason: "spec_contradiction", detail }` when trackers are inconsistent (e.g. phase `red` but no `state.json`).
    `ap` is the parsed `autopilot.json`, or for dry runs `{ target, until, stop_policy, current: null }`.
  - `nextEligibleStory(stories, afterId, untilId)` → lowest-id story with id in `(afterId, untilId]`, phase ∉ `{ backlog, verified }`, every dep `verified` or foundation; else `null`.
  - `main`: `next [--story US-NNN] [--until US-MMM] [--stop-policy p]` — with `--story` it ignores `autopilot.json` (dry run), otherwise it requires an active run. Prints the JSON.

**Resolution rules** (`story = ap.current?.story ?? ap.target`, `s = stories[story]`, `dir = storyDir`, `st = readState`):

```
verified:
  if story === ap.until                         → done until_reached
  if ap.stop_policy includes "story-end"
     and ap.current?.stage === "verification-and-validation" and ap.current.story === story
                                                → done story_end        (the story just finished in this run; resume moves on)
  n = nextEligibleStory(...); n ? recurse with story = n : done until_reached
scoped:
  invest all six true and checked_at            → spec-writing
  else                                          → invest
specced:
  !exists(dir/verification/spec-audit.md)       → spec-writing-verification
  else                                          → plan-writing
planned:
  !exists(dir/verification/plan-audit.md)       → plan-writing-verification
  story === "US-000" and !exists(<root>/package.json) → repo-initialization
  else                                          → test-setup Op-1   (Op ids from state.json if present, else PLAN.md "### Operation N" headings)
red:
  st null                                       → stop spec_contradiction "phase red but no state.json"
  ops = st.operations in Op order
  if rigor === "full": a = first op with operation_phase ∈ {green, refactored} and green_audit.verdict ∉ {PASS, PASS_WITH_WARNINGS}
                                                → spec-implementation-verification a
  cur = first op with operation_phase ∉ {green, refactored}
  cur and cur.operation_phase === "red"         → spec-implementation cur
  cur                                           → test-setup cur       (pending / red_a / red_b)
  !st.quality_gates?.simplified                 → simplify
  !st.quality_gates?.reviewed                   → code-review
  else                                          → spec-implementation (story-end, op null)
green:                                          → verification-and-validation
backlog:                                        → stop spec_contradiction (preflight should have caught it)
```

- [ ] **Step 1: Write the failing tests** (one per branch; each builds the tracker state then asserts `nextStage(...)` shape — assert `stage`, `op`, `agent`, `args`, and the rendered `sentinel`)

```js
test("next: scoped story without INVEST → invest (invest-assessor)", ...)
test("next: scoped story with INVEST all true → spec-writing", ...)
test("next: specced → spec-writing-verification until spec-audit.md exists, then plan-writing", ...)
test("next: planned → plan-writing-verification, then repo-initialization for US-000 on an empty repo, then test-setup Op-1", ...)
  // touch verification/plan-audit.md; assert repo-initialization; then write <root>/package.json → test-setup Op-1 with args "US-000 Op-1"
test("next: planned non-foundation story with package.json present → test-setup Op-1 from PLAN.md headings", ...)
test("next: red — cursor rules", ...)
  // state ops: Op-1 red → spec-implementation Op-1; Op-1 green (rigor light), Op-2 pending → test-setup Op-2; Op-2 red_b → test-setup Op-2
test("next: red — full rigor audits the last GREEN'd op before moving on", ...)
  // rigor full, Op-1 green with green_audit.verdict null → spec-implementation-verification Op-1; set verdict PASS → test-setup Op-2
test("next: red — all ops green → simplify → code-review → spec-implementation story-end", ...)
test("next: red without state.json → stop spec_contradiction", ...)
test("next: green → verification-and-validation", ...)
test("next: verified target with until=target → done until_reached", ...)
test("next: verified in this run under hard-failures+story-end → done story_end; under hard-failures → next eligible story's stage", ...)
  // ap.current = { story: "US-000", stage: "verification-and-validation" }; US-001 scoped deps [US-000] → with policy hard-failures returns { story: "US-001", stage: "invest" }
test("next: resume after story_end moves to the next eligible story (current null)", ...)
test("nextEligibleStory skips stories with unverified deps and stops at until", ...)
test("matchSentinel accepts bare and <promise>-wrapped sentinels, extracts INVEST verdicts and AUTOPILOT_STOP reasons", ...)
test("CLI: next --story US-000 dry-runs without autopilot.json", ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
Expected: the new tests fail (`nextStage is not a function`).

- [ ] **Step 3: Implement `STAGES`, `matchSentinel`, `nextEligibleStory`, `nextStage`, wire `next` in `main`**

Op ordering: sort by the integer after `Op-`. Op ids when `state.json` is absent: regex `^### Operation (\d+)` over PLAN.md → `Op-N`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/autopilot && git commit -m "feat(autopilot): stage resolver (next), sentinel matcher, DAG chaining"
```

---

### Task 4: `autopilot.mjs start | stage-start | stage-end | stop | report` — the run lifecycle

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs`
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`

**Interfaces:**
- Produces (all `async`, all take `(specs, opts, deps = { ledger, now })` so tests inject a fake `now`):
  - `start(specs, { target, until, stop_policy, skip_arch_check, force })` → runs `preflight`; on failure returns `{ ok: false, errors }` (CLI exits 1, nothing written). On success writes `specs/autopilot.json`:

    ```json
    { "active": true, "run_id": "run-<ISO now>", "target": "US-000", "until": "US-000",
      "stop_policy": "hard-failures+story-end", "skip_arch_check": false,
      "current": null, "last_next": null,
      "started_at": "<ISO>", "stopped_at": null, "stop_reason": null }
    ```

    then journals (through `ledger.log`, `--kind action`, `--story target`, `--stage autopilot`) `autopilot start target=… until=… policy=…`; if `force` took over an active run: `--kind decision` `force: took over run <old run_id>`; if `skip_arch_check`: `--kind decision` `--skip-arch-check: architecture check bypassed (migrated repo)`. Returns the written object.
  - `stageStart(specs, { story, stage, op, agent })` → sets `current = { story, stage, op, agent, started_at, attempt: (same story/stage/op as before ? previous.attempt : 1) }`, journals `stage_start` (`--story --op --stage`, summary `"<stage> <args> via <agent> (attempt N)"`). Requires an active run.
  - `stageEnd(specs, { outcome, verdict, reason, tail })` with `outcome ∈ { sentinel, no_sentinel, stop }`:
    - `sentinel`: journals `stage_end` (summary `"<stage> <args> ok"`). For stage `invest`, applies the verdict: `PASS` → `stories[i].invest = { i..t: true, checked_at: today }`, journal `gate invest PASS`; `RE-TIER light|full` → same plus `stories[i].rigor = tier`, journal `decision "re-tiered to <tier> by invest-assessor"`; `SPLIT` → calls `stop` with reason `split_required`; `FAIL <letter>: <reason>` → journal `gate invest FAIL` and `stop` with reason `spec_contradiction`; both return `{ action: "stop", reason }`. Then computes `nextStage`; if it equals `current` on `{story, stage, op}` → `stop` with `stage_no_progress` (summary names the stage) and returns `{ action: "stop", … }`; else stores `last_next`, returns `{ action: "continue", next }`.
    - `no_sentinel`: journals `action` `"retry <attempt+1>/2: <stage> returned no sentinel"` with `tail` (first 400 chars) in the summary when `current.attempt === 1` → `current.attempt = 2`, returns `{ action: "retry", attempt: 2 }`; otherwise `stop` with `stage_no_sentinel`, returns `{ action: "stop" }`.
    - `stop`: calls `stop(specs, { reason })` (the subagent already journaled its own `stop` line; the conductor's `stop` adds the run-level one) → `{ action: "stop", reason }`.
  - `stop(specs, { reason, summary })` → `active=false, stopped_at, stop_reason`, journals `--kind stop` `"<reason>: <summary>"`, returns `report(...)`.
  - `report(specs, { run_id })` → `{ run_id, target, until, stop_reason, stages: [{stage, story, op, outcome}], gates: [{gate, verdict, story, op, report}], backlog_ids: [...], commits: [{sha, summary}], text }` from `readJournal` filtered by `run_id` (`stage_end`/`stop` → stages; `gate` → gates; `finding` → `backlog_id`; `commit` entries) plus `git log --since <started_at> --format=%h%x1f%s` for commits skills forgot to log. `text` is a compact multi-line human summary (the conductor prints it verbatim).
  - `main`: `start US-NNN [--until] [--stop-policy] [--skip-arch-check] [--force]`, `stage-start --story --stage [--op] [--agent]`, `stage-end --outcome sentinel|no_sentinel|stop [--verdict "…"] [--reason r] [--tail "…"]`, `stop --reason r [--summary "…"]`, `report [--run-id id]`. Every command prints JSON (`report` prints `text` unless `--json`).

- [ ] **Step 1: Write the failing tests**

```js
test("start writes autopilot.json and journals the start (plus decisions for --force / --skip-arch-check)", ...)
  // readJournal: one action with run_id === ap.run_id; with force over an active file: a decision mentioning the old run_id
test("start refuses when preflight fails and writes nothing", ...)
test("stageStart sets current with attempt 1 and journals stage_start with story/op/stage filled", ...)
test("stageEnd sentinel → continue with the next stage and journals stage_end", ...)
  // US-000 scoped, invest all true; stage spec-writing; setStory phase specced → next.stage === "spec-writing-verification"
test("stageEnd sentinel with no tracker progress → stop stage_no_progress", ...)
  // same as above but do NOT advance the phase → action stop, autopilot.json.active false, stop_reason stage_no_progress
test("stageEnd no_sentinel retries once then stops with stage_no_sentinel", ...)
test("stageEnd invest verdicts: PASS writes invest flags; RE-TIER also rewrites rigor; SPLIT stops split_required; FAIL stops spec_contradiction", ...)
test("stageEnd stop passes the subagent's reason through", ...)
test("report aggregates this run's stages, gates, backlog ids and commits", ...)
  // seed the journal via ledger.log with the run's run_id: two stage_end, one gate PASS_WITH_WARNINGS, one backlog add (backlogAdd) → report.backlog_ids = ["BL-001"], gates.length 1, text contains "BL-001"
test("CLI: start → stage-start → stage-end → stop round-trips through main", ...)
```

- [ ] **Step 2: Run tests to verify they fail**, then **Step 3: Implement**, then **Step 4: Run to green**

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` — all pass; `node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` still 30/30.

- [ ] **Step 5: Commit**

```bash
git add plugins/autopilot && git commit -m "feat(autopilot): run lifecycle — start, stage-start/end, retry + no-progress guards, stop report"
```

---

### Task 5: The four bundled agents

**Files:**
- Create: `plugins/autopilot/agents/invest-assessor.md`
- Create: `plugins/autopilot/agents/story-verifier.md`
- Create: `plugins/autopilot/agents/lazy-simplifier.md`
- Create: `plugins/autopilot/agents/story-reviewer.md`

**Interfaces:**
- Consumes: sentinels and verdict line from Task 3's `STAGES`; the contract (`references/autopilot-contract.md` §3–5) for journaling and the ledger locator.
- Produces: agents callable as `Agent({ subagent_type: "<name>", prompt })` by the conductor (Task 6), `/spec-writing` (Task 8) and `/spec-implementation` (Task 9). Each agent's last output line is its sentinel/verdict.

Common frontmatter shape (exact keys; `tools` per agent below; `model: inherit`):

```yaml
---
name: invest-assessor
description: <one paragraph: what it scores, inputs, the INVEST_VERDICT line it ends with, who invokes it, what it must not do>
tools: Read, Grep, Glob
model: inherit
---
```

Each body opens with an **Invocation contract** section (Input you receive / What you return / What you MUST NOT do) like `plugins/d2-architect/agents/d2-architect-polish-reviewer.md`, then the procedure. Write the bodies from the behaviour below — do not copy prose from this plan.

- [ ] **Step 1: `invest-assessor`** (`tools: Read, Grep, Glob`)
  - Input: `US-NNN`; reads only `specs/stories.json` (that story + its deps' phases), `specs/PROJECT.md`, `specs/ARCHITECTURE.md` (module list), and `specs/story-NNN-slug/STORY.md` if it exists (update mode).
  - Scores the six letters with the same auto-checks `/spec-writing` Phase 0 lists today (I: deps vs AC; N: jargon scan; V: so_that non-tautological; E: ≥ 2 concrete AC, no "etc."; S: estimated Op count ≤ 6 full / ≤ 3 light, no new module/entity for light; T: one Gherkin skeleton per AC).
  - Output, in this order: the six-row INVEST table in the exact column shape of `references/story-md-template.md` (`| Letter | Status | Note |` with `✅`/`❌`), the drafted Gherkin skeletons under a `### Draft scenarios` heading, then **one final line**: `INVEST_VERDICT: PASS` | `INVEST_VERDICT: RE-TIER light` | `INVEST_VERDICT: RE-TIER full` | `INVEST_VERDICT: SPLIT` followed (for SPLIT only) by a `### Proposed split` list of 2–4 story stubs (title, as_a/i_want/so_that, 2 AC each, deps).
  - Verdict rules: all ✅ → PASS; only `S` ❌ and the fix is a tier change (estimated Ops ≤ 3 on a `full` story → `light`; > 3 on a `light` story → `full`) → RE-TIER; `S` or `I` ❌ otherwise → SPLIT; any of `N/V/E/T` ❌ → `INVEST_VERDICT: FAIL <letter>: <reason>` (the conductor's `stage-end` maps it to `spec_contradiction`, Task 4).
  - MUST NOT: write any file, run any command, ask anything.

- [ ] **Step 2: `story-verifier`** (`tools: Read, Grep, Glob, Bash, Write, Edit`)
  - Input: the verification skill name (`spec-writing-verification | plan-writing-verification | spec-implementation-verification`), `US-NNN`, optional `Op-X`, the report path to write.
  - It **is** the fresh agent the skill would spawn: locate the skill (`find -L ~/.claude/skills ~/.claude/plugins -path '*/skills/<skill>/SKILL.md' | head -1`), read it, execute its "Agent Prompt" checklist itself, write the report to the given path (create `verification/`), then perform the skill's "After the Agent Returns" steps in autopilot mode: update `state.json` audit blobs where the skill says so, journal the gate (`--gate <spec-verification|plan-verification|green-audit>`, `--report <path>`), file every warning with `ledger backlog add … --report <path>`, and on `FAIL` write `stop_reason` per contract §2 and end with `<promise>AUTOPILOT_STOP_verifier_fail</promise>`.
  - Ends with the skill's sentinel: `SPEC_AUDIT_COMPLETE_US-NNN` / `PLAN_AUDIT_COMPLETE_US-NNN` / `GREEN_AUDIT_COMPLETE_US-NNN_Op-X` (or `…_US-NNN` for story-end).
  - MUST NOT: fix the artefacts it audits, ask questions, spawn agents.

- [ ] **Step 3: `lazy-simplifier`** (`tools: Read, Grep, Glob, Bash, Edit, Write`)
  - Input: `US-NNN`, `BASE_SHA` (parent of the story's first `test(US-NNN):` commit — the prompt passes it; if absent the agent computes it with `git log --reverse --grep '^test(US-NNN)' --format=%h | head -1` and `^`).
  - Scope: `git diff --name-only $BASE_SHA..HEAD | grep -v '^specs/'`. Applies the ponytail ladder to each file: delete before add, reuse an existing helper before writing one, stdlib before dependency, native platform feature before code, one line before a function; no new abstraction with one caller; never touch tests' assertions or `specs/**`.
  - After edits: `<TEST> -t "@US-NNN"` + `<BDD>` story filter (contract §4) must pass, then `ledger regress --base HEAD …` exit 0; commit `refactor(US-NNN): simplify — <what>` and journal it. Every corner it deliberately leaves (a `ponytail:` comment, an O(n²) scan, a missing guard it chose not to add) → `ledger backlog add --kind simplification --severity info --gate simplify`.
  - Writes `state.json.quality_gates.simplified = true`, journals `--kind gate --gate simplify --verdict PASS --summary "<n> files, <m> commits, <k> BL items"`, ends with `<promise>SIMPLIFY_COMPLETE_US-NNN</promise>`. If the suite cannot be brought back green after a simplification → revert that edit (`git checkout -- <file>`), file a BL item, continue; it never stops the run.

- [ ] **Step 4: `story-reviewer`** (`tools: Read, Grep, Glob, Bash, Edit, Write`)
  - Input: `US-NNN`, `BASE_SHA`. Reads PLAN.md's Structure / Norms / Safeguards, ARCHITECTURE.md's module map and dependency rules, then the story diff.
  - Reviews for: architecture compliance (module boundaries, dependency direction, public APIs only), Norms, Safeguards, over-implementation beyond Op scope, obvious bugs / missed edge cases.
  - Critical findings (a boundary violation, a Safeguard not enforced, a real bug) → fix in place, re-run the story suite + `ledger regress`, commit `fix(US-NNN): review — <what>`, journal. Warnings → `ledger backlog add --severity warning --gate code-review --report <report path>`; write the report to `specs/story-NNN-slug/verification/code-review.md`; append the BL ids to `state.json.quality_gates.review_findings[]`; set `quality_gates.reviewed = true`; journal `--kind gate --gate code-review --verdict PASS|PASS_WITH_WARNINGS`; end with `<promise>REVIEW_COMPLETE_US-NNN</promise>`.
  - A critical it cannot fix without an architecture change → journal a decision, `ledger backlog add --severity error --kind refactor`, still `reviewed = true` (the E2E gate is next; the error-severity item is the flag), continue.

- [ ] **Step 5: Validate and commit**

`bash scripts/validate.sh` → exit 0 (section 6 checks the four files). `bash scripts/install-local.sh autopilot` → the four agents appear in `~/.claude/agents/`.

```bash
git add plugins/autopilot/agents && git commit -m "feat(autopilot): bundled agents — invest-assessor, story-verifier, lazy-simplifier, story-reviewer"
```

---

### Task 6: `/autopilot` SKILL.md, README, 1.0.0

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/SKILL.md` (replace the scaffold)
- Modify: `plugins/autopilot/README.md`, `plugins/autopilot/CHANGELOG.md`, `plugins/autopilot/.claude-plugin/plugin.json` (via bump)

**Interfaces:**
- Consumes: every `autopilot.mjs` subcommand from Tasks 2–4; the agents from Task 5.

- [ ] **Step 1: Write SKILL.md** with frontmatter (`name: autopilot`, `version` = plugin version, the Task 1 description) and these sections:

  1. **What it is / what it refuses** — drives one story or a chain; never runs `/high-level-scoping` or `/research-and-architecture` and says so; user decisions it needs happen before (`scoping`, `architecture`) and after (`/backlog BL-NNN`).
  2. **Locate the scripts**:
     ```bash
     AP="$(find -L "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/autopilot/scripts/autopilot.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
     ```
     plus the contract §5 `LEDGER` line. Empty `AP` → print the install command and stop.
  3. **Usage**: `/autopilot US-NNN [--until US-MMM] [--stop-policy hard-failures|hard-failures+story-end] [--skip-arch-check] [--force] [--stop]`. `--stop` → `node "$AP" stop --reason user_stop` and print the report; nothing else.
  4. **Pre-flight**: `node "$AP" start US-NNN …`; on `ok:false` print the errors verbatim and stop (no journal yet — the run never existed). Note that the check list lives in the script (Task 2's table) so the skill does not restate it.
  5. **The loop** (the whole conductor; keep it short, it is executed literally):
     ```
     loop:
       N=$(node "$AP" next)
       done → print report (node "$AP" stop --reason <reason>) and end with <promise>AUTOPILOT_PAUSED_<reason></promise>
       stop → already stopped by the script; print report; end with <promise>AUTOPILOT_STOP_<reason></promise>
       node "$AP" stage-start --story --stage --op --agent
       dispatch ONE subagent (Agent tool) per the dispatch table below; capture its full output
       m = sentinel match (matchSentinel semantics: the stage's sentinel, or AUTOPILOT_STOP_<reason>)
       sentinel  → R=$(node "$AP" stage-end --outcome sentinel [--verdict "<invest verdict>"])
       stop      → node "$AP" stage-end --outcome stop --reason <reason>
       none      → R=$(node "$AP" stage-end --outcome no_sentinel --tail "<last 400 chars>") ; action retry → re-dispatch the same stage with the tail appended to the prompt ("Previous attempt ended without its sentinel; its last output was: …")
       R.action == stop → print report, end with the stop sentinel
     ```
     The conductor never reads specs itself — only the JSON the script prints. It never calls `AskUserQuestion` (it is the autopilot).
  6. **Dispatch table** — per `agent` value:
     - `general-purpose`: `Agent({ subagent_type: "general-purpose", prompt })` with the prompt: *"Use the `<skill>` skill for `<args>`. AUTOPILOT is active: read `specs/autopilot.json` and follow `references/autopilot-contract.md` §1–2 exactly (no questions, warnings → backlog, hard stops → `<promise>AUTOPILOT_STOP_<reason></promise>`). Read only the inputs the skill names. If the Skill tool is unavailable, read the SKILL.md at `$(find -L ~/.claude/skills ~/.claude/plugins -path '*/skills/<skill>/SKILL.md' | head -1)` and follow it. End your reply with the skill's completion sentinel."*
     - `invest-assessor`: prompt = *"Assess `US-NNN`. End with the `INVEST_VERDICT:` line."*
     - `story-verifier`: prompt names the verification skill, `US-NNN [Op-X]`, and the report path (`spec-audit.md` / `plan-audit.md` / `green-audit-Op-X.md`).
     - `lazy-simplifier` / `story-reviewer`: prompt gives `US-NNN` and `BASE_SHA` (compute: `git log --reverse --grep '^test(US-NNN)' --format=%h | head -1`, then `^`).
  7. **Stop / pause report** — `node "$AP" report` text: stages run, Ops GREEN, gates + verdicts, BL ids, commits. Resume = same command; the script starts a new `run_id` and `next` continues from the trackers.
  8. **Stop reasons** — contract §2 list + `stage_no_sentinel`, `stage_no_progress`, `preflight_failed`, `story_end`, `until_reached`, `user_stop`, one line each.
  9. **What this skill does NOT do** — scoping, architecture, editing specs, merging, pushing.
  10. **Self-review (mandatory, printed)** — `[ ] every stage_start has a stage_end or the stop line`, `[ ] no AskUserQuestion was called`, `[ ] the report lists every BL id created this run`.

- [ ] **Step 2: README** — sections: what it is (2 paragraphs), Install (`/plugin install autopilot@claude-dev-skill` **and** `dev-ledger`), Usage, the stage machine as a fenced block (copy the §4.1 diagram, with `invest`, `simplify`, `code-review` inserted where they run), the agents table (name / role / tools), stop policy + stop reasons, Tests (`node --test skills/autopilot/scripts/autopilot.test.mjs`), Changelog link. No `**Version:**` footer line (they go stale — the deferred-minor from Plan 1).

- [ ] **Step 3: Release 1.0.0**

`bash scripts/bump.sh autopilot major` (0.1.0 → 1.0.0); CHANGELOG `[1.0.0]` `### Added`: `- /autopilot conductor (start/next/stage-start/stage-end/stop/report in autopilot.mjs), bundled agents invest-assessor / story-verifier / lazy-simplifier / story-reviewer, DAG chaining with --until, stop policies, retry + no-progress guards.` Remove the scaffold's `[0.1.0]` entry. `bash scripts/validate.sh` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add plugins/autopilot .claude-plugin/marketplace.json && git commit -m "feat(autopilot): conductor skill, README, release 1.0.0"
```

---

### Task 7: Missing seams — sentinels for `plan-writing` and the two document verifiers, persisted reports

**Files:**
- Modify: `plugins/plan-writing/skills/plan-writing/SKILL.md` (Phase 3 step 3, ~line 209)
- Modify: `plugins/spec-writing-verification/skills/spec-writing-verification/SKILL.md` ("After the Agent Returns", ~line 200)
- Modify: `plugins/plan-writing-verification/skills/plan-writing-verification/SKILL.md` ("After the Agent Returns", ~line 212)

**Interfaces:**
- Produces: `PLAN_COMPLETE_US-NNN`, `SPEC_AUDIT_COMPLETE_US-NNN`, `PLAN_AUDIT_COMPLETE_US-NNN`; report files `specs/story-NNN-slug/verification/spec-audit.md` and `plan-audit.md` (what Task 3's `next` checks).

- [ ] **Step 1: plan-writing** — after the `Outside autopilot, use AskUserQuestion` block add: `Under autopilot (contract §2), skip the question and emit \`<promise>PLAN_COMPLETE_US-NNN</promise>\`.`
- [ ] **Step 2: spec-writing-verification** — make step 1 of "After the Agent Returns": `Persist the report to \`specs/story-NNN-slug/verification/spec-audit.md\` (create the directory), then present its summary.` Use that path as `--report` in the journal and backlog lines that follow. Add at the end: `Under autopilot, skip the question and emit \`<promise>SPEC_AUDIT_COMPLETE_US-NNN</promise>\`.` Add a sentence under "Execution": `Under \`/autopilot\` this skill's audit is performed by the bundled \`story-verifier\` agent, which reads this file and executes the Agent Prompt itself (a subagent cannot spawn agents).`
- [ ] **Step 3: plan-writing-verification** — same three edits with `plan-audit.md` and `PLAN_AUDIT_COMPLETE_US-NNN`.
- [ ] **Step 4: grep the repo** for `SPEC_AUDIT_COMPLETE\|PLAN_AUDIT_COMPLETE\|PLAN_COMPLETE_\|spec-audit.md\|plan-audit.md` — the only hits must be these three skills, `autopilot.mjs`, its tests, the agents and the autopilot README/SKILL.
- [ ] **Step 5: Bumps + commit** — `bash scripts/bump.sh plan-writing minor` (`- Autopilot: PLAN_COMPLETE sentinel.`), `bash scripts/bump.sh spec-writing-verification minor` (`- Report persisted to verification/spec-audit.md; SPEC_AUDIT_COMPLETE sentinel; under /autopilot the audit runs in the story-verifier agent.`), `bash scripts/bump.sh plan-writing-verification minor` (analogous). `bash scripts/validate.sh` → 0.

```bash
git add -A && git commit -m "feat(plan-writing,spec-writing-verification,plan-writing-verification): autopilot sentinels, persisted audit reports"
```

---

### Task 8: `spec-writing` 3.0.0 — Phase 0 via `invest-assessor`

**Files:**
- Modify: `plugins/spec-writing/skills/spec-writing/SKILL.md` (frontmatter description; Phase 0 whole section; Writing Quality Checklist)
- Modify: `plugins/spec-writing/.claude-plugin/plugin.json` description (mirror the frontmatter)

**Interfaces:**
- Consumes: `invest-assessor` output contract (Task 5 Step 1); `stories[i].invest` written by the conductor's `stage-end` (Task 4).

- [ ] **Step 1: Rewrite Phase 0** so it reads, in order:
  1. **Already assessed?** If `stories[i].invest` has all six letters `true` and a `checked_at` — under autopilot that means the conductor's `invest` stage just ran — record the table in STORY.md from those flags and skip to Phase 1 (journal nothing; the gate entry already exists).
  2. **Otherwise run the agent**: `Agent({ subagent_type: "invest-assessor", prompt: "Assess US-NNN. End with the INVEST_VERDICT: line." })` and parse the last line.
  3. **Under autopilot (no conductor — `AUTOPILOT=1` legacy loop)** the verdict is final, handled exactly as the current "Under autopilot (contract §2)" paragraph specifies (PASS → gate PASS; RE-TIER → write `rigor` + decision; SPLIT → `split_required`; FAIL → `spec_contradiction`).
  4. **Outside autopilot** the agent's table seeds the gate: light stories get the existing single `AskUserQuestion` with the agent's table as preview; full stories walk the six questions **pre-filled** with the agent's status + note, so the user confirms or corrects instead of filling in. `SPLIT` outside autopilot → present the proposed split and offer to create the stubs (existing behaviour). Keep the letter table, the `stories.json` write-back block and the "do NOT silently bypass INVEST" rule.
  Delete the sentence `\`/autopilot\` (Plan 2) replaces the auto-checks with the \`invest-assessor\` agent; the verdict handling stays as written here.` (grep the repo for `Plan 2` afterwards — zero hits outside `docs/`).
- [ ] **Step 2: Checklist** — add `- [ ] INVEST table came from the invest-assessor agent (or the conductor's invest stage), not from an unaided guess`.
- [ ] **Step 3: Bump major** — `bash scripts/bump.sh spec-writing major` (2.2.1 → 3.0.0). CHANGELOG `### Changed`: `- **Breaking:** Phase 0 INVEST gate is produced by the bundled \`invest-assessor\` agent (from the \`autopilot\` plugin). Outside autopilot the user confirms the agent's table; under autopilot the verdict is final. Requires \`autopilot\` ≥ 1.0.0 to be installed for the gate; without it the skill prints the install command.` Add that fallback sentence to Phase 0 step 2 (agent unavailable → print `Install autopilot: /plugin install autopilot@claude-dev-skill`; outside autopilot fall back to the manual six-question walk; under autopilot hard stop `tooling_not_ready`). Update the frontmatter + plugin.json description to mention the agent. `bash scripts/validate.sh` → 0.

```bash
git add -A && git commit -m "feat(spec-writing)!: INVEST gate via invest-assessor agent (3.0.0)"
```

---

### Task 9: `spec-implementation` — story-end gates via agents, skip when the conductor ran them

**Files:**
- Modify: `plugins/spec-implementation/skills/spec-implementation/SKILL.md` (Gate 1, Gate 2, "When to use subagents", line 216 shorthand)

- [ ] **Step 1: Gate 1 — Simplify**: first line `If \`state.json.quality_gates.simplified\` is already \`true\` (the \`/autopilot\` conductor ran the \`lazy-simplifier\` stage), skip this gate.` Otherwise: `Agent({ subagent_type: "lazy-simplifier", prompt: "Simplify story US-NNN. BASE_SHA=<sha>." })` replaces the `/simplify` call; keep the `BASE_SHA` definition and the "everything must still pass" sentence; the agent itself writes the flag and journals the gate (say so). Fallback when the agent is not installed: the existing inline `/simplify` procedure.
- [ ] **Step 2: Gate 2 — Code Review**: same skip line on `quality_gates.reviewed`; `Agent({ subagent_type: "story-reviewer", prompt: "Review story US-NNN. BASE_SHA=<sha>." })` replaces "Dispatch a code-review subagent"; keep the audit bullet list as the description of what the reviewer checks; the agent writes `review_findings[]`, `reviewed`, the journal line. Fallback: a `general-purpose` subagent with the same bullet list.
- [ ] **Step 3: Decision Rules → "When to use subagents"**: `Gate 1: lazy-simplifier agent. Gate 2: story-reviewer agent. Gate 3: inline.`
- [ ] **Step 4: Deferred minor** — line 216: replace the bare `node "$LEDGER" backlog add\`` with the full form `node "$LEDGER" backlog add --title "<unchecked item>" --severity warning --kind <bug|test-gap|refactor> --story US-NNN --op Op-X`. Then `grep -rn 'backlog add`' plugins/` — fix any other bare shorthand the same way.
- [ ] **Step 5: Bump minor** — `bash scripts/bump.sh spec-implementation minor` (3.2.1 → 3.3.0): `- Story-end Gate 1 runs the \`lazy-simplifier\` agent and Gate 2 the \`story-reviewer\` agent (both from the \`autopilot\` plugin); a gate already flipped by the /autopilot conductor is skipped. Full \`backlog add\` form in the per-op self-review.` `bash scripts/validate.sh` → 0.

```bash
git add -A && git commit -m "feat(spec-implementation): story-end gates via lazy-simplifier / story-reviewer agents"
```

---

### Task 10: `dev-ledger` 1.0.2 — `formatBacklog([])` prints a line

**Files:**
- Modify: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs:369-378`
- Modify: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs`

- [ ] **Step 1: Failing test** — `test("formatBacklog([]) prints a single '(no backlog items)' line", () => assert.equal(formatBacklog([]), "(no backlog items)\n"))` (import `formatBacklog`). Run → fails (`""`).
- [ ] **Step 2: Implement** — the empty case returns `"(no backlog items)\n"`. Run → 31/31.
- [ ] **Step 3: Bump patch** — `bash scripts/bump.sh dev-ledger patch` (→ 1.0.2); also set `version: 1.0.2` in `skills/backlog/SKILL.md` frontmatter by hand (bump.sh only touches the main skill; validate.sh checks both). CHANGELOG `### Fixed`: `- \`backlog list\` prints \`(no backlog items)\` instead of nothing when the list is empty.` `bash scripts/validate.sh` → 0.

```bash
git add -A && git commit -m "fix(dev-ledger): backlog list prints a line when empty (1.0.2)"
```

---

### Task 11: Catalog, top-level changelog, local install, dogfood dry run

**Files:**
- Modify: `README.md` (Philosophy paragraph; new `### Autopilot` under the catalog; version cells), `CHANGELOG.md` (`[Unreleased]`)

- [ ] **Step 1: README** — in `## Philosophy` extend the journal paragraph's last sentence to: `… so \`/autopilot US-NNN\` can drive a story end-to-end — see the Autopilot section below.` Add after `### Traceability`:

  ```markdown
  ### Autopilot

  | Skill       | Version | What it does |
  | ----------- | ------- | ------------ |
  | `autopilot` | 1.0.0   | `/autopilot US-NNN [--until US-MMM]` — runs the per-story loop unattended once scoping and architecture are validated: one fresh subagent per stage, INVEST via the `invest-assessor` agent, spec/plan audits via `story-verifier`, per-Op RED → GREEN, story-end `lazy-simplifier` + `story-reviewer` gates, then the mandatory E2E gate. Warnings become `BL-NNN` items, hard failures stop the run with a report, every step lands in `specs/journal.jsonl`. Pauses after each verified story by default (`--stop-policy hard-failures` to chain through). |
  ```

  Update the version cells for `spec-writing` (3.0.0), `spec-implementation` (3.3.0), `plan-writing`, `spec-writing-verification`, `plan-writing-verification`, `dev-ledger` (1.0.2) to match each `plugin.json` (`for p in plugins/*/; do jq -r '"\(.name) \(.version)"' $p/.claude-plugin/plugin.json; done` and compare). In the `specs/` tree comment for `autopilot.json` keep `present only while /autopilot runs` and add `verification/{spec,plan}-audit.md, code-review.md` under `story-000-foundation/verification/`.
- [ ] **Step 2: CHANGELOG `[Unreleased]` → `### Added`**: `- **\`autopilot\`** plugin (conductor + four bundled agents). \`validate.sh\` now checks bundled agents' frontmatter and every contract copy on disk; \`uninstall-local.sh\` unlinks every skill dir of a plugin; CI runs the autopilot tests.`
- [ ] **Step 3: Validate + install** — `bash scripts/validate.sh` → 0; both test suites green; `bash scripts/install-local.sh --all` → `~/.claude/skills/autopilot` and the four agents linked.
- [ ] **Step 4: Dogfood dry run on finfetch-web (read-only)**

  ```bash
  cd /home/ttadmin/Codes/finfetch-web
  AP="$(find -L "$HOME/.claude/skills" -path '*/autopilot/scripts/autopilot.mjs' | head -1)"
  node "$AP" preflight US-002                      # expect ok:false — the arch check (no tech_stack/adrs there)
  node "$AP" preflight US-002 --skip-arch-check    # expect ok:true, warnings:[skip-arch-check…]
  node "$AP" next --story US-002                   # expect stage test-setup or spec-implementation with the Op state.json's cursor names
  node "$AP" next --story US-003                   # US-003 depends on US-002 (red) → the dry run still resolves a stage; preflight is what blocks it — confirm `preflight US-003` errors on the dependency
  git status --short                               # expect empty — nothing written
  cd /home/ttadmin/Codes/claude-dev-skill
  ```

  Record the three JSON outputs in the commit body.
- [ ] **Step 5: Commit and open the PR**

  ```bash
  git add -A && git commit -m "docs: catalog autopilot; changelog; dogfood dry run on finfetch-web"
  git push -u origin feat/autopilot-plan2
  gh pr create --title "feat: autopilot plugin — conductor, stage machine, bundled agents (plan 2/3)" --body-file <(printf '%s\n' "Implements docs/superpowers/specs/2026-08-30-autopilot-design.md §4 per docs/superpowers/plans/2026-09-05-autopilot-plugin.md." "" "Deviations from the spec are listed in the plan header (conductor-owned agent stages, added sentinels, node --test instead of a claude -p fixture)." "" "🤖 Generated with [Claude Code](https://claude.com/claude-code)" "" "https://claude.ai/code/session_018nfctJSNeCoumYUFB6FtsW")
  ```

  Then the live dogfood is the user's call (it commits into finfetch-web): `/autopilot US-002 --skip-arch-check` from a finfetch-web session.

---

## Self-review against the spec

- **§4.1 skill**: usage + policies (Task 6 §3), pre-flight list incl. `--skip-arch-check` and refusal to scope/architect (Task 2 table, Task 6 §1), stage machine (Task 3 rules; `invest`/`simplify`/`code-review` added per the header deviation), execution model — conductor reads only trackers, one subagent per stage, three-line prompt (Task 6 §5–6), retry once then `stage_no_sentinel` (Task 4 `stageEnd`), stop/pause report + resume (Task 4 `stop`/`report`, Task 6 §7).
- **§4.2 agents**: `invest-assessor` PASS/RE-TIER/SPLIT with SPLIT as a hard stop (Task 5 §1 + Task 4 verdict handling), `story-verifier` wraps the verification skills (Task 5 §2, Task 7 makes their reports persistable), `lazy-simplifier` ladder + BL items (Task 5 §3), `story-reviewer` fixes criticals / files warnings (Task 5 §4).
- **§4.3 spec-writing**: Task 8 — agent verdict final under autopilot, seeds the interactive gate outside; major bump per §9.
- **§7 error handling**: no-sentinel retry (Task 4), concurrent run refusal + `--force` journaled (Task 2/4), ledger write failure = the ledger CLI's non-zero exit propagates (agents/skills treat it as a hard stop per contract §3 — unchanged).
- **§8 testing**: `node --test` over `autopilot.mjs` with fixture trackers (Tasks 2–4), CI wired (Task 1), agents validated structurally (Task 1 §6), dogfood dry run (Task 11).
- **§9 versioning**: `autopilot 1.0.0`, `spec-writing 3.0.0`; the others minor/patch as listed; README catalog gains the Autopilot section (Task 11).
- **Deferred minors folded in**: `uninstall-local.sh` extra skills (Task 1), contract drift for unrostered plugins (Task 1), bare `backlog add` shorthand (Task 9), `formatBacklog([])` (Task 10), no `**Version:**` footer in the new README (Task 6). Left out on purpose: test temp-dir cleanup, `regress` re-running the head suite, stale footers in the other READMEs.
- **Names used consistently**: exports `locateLedger, loadLedger, readJson, writeJson, storyDir, readState, readAutopilot, preflight, STAGES, matchSentinel, nextEligibleStory, nextStage, start, stageStart, stageEnd, stop, report, main, DEFAULT_POLICY, POLICIES`; CLI verbs `preflight | start | next | stage-start | stage-end | stop | report`; `autopilot.json` keys `active run_id target until stop_policy skip_arch_check current{story stage op agent started_at attempt} last_next started_at stopped_at stop_reason`; agents `invest-assessor | story-verifier | lazy-simplifier | story-reviewer`; report files `spec-audit.md | plan-audit.md | green-audit-Op-X.md | green-audit-story-end.md | code-review.md`.
