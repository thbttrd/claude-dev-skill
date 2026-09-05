# Autopilot dogfood hardening Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 19 problems the first live `/autopilot US-002 --skip-arch-check` run on finfetch-web surfaced (`.claude/handoffs/dogfood-US-002-report.md` §3, P1–P19), so the next run on a migrated repo resumes cleanly, journals every stop once, never leaves two agents on one working tree, and audits only what has a diff.

**Architecture:** Three layers, fixed where each bug lives. (1) `autopilot.mjs` gets the deterministic fixes with `node --test` coverage: stop/report rendering and dedupe, a per-story `base_sha` recorded at `start`, `specs/autopilot.json` kept out of `git status` through `.git/info/exclude`, a `confirm_only` Op skipping its per-Op audit, a migrated-stub warning. (2) The canonical pipeline contract gets one coordinated edit (synchronous stages, never-amend rule, filter fallbacks, baseline lanes, `<E2E>` for UI Ops, the `pkill` gotcha) synced into every pipeline plugin. (3) The skills and agents the report names get their text fixes: the conductor stops a retried agent before re-dispatching and reads `BASE_SHA` from the run file; `story-verifier` commits its outputs; `test-setup` can migrate the `/migrate-specs` shape and recognise a pre-existing RED suite; `spec-implementation` records confirm-only Ops and runs `<E2E>` for UI Ops.

**Tech Stack:** Node ≥ 20 (`node:test`, stdlib only), bash + jq + yq marketplace scripts, Keep-a-Changelog + SemVer per plugin via `scripts/bump.sh`, `scripts/sync-contract.sh` for the contract copies.

**Spec:** `.claude/handoffs/dogfood-US-002-report.md` (the problem list, with file:line and the smallest fix per item) read against `docs/superpowers/specs/2026-08-30-autopilot-design.md` §2, §4 and §7. Plan 1 (`docs/superpowers/plans/2026-08-30-dev-ledger-and-autopilot-contract.md`) and Plan 2 (`docs/superpowers/plans/2026-09-05-autopilot-plugin.md`) shipped the code this plan hardens.

**Decisions made while planning:**

