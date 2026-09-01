# Design: Autopilot, Ledger and Specs Site for claude-dev-skill

**Date:** 2026-08-30
**Branch:** `feat/autopilot`
**Status:** Design — awaiting user review before `/writing-plans`.

## 1. Goal

Keep the pipeline's practices (INVEST stories, REASONS canvas, per-Operation RED → GREEN → REFACTOR, layered quality gates, the mandatory E2E gate) but remove the human from every gate after the architecture is validated, while making everything that happened auditable afterwards and every un-applied improvement retrievable by ID.

Philosophy: **implement first, apologise after.** The user validates scoping and architecture, says `/autopilot US-000`, and comes back to a verified story, a journal of every decision/action/gate, a backlog of un-applied findings, and a live site that shows all of it.

Four deliverables, shipped in this order:

1. **Unattended-mode fixes** to the existing skills + one shared `AUTOPILOT` contract.
2. **`dev-ledger`** plugin — journal + backlog scripts, `/backlog` skill.
3. **`autopilot`** plugin — the orchestrator skill + bundled agents.
4. **`specs-site`** plugin — an Astro app that renders `specs/**` live.

Out of scope: automating `/high-level-scoping` and `/research-and-architecture` (they stay interactive and user-validated), replacing `stories.json` / `state.json` (they remain the machine trackers), any change to `specs/` layout.

## 2. The `AUTOPILOT` contract (all existing pipeline skills)

### 2.1 Activation

`specs/autopilot.json` exists with `"active": true`. Written by `/autopilot` on start, set to `false` on stop. Env `AUTOPILOT=1` is an equivalent override for `claude -p` drivers. Every pipeline skill checks this in its Pre-Flight.

```json
{
  "active": true,
  "run_id": "run-2026-08-30T15:00:00Z",
  "target": "US-000",
  "until": "US-000",
  "stop_policy": "hard-failures+story-end",
  "current": { "story": "US-000", "stage": "spec-implementation", "op": "Op-2", "agent": "agent-7f3a", "started_at": "..." },
  "started_at": "...",
  "stopped_at": null,
  "stop_reason": null
}
```

### 2.2 Rules when active

Replaces every skill's scattered "inside a ralph-loop" prose with one referenced section (`references/autopilot-contract.md`, one canonical copy in `autopilot`, symlinked/duplicated verbatim into each plugin so plugins stay self-contained).