- **Plan 3 is the hardening pass, not `specs-site`.** The design spec's third deliverable (§5, the Astro site) is unchanged in scope but moves to a fourth plan: a site that renders a journal full of unreachable shas and duplicate stop lines would render the bugs. The user's ask ties this plan to the dogfood insight.
- **`specs/autopilot.json` is local run state, excluded via `.git/info/exclude`, not `.gitignore`** (P2). Appending to the tracked `.gitignore` would dirty the tree `start` had just checked was clean and make the resume pre-flight refuse. The exclude file is git's own mechanism for exactly this.
- **P13 (double-journaled stop) is fixed in the script, not the contract.** `stop()` skips its journal line when `autopilot.json.stop_reason` already equals the reason — the agent that wrote it also journaled it (contract §2.3). No contract sentence changes, no `AUTOPILOT=1` legacy driver breaks.
- **The legacy `state.json` stays a manual `/test-setup` step under autopilot** (P3/P4 make that remedy real). Rebuilding the operations map inside `autopilot.mjs` would assert "the RED suite exists and is RED" without running it; only `/test-setup` can verify that. The `spec_contradiction` stop keeps pointing at the command that now works.
- **`confirm_only` is written by `/spec-implementation` and read by `next`** (P14). An Op whose tests were already green at Phase 1 has no production diff; auditing it costs a full stage and produces "never went RED" noise. The story-reviewer still sees the whole story diff.
- **One contract edit, thirteen patch bumps.** Seven of the nineteen problems are contract-level (P5, P6, P8, P11, P15, P16, P17); Plan 2 avoided touching the contract for one sentence, this plan has seven and the CI changelog guard makes the cost mechanical (a loop in Task 1).
- **`TEST_SETUP_COMPLETE_US-NNN` (P4's suggestion) is not added.** `test-setup` already emits it when every Op is RED (SKILL.md:277); the conductor matches `RED_COMPLETE_US-NNN_Op-X` per Op.

## Global Constraints

- Node ≥ 20, stdlib only in `autopilot.mjs` and `ledger.mjs`; the only non-stdlib import is `autopilot.mjs`'s dynamic `import()` of the located `ledger.mjs`.
- `specs/autopilot.json` is rewritten whole (2-space indent, trailing newline) and only by `autopilot.mjs`. `specs/journal.jsonl` is written only through `ledger.mjs`'s `log()`.
- `autopilot.json` keys after this plan: `active run_id target until stop_policy skip_arch_check base_sha{US-NNN: sha} current{story stage op agent started_at attempt} last_next started_at stopped_at stop_reason`. `base_sha` is new; every other key and its meaning is unchanged.
- Stop reasons unchanged: contract §2 set (`verifier_fail | op_blocked | regression | spec_contradiction | tooling_not_ready | split_required`) plus the conductor's `stage_no_sentinel | stage_no_progress | preflight_failed | story_end | until_reached | user_stop`.
- Stage names, sentinels and agent names unchanged (see `STAGES` in `autopilot.mjs`).
- Every plugin whose files change gets a `scripts/bump.sh` bump and a filled CHANGELOG line **in the same task** (CI's `changelog-bump-guard` fails the PR otherwise). `bump.sh` inserts `### Added` + a blank `- ` bullet: fix the heading (`### Fixed` / `### Changed`) and fill the bullet by hand. `bump.sh` only touches `skills/<name>/SKILL.md`; a plugin with a second skill (`dev-ledger` → `skills/backlog/SKILL.md`) needs that skill's `version:` line edited by hand (validate.sh checks it).
- Marketplace scripts are bash: run them as `bash scripts/x.sh` (the user's shell is fish). `bash scripts/validate.sh` must exit 0 at the end of every task.
- Do not edit any file outside the task's **Files** list. Anything else that turns out to need a change gets its own bump + CHANGELOG line, or a note in the handoff — never a silent edit (Plan 1–2 lesson: greps over-applied across plugins).
- Never edit a plugin's copy of `references/autopilot-contract.md` directly — edit the canonical `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md` and run `bash scripts/sync-contract.sh`.
- Commit after every task on branch `feat/autopilot-plan3` (created in Task 1 from `main`). Commit messages: Conventional Commits, as in Plans 1–2.

## Target versions after this plan

| Plugin | Before | After | Why |
| --- | --- | --- | --- |
| `autopilot` | 1.0.0 | 1.1.0 | base_sha, exclude, report/stop fixes, confirm-only skip, conductor + verifier text |
| `test-setup` | 3.2.2 | 3.3.0 | legacy-shape migration, pre-existing RED suite |
| `spec-implementation` | 3.3.0 | 3.4.0 | confirm-only Ops, `<E2E>` for UI Ops, never-amend, synchronous lanes |
| `spec-implementation-verification` | 1.2.1 | 1.3.0 | `<E2E>` in the audit, confirm-only Ops legitimate, next-step from state.json |
| `dev-ledger` | 1.0.2 | 1.0.3 | contract resync (canonical lives here), `--help` per command |
| `spec-writing` | 3.0.0 | 3.0.1 | contract resync |
| `spec-writing-verification` | 2.3.0 | 2.3.1 | contract resync |
| `ui-specs` | 2.1.1 | 2.1.2 | contract resync |
| `plan-writing` | 2.4.0 | 2.4.1 | contract resync |
| `plan-writing-verification` | 2.3.0 | 2.3.1 | contract resync |
| `test-setup-verification` | 3.2.1 | 3.2.2 | contract resync |
| `verification-and-validation` | 2.1.1 | 2.1.2 | contract resync |
| `repo-initialization` | 2.2.1 | 2.2.2 | contract resync |

## File map

```
plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md   # canonical: §2 rule 6, §3 never-amend, §4 filters / lanes / <E2E> / pkill   (Task 1)
plugins/*/skills/*/references/autopilot-contract.md                     # synced copies (scripts/sync-contract.sh)                                  (Task 1)
plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs                 # --help per command                                                         (Task 1)
plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs            # one CLI test                                                               (Task 1)
plugins/autopilot/skills/autopilot/scripts/autopilot.mjs                # stop/report (Task 2); start/stageEnd/preflight (Task 3); resolveRed (Task 4)
plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs           # tests for Tasks 2–4
plugins/autopilot/skills/autopilot/SKILL.md                             # §4 warnings, §5 retry + no hand journaling, §6 BASE_SHA, §7, §10          (Task 5)
plugins/autopilot/agents/story-verifier.md                              # commit step, next-step text, confirm-only, synchronous                    (Task 5)
plugins/autopilot/README.md                                             # run-state paragraph, confirm-only in the stage machine                     (Task 5)
plugins/test-setup/skills/test-setup/SKILL.md                           # pre-existing RED suite branch                                              (Task 6)
plugins/test-setup/skills/test-setup/references/state-schema.md         # migration step 0, confirm_only field                                       (Task 6)
plugins/spec-implementation/skills/spec-implementation/SKILL.md         # confirm-only Ops, <E2E>, never-amend, synchronous lanes                    (Task 7)
plugins/spec-implementation/skills/spec-implementation/references/state-schema.md   # confirm_only                                                 (Task 7)
plugins/spec-implementation-verification/skills/spec-implementation-verification/SKILL.md   # <E2E>, confirm-only, next step                       (Task 7)
README.md, CHANGELOG.md, .claude/handoffs/autopilot-plan3-001.md        # catalog versions, marketplace changelog, handoff                           (Task 8)
```

---

### Task 1: Contract resync — synchronous stages, never-amend, filter fallbacks, baseline lanes, `<E2E>` for UI Ops, `pkill` gotcha; `ledger --help`

**Files:**
- Modify: `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md` (canonical; §2 after rule 5, §3 after the "`--story`, `--op`, `--stage` default…" paragraph, §4 table row `<E2E>`, §4 "Op filtering" bullets, §4 "Regression baseline" paragraph)
- Modify: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs:612-617` (the `default:` usage branch of `main`)
- Modify: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` (one new test)
- Modify: `plugins/dev-ledger/skills/backlog/SKILL.md` (`version:` line, by hand)
- Modify (generated by `sync-contract.sh`): every `plugins/<p>/skills/<p>/references/autopilot-contract.md` for `p` in `scripts/_lib.sh`'s `PIPELINE_PLUGINS`
- Modify (by `bump.sh` + hand-filled bullet): `plugins/<p>/CHANGELOG.md`, `plugin.json`, `SKILL.md` frontmatter and `.claude-plugin/marketplace.json` for `p` in `spec-writing spec-writing-verification ui-specs plan-writing plan-writing-verification test-setup-verification verification-and-validation repo-initialization dev-ledger`

**Interfaces:**
- Produces: contract §2 rule 6 (synchronous stages), §3 "never amend" paragraph, §4 unit-filter fallback by file path, §4 third BDD fallback by scenario-name union, §4 "UI Operations also run `<E2E>`" bullet, §4 "Leftover servers" bullet, §4 "Lanes" paragraph. Tasks 5–7 cite these by section number. The four plugins bumped in Tasks 5–7 (`autopilot`, `test-setup`, `spec-implementation`, `spec-implementation-verification`) receive the synced copy here and mention the resync in their own CHANGELOG entry there — they are **not** bumped in this task.

- [ ] **Step 1: Branch**

```bash
cd /home/ttadmin/Codes/claude-dev-skill && git checkout main && git pull --ff-only && git checkout -b feat/autopilot-plan3
```

- [ ] **Step 2: Edit the canonical contract**

In `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md`:

(a) §2 — append rule 6 after rule 5 (`**Retries are explicit.** …`):

```markdown
6. **Stages finish synchronously.** Never start a tool call with `run_in_background`, and never end a reply while a command you started is still running: a reply without the sentinel is a failed stage, and the retry then runs alongside whatever you left behind, on the same working tree. A lane that cannot fit the tool timeout is narrowed (`--name` on this Op's scenarios, one lane at a time), never backgrounded — journal the narrowing as a decision.
```

(b) §3 — after the paragraph starting `` `--story`, `--op`, `--stage` default from `specs/autopilot.json.current` `` add:

```markdown
**Commit, then journal — never amend.** The `commit` journal line lands after the commit it records, so a trailing uncommitted `journal.jsonl` line is the normal state at the end of every stage; the next commit sweeps it in. Never `git commit --amend` a commit that has already been journaled — the journal would point at a sha no branch reaches. When `/repo-initialization` installed the post-commit hook (`grep -q ledger .git/hooks/post-commit`), skip the manual `commit` line: the hook already wrote it.
```

(c) §4 table — replace the `<E2E>` row with:

```markdown
| `<E2E>`     | `e2e`                 | V&V; the GREEN self-review and green audit of any Op that touches the UI module (see below) |
```

(d) §4 "Op filtering" — replace the two bullets `BDD story-wide:` and `Unit/integration:` with these four bullets (keep the first `BDD:` bullet and the `manual` bullet as they are):

```markdown
- BDD story-wide: `<BDD> --tags "@US-NNN"` if the feature files carry the tag (`/spec-writing` always adds it at feature level). If they don't (e.g. a repo onboarded via `/migrate-specs`), select by path instead — the story's features all live in one directory: `<BDD> specs/story-NNN-slug/features/`. If the story owns no `features/` directory either (its scenarios were routed to another story's feature file — `stories.json artifacts.feature_files` is empty), select by name: `<BDD> --name "^(<every scenario from every Op's Covers scenarios line, regex-escaped, joined with |>)$"`. Never rely on a tag filter you haven't confirmed selects > 0 scenarios: a tag matching nothing exits 0 and passes vacuously.
- Unit/integration: tests are named `@US-NNN @Op-X …` by `/test-setup`, so `<TEST> -t "@US-NNN.*@Op-X"` (Vitest/Jest `-t`); story-wide: `-t "@US-NNN"`. The same rule as BDD applies — never rely on a `-t` filter you haven't confirmed selects > 0 tests (a filter matching nothing exits 0). Suites written before the tags existed (v1 `/test-setup`, `/migrate-specs`): run the RED-B files PLAN.md's Operation names by path — `<TEST> <file>…` — and story-wide, every file the story's Test Plan rows name.
- UI Operations also run `<E2E>`: when PLAN.md's Structure assigns a file the Op changed to the UI module (or the Op names a `UI spec`), the GREEN self-review and the green audit run `<E2E>` in addition to `<TEST>`/`<BDD>`, when `package.json` defines it. A verified story's e2e spec asserting rendered text is the only lane that sees a text-node regression.
- Leftover servers: when a lane starts a dev/preview server that must be killed afterwards, anchor the pattern to the end of the command line — `pkill -f 'entry\.mjs$'`. A bare `pkill -f 'dist/server/entry.mjs'` also matches the tool shell that is running the `pkill`, and kills the stage (exit 144).
```

(e) §4 "Regression baseline" — after the `(`mktemp`, not a fixed `/tmp` path …)` paragraph and before the `` `<sha>` is `HEAD` before committing… `` paragraph, add:

```markdown
**Lanes.** The baseline is the default `<TEST>` and `<BDD>` lanes exactly as `package.json` defines them. A lane gated by an environment variable (a full-dataset or slow lane that skips itself unless `SOME_VAR` is set) is part of the baseline only when that variable is set in the shell the run started from; a failure — including a suspect base failure — in a lane that is not part of the baseline is a `warning` backlog item (`--kind test-gap`), not the `regression` stop.
```

- [ ] **Step 3: Sync and validate**

```bash
bash scripts/sync-contract.sh && bash scripts/validate.sh
```

Expected: `✓` for each of the 12 roster plugins; validate exits 0 (every copy on disk now matches the canonical).

- [ ] **Step 4: `ledger --help` — failing test**

Append to `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` (it already imports `spawnSync`, `fileURLToPath` — check the top of the file and add any missing import):

```js
test("CLI: --help prints per-command usage on stdout and exits 0", () => {
  const cli = fileURLToPath(new URL("./ledger.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /regress\s+--base/);
  assert.match(r.stdout, /backlog\s+add --title/);
  assert.match(r.stdout, /log\s+--kind/);
});
```

Run: `node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` → the new test FAILS (`status` is 2, stdout empty).

- [ ] **Step 5: `ledger --help` — implement**

Replace the `default:` branch of `main` in `ledger.mjs` with:

```js
    default: {
      const usage =
        "usage: ledger <command> [--specs dir] ...\n" +
        "  log      --kind <kind> --summary s [--story US-NNN] [--op Op-N] [--stage s] [--agent a] [--ref path]... [--sha h]\n" +
        "           kind=gate also needs --gate g --verdict PASS|PASS_WITH_WARNINGS|FAIL [--report p]; kind=finding takes --backlog-id BL-NNN\n" +
        `           kinds: ${KINDS.join("|")}\n` +
        "  journal  [--story US-NNN] [--op Op-N] [--kind k] [--since YYYY-MM-DD] [--no-git] [--json]\n" +
        "  backlog  add --title t --severity info|warning|error --kind k [--file p]... [--detail d] [--report p] [--gate g] [--story US-NNN] [--op Op-N]\n" +
        "  backlog  [list] [--status s] [--story US-NNN] [--json]\n" +
        "  backlog  resolve BL-NNN --sha h --resolution r | wontfix BL-NNN --reason r\n" +
        "  failures --runner vitest|cucumber|lines [--report-file p]   (reads stdin without --report-file)\n" +
        '  regress  --base sha --runner vitest|cucumber --cmd "<suite command>" --report-file p [--json]\n';
      (opts.help ? process.stdout : process.stderr).write(usage);
      return opts.help ? 0 : 2;
    }
```

Check every flag above against the function that consumes it (`KINDS` :20, `filterJournal` :144, `backlogAdd` :249, `backlogResolve` :342, `backlogWontfix` :358, `regress` :475, `PARSERS` near :385) and correct any name that differs — the usage must not promise a flag the code ignores.

Run: `node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` → all pass (31 + 1).

- [ ] **Step 6: Bump the nine contract-only plugins (patch) and fill their CHANGELOG lines**

```bash
LINE='- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op'"'"'s RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.'
for p in spec-writing spec-writing-verification ui-specs plan-writing plan-writing-verification test-setup-verification verification-and-validation repo-initialization dev-ledger; do
  bash scripts/bump.sh "$p" patch
  cl="plugins/$p/CHANGELOG.md"
  awk -v line="$LINE" 'BEGIN{h=0;b=0} !h && /^### Added$/ {print "### Changed"; h=1; next} !b && /^- $/ {print line; b=1; next} {print}' "$cl" > "$cl.tmp" && mv "$cl.tmp" "$cl"
done
```

Then, for `dev-ledger` only: append to that same new `[1.0.3]` section a `### Added` block with `- \`ledger --help\` prints per-command usage (flags per subcommand) on stdout and exits 0.`, and set `version: 1.0.3` in `plugins/dev-ledger/skills/backlog/SKILL.md`.

`bash scripts/validate.sh` → exit 0. `git diff --stat` shows exactly: canonical contract, 12 copies, `ledger.mjs`, `ledger.test.mjs`, 9 × (`CHANGELOG.md`, `plugin.json`, `SKILL.md`), `backlog/SKILL.md`, `marketplace.json`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(contract): synchronous stages, never-amend, filter fallbacks, baseline lanes, E2E for UI ops; ledger --help (dogfood P5/P6/P8/P11/P15/P16/P17/P18)"
```

---

### Task 2: `autopilot.mjs` — one stop line, a readable stop before any stage, a deduplicated report with git-ordered, reachability-checked commits (P1, P12, P13)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs:852-986` (`stop`, `renderReportText`, `report`)
- Test: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`

**Interfaces:**
- Consumes: `ledger.log`/`ledger.readJournal` (unchanged); `stop` entries whose `summary` is `<reason>` or `<reason>: <detail>` (unchanged shape).
- Produces: `report()` result — `stages[]` entries gain `reason` on `outcome: "stop"`; `commits[]` entries may carry `unreachable: true` and a summary suffixed ` (unreachable)`; `gates[]` deduplicated by `(story, op, gate)` keeping the last verdict; `stages[]` deduplicated by `(story, op, stage, outcome)` keeping the first. `stop()` journals `story: ap.current?.story ?? ap.target`, `stage: ap.current?.stage ?? "autopilot"`, and journals nothing when `ap.stop_reason` already equals the reason.

- [ ] **Step 1: Failing tests**

Add a helper near the top of `autopilot.test.mjs` (after `writeState`):

```js
export function commitPaths(root, msg, paths) {
  execFileSync("git", ["add", "--", ...paths], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", msg], { cwd: root, stdio: "pipe" });
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}
```

Append three tests:

```js
test("stop before any stage journals story=target, stage=autopilot; report renders it as 'run — stop (<reason>)'", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  const ap = await start(specs, { target: "US-000" }, { ledger, now });
  const rep = await stop(specs, { reason: "spec_contradiction", summary: "no operations map" }, { ledger, now });
  const entry = ledger.readJournal(specs).find((e) => e.kind === "stop" && e.run_id === ap.run_id);
  assert.equal(entry.story, "US-000");
  assert.equal(entry.stage, "autopilot");
  assert.equal(rep.stages[0].reason, "spec_contradiction");
  assert.match(rep.text, /run — stop \(spec_contradiction\)/);
  assert.doesNotMatch(rep.text, /null null/);
});

test("stop skips its journal line when the stage agent already recorded the same stop_reason (contract §2.3)", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  const ap = await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "spec-writing-verification", agent: "story-verifier" },
    { ledger, now },
  );
  // What story-verifier does on FAIL: stop_reason into autopilot.json (active untouched) + one journal stop line.
  writeJson(join(specs, "autopilot.json"), { ...readAutopilot(specs), stop_reason: "verifier_fail" });
  ledger.log(
    specs,
    { kind: "stop", summary: "verifier_fail: scenario X contradicts rule R2", run_id: ap.run_id, story: "US-000", stage: "spec-writing-verification" },
    now,
  );

  const result = await stageEnd(specs, { outcome: "stop", reason: "verifier_fail" }, { ledger, now });
  assert.deepEqual(result, { action: "stop", reason: "verifier_fail" });
  const after = readAutopilot(specs);
  assert.equal(after.active, false);
  assert.equal(after.stop_reason, "verifier_fail");
  const stops = ledger.readJournal(specs).filter((e) => e.kind === "stop" && e.run_id === ap.run_id);
  assert.equal(stops.length, 1);
  assert.match(stops[0].summary, /contradicts rule R2/);
});

test("report dedupes duplicate gate and stop lines, keeps git order and marks unreachable journaled shas", async () => {
  const { specs, root } = fixtureProject();
  const now = new Date(Date.now() - 5000); // the run started 5 s ago: a commit made now is inside --since
  const ap = await start(specs, { target: "US-000" }, { ledger, now });
  const gate = { kind: "gate", gate: "self-review", verdict: "PASS", summary: "4/4", run_id: ap.run_id, story: "US-000", op: "Op-7", stage: "spec-implementation" };
  ledger.log(specs, gate, now);
  ledger.log(specs, { ...gate, verdict: "PASS_WITH_WARNINGS", summary: "3/4" }, now);
  ledger.log(specs, { kind: "commit", sha: "deadbee", summary: "chore: amended away", run_id: ap.run_id, story: "US-000" }, now);
  writeFileSync(join(root, "note.txt"), "x\n");
  const real = commitPaths(root, "feat(US-000): real", ["note.txt"]);

  await stop(specs, { reason: "verifier_fail", summary: "C1" }, { ledger, now: new Date() });
  await stop(specs, { reason: "verifier_fail" }, { ledger, now: new Date() }); // a second stop with the same reason journals nothing

  const rep = await report(specs, { run_id: ap.run_id }, { ledger });
  assert.equal(rep.gates.length, 1);
  assert.equal(rep.gates[0].verdict, "PASS_WITH_WARNINGS", "last verdict wins");
  assert.equal(rep.stages.filter((s) => s.outcome === "stop").length, 1);
  assert.match(rep.text, /run — stop \(verifier_fail\)/);
  assert.equal(rep.commits[0].sha, real);
  const dead = rep.commits.find((c) => c.sha === "deadbee");
  assert.equal(dead.unreachable, true);
  assert.match(dead.summary, /\(unreachable\)$/);
  assert.match(rep.text, /deadbee chore: amended away \(unreachable\)/);
});
```

Run: `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` → the three new tests FAIL (`entry.stage` is `null`; two stop entries; two gates / no `unreachable`).

- [ ] **Step 2: Implement `stop`**

```js
export async function stop(specs, opts, deps = {}) {
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const now = deps.now ?? new Date();
  const ap = readAutopilot(specs) ?? {};
  // A stage agent that hard-stops per contract §2.3 has already written
  // stop_reason and journaled the stop; the conductor's stage-end must not
  // record the same stop a second time.
  const alreadyJournaled = opts.reason != null && ap.stop_reason === opts.reason;

  if (ap.active === true) {
    ap.active = false;
    ap.stopped_at = now.toISOString();
    ap.stop_reason = opts.reason ?? null;
    writeJson(autopilotPath(specs), ap);
  }

  if (!alreadyJournaled) {
    ledger.log(
      specs,
      {
        kind: "stop",
        summary: opts.summary ? `${opts.reason}: ${opts.summary}` : String(opts.reason),
        run_id: ap.run_id ?? null,
        story: ap.current?.story ?? ap.target ?? null,
        op: ap.current?.op ?? null,
        stage: ap.current?.stage ?? "autopilot",
      },
      now,
    );
  }

  return report(specs, { run_id: ap.run_id ?? null }, { ledger, now });
}
```

- [ ] **Step 3: Implement the report changes**

Replace the `stages`, `gates` and commit-merging blocks in `report()` and the `stages`/`commits` lines in `renderReportText`:

```js
  const stopReason = (e) => (e.summary ?? "").split(":")[0].trim() || "?";
  const seenStages = new Set();
  const stages = [];
  for (const e of entries) {
    if (e.kind !== "stage_end" && e.kind !== "stop") continue;
    const s = { stage: e.stage, story: e.story, op: e.op, outcome: e.kind === "stage_end" ? "ok" : "stop" };
    if (e.kind === "stop") s.reason = stopReason(e);
    const key = [s.story, s.op, s.stage, s.outcome].join("|");
    if (seenStages.has(key)) continue; // the same stage journaled twice (two agents, or agent + conductor) is one line
    seenStages.add(key);
    stages.push(s);
  }

  // One line per gate: the last verdict wins, first appearance keeps its place.
  const gateByKey = new Map();
  for (const e of entries.filter((e) => e.kind === "gate")) {
    gateByKey.set([e.story, e.op, e.gate].join("|"), {
      gate: e.gate, verdict: e.verdict, story: e.story, op: e.op, report: e.report ?? null,
    });
  }
  const gates = [...gateByKey.values()];