1. **Never `AskUserQuestion`.** Take the option the skill marks *(Recommended)*. If no option is marked, take the first. Log the choice with `ledger log --kind decision`.
2. **Never stop for warnings.** A verifier `PASS_WITH_WARNINGS` → each warning becomes a backlog item (`ledger backlog add`) and the skill continues.
3. **Stop conditions** (skill writes `stop_reason` and exits with the sentinel `<promise>AUTOPILOT_STOP_<reason></promise>`):
   - a verifier verdict `FAIL`;
   - an Operation `blocked` after **2** retries;
   - a regression in a story already `verified`;
   - a spec contradiction (`/verification-and-validation`'s "flag only" case);
   - `TOOLING_NOT_READY` from `/test-setup`'s toolchain gate.
4. **Every decision, action and gate result is journaled** (see §3). Existing `state.json.decisions[]` writes stay (they're the per-story view) and are mirrored to the journal by the same call.
5. **Sentinels unchanged.** The existing `<promise>…COMPLETE…</promise>` tokens remain the completion signal the orchestrator reads.

### 2.3 Unattended-mode gaps to fix (found on finfetch-web US-008)

| Gap | Fix |
| --- | --- |
| Commands hardcoded to `bun test`, `bun bdd --tags="@US-NNN and @Op-X"` | Every skill reads commands from `package.json` `scripts` (`test`, `bdd`, `lint`, `typecheck`, `dev`, `e2e`) and falls back to `bun`/`npm` by lockfile. Op filtering: `@Op-X` tag if present, else **scenario names from the Op's `Covers scenarios:` line** (first-class, not "legacy"). |
| No non-automatable test type; `/test-setup` demands every row fail at assertion time | New Test Plan type `manual`. `/plan-writing` may emit it only for rows whose Asserts reference something outside the repo (a host, a network, a human). `/test-setup` and `/spec-implementation` skip `manual` rows; `/verification-and-validation` walks them, records the outcome in `qa-report.md`, and flips `test_plan_rows[T-N].passing`. `state.json` gains `tests_status: "manual"` for rows so typed. |
| Cursor semantics differ: `/test-setup` advances to next `pending`, `/spec-implementation` to next `red`, so after a GREEN the cursor is `null` while Ops remain pending | One rule in both skills and the schema: `current_operation` = first Op whose `operation_phase ∉ {green, refactored}`; `null` only when every Op is GREEN. |
| Story-end Gate 3 duplicates `/verification-and-validation` (starts app, curl, Playwright) | Gate 3 = suite + bdd + lint + typecheck + module-boundary check only. Live-app checks live in V&V alone. |
| Regression baseline undefined when the unfiltered suite is permanently red (RED scaffolds of unstarted stories) | Define the baseline: run the unfiltered suite on `HEAD~` and `HEAD`, compare the set of failing test ids; a regression is a test failing on `HEAD` that passed on `HEAD~`. Provided as `ledger regress --base HEAD~` so every skill uses the same computation. |
| `NEVER add a Co-Authored-By trailer` contradicts host commit rules | Remove the line from all skills; commit trailers are the host's business. |
| `/spec-writing` INVEST gate needs a human even for light stories | See §4.3 — an `invest-assessor` agent produces the verdict; the user is only consulted outside autopilot. |

## 3. `dev-ledger` plugin

Scripts only (Node ≥ 20, stdlib, zero deps) + one skill. Lives at `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs`; invoked as `node <plugin>/scripts/ledger.mjs <cmd>`; `/repo-initialization` adds `"ledger": "node …/ledger.mjs"` to the project's `package.json` scripts so skills call `npm run ledger -- …` uniformly.

### 3.1 Journal — `specs/journal.jsonl`

Append-only, one JSON object per line, never edited, committed with the work it describes.

```json
{"ts":"2026-08-30T15:04:11Z","run_id":"run-…","story":"US-008","op":"Op-2","stage":"test-setup","kind":"decision","agent":"agent-7f3a","summary":"RED-B skipped: PLAN.md lists no unit row for Op-2","refs":["specs/story-008-staging-deployment/PLAN.md#operation-2"],"sha":null}
```

- `kind ∈ {stage_start, stage_end, decision, action, gate, finding, commit, stop}`.
- `gate` entries carry `{"gate":"self-review|simplify|code-review|verify|invest|spec-verification|plan-verification|red-audit|green-audit|v-and-v","verdict":"PASS|PASS_WITH_WARNINGS|FAIL","report":"path"}`.
- `finding` entries carry the `BL-NNN` id they produced.
- `commit` entries are written by a `post-commit` git hook installed by `/repo-initialization` (`ledger log --kind commit --sha $(git rev-parse HEAD)`), so commits are journaled even when a skill forgets.

CLI: `ledger log --kind decision --story US-008 --op Op-2 --stage test-setup --summary "…" [--ref path]…`. Story/op/stage/agent default from `specs/autopilot.json.current` when active, so subagents can omit them.

`ledger journal [--story US-008] [--op Op-2] [--kind gate] [--since 2026-08-30]` prints a readable table — the CLI audit view before the site exists.

### 3.2 Backlog — `specs/backlog.json`

```json
{
  "next_id": 13,
  "items": [
    {
      "id": "BL-012",
      "title": "Extract podman helper shared by deploy.steps and e2e",
      "detail": "…",
      "source": { "stage": "spec-implementation", "gate": "code-review", "story": "US-008", "op": "Op-1", "report": "specs/story-008-staging-deployment/verification/green-audit-Op-1.md" },
      "severity": "warning",
      "kind": "simplification",
      "files": ["tests/bdd/steps/deploy.steps.ts"],
      "status": "open",
      "created_at": "2026-08-30",
      "resolved_at": null,
      "resolved_sha": null,
      "resolution": null
    }
  ]
}
```

- `severity ∈ {info, warning, error}`; `kind ∈ {bug, simplification, refactor, test-gap, spec-gap, doc, perf, security}`; `status ∈ {open, in-progress, done, wontfix}`.
- CLI: `ledger backlog add --title … --severity … --kind … [--file …]… [--detail …]` (prints the id; source defaults from `autopilot.json.current`); `ledger backlog list [--status open] [--story …]`; `ledger backlog resolve BL-012 --sha … --resolution "…"`; `ledger backlog wontfix BL-012 --reason "…"`.
- Every producing skill and every verifier routes un-applied findings here **instead of** chat prose. `state.json.quality_gates.review_findings[]` keeps a list of the `BL-` ids it produced.

### 3.3 `/backlog` skill

- `/backlog` — lists open items grouped by story and severity.
- `/backlog BL-012` — reads the item + its source report, reproduces the issue if it is a bug (failing test first), applies the fix via the ponytail ladder (reuse → stdlib → native → installed dep → one line → minimum code), runs the story's suite + `ledger regress`, commits `fix|refactor(US-NNN): BL-012 — <title>`, journals, resolves the item. Honours the `AUTOPILOT` contract like every other skill. `--wontfix "reason"` closes without changes.

## 4. `autopilot` plugin

### 4.1 Skill `/autopilot US-NNN [--until US-MMM] [--stop-policy hard-failures|hard-failures+story-end]`

Default stop policy (user's choice): **`hard-failures+story-end`** — continue through warnings, stop on the §2.2 hard conditions **and** pause after every story reaches `verified`. `--until` chains stories in DAG order (each story still pauses at its end unless `--stop-policy hard-failures`).

**Pre-flight (hard stops):** `specs/stories.json` and `specs/ARCHITECTURE.md` exist; target story `phase ≥ scoped`; every `depends_on_story_ids` is `verified` (or foundation); `ARCHITECTURE.md` has been through `/research-and-architecture` (`stories.json.architecture.tech_stack` or `adrs` present — the fields that skill adds; finfetch-web currently has neither, so `--skip-arch-check` is provided for migrated repos and journaled); clean working tree; no other `autopilot.json` run `active`. It **refuses** to run `/high-level-scoping` or `/research-and-architecture` and says so.

**Stage machine** (resumed from `stories.json.phase` + `state.json`, so a killed session restarts at the right stage):

```
repo-initialization            only US-000 on an empty repo
spec-writing                   Phase 0 INVEST via invest-assessor agent
spec-writing-verification      story-verifier agent, findings → backlog
plan-writing
plan-writing-verification      story-verifier agent, findings → backlog
for each Op:
  test-setup Op-X
  spec-implementation Op-X     GREEN + REFACTOR
  spec-implementation-verification Op-X   full-rigor stories only
spec-implementation            story-end gates: lazy-simplifier, story-reviewer, verify
verification-and-validation    the mandatory E2E gate
→ pause (story-end) or next story (--until)
```

**Execution model.** The main session is the conductor: it reads/writes `autopilot.json`, journals `stage_start`/`stage_end`, and dispatches **one `general-purpose` subagent per stage** with a narrow prompt: "Use the `<skill>` skill for `US-NNN [Op-X]`. `AUTOPILOT` is active. Read `specs/autopilot.json`, the story's `state.json` and only the inputs the skill names. Return the sentinel." The conductor never reads specs itself beyond the trackers, keeping its context small across a whole story. Verifier stages use the bundled agents (§4.2) instead of `general-purpose`.

**Retry:** a stage that returns neither its sentinel nor a stop sentinel is retried once with the subagent's tail output attached; second miss → `stop_reason: "stage_no_sentinel"`.

**Stop/pause:** write `autopilot.json` (`active:false`, `stop_reason`), journal `stop`, print a compact report: stages run, Ops GREEN, gates + verdicts, backlog ids created, commits. Resume with the same command.

### 4.2 Bundled agents (`plugins/autopilot/agents/*.md`)

| Agent | Role | Notes |
| --- | --- | --- |
| `invest-assessor` | Scores the six INVEST letters for a story from `stories.json` + `PROJECT.md` + `ARCHITECTURE.md`; returns `PASS`, `RE-TIER` (light↔full, writes `rigor`), or `SPLIT` (proposes the split; a `SPLIT` is a hard stop — splitting a story changes the backlog the user validated). | Fresh context, read-only tools. |
| `story-verifier` | Runs the existing `*-verification` skill it is told to (spec / plan / red / green / story-end) and emits verdict + findings as `ledger backlog add` calls. | Wraps the verification skills unchanged. |
| `lazy-simplifier` | Story-end Simplify gate. Ponytail ladder over the story's diff: delete before add, reuse before write, stdlib before dep, one line before function. Applies safe simplifications, re-runs the suite; every corner it deliberately leaves (`ponytail:` comments, O(n²), missing guard) becomes a `BL-` item. | Replaces the generic `/simplify` call. |
| `story-reviewer` | Story-end Code Review gate: architecture boundaries, Norms, Safeguards, over-implementation. Critical findings are fixed in-line (it may edit + commit); warnings → backlog. | Fresh context. |

### 4.3 Changes to `/spec-writing`

Phase 0 becomes: run the `invest-assessor` agent; under `AUTOPILOT` its verdict is final (`PASS` → continue; `RE-TIER` → write and continue; `SPLIT` → stop). Outside autopilot the existing interactive gate stays, seeded with the agent's table so the user confirms instead of filling it in.

## 5. `specs-site` plugin (Astro)

An Astro 7 app (current major, `astro@7.2.x`) shipped inside the plugin (`plugins/specs-site/site/`) that renders **another repo's** `specs/` directory. No LLM writes any of its content; it is a pure function of `specs/**`.

### 5.1 Invocation

```
specs-site dev   --specs /path/to/project/specs     # live: astro dev, HMR on specs/** changes
specs-site build --specs /path/to/project/specs     # static export → <project>/specs/.site/ (gitignored)
```

`specs-site` is `plugins/specs-site/skills/specs-site/scripts/specs-site.mjs`; it installs the site's deps on first run (`npm ci` in the plugin dir) and sets `SPECS_DIR` for the loaders. `/repo-initialization` adds `"specs:site": "specs-site dev --specs specs"` to the project and a `specs/.site/` gitignore line. The skill `/specs-site` just starts it and prints the URL (bound to `127.0.0.1:4321` by default; `--host` to expose on the LAN).

### 5.2 Data model — Astro content collections over `SPECS_DIR`

| Collection | Loader | Source |
| --- | --- | --- |
| `tracker` | `file()` | `stories.json`, `backlog.json`, `autopilot.json` |
| `states` | `glob()` | `story-*/state.json` |
| `journal` | custom loader | `journal.jsonl` (one entry per line) |
| `docs` | `glob()` markdown | `PROJECT.md`, `ARCHITECTURE.md`, `DESIGN.md`, `MIGRATION.md`, `story-*/{STORY,PLAN}.md`, `story-*/ui/*.md`, `story-*/verification/*.md` |
| `features` | custom loader using `@cucumber/gherkin` + `@cucumber/messages` | `story-*/features/*.feature` → structured Feature/Rule/Scenario/Step/DataTable/Examples |
| `assets` | static passthrough | `*.png` diagrams, `story-*/mockups/*.html` (iframe) |

Because these are content collections, **`astro dev` gives live reload on every file change under `specs/` for free** — that is the "real-time Op workflow" view: the Dashboard re-renders as `state.json` and `journal.jsonl` change.

Markdown rendering: Astro's built-in pipeline + `remark-gfm` for tables; tables get a wrapper with `overflow-x:auto` and sticky headers; the REASONS canvas sections get an in-page nav. Gherkin rendering: dedicated components (`Feature`, `Rule`, `Scenario`, `Step` with keyword highlighting, `DataTable`, `Examples`); each Scenario is colour-coded by its Test Plan row status from `state.json` (`pending` / `red` / `green` / `manual`).

### 5.3 Pages

| Route | Content |
| --- | --- |
| `/` Dashboard | Phase kanban (from `stories.json`), per-story Op progress bars, gate verdict chips, open backlog count by severity, **"Now running"** panel from `autopilot.json.current` + the last 20 journal events, last verified story. |
| `/stories/US-NNN` | Tabs: Story (STORY.md), Features (rendered Gherkin with status colours), Plan (REASONS canvas, Test Plan table linked to rows' status), State (Ops timeline, gates, decisions), Verification (qa-report, audit reports), Backlog (items sourced from this story). |
| `/architecture` | ARCHITECTURE.md + diagrams; module map table linked to ADRs. |
| `/design` | DESIGN.md with token swatches rendered from the tokens table. |
| `/journal` | Filterable table (story / op / stage / kind / date), each row linking to its refs and commits. |
| `/backlog` | Filterable by status / severity / kind / story; item page shows source report excerpt and the `/backlog BL-NNN` command to copy. |

Styling: Tailwind 4 via `@tailwindcss/vite`; if the project's `DESIGN.md` declares tokens the site adopts its colour tokens, otherwise a neutral default. Light/dark follows the OS. No client-side framework; the only client JS is filter controls on `/journal` and `/backlog`.

### 5.4 What it is not

Not an editor, not a place where the LLM writes summaries, not a replacement for `stories.json`. If a fact isn't in `specs/**`, the site doesn't show it.

## 6. Data flow summary

```
user: /autopilot US-000
  conductor ── writes autopilot.json, journals stage_start
     ├─ subagent(spec-writing) ── invest-assessor ── STORY.md + features ── journal
     ├─ subagent(story-verifier: spec) ── verdict ── backlog BL-*
     ├─ subagent(plan-writing) ── PLAN.md ── journal
     ├─ subagent(story-verifier: plan)
     ├─ per Op: subagent(test-setup) → subagent(spec-implementation) [→ story-verifier: green]
     ├─ subagent(spec-implementation story-end) ── lazy-simplifier, story-reviewer, verify
     └─ subagent(verification-and-validation) ── qa-report ── phase verified
  post-commit hook ── ledger log --kind commit
  specs-site dev ── watches specs/** ── dashboard/journal/backlog re-render live
user later: /backlog BL-012
```

## 7. Error handling

- Subagent crash / no sentinel: one retry with context, then hard stop (§4.1).
- Journal/backlog write failure (disk, malformed JSON): the CLI exits non-zero and prints the payload; skills treat that as a hard stop — traceability is not optional under autopilot.
- Concurrent runs: `autopilot.json.active = true` from another run → refuse to start; `--force` clears it (journaled).
- Site loader errors (unparsable `.feature`, bad JSON): the page for that item renders the parse error in place; the rest of the site keeps working.

## 8. Testing strategy

- `ledger.mjs`: `node --test` unit tests for each command (temp dirs, fixture specs), including the `regress` baseline diff and default-from-`autopilot.json` behaviour.
- Autopilot contract: a fixture project (`plugins/autopilot/fixtures/mini-project/`, one light story, two Ops) driven by `claude -p "/autopilot US-000"` in CI-optional mode; assertions on `stories.json.phase = verified`, journal shape, backlog shape, sentinel sequence.
- Skill edits: each plugin's existing self-review checklist gets a line "under `AUTOPILOT`, no `AskUserQuestion` was called"; the marketplace CI `validate` script greps every pipeline SKILL.md for the contract reference.
- `specs-site`: Vitest tests for the Gherkin and journal loaders against fixture files; Playwright smoke: `dev` against `finfetch-web/specs`, every route renders, the Dashboard reflects a `state.json` edit within one reload.
- Dogfood: (1) finfetch-web US-008 Op-2..Op-5 under `/autopilot US-008`; (2) a fresh project's `/autopilot US-000` on an empty repo.

## 9. Versioning and release

Each phase is a marketplace release:

1. `v3.2.0` of every pipeline plugin — `AUTOPILOT` contract + gap fixes (minor: behaviour additive, no layout change).
2. `dev-ledger 1.0.0`; `repo-initialization 2.2.0` (adds ledger script + post-commit hook).
3. `autopilot 1.0.0`; `spec-writing 3.0.0` (INVEST gate reworked — major).
4. `specs-site 1.0.0`; `repo-initialization 2.3.0` (adds `specs:site` script + gitignore).

README catalog gains an **Autopilot** section and the `dev-ledger` / `specs-site` rows.