```

and, after `gitCommits` is computed:

```js
  // git's own order first (newest first, as `git log` prints); journaled
  // shas git no longer reaches (an --amend after journaling) come last, marked.
  const root = dirname(specs);
  const reachable = (sha) =>
    spawnSync("git", ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], { cwd: root, stdio: "ignore" }).status === 0;
  const sameSha = (a, b) => a.startsWith(b) || b.startsWith(a);
  const commits = [...gitCommits];
  for (const c of journaledCommits) {
    if (!c.sha || commits.some((k) => sameSha(k.sha, c.sha))) continue;
    commits.push(reachable(c.sha) ? c : { ...c, summary: `${c.summary} (unreachable)`, unreachable: true });
  }
```

(delete the old `seen`/`commits` loop). In `renderReportText`:

```js
      block(
        "stages",
        stages.map((s) =>
          s.outcome === "stop"
            ? `  ${s.stage == null || s.stage === "autopilot" ? "run" : `${stageArgs(s.story, s.op)} ${s.stage}`} — stop (${s.reason})`
            : `  ${stageArgs(s.story, s.op)} ${s.stage} — ok`,
        ),
      ),
```

(the `commits` line already prints `sha summary`; the suffix rides in `summary`).

- [ ] **Step 4: Run the suite**

`node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` → all pass (42 + 3). If the existing `report aggregates…` test breaks on `stages.length`, it is because its two `stage_end` entries share no key — they don't (`invest` vs `spec-writing`); investigate rather than loosen it.

- [ ] **Step 5: Commit**

```bash
git add plugins/autopilot/skills/autopilot/scripts && git commit -m "fix(autopilot): stop journals once and names the run; report dedupes gates/stops, git-orders commits, marks unreachable shas (dogfood P1/P12/P13)"
```

---

### Task 3: `autopilot.mjs` — `base_sha` per story, `specs/autopilot.json` excluded from `git status`, warnings returned by `start`, migrated-stub warning (P2, P7, P19)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs` (imports :5-12; `preflight` :232-237; `start` :606-679; `stageEnd` :831-849)
- Test: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` (the existing `start writes autopilot.json…` test at :654 and four new tests)

**Interfaces:**
- Produces: `autopilot.json.base_sha` — `{ "US-NNN": "<full sha>" }`, written by `start` for the target (carried over from the previous `autopilot.json` on disk, never overwritten) and by `stageEnd` for the story `next` moves to; `start()` returns `{ ...ap, warnings: string[] }` (the on-disk file has no `warnings` key); `preflight().warnings` gains `"<US-NNN>: STORY.md still carries TODO markers …"`; `start` appends `specs/autopilot.json` to `$(git rev-parse --git-path info/exclude)` once and journals `kind: action` when it does. Task 5's §6 reads `base_sha` with `jq`.

- [ ] **Step 1: Update the existing `start` test and add four failing tests**

In the test `start writes autopilot.json and journals the start…` (:654), replace the first `assert.deepEqual(ap, {...})` + `assert.deepEqual(readAutopilot(specs), ap)` pair with:

```js
  const { root } = { root: dirname(specs) };
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const { warnings, ...onDisk } = ap;
  assert.deepEqual(warnings, []);
  assert.deepEqual(onDisk, {
    active: true,
    run_id: `run-${now.toISOString()}`,
    target: "US-000",
    until: "US-000",
    stop_policy: DEFAULT_POLICY,
    skip_arch_check: false,
    base_sha: { "US-000": head },
    current: null,
    last_next: null,
    started_at: now.toISOString(),
    stopped_at: null,
    stop_reason: null,
  });
  assert.deepEqual(readAutopilot(specs), onDisk);
```

(add `dirname` to the `node:path` import of the test file). Append:

```js
test("start excludes specs/autopilot.json via .git/info/exclude exactly once and carries base_sha across runs", async () => {
  const { specs, root } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  const excludePath = join(root, ".git", "info", "exclude");
  const countExclude = () => readFileSync(excludePath, "utf8").split("\n").filter((l) => l === "specs/autopilot.json").length;

  const ap1 = await start(specs, { target: "US-000" }, { ledger, now });
  const head1 = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(ap1.base_sha["US-000"], head1);
  assert.equal(countExclude(), 1);
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  assert.equal(status.includes("autopilot.json"), false, status);

  await stop(specs, { reason: "user_stop" }, { ledger, now });
  writeFileSync(join(root, "later.txt"), "x\n");
  commitPaths(root, "feat(US-000): later", ["later.txt", "specs/journal.jsonl"]);

  const ap2 = await start(specs, { target: "US-000" }, { ledger, now: new Date("2026-09-05T11:00:00.000Z") });
  assert.equal(ap2.base_sha["US-000"], head1, "base_sha must not move on resume");
  assert.equal(countExclude(), 1);
  const excludeActions = ledger.readJournal(specs).filter((e) => e.kind === "action" && /info\/exclude/.test(e.summary));
  assert.equal(excludeActions.length, 1);
});

test("start returns preflight warnings alongside the run file", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  const ap = await start(specs, { target: "US-000", skip_arch_check: true }, { ledger, now });
  assert.ok(ap.warnings.some((w) => /skip-arch-check/.test(w)), JSON.stringify(ap.warnings));
  assert.equal("warnings" in readAutopilot(specs), false);
});

test("stageEnd records base_sha for the next story when the chain moves on", async () => {
  const { specs, root } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000", until: "US-002", stop_policy: "hard-failures" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "verification-and-validation", agent: "general-purpose" },
    { ledger, now },
  );
  setStory(specs, "US-000", { phase: "verified" });
  const result = await stageEnd(specs, { outcome: "sentinel" }, { ledger, now });
  assert.equal(result.action, "continue");
  assert.equal(result.next.story, "US-001");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.deepEqual(readAutopilot(specs).base_sha, { "US-000": head, "US-001": head });
});

test("preflight warns when the target's STORY.md is a migrated TODO stub", () => {
  const { specs, root } = fixtureProject();
  const dir = storyDir(specs, "US-000");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "STORY.md"), "# US-000\n\n> As a **TODO — not formalised in v1**,\n");
  commitPaths(root, "chore: stub STORY.md", ["specs"]);
  const pf = preflight(specs, { target: "US-000" });
  assert.equal(pf.ok, true, JSON.stringify(pf));
  assert.ok(pf.warnings.some((w) => /TODO/.test(w)), pf.warnings.join("\n"));
});
```

Run the suite → the four new tests and the updated `start` test FAIL.

- [ ] **Step 2: Implement**

Imports: add `appendFileSync` and `mkdirSync` to the `node:fs` import.

Helpers (place after `todayStr`):

```js
function gitOut(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

// specs/autopilot.json is per-machine run state. Keep it out of `git status`
// through the repo-local exclude file, not the tracked .gitignore — editing
// .gitignore would dirty the tree start() just checked was clean.
function excludeAutopilotJson(root) {
  const rel = gitOut(root, ["rev-parse", "--git-path", "info/exclude"]);
  if (!rel) return false;
  const p = resolve(root, rel);
  const text = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (text.split("\n").includes("specs/autopilot.json")) return false;
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, `${text && !text.endsWith("\n") ? "\n" : ""}specs/autopilot.json\n`);
  return true;
}

// The story's diff base for the simplify / code-review gates: HEAD when a run
// first picks the story up, recorded once and carried across resumes so a
// later run never moves the base past the story's own commits.
function recordBaseSha(specs, ap, story) {
  ap.base_sha ??= {};
  if (ap.base_sha[story]) return;
  const sha = gitOut(dirname(specs), ["rev-parse", "HEAD"]);
  if (sha) ap.base_sha[story] = sha;
}
```

`preflight` — before `return { ok: true, … }`, after the `--force` warning:

```js
  const storyMd = story ? join(storyDir(specs, target) ?? "", "STORY.md") : null;
  if (storyMd && existsSync(storyMd) && /\bTODO\b/.test(readFileSync(storyMd, "utf8"))) {
    warnings.push(
      `${target}: STORY.md still carries TODO markers (migrated stub) — the spec/plan audits will run against it; run /spec-writing ${target} to formalise it first`,
    );
  }
```

`start` — build `ap` with `base_sha: { ...(prevAp?.base_sha ?? {}) }` placed right after `skip_arch_check`, call `recordBaseSha(specs, ap, pf.target)` before `writeJson`, and after the existing three `ledger.log` blocks add:

```js
  if (excludeAutopilotJson(dirname(specs))) {
    ledger.log(
      specs,
      {
        kind: "action",
        summary: "added specs/autopilot.json to .git/info/exclude (local run state, never committed)",
        run_id: ap.run_id,
        story: ap.target,
        op: null,
        stage: "autopilot",
      },
      now,
    );
  }

  return { ...ap, warnings: pf.warnings };
```

`stageEnd` — just before the final `writeJson(autopilotPath(specs), ap); return { action: "continue", next };`:

```js
  if (!next.done && !next.stop && next.story !== current.story) recordBaseSha(specs, ap, next.story);
```

- [ ] **Step 3: Run the suite**

`node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` → all pass (45 + 4). The CLI round-trip test at :1012 reads `start`'s JSON output: if it deep-equals the object, drop `warnings` from its comparison the same way as Step 1.

- [ ] **Step 4: Commit**

```bash
git add plugins/autopilot/skills/autopilot/scripts && git commit -m "feat(autopilot): base_sha per story, autopilot.json in .git/info/exclude, start returns warnings, migrated-stub warning (dogfood P2/P7/P19)"
```

---

### Task 4: `autopilot.mjs` — a confirm-only Op skips its per-Op green audit (P14)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs:460-468` (`resolveRed`'s `needsAudit`)
- Test: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`

**Interfaces:**
- Consumes: `state.json.operations[Op-X].confirm_only === true` (written by `/spec-implementation` in Task 7, documented in Task 6/7's schema files).
- Produces: under `rigor: full`, `next` never resolves `spec-implementation-verification` for such an Op.

- [ ] **Step 1: Failing test**

```js
test("next: red — full rigor skips the per-Op audit for a confirm-only Op (no production diff to audit)", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "red", rigor: "full" });
  writeState(specs, "US-000", {
    schema_version: 2,
    operations: {
      "Op-1": { operation_phase: "green", confirm_only: true },
      "Op-2": { operation_phase: "red" },
    },
  });
  const result = nextStage(specs, dryRun("US-000"));
  assert.equal(result.stage, "spec-implementation");
  assert.equal(result.op, "Op-2");
});
```

Run → FAILS (`stage` is `spec-implementation-verification`, `op` is `Op-1`).

- [ ] **Step 2: Implement**

```js
    const needsAudit = ops.find(
      (op) =>
        GREEN_PHASES.has(op.operation_phase) &&
        op.confirm_only !== true && // green at base, no production diff: nothing to audit per Op
        !PASSING_VERDICTS.has(op.green_audit?.verdict),
    );
```

Run → all pass (49 + 1).

- [ ] **Step 3: Commit**

```bash
git add plugins/autopilot/skills/autopilot/scripts && git commit -m "feat(autopilot): confirm-only Ops skip the per-Op green audit (dogfood P14)"
```

---

### Task 5: Conductor and `story-verifier` text; `autopilot` 1.1.0 (P7, P9, P10, P11b, P14, P18)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/SKILL.md` (§4 :48-49, §5 :56-91, §6 :97-105, §7 :127-129, §10 :164-167)
- Modify: `plugins/autopilot/agents/story-verifier.md` (Step 2 :53-67, Step 4 :75-114, Hard rules :129-134)
- Modify: `plugins/autopilot/README.md` (Usage, Stage machine)
- Modify (by `bump.sh`): `plugins/autopilot/CHANGELOG.md`, `.claude-plugin/plugin.json`, `SKILL.md` frontmatter, `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: `autopilot.json.base_sha` (Task 3), `start`'s `warnings` (Task 3), `confirm_only` (Task 4), contract §2 rule 6 and §3 never-amend (Task 1).

- [ ] **Step 1: SKILL.md §4** — replace the second bullet with: `- Otherwise \`start\` prints the new \`autopilot.json\` plus a \`warnings\` array (\`--skip-arch-check\`, \`--force\`, a STORY.md that is still a migrated TODO stub). Print every warning verbatim, then enter the loop.`

- [ ] **Step 2: SKILL.md §5** — replace the `R.action == "retry"` line of the loop with:

```
   R.action == "retry"    → if the Agent tool returned a task id for attempt 1 and that agent has not reported
                            completion, TaskStop it first — two agents on one working tree commit over each other
                            (dogfood P11b); then NOTE = "Previous attempt ended without its sentinel; its last output was: <last 400 chars of OUT>"
                            goto 3                               # same N, identical stage-start args: the script counts attempt 2
```

After the "Two jump targets are load-bearing" paragraph add:

```markdown
The conductor journals nothing by hand. `start`, `stage-start`, `stage-end` and `stop` write every line a run needs, including the `retry N/2` action; a pause you impose yourself (a rate limit, a user interruption) is reported in the final message, not journaled — a second numbering scheme for the same event is worse than none.
```

- [ ] **Step 3: SKILL.md §6** — replace the per-story block and the paragraph after it with:

```bash
STORY=US-NNN
SLUG=$(jq -r --arg s "$STORY" '.stories[]|select(.id==$s).slug' specs/stories.json)
BASE_SHA=$(jq -r --arg s "$STORY" '.base_sha[$s] // empty' specs/autopilot.json)
if [ -z "$BASE_SHA" ]; then   # story first picked up by a run older than autopilot 1.1.0
  FIRST=$(git log --reverse --grep "^test($STORY)" --grep "^feat($STORY)" --grep "^chore($STORY)" --format=%h | head -1)
  BASE_SHA=$( [ -n "$FIRST" ] && git rev-parse "$FIRST^" 2>/dev/null || echo "HEAD~0" )
fi
```

```markdown
`SLUG` builds the report paths (`specs/story-NNN-$SLUG/verification/…`). `BASE_SHA` is the commit the story's diff starts after: `start` records HEAD into `autopilot.json.base_sha[US-NNN]` the first time a run picks the story up and carries it across resumes, so the simplify and code-review gates diff exactly the run's work. The `git log` fallback is for stories first driven before that field existed; it accepts `chore(US-NNN)` because on a migrated repo the `state.json` rebuild commit is the true start of the story's work. When it still ends at `HEAD~0`, say so in the prompt so the agent files an info item instead of measuring an empty diff. These two lookups are the only tracker reads the conductor makes.
```

- [ ] **Step 4: SKILL.md §7** — append: `` `specs/autopilot.json` is local run state: `start` adds it to `.git/info/exclude` on first use, so it never shows in `git status` and is never committed. `` §10 — add `- [ ] no stage agent from a retried attempt was left running`.

- [ ] **Step 5: story-verifier.md** — Step 2, append a paragraph:

```markdown
An Op whose `state.json.operations[Op-X].confirm_only` is `true` had no RED phase by design: its tests were green at base because an earlier story or Op shipped the behaviour, and there is no `feat(US-NNN): implement Op-X` commit. Under `rigor: full` the conductor does not dispatch you for such an Op; if you meet one in story-end mode, audit its journaled regression-baseline run and do not file "never went RED" as a warning.
```

Step 4 — replace the `Print the ids. Warnings never stop the run…` sentence's paragraph ending with a new step inserted **before** step 4 (renumber: the FAIL step becomes 5):

```markdown
**4. Commit your outputs** — the report, `state.json`, the backlog and the journal as they stand. This is what makes "resume with the same command" work: `start`'s clean-tree check exempts only the run's bookkeeping files, so an uncommitted report or `state.json` blocks the next run.

```bash
git add -A -- specs/ && git commit -m "chore(US-NNN): <spec-audit|plan-audit|green-audit Op-X> — <PASS|PASS_WITH_WARNINGS|FAIL>"
```

The only dirty paths under `specs/` at this point are yours and the previous stage's trailing journal line. The journal line this commit itself produces stays uncommitted — that is the expected state (contract §3); never `--amend`. Commit **before** the FAIL stop below too: a hard stop must leave a tree the user can resume from.
```

Step 4 (now 5, FAIL) — no change. Replace the **Next Step** guidance by adding, at the end of Step 3:

```markdown
In the report's *Next Step*, derive the command from `state.json`, not from habit: the next Op in id order whose `operation_phase` is `red` → `/spec-implementation US-NNN Op-N`; `pending` → `/test-setup US-NNN Op-N`; none left → "story-end gates". On a migrated repo every Op is already `red`, so `/test-setup` is never the next step.
```

Hard rules — add `- You run synchronously: no background tool calls, no reply while a command is still running (contract §2 rule 6).` and `- One commit of your outputs per invocation, before the sentinel or the stop.`

- [ ] **Step 6: README.md (plugin)** — under Usage, after "Resume by re-running the same command…", add:

```markdown
**Run state.** `specs/autopilot.json` is per-machine run state: `start` adds it to `.git/info/exclude`, so it never appears in `git status` and is never committed. It also records `base_sha` — HEAD when a run first picked up each story — which the simplify and code-review gates diff against; a resume carries it forward.
```

In the stage machine block change the `spec-implementation-verification Op-X` line to `spec-implementation-verification Op-X   full-rigor stories only, skipped for confirm-only Ops → verification/green-audit-Op-X.md`.

- [ ] **Step 7: Bump minor, validate, commit**

`bash scripts/bump.sh autopilot minor` (→ 1.1.0). CHANGELOG `[1.1.0]`:

```markdown
### Added

- `autopilot.json.base_sha[US-NNN]`: HEAD when a run first picks a story up, carried across resumes; the conductor reads it with `jq` (the `git log --grep` lookup is now the fallback and accepts `chore(US-NNN)`).
- `start` adds `specs/autopilot.json` to `.git/info/exclude` (journaled once) and returns preflight `warnings`, including a warning when the target's STORY.md is still a migrated TODO stub.
- Confirm-only Ops (`state.json.operations[Op-X].confirm_only = true`, written by `spec-implementation` 3.4.0) skip the per-Op green audit under `rigor: full`.
- `story-verifier` commits its outputs (report, state.json, backlog, journal) before its sentinel or stop, derives the Next Step from `state.json`, and treats confirm-only Ops as legitimate.

### Fixed

- A stop before any stage journals `story=target`, `stage=autopilot` and renders as `run — stop (<reason>)` instead of `null null — stop`.
- `stop` journals nothing when the stage agent already recorded the same `stop_reason` (contract §2.3) — no more duplicated stop lines.
- `report` dedupes gate lines (last verdict wins) and stop lines, lists commits in `git log` order and marks journaled shas no branch reaches as `(unreachable)`.
- Conductor: `retry` stops the previous attempt's agent before re-dispatching; the conductor journals nothing by hand.

### Changed

- Contract resync (see `dev-ledger` 1.0.3): synchronous stages, never-amend, filter fallbacks, baseline lanes, `<E2E>` for UI Ops.
```

`bash scripts/validate.sh` → 0. `node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs` → all pass.

```bash
git add plugins/autopilot .claude-plugin/marketplace.json && git commit -m "feat(autopilot): conductor stops a retried agent and reads base_sha; story-verifier commits its outputs; release 1.1.0"
```

---

### Task 6: `test-setup` 3.3.0 — migrate the `/migrate-specs` legacy `state.json`, recognise a pre-existing RED suite (P3, P4)

**Files:**
- Modify: `plugins/test-setup/skills/test-setup/references/state-schema.md` ("v1 → v2 Migration" :234-247; the `operations` block of the full schema :36-60)
- Modify: `plugins/test-setup/skills/test-setup/SKILL.md` ("Resolving the target Operation" :56-71; Pre-Flight row `schema_version < 2` :45)
- Modify (by `bump.sh`): `plugins/test-setup/CHANGELOG.md`, `plugin.json`, `SKILL.md` frontmatter, `marketplace.json`

**Interfaces:**
- Produces: a v2 `state.json` from a `{story_id, phase, history, checkpoints}` file; `operations[Op-X].confirm_only` documented (written by Task 7's skill, read by Task 4's resolver).

- [ ] **Step 1: state-schema.md — migration step 0**

Replace the numbered list under "v1 → v2 Migration (one-shot, on entry)" with:

```markdown
0. **No `operations` map at all** (the `/migrate-specs` shape: `{story_id, phase, history, checkpoints}`): build it from PLAN.md before anything else. One entry per `### Operation N` heading — `title` from the heading text after the dash, `covers_scenarios` from the quoted `- "…"` lines (or the `**Covers scenarios:**` line) of that section. If `stories.json#stories[i].phase` is `red` the RED suite already exists (a v1 `/test-setup` wrote it): set every Op to `operation_phase: "red"`, `tests_status: "red"`, `stub_status: "created"`, `implementation_status: "pending"`, `phase_local: "executing"`, `current_operation: "Op-1"`; otherwise every Op is `pending` and `phase_local` is `test_setup`. `test_plan_rows`: one row per Test Plan row of PLAN.md tagged with that Op (`written: true, passing: false` when the RED suite exists, `written: false` otherwise). Preserve the legacy `history` and `checkpoints` fields verbatim. Journal the rebuild as a decision (`state.json rebuilt from PLAN.md: N Ops, RED suite pre-exists|absent`). Then continue with step 1 on the map you just built. Before writing a `red` state, run the Op-filtered suites once (contract §4, with the path fallbacks) and confirm they are RED — an Op whose suite is green at this point is `pending`, not `red`.
1. Walk `operations`. For each Op, derive `operation_phase` from existing fields:
   - `tests_status = "pending"` → `operation_phase = "pending"`
   - `tests_status = "in_progress"` → `operation_phase = "red_b"` (best-effort)
   - `tests_status = "red"` AND `implementation_status = "pending"` → `operation_phase = "red"`
   - `implementation_status = "green"` → `operation_phase = "green"`
2. Initialize empty `red_audit`/`green_audit` blobs (`verdict: null, at: null, report_path: null`).
3. Set `current_operation` to the first Op whose `operation_phase` is not `green`/`refactored`.
4. For each `test_plan_rows[T-N]` lacking `op`, attempt to read PLAN.md's Test Plan and back-fill the `Op` column. If the PLAN.md has no `Op` column either, leave `op` as `null` and emit a one-time warning.
5. Bump `schema_version` to `2`.
6. Atomic write (temp file + rename). Commit it: `chore(US-NNN): migrate state.json to v2 from PLAN.md` — this commit is the story's diff base for a later `/autopilot` run.
```

In the full-schema `operations["Op-1"]` block, after `"implementation_status": "green", // existing …` add:

```jsonc
      "confirm_only": false, // NEW in 3.3.0: true when /spec-implementation found every Op test already green at Phase 1 — no feat commit, no per-Op audit
```

- [ ] **Step 2: SKILL.md — pre-existing RED suite**

In "Resolving the target Operation", after `The chosen Op-X is written to state.json.current_operation.` add:

```markdown
**Pre-existing RED suite.** On a repo onboarded by `/migrate-specs`, or after a v1 `/test-setup`, the tests for Op-X may already exist. Before Phase 2: if every file named in Op-X's RED-A and RED-B sections exists and the Op-filtered suites (contract §4 — tag, then scenario names, then file paths) run RED, do not rewrite them. Record the `test_plan_rows` for Op-X (`written: true, passing: false`), journal the decision `pre-existing RED suite for Op-X: <n> files, <m> failing`, skip Phases 2–4 and continue at Phase 5. If one of those suites is green, Op-X is not RED: fall through to the normal phases for the rows that are green. The picker itself is unchanged — an Op the migration already marked `red` is not re-picked (it says so); this branch covers Ops still `pending` whose files exist.
```

Pre-Flight row `state.json.schema_version < 2` — change the Action cell to: `Run the v1 → v2 migration (see \`references/state-schema.md\`; a legacy file without an \`operations\` map is rebuilt from PLAN.md first) atomically, commit it, then continue.`

- [ ] **Step 3: Bump minor, validate, commit**

`bash scripts/bump.sh test-setup minor` (→ 3.3.0). CHANGELOG `[3.3.0]`:

```markdown
### Added

- v1 → v2 migration step 0: a legacy `state.json` without an `operations` map (the `/migrate-specs` shape) is rebuilt from PLAN.md's `### Operation N` headings, marked RED when the story's phase is `red` and the Op suites confirm it, and committed — the remedy `/autopilot`'s `spec_contradiction` stop names now exists (dogfood P3).
- Pre-existing RED suite branch: when Op-X's RED-A/RED-B files already exist and run RED, the rows are recorded and Phases 2–4 are skipped (dogfood P4).
- `operations[Op-X].confirm_only` documented in the schema.

### Changed

- Contract resync (see `dev-ledger` 1.0.3).
```

`bash scripts/validate.sh` → 0.

```bash
git add plugins/test-setup .claude-plugin/marketplace.json && git commit -m "feat(test-setup): migrate the /migrate-specs state.json shape, keep a pre-existing RED suite (3.3.0)"
```

---

### Task 7: `spec-implementation` 3.4.0 and `spec-implementation-verification` 1.3.0 — confirm-only Ops, `<E2E>` for UI Ops, never-amend, synchronous lanes, next step from state (P8, P10, P11, P14, P17)

**Files:**
- Modify: `plugins/spec-implementation/skills/spec-implementation/SKILL.md` (Phase 1 :126-136; Phase 2 after the regression bullets :151-156; Phase 4 :196-208; "Commit Rules" :371-381)
- Modify: `plugins/spec-implementation/skills/spec-implementation/references/state-schema.md` (after the `implementation` block section)
- Modify: `plugins/spec-implementation-verification/skills/spec-implementation-verification/SKILL.md` (Agent Prompt Step 1 item 5 :108-115, Step 2 :119-129, Test Run Results table :215-224, Next Step :238-243)
- Modify (by `bump.sh`): both plugins' `CHANGELOG.md`, `plugin.json`, `SKILL.md` frontmatter, `marketplace.json`

**Interfaces:**
- Produces: `state.json.operations[Op-X].confirm_only = true` (read by Task 4's resolver and Task 5's verifier); the journal decision `Op-X confirm-only: …`.

- [ ] **Step 1: spec-implementation Phase 1** — after `Both MUST FAIL … investigate before proceeding …` add:

```markdown
**Confirm-only Op.** If *every* Op-X test is already green here and the cause is legitimate — an earlier story or Op shipped the behaviour and Op-X's rows only pin it — this Op has no GREEN to write. Journal the decision (`Op-X confirm-only: <which tests> green at base because <story/Op that shipped it>`), skip Phase 2's implementation and its `feat` commit (there is nothing to commit), but still run Phase 2's regression baseline (and `<E2E>` if Op-X is a UI Op) so the evidence is journaled, then continue at Phase 4 with `Op-X.confirm_only = true`. A mix — some rows green, some red — is not confirm-only: implement the red ones and mention the green ones in the self-review.
```

- [ ] **Step 2: spec-implementation Phase 2** — after the `Regression baseline (contract §4): …` bullet add two bullets:

```markdown
- UI Ops also run `<E2E>` (contract §4): if PLAN.md's Structure assigns any file Op-X changed to the UI module, or the Op names a `UI spec`, run `<E2E>` when `package.json` defines it. A failing e2e spec of a story already `verified` is the `regression` hard stop under autopilot — a rendered-text regression is invisible to the unit and BDD lanes (dogfood C1: sr-only text leaking into a cell's text content).
- Every lane runs synchronously (contract §2 rule 6): never `run_in_background`; a lane that cannot fit the tool timeout is narrowed to this Op's scenarios (`--name`), and the narrowing journaled.
```

- [ ] **Step 3: spec-implementation Phase 4** — add `- \`Op-X.confirm_only = true\` when Phase 1 declared the Op confirm-only (otherwise leave the field absent)` after the `Op-X.completed_at` bullet. Under "Commit Rules" append:

```markdown
Never `--amend` a commit once it has been journaled (contract §3). The `journal.jsonl` line your commit produces stays uncommitted until the next commit sweeps it in — that trailing line is the expected end state of a stage, not something to fold back with `--amend` (which leaves the journal pointing at a sha no branch reaches).
```

- [ ] **Step 4: spec-implementation state-schema.md** — after the `implementation` block section add:

```markdown
### `operations[Op-X].confirm_only` (per Op, written in Phase 4)

`true` when Phase 1 found every Op-X test already green at base (an earlier story or Op shipped the behaviour): no `feat(US-NNN): implement Op-X` commit exists, `operation_phase` still advances to `green`, and `/autopilot` skips the per-Op green audit for it. Absent otherwise.
```

- [ ] **Step 5: spec-implementation-verification Agent Prompt**

Step 1 item 5 — append: `If state.operations[Op-X].confirm_only = true there is no feat() commit and the diff range is empty by design: audit the journaled regression-baseline run (specs/journal.jsonl, kind decision "Op-X confirm-only") and the Test Plan rows instead, and do NOT report the missing RED phase as a warning.`

Step 2 — after the four `<TEST>`/`<BDD>` lines add:

```
If Op-X touched the UI module (PLAN.md Structure) and package.json defines
`e2e` (contract §4):
- `<E2E>` → expect: every spec of stories already `verified` PASSES. A
  rendered-text regression there is a critical issue even when the unit and
  BDD lanes are green.
```

Test Run Results table — add the row `| e2e   | (UI Ops only)                       | N         | N      | 0      |`.

Next Step — replace the bracketed text with:

```
[Derived from state.json, not from habit: the next Op in id order whose
 operation_phase is red → "Ready for /spec-implementation US-NNN Op-N";
 pending → "Ready for /test-setup US-NNN Op-N"; none left → "Ready for
 /spec-implementation US-NNN (story-end gates)"; or "Fix [N] critical
 issues first, then re-run /spec-implementation-verification US-NNN Op-X"]
```

- [ ] **Step 6: Bumps, validate, commit**

`bash scripts/bump.sh spec-implementation minor` (→ 3.4.0):

```markdown
### Added

- Confirm-only Ops: when every Op-X test is already green at Phase 1, the Op is journaled, no `feat` commit is made, the regression baseline still runs, and `state.json.operations[Op-X].confirm_only = true` lets `/autopilot` skip the per-Op audit (dogfood P14).
- UI Ops run `<E2E>` in the GREEN self-review (dogfood P17).

### Changed

- Never `--amend` a journaled commit; lanes run synchronously. Contract resync (see `dev-ledger` 1.0.3).
```

`bash scripts/bump.sh spec-implementation-verification minor` (→ 1.3.0):

```markdown
### Added

- Per-Op audit runs `<E2E>` for UI Ops; confirm-only Ops are audited on their regression evidence, not flagged for a missing RED phase; the Next Step is derived from `state.json` (dogfood P10/P14/P17).

### Changed

- Contract resync (see `dev-ledger` 1.0.3).
```

`bash scripts/validate.sh` → 0.

```bash
git add plugins/spec-implementation plugins/spec-implementation-verification .claude-plugin/marketplace.json && git commit -m "feat(spec-implementation,spec-implementation-verification): confirm-only Ops, E2E for UI ops, never-amend, next step from state (3.4.0 / 1.3.0)"
```

---

### Task 8: Catalog, marketplace changelog, local install, read-only dogfood check on finfetch-web, handoff, PR

**Files:**
- Modify: `README.md` (catalog version cells; the `specs/` tree comment for `autopilot.json`)
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Changed`)
- Create: `.claude/handoffs/autopilot-plan3-001.md`

- [ ] **Step 1: README** — update every version cell to match `plugin.json` (`for p in plugins/*/; do jq -r '"\(.name) \(.version)"' $p/.claude-plugin/plugin.json; done` against the table). Change the tree comment to `├── autopilot.json                            # local run state (.git/info/exclude), present only while /autopilot runs`. In the `spec-implementation` row add `Confirm-only Ops (already green at base) are recorded, not re-implemented; UI Ops also run <E2E>.` In the `autopilot` row add `Records base_sha per story; story-verifier commits its outputs.`

- [ ] **Step 2: CHANGELOG.md** — under `[Unreleased]` add a `### Changed` block (create it if absent): `- Autopilot hardening from the first live dogfood on finfetch-web (plan 3/3, \`.claude/handoffs/dogfood-US-002-report.md\`): the pipeline contract resynced across every pipeline plugin (synchronous stages, never-amend, filter fallbacks, baseline lanes, \`<E2E>\` for UI Ops), \`autopilot\` 1.1.0, \`test-setup\` 3.3.0, \`spec-implementation\` 3.4.0, \`spec-implementation-verification\` 1.3.0, \`dev-ledger\` 1.0.3.`

- [ ] **Step 3: Validate, tests, install**

```bash
bash scripts/validate.sh && node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs && node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs && bash scripts/install-local.sh --all
git diff --name-only main HEAD | grep '^plugins/' | awk -F/ '{print $2}' | sort -u > /tmp/touched.txt
git diff --name-only main HEAD | grep 'CHANGELOG.md$' | grep '^plugins/' | awk -F/ '{print $2}' | sort -u | diff - /tmp/touched.txt && echo "changelog guard: ok"
```

Expected: validate 0, both suites green, 20 plugins linked, `changelog guard: ok` (every touched plugin has a CHANGELOG change — this is what CI enforces).

- [ ] **Step 4: Read-only dogfood check on finfetch-web** (nothing is written there — `next --story` is a dry run and `report` only reads)

```bash
cd /home/ttadmin/Codes/finfetch-web
AP="$(find -L "$HOME/.claude/skills" -path '*/autopilot/scripts/autopilot.mjs' -not -path '*archive*' | head -1)"
node "$AP" next --story US-002          # expect stage spec-implementation-verification, op Op-7 (its green_audit is FAIL) — confirm_only absent everywhere so nothing is skipped
node "$AP" report                       # expect: ONE "US-002 Op-7 spec-implementation-verification — stop (verifier_fail)" line, ONE "US-002 Op-7 self-review" gate line, commits in git order, ee9f00f / e3ee22d / 30bd82a suffixed "(unreachable)"
node "$AP" preflight US-002 --skip-arch-check   # expect ok:false — the tree is still dirty with the Op-7 verifier's uncommitted outputs (that is the P9 state this plan fixes for the NEXT run; committing them is the user's call), and a warning would name the TODO STORY.md once the tree is clean
git status --short                      # expect unchanged: M backlog.json, M journal.jsonl, M state.json, ?? autopilot.json, ?? green-audit-Op-7.md
cd /home/ttadmin/Codes/claude-dev-skill
```

Paste the three JSON/text outputs into the handoff. If `report` still shows a duplicate line or a bare `null`, that is a Task 2 bug: fix it there before continuing.

- [ ] **Step 5: Handoff**

Write `.claude/handoffs/autopilot-plan3-001.md` with the sections Goal / State / Next / Context in the style of `autopilot-plan2-002.md`: what shipped (versions table above), the dry-run outputs from Step 4, and Next = (1) user merges the PR, (2) in finfetch-web: resolve C1 per `green-audit-Op-7.md`, commit the verifier's leftovers, `bash scripts/install-local.sh --all`, re-run `/autopilot US-002 --skip-arch-check` (expect a resume at `spec-implementation-verification Op-7`, then `simplify` → `code-review` → `spec-implementation` story-end → V&V), (3) Plan 4 = `specs-site` (design spec §5). Note the deferred items: `report --run-id <old>` still has null target/until; the P14 skip is self-declared by the impl agent (the story-reviewer sees the full diff); `TEST_SETUP_COMPLETE` not added.

- [ ] **Step 6: Commit, push, PR**

```bash
git add -A && git commit -m "docs: catalog + changelog for the dogfood hardening; handoff; read-only dry run on finfetch-web"
git push -u origin feat/autopilot-plan3
gh pr create --title "feat: autopilot hardening from the finfetch-web dogfood (plan 3/3)" --body-file <(printf '%s\n' "Closes P1–P19 of .claude/handoffs/dogfood-US-002-report.md per docs/superpowers/plans/2026-09-05-autopilot-dogfood-hardening.md." "" "Contract resync across every pipeline plugin (7 of the 19 were contract-level); autopilot 1.1.0, test-setup 3.3.0, spec-implementation 3.4.0, spec-implementation-verification 1.3.0, dev-ledger 1.0.3. Decisions (autopilot.json via .git/info/exclude, P13 fixed in the script, legacy state.json stays a manual /test-setup) are in the plan header." "" "🤖 Generated with [Claude Code](https://claude.com/claude-code)" "" "https://claude.ai/code/session_01BrA99AFhaYj693V5EDwSbw")
```

---

## Self-review against the report

- **P1** stop before any stage → Task 2 (`story=target`, `stage=autopilot`, `run — stop (<reason>)`). **P2** untracked `autopilot.json` → Task 3 (`.git/info/exclude`, journaled once). **P3** legacy `state.json` migration → Task 6 step 0 (+ commit). **P4** pre-existing RED suite → Task 6. **P5** vacuous unit filter → Task 1 §4 (confirm > 0, file-path fallback). **P6** story with no `features/` → Task 1 §4 (name-union fallback). **P7** `BASE_SHA=HEAD~0` → Task 3 (`base_sha` recorded at `start`/`stageEnd`) + Task 5 §6 (`jq` read, `chore(` in the fallback). **P8** amend after journaling → Task 1 §3 (never-amend, hook dedupe) + Task 7 Commit Rules + Task 2 (`(unreachable)` in the report). **P9** verifier leaves the tree dirty → Task 5 (commit step before sentinel/stop). **P10** wrong next-step text → Task 5 (verifier) + Task 7 (skill's Output Format). **P11** background tool call → Task 1 §2 rule 6 + Task 5 hard rule + Task 7 Phase 2. **P11b** two agents after retry → Task 5 §5 (`TaskStop` first) + §10 checklist. **P12** report noise → Task 2. **P13** double stop → Task 2 (`alreadyJournaled`). **P14** confirm-only Ops → Task 4 (resolver) + Task 7 (writer) + Task 5/6 (verifier text, schema). **P15** env-gated lanes → Task 1 §4 "Lanes". **P16** `pkill` kills the shell → Task 1 §4 "Leftover servers". **P17** `<E2E>` for UI Ops → Task 1 §4 table + bullet, Task 7 both skills. **P18** conductor's stray journal line / `ledger --help` → Task 5 §5 paragraph + Task 1 `--help`. **P19** migrated-stub warning → Task 3 (`preflight` warning) + Task 5 §4.
- **Placeholder scan:** every code step carries its code; every prose edit carries its text; the one "check every flag against the function" instruction in Task 1 Step 5 names the functions and lines to check.
- **Name consistency:** `base_sha` (autopilot.json key, Tasks 3/5/README), `confirm_only` (state.json key, Tasks 4/5/6/7), `recordBaseSha` / `excludeAutopilotJson` / `gitOut` (Task 3 helpers, private), `commitPaths(root, msg, paths)` (test helper, Tasks 2/3), `reason` on stop `stages[]` entries and `unreachable` on `commits[]` entries (Task 2, read by Task 8's dry run). Contract section numbers cited by Tasks 5–7 (`§2 rule 6`, `§3`, `§4`) are the ones Task 1 creates.
