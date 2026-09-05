# specs-site (Astro) + run-2 dogfood fixes Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `specs-site` plugin — an Astro 7 app that renders another repo's `specs/` directory (dashboard, per-story pages, architecture, design, journal, backlog) as a pure function of `specs/**` — and close the eight problems the second live `/autopilot US-002` run surfaced (`.claude/handoffs/dogfood-US-002-run2-report.md` §3, P1–P8) so the journal the site renders is correct.

**Architecture:** (1) `autopilot.mjs` gets the four deterministic fixes with `node --test` coverage: a finished single-story run pauses as `story_end` (P1), a story first picked up mid-way gets a real `base_sha` (P2), a run's stop is attributed to the run, not the last stage (P3), and `preflight` refuses a tracked `specs/autopilot.json` (P8). (2) The canonical contract gets two sentences (P4 journal-only-on-success + commitlint constraints, P5 uid-scoped `pkill`) synced into every pipeline plugin; the conductor skill learns that Agent dispatch is asynchronous (P6). (3) A new plugin `specs-site` whose skill dir carries the Astro site: plain `fs` readers for the JSON trackers (fresh on every dev request), a `docs` content collection over the markdown, a pure Gherkin parser for `.feature` files, one CSS file, one static endpoint for diagrams/screenshots/mockups, and a `specs-site.mjs` CLI that installs the site's deps on first run and starts `astro dev` / `astro build` against `--specs`.

**Tech Stack:** Node ≥ 22.12 (Astro 7 floor; `node:test`, stdlib only outside the site), Astro `^7.3.1` (static output, content layer `glob()` for markdown), `@cucumber/gherkin` `^42` + `@cucumber/messages` `^34`, plain CSS with `light-dark()`. No Tailwind, no Vitest, no Playwright (see decisions).

**Spec:** `docs/superpowers/specs/2026-08-30-autopilot-design.md` §5 (the site), §7 (loader errors render in place), §8 (tests), §9 (versions); `.claude/handoffs/dogfood-US-002-run2-report.md` §3 (P1–P8, each with file:line and the smallest fix). Plans 1–3 (`docs/superpowers/plans/2026-08-30-dev-ledger-and-autopilot-contract.md`, `2026-09-05-autopilot-plugin.md`, `2026-09-05-autopilot-dogfood-hardening.md`) shipped the trackers and journal this site renders.

**Decisions made while planning:**

- **The site lives at `plugins/specs-site/skills/specs-site/site/`, not `plugins/specs-site/site/`** (spec §5.1). `install-local.sh` symlinks `skills/<name>/` only; a sibling `site/` would not follow the skill into `~/.claude/skills/`, and the CLI locates the site relative to itself.
- **JSON trackers are read with `fs` on every request, not through content collections.** `astro dev` re-runs frontmatter per request, so `stories.json` / `state.json` / `journal.jsonl` / `backlog.json` / `autopilot.json` are always fresh (spec §8's "reflects a `state.json` edit within one reload"). Collections would add a schema layer and loader semantics for zero gain here. Markdown stays a `glob()` collection (`docs`) because that is where Astro's markdown pipeline (GFM tables included by default — no `remark-gfm`) lives. `.feature` files go through a pure parser module called from frontmatter — a parse error becomes an entry-level error rendered in place (spec §7) with no custom loader.
- **No Tailwind, no client framework.** One `global.css` (~150 lines, CSS custom properties, `light-dark()` for the OS theme) covers six page types. The only client JS is the `/journal` and `/backlog` filter script (spec §5.3) and a 15 s auto-reload on the Dashboard while `autopilot.json.active` is true in dev.
- **DESIGN.md tokens are rendered as swatches on `/design`; the site does not re-theme itself from them.** Adopting a project's palette is speculative polish; the swatch table is the useful part.
- **Tests are `node --test`, not Vitest + Playwright.** Parser/reader units run against fixture files; the smoke test builds the site against the fixture and asserts on the emitted HTML, then starts `astro dev` and proves a `state.json` edit is visible on the next fetch. Playwright would add a browser download to CI for assertions `fetch` can make.
- **`repo-initialization` does not gain a `specs:site` npm script** (spec §5.1/§9). The plugin script is not on the project's PATH, and `/specs-site` is the entry point. The `specs/.site/` gitignore line already ships (2.2.x). `repo-initialization` gets the contract patch bump only.
- **Run-2 fixes ride in this plan** (Tasks 1–3) rather than a separate Plan 3b: P1/P3 change what the journal's `stop` line says and P2 what `base_sha` means — the site renders both, so they land first.
- **P2 rule:** when `base_sha[story]` is absent at first pickup, the base is the parent of the first commit whose subject matches `^(test|feat|fix|refactor|chore)\(US-NNN\)`; HEAD only when no such commit exists. No `state.json` read — prior story commits are the only evidence that work predates this run.
- **P3 rule:** `stage-end --outcome sentinel` clears `ap.current` when `next` is `done` or `stop`; `stop()` already falls back to `stage: "autopilot"` / `story: target`, which `report` renders as `run — stop (<reason>)`. A stop while a stage is running keeps that stage's attribution.

## Global Constraints

- Node ≥ 22.12 for the site (Astro 7 `engines`); `autopilot.mjs`, `ledger.mjs`, `specs-site.mjs` and every test use stdlib only. The site's runtime deps are exactly `astro`, `@cucumber/gherkin`, `@cucumber/messages`.
- The site never writes under `SPECS_DIR` except `build --outDir <specs>/.site/` (spec §5.1). It shows nothing that is not in `specs/**` (spec §5.4).
- `SPECS_DIR` is an absolute path set by `specs-site.mjs`; every reader resolves against it. The dev server binds `127.0.0.1:4321` unless `--host` / `--port` are passed.
- `specs/autopilot.json` keys after this plan are unchanged from Plan 3 (`active run_id target until stop_policy skip_arch_check base_sha current last_next started_at stopped_at stop_reason`); `current` may now be `null` after the last stage of a run.
- Stop reasons, stage names, sentinels and agent names unchanged.
- Every plugin whose files change gets a `scripts/bump.sh` bump and a filled CHANGELOG line **in the same task** (CI `changelog-bump-guard`). `bump.sh` inserts `### Added` + a blank `- ` bullet: fix the heading and fill the bullet by hand. `dev-ledger`'s second skill (`skills/backlog/SKILL.md`) needs its `version:` line edited by hand.
- Marketplace scripts are bash: run them as `bash scripts/x.sh` (the user's shell is fish; a bare `=====` token in `echo` must be quoted; use `/bin/mv -f`, never `mv`, in loops). `bash scripts/validate.sh` must exit 0 at the end of every task.
- Never edit a plugin's copy of `references/autopilot-contract.md`; edit the canonical `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md` and run `bash scripts/sync-contract.sh`.
- Do not edit any file outside the task's **Files** list. Anything else that needs a change gets its own bump + CHANGELOG line, or a note in the handoff.
- Commit after every task on branch `feat/autopilot-plan4-specs-site` (created in Task 1 from `main`). Conventional Commits; commit footer per the session's attribution rules.
- `.astro` files: explicit file extensions in imports, `class` not `className`, `await` in frontmatter only, `set:html` only on markdown the site rendered itself.

## Target versions after this plan

| Plugin | Before | After | Why |
| --- | --- | --- | --- |
| `specs-site` | — | 1.0.0 | new |
| `autopilot` | 1.1.0 | 1.2.0 | P1 pause reason, P2 base_sha heuristic, P3 stop attribution, P8 tracked-file refusal, P6 async dispatch text |
| `dev-ledger` | 1.0.3 | 1.0.4 | contract §3 commit-then-journal rule (P4), §4 `pkill -u` (P5) |
| `spec-writing` | 3.0.1 | 3.0.2 | contract resync |
| `spec-writing-verification` | 2.3.1 | 2.3.2 | contract resync |
| `ui-specs` | 2.1.2 | 2.1.3 | contract resync |
| `plan-writing` | 2.4.1 | 2.4.2 | contract resync |
| `plan-writing-verification` | 2.3.1 | 2.3.2 | contract resync |
| `test-setup` | 3.3.0 | 3.3.1 | contract resync |
| `test-setup-verification` | 3.2.2 | 3.2.3 | contract resync |
| `spec-implementation` | 3.4.0 | 3.4.1 | contract resync |
| `spec-implementation-verification` | 1.3.0 | 1.3.1 | contract resync |
| `verification-and-validation` | 2.1.2 | 2.1.3 | contract resync |
| `repo-initialization` | 2.2.2 | 2.2.3 | contract resync |

## File map

```
plugins/autopilot/skills/autopilot/scripts/autopilot.mjs             # resolveVerified (P1), stageEnd + stop (P3), recordBaseSha (P2), preflight (P8)   Tasks 1–2
plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs        # tests for Tasks 1–2
plugins/autopilot/skills/autopilot/SKILL.md                          # §5 step 4 async dispatch (P6), §6 BASE_SHA (P2), §7 tracked file (P8), §8 table (P1)   Task 3
plugins/autopilot/agents/story-verifier.md                           # explicit path list in the commit step (P8)                                          Task 3
plugins/autopilot/README.md                                          # stop policy paragraph (P1)                                                         Task 3
plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md # §3 commit-then-journal (P4), §4 leftover servers (P5) — canonical                  Task 3
plugins/*/skills/*/references/autopilot-contract.md                  # synced copies                                                                      Task 3
plugins/specs-site/                                                  # new plugin                                                                         Tasks 4–7
  .claude-plugin/plugin.json, CHANGELOG.md, README.md
  skills/specs-site/SKILL.md                                         # /specs-site [--specs DIR] [--build] [--host] [--port N]
  skills/specs-site/scripts/specs-site.mjs                           # CLI: dev|build --specs DIR                                                          Task 4
  skills/specs-site/scripts/specs-site.test.mjs                      # arg parsing + build smoke + dev freshness                                            Tasks 4, 7
  skills/specs-site/scripts/fixtures/specs/                          # tiny specs dir the tests render                                                     Task 4
  skills/specs-site/site/package.json, astro.config.mjs, tsconfig.json, .gitignore                                                                          Task 4
  skills/specs-site/site/src/content.config.ts                       # docs collection (markdown under SPECS_DIR)                                          Task 4
  skills/specs-site/site/src/lib/specs.mjs (+ .test.mjs)             # SPECS_DIR, readers, parseJsonl, opProgress, scenarioStatus, listAssets              Task 5
  skills/specs-site/site/src/lib/gherkin.mjs (+ .test.mjs)           # parseFeature                                                                        Task 5
  skills/specs-site/site/src/layouts/Base.astro, src/styles/global.css                                                                                     Task 6
  skills/specs-site/site/src/components/{Chip,Markdown,Feature,JournalTable,BacklogTable,Filters}.astro                                                    Task 6
  skills/specs-site/site/src/pages/index.astro, stories/[id].astro                                                                                         Task 6
  skills/specs-site/site/src/pages/{architecture,design,journal,backlog}.astro, backlog/[id].astro, assets/[...path].ts                                     Task 7
.github/workflows/ci.yml                                             # specs-site tests job                                                                Task 7
README.md, CHANGELOG.md, .claude/handoffs/autopilot-plan4-001.md    # catalog, marketplace changelog, handoff                                             Task 8
```

---

### Task 1: `autopilot.mjs` — a finished single-story run pauses as `story_end` (P1); the run's stop is not attributed to the last stage (P3)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs:511-523` (`resolveVerified`), `:904-906` (end of `stageEnd`)
- Test: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`

**Interfaces:**
- Consumes: `nextStage(specs, ap)`, `stageEnd(specs, opts, deps)`, `stop(specs, opts, deps)`, `report(specs, opts, deps)`; test helpers `fixtureProject`, `setStory`, `writeState`, `commitPaths`, `ledger` at the top of the test file.
- Produces: `stageEnd` returns `{action:"continue", next:{done:true, reason:"story_end"|"until_reached", story}}` and leaves `autopilot.json.current === null` whenever `next.done || next.stop`; `stop()` then journals `stage:"autopilot"`, `story: ap.target`.

- [ ] **Step 1: Branch**

```bash
cd /home/ttadmin/Codes/claude-dev-skill && git checkout -b feat/autopilot-plan4-specs-site main
```

- [ ] **Step 2: Failing tests** — append to `autopilot.test.mjs`:

```js
test("P1: a verified story that is also --until pauses as story_end under hard-failures+story-end, until_reached under hard-failures", async () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "verified" });
  const base = { active: true, run_id: "r", target: "US-000", until: "US-000", base_sha: {},
    current: { story: "US-000", stage: "verification-and-validation", op: null, agent: "general-purpose", started_at: "x", attempt: 1 } };
  assert.deepEqual(nextStage(specs, { ...base, stop_policy: "hard-failures+story-end" }),
    { done: true, reason: "story_end", story: "US-000" });
  assert.deepEqual(nextStage(specs, { ...base, stop_policy: "hard-failures" }),
    { done: true, reason: "until_reached", story: "US-000" });
  // a resume (current null) of an already-verified until story is still until_reached
  assert.deepEqual(nextStage(specs, { ...base, stop_policy: "hard-failures+story-end", current: null }),
    { done: true, reason: "until_reached", story: "US-000" });
});

test("P3: stage-end that finishes the run clears current, so stop journals the run, not the last stage", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T18:00:00Z");
  setStory(specs, "US-000", { phase: "green", invest: { i: true, n: true, v: true, e: true, s: true, t: true, checked_at: "2026-09-05" } });
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(specs, { story: "US-000", stage: "verification-and-validation", agent: "general-purpose" }, { ledger, now });
  setStory(specs, "US-000", { phase: "verified" }); // what the V&V stage does
  const r = await stageEnd(specs, { outcome: "sentinel" }, { ledger, now });
  assert.equal(r.action, "continue");
  assert.equal(r.next.reason, "story_end");
  assert.equal(readAutopilot(specs).current, null);
  const rep = await stop(specs, { reason: r.next.reason }, { ledger, now });
  const stopLine = ledger.readJournal(specs).findLast((e) => e.kind === "stop");
  assert.equal(stopLine.stage, "autopilot");
  assert.equal(stopLine.story, "US-000");
  assert.match(rep.text, /\n  run — stop \(story_end\)\n/);
  assert.doesNotMatch(rep.text, /verification-and-validation — stop/);
});
```

- [ ] **Step 3: Run, expect both to fail**

```bash
node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs 2>&1 | grep -E '^not ok|^# (pass|fail)'
```

Expected: `not ok … P1 …` (`until_reached` where `story_end` expected), `not ok … P3 …` (`current` still set; `verification-and-validation — stop`).

- [ ] **Step 4: Implement** — replace `resolveVerified`:

```js
function resolveVerified(specs, ap, story, stories) {
  // A story that just reached `verified` under a story-end policy pauses as
  // story_end even when it is also --until: until_reached is reserved for the
  // chain being exhausted (dogfood run 2, P1).
  const storyEndPolicy = String(ap.stop_policy ?? "").includes("story-end");
  if (
    storyEndPolicy &&
    ap.current?.stage === "verification-and-validation" &&
    ap.current.story === story
  ) {
    return { done: true, reason: "story_end", story };
  }
  if (story === ap.until) return { done: true, reason: "until_reached", story };
  const next = nextEligibleStory(stories, story, ap.until);
  return next ? resolveForStory(specs, ap, next) : { done: true, reason: "until_reached", story };
}
```

and, at the end of `stageEnd`, replace the last three lines with:

```js
  if (!next.done && !next.stop && next.story !== current.story) recordBaseSha(specs, ap, next.story);
  // The run is over: nothing is running any more, so a following `stop`
  // belongs to the run, not to the stage that happened to finish last (P3).
  if (next.done || next.stop) ap.current = null;
  writeJson(autopilotPath(specs), ap);
  return { action: "continue", next };
```

- [ ] **Step 5: Run the whole suite** — same command. Expected: `# pass 52`, `# fail 0`. (The existing test at `:534` "verified target with until=target → done until_reached" passes `current: null`, so it still holds; `:541` still gets `story_end`.)

- [ ] **Step 6: Commit**

```bash
git add plugins/autopilot/skills/autopilot/scripts/autopilot.mjs plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs
git commit -m "fix(autopilot): single-story run pauses as story_end; run-ending stop is not attributed to the last stage (run-2 P1, P3)"
```

---

### Task 2: `autopilot.mjs` — `base_sha` for a story first picked up mid-way (P2); `preflight` refuses a tracked `specs/autopilot.json` (P8)

**Files:**
- Modify: `plugins/autopilot/skills/autopilot/scripts/autopilot.mjs:624-629` (`recordBaseSha`), `:129-255` (`preflight`, after the clean-tree check)
- Test: `plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs`

**Interfaces:**
- Produces: `autopilot.json.base_sha[US-NNN]` = parent sha of the first `^(test|feat|fix|refactor|chore)\(US-NNN\)` commit when one exists, else HEAD. `preflight` error string: `specs/autopilot.json is tracked — run: git rm --cached specs/autopilot.json && git commit -m "chore: untrack autopilot run state" (it is local run state)`.

- [ ] **Step 1: Failing tests**

```js
test("P2: base_sha is the parent of the story's first commit when the story was worked on before this run", async () => {
  const { root, specs } = fixtureProject();
  const init = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  writeFileSync(join(root, "a.txt"), "red\n");
  commitPaths(root, "test(US-000): Op-1 RED", ["a.txt"]);
  writeFileSync(join(root, "b.txt"), "green\n");
  commitPaths(root, "feat(US-000): Op-1", ["b.txt"]);
  setStory(specs, "US-000", { phase: "red", invest: { i: true, n: true, v: true, e: true, s: true, t: true, checked_at: "2026-09-05" } });
  writeState(specs, "US-000", { story_id: "US-000", schema_version: 2, operations: { "Op-1": { operation_phase: "green" }, "Op-2": { operation_phase: "red" } } });
  commitPaths(root, "chore: trackers", ["specs"]);
  const ap = await start(specs, { target: "US-000" }, { ledger, now: new Date() });
  assert.equal(ap.base_sha["US-000"], init);
});

test("P2: base_sha stays HEAD when no commit of the story exists yet", async () => {
  const { root, specs } = fixtureProject();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const ap = await start(specs, { target: "US-000" }, { ledger, now: new Date() });
  assert.equal(ap.base_sha["US-000"], head);
});

test("P8: preflight refuses when specs/autopilot.json is tracked", () => {
  const { root, specs } = fixtureProject();
  writeJson(join(specs, "autopilot.json"), { active: false });
  commitPaths(root, "oops: tracked run state", ["specs/autopilot.json"]);
  const r = preflight(specs, { target: "US-000" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith("specs/autopilot.json is tracked")), r.errors.join("\n"));
});
```

- [ ] **Step 2: Run, expect the three new tests to fail** (P2 first: `base_sha` equals HEAD, not `init`; P8: `ok: true`).

- [ ] **Step 3: Implement** — replace `recordBaseSha`:

```js
// The story's diff base for the simplify / code-review gates, recorded once
// and carried across resumes. A story first picked up by a run after work on
// it was already committed (a migrated repo, a pre-1.1.0 run) starts at the
// parent of its first commit — HEAD would make the story diff specs-only
// (dogfood run 2, P2).
function recordBaseSha(specs, ap, story) {
  ap.base_sha ??= {};
  if (ap.base_sha[story]) return;
  const root = dirname(specs);
  const first = gitOut(root, [
    "log", "--reverse", "-E", `--grep=^(test|feat|fix|refactor|chore)\\(${story}\\)`, "--format=%H",
  ])?.split("\n")[0];
  const sha = (first && gitOut(root, ["rev-parse", `${first}^`])) || gitOut(root, ["rev-parse", "HEAD"]);
  if (sha) ap.base_sha[story] = sha;
}
```

(`rev-parse <first>^` fails when the first story commit is the root commit; the `||` then falls back to HEAD — acceptable, and the fixture never hits it.)

In `preflight`, right after the `dirty.length` block inside the `else`:

```js
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "specs/autopilot.json"], { cwd: root, stdio: "ignore" });
    if (tracked.status === 0) {
      errors.push(
        'specs/autopilot.json is tracked — run: git rm --cached specs/autopilot.json && git commit -m "chore: untrack autopilot run state" (it is local run state)',
      );
    }
```

- [ ] **Step 4: Run the suite.** Expected `# pass 55`, `# fail 0`. If the existing test at `:1133` ("carries base_sha across runs") fails, its fixture commits carry no `US-NNN` subject, so the value must still be HEAD — inspect before touching it.

- [ ] **Step 5: Commit**

```bash
git add plugins/autopilot/skills/autopilot/scripts/autopilot.mjs plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs
git commit -m "fix(autopilot): base_sha from the story's first commit; preflight refuses a tracked autopilot.json (run-2 P2, P8)"
```

---

### Task 3: Contract P4 + P5, conductor/verifier text P1 P2 P6 P8; `autopilot` 1.2.0, `dev-ledger` 1.0.4, eleven contract patch bumps

**Files:**
- Modify: `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md` (canonical; §3 "Commit, then journal" paragraph, §4 "Leftover servers" bullet)
- Modify: `plugins/*/skills/*/references/autopilot-contract.md` via `bash scripts/sync-contract.sh`
- Modify: `plugins/autopilot/skills/autopilot/SKILL.md` §5 step 4, §6 BASE_SHA block + paragraph, §7 last paragraph, §8 table rows `story_end` / `until_reached`
- Modify: `plugins/autopilot/agents/story-verifier.md:121`
- Modify: `plugins/autopilot/README.md` "Stop policy" paragraph
- Modify: CHANGELOGs + versions of the 13 plugins in the table (via `bump.sh`), `plugins/dev-ledger/skills/backlog/SKILL.md` `version:` by hand

- [ ] **Step 1: Contract §3** — replace the paragraph starting `**Commit, then journal — never amend.**` with:

```markdown
**Commit, then journal — never amend.** Journal a `commit` line only when `git commit` exited 0 — chain them: `git commit -m "…" && node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "…"`. A commit hook (commitlint, lint-staged) can reject the commit; a journal line written first would then point at the previous HEAD. Two commitlint rules under `config-conventional` trip agents most: the header is ≤ 100 characters, and the subject after `type(scope): ` starts lowercase (`op-7 — …`, not `Op-7 — …`). The `commit` journal line lands after the commit it records, so a trailing uncommitted `journal.jsonl` line is the normal state at the end of every stage; the next commit sweeps it in. Never `git commit --amend` a commit that has already been journaled — the journal would point at a sha no branch reaches. When `/repo-initialization` installed the post-commit hook (`grep -q ledger .git/hooks/post-commit`), skip the manual `commit` line: the hook already wrote it.
```

- [ ] **Step 2: Contract §4 "Leftover servers"** — replace the bullet with:

```markdown
- Leftover servers: Playwright's `webServer` and `astro preview` stop their own process; kill only what this lane started, and only your own — `pkill -u "$(id -u)" -f 'entry\.mjs$'`. Scope to the uid because a rootless container running the same command (a staging deployment on the same host) shows up in the host's process list under a mapped uid, and an unscoped `pkill` restarts production. Anchor the pattern to the end of the command line — a bare `pkill -f 'dist/server/entry.mjs'` also matches the tool shell running the `pkill` and kills the stage (exit 144). Before any manual `kill <pid>`, read the process's `USER` column; a uid you do not recognise is not yours.
```

- [ ] **Step 3: Sync** — `bash scripts/sync-contract.sh` (12 `✓` lines).

- [ ] **Step 4: autopilot SKILL.md**

§5 step 4 — replace the line `Capture its FULL final message as OUT — sentinels are matched against that text and nothing else.` with:

```
        The Agent call may return before the agent has finished (the harness runs dispatches asynchronously
        and delivers the final message as a completion notification, sometimes minutes later). Do not run
        stage-end, next, or anything else for this run until that notification has arrived; then capture
        the agent's FULL final message as OUT — sentinels are matched against that text and nothing else.
```

§6 — replace the bash block and the paragraph after it with:

```bash
STORY=US-NNN
SLUG=$(jq -r --arg s "$STORY" '.stories[]|select(.id==$s).slug' specs/stories.json)
BASE_SHA=$(jq -r --arg s "$STORY" '.base_sha[$s]' specs/autopilot.json)
```

```markdown
`SLUG` builds the report paths (`specs/story-NNN-$SLUG/verification/…`). `BASE_SHA` is the commit the story's diff starts after: `start` (or `stage-end`, when a chain moves to the next story) records it the first time a run picks the story up and carries it across resumes. It is HEAD for a story with no commits yet, and the parent of the story's first `test|feat|fix|refactor|chore(US-NNN)` commit for a story worked on before this run (a migrated repo, a pre-1.1.0 run) — so the simplify and code-review gates always diff the story's own work, never a specs-only span. These two lookups are the only tracker reads the conductor makes.
```

§7 — append to the last paragraph: `` `start` refuses when `specs/autopilot.json` is tracked; a verifier or a human who swept it in with `git add -A -- specs/` un-tracks it with `git rm --cached specs/autopilot.json` and a commit. Commit spec leftovers with an explicit path list, never `git add -A -- specs/`. ``

§8 — the two `PAUSED` rows become:

```
| `story_end`          | `PAUSED`  | The story reached `verified` under `hard-failures+story-end` — also when it was the last story of the run. |
| `until_reached`      | `PAUSED`  | Under `hard-failures`: `--until` is done, or no eligible story remains. |
```

- [ ] **Step 5: story-verifier.md:121** — replace the `git add -A -- specs/ && git commit …` line with:

```bash
git add -- "$REPORT" "specs/story-NNN-$SLUG/state.json" specs/backlog.json specs/journal.jsonl && git commit -m "chore(US-NNN): <spec-audit|plan-audit|green-audit op-x> — <PASS|PASS_WITH_WARNINGS|FAIL>"
```

and add the sentence after it: `Explicit paths, never `git add -A -- specs/`: that sweeps in `specs/autopilot.json` (local run state) and any stray file, and the next `start` refuses a tracked run file. Header ≤ 100 characters, subject lowercase after the colon (commitlint).`

- [ ] **Step 6: autopilot README** — in the "Stop policy" paragraph replace `pauses at each story's end so the user can look before the chain continues;` with `pauses at each story's end (\`story_end\` — also for the last story of the run) so the user can look before the chain continues; \`until_reached\` is the chain being exhausted under \`hard-failures\`;`.

- [ ] **Step 7: Bumps** (each writes `### Added` + `- `; rewrite by hand as shown)

```bash
bash scripts/bump.sh autopilot minor
bash scripts/bump.sh dev-ledger patch
for p in spec-writing spec-writing-verification ui-specs plan-writing plan-writing-verification test-setup test-setup-verification spec-implementation spec-implementation-verification verification-and-validation repo-initialization; do bash scripts/bump.sh $p patch; done
```

`autopilot` 1.2.0 entry:

```markdown
### Fixed

- A single-story run whose story reaches `verified` pauses as `story_end` (was `until_reached` whenever the story equalled `--until`, i.e. always without `--until`); `until_reached` now means the chain is exhausted (dogfood run 2, P1).
- A run-ending `stop` is journaled as `stage: autopilot` and rendered `run — stop (<reason>)`; the last stage no longer appears twice, once `ok` and once as a stop (P3).
- `base_sha[US-NNN]` for a story worked on before this run is the parent of its first `test|feat|fix|refactor|chore(US-NNN)` commit, not HEAD — the story-end gates diff the story's code, not a specs-only span (P2).
- `preflight` refuses a tracked `specs/autopilot.json` and prints the `git rm --cached` fix; `story-verifier` commits with an explicit path list (P8).

### Changed

- Conductor §5: the Agent call may return before the agent does — wait for the completion notification before `stage-end` (P6). §6 reads `BASE_SHA` from `autopilot.json` only; the `git log` fallback moved into the script.
- Contract resync (see `dev-ledger` 1.0.4).
```

`dev-ledger` 1.0.4 entry (and set `version: 1.0.4` in `plugins/dev-ledger/skills/backlog/SKILL.md`):

```markdown
### Changed

- Contract §3: journal a `commit` line only after `git commit` exits 0 (`git commit … && ledger log`), with the two commitlint rules agents trip on (header ≤ 100 chars, lowercase subject); §4 leftover servers: `pkill -u "$(id -u)" -f 'entry\.mjs$'` — an unscoped `pkill` on a shared host kills a rootless container's identical process (dogfood run 2, P4/P5).
```

Every other bumped plugin: heading `### Changed`, bullet `- Contract resync (dogfood run 2, 2026-09-05): journal a commit only after the commit succeeded, commitlint header/subject rules; uid-scoped, end-anchored `pkill` for leftover servers.`

- [ ] **Step 8: Validate + tests**

```bash
bash scripts/validate.sh && node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs && node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs
```

Expected: validate `all checks passed`, autopilot 55/55, ledger 32/32.

- [ ] **Step 9: Commit**

```bash
git add -A plugins/ .claude-plugin/marketplace.json
git commit -m "docs(contract): journal only a successful commit, uid-scoped pkill; conductor waits for async dispatch; autopilot 1.2.0, dev-ledger 1.0.4, 11 contract bumps (run-2 P4-P6, P8)"
```

---

### Task 4: `specs-site` plugin scaffold, site `package.json`, fixture `specs/`, pure modules `lib/specs.mjs` + `lib/gherkin.mjs` with `node --test`

**Files:**
- Create (via `scripts/new-skill.sh`): `plugins/specs-site/{.claude-plugin/plugin.json,CHANGELOG.md,README.md,skills/specs-site/SKILL.md}` + marketplace entry
- Create: `plugins/specs-site/skills/specs-site/site/{package.json,package-lock.json,.gitignore}`
- Create: `plugins/specs-site/skills/specs-site/site/src/lib/specs.mjs`, `specs.test.mjs`, `gherkin.mjs`, `gherkin.test.mjs`
- Create: `plugins/specs-site/skills/specs-site/scripts/fixtures/specs/**` (listed in Step 3)

**Interfaces:**
- Produces (`lib/specs.mjs`): `SPECS_DIR: string` (absolute, from `process.env.SPECS_DIR`, default `./specs`); `readJsonFile(path, fallback) → {data, error}`; `readStories()`, `readBacklog()`, `readAutopilot()` (same shape, fallbacks `{stories:[],project:{},epics:[],personas:[]}`, `{next_id:1,items:[]}`, `null`); `parseJsonl(text) → entry[]` (each entry gets `line`; a malformed line becomes `{line, kind:"invalid", ts:null, summary, raw}`); `readJournal() → entry[]`; `storyDirs() → string[]`; `storyDir(story) → string|null` (dir name, not absolute); `readState(dirName) → {data, error}`; `PHASES`; `opProgress(state) → [{id,title,phase,confirm_only,red_audit,green_audit}]`; `scenarioStatus(state, name) → "pending"|"red"|"green"|"manual"`; `gateVerdicts(journal, storyId) → Map<gate, {verdict, ts, report}>`; `listFiles(dirRel, exts) → string[]` (SPECS_DIR-relative, recursive, sorted).
- Produces (`lib/gherkin.mjs`): `parseFeature(source, path) → {path, error, name, tags, description, children}` where a child is `{kind:"background"|"scenario"|"outline"|"rule", …}` and a step is `{keyword, text, table, docString}`; `readFeatures(dirRel) → parsed[]` (every `*.feature` under `SPECS_DIR/dirRel/features`, sorted; a parse failure is an entry with `error` set).

- [ ] **Step 1: Scaffold** (single-quoted description — `new-skill.sh` writes it unquoted into YAML, so no `: ` inside)

```bash
bash scripts/new-skill.sh specs-site 'Renders a project specs/ directory as a local Astro site — dashboard, per-story pages (story, features, plan, state, verification, backlog), architecture, design, journal and backlog — as a pure function of specs/**. /specs-site starts astro dev on 127.0.0.1 with live data; --build exports to specs/.site/. Triggers on "/specs-site", "show me the specs site", "open the dashboard", "build the specs site".'
```

Then set the version to 1.0.0 by hand in `plugin.json`, `SKILL.md` frontmatter, `README.md`, `marketplace.json`, and rename the CHANGELOG section `## [0.1.0]` → `## [1.0.0] — 2026-09-05` with bullet `- Initial release: Astro 7 site over \`specs/**\` (dashboard, stories, architecture, design, journal, backlog), \`specs-site.mjs\` CLI (\`dev\` / \`build --specs DIR\`), fixture-driven \`node --test\` suite.` `bash scripts/validate.sh` must pass (SKILL.md body is finished in Task 7).

- [ ] **Step 2: Site package**

`site/package.json`:

```json
{
  "name": "specs-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "node --test src/lib/"
  },
  "dependencies": {
    "@cucumber/gherkin": "^42.0.1",
    "@cucumber/messages": "^34.2.1",
    "astro": "^7.3.1"
  }
}
```

`site/.gitignore`: `node_modules/`, `dist/`, `.astro/`. Then `cd plugins/specs-site/skills/specs-site/site && npm install --no-audit --no-fund` (creates `package-lock.json`, which is committed — `npm ci` needs it).

- [ ] **Step 3: Fixture `scripts/fixtures/specs/`** — hand-written, small, every shape the site renders:

```
stories.json        project {name:"Mini Project", description, created_at, updated_at}, personas[1], epics[1],
                    stories: US-000 {slug foundation, title Foundation, phase red, rigor full, is_foundation true,
                    depends_on_story_ids [], artifacts.feature_files ["specs/story-000-foundation/features/F-001-greeting.feature"]},
                    US-001 {slug farewell, title Farewell, phase scoped, depends_on_story_ids ["US-000"]}
backlog.json        next_id 3; BL-001 open warning test-gap story US-000 op Op-1 files ["src/hello.ts"] report "specs/story-000-foundation/verification/green-audit-Op-1.md" detail "…";
                    BL-002 done info doc story US-000, resolved_sha "abc1234", resolution "fixed in docs"
journal.jsonl       8 lines, run_id "run-2026-09-05T10:00:00.000Z", story US-000: action "autopilot start…" · stage_start invest ·
                    gate invest PASS · stage_end invest · stage_start spec-implementation Op-1 · finding backlog_id BL-001 ·
                    commit sha "abc1234" summary "feat(US-000): op-1 — greet" · decision "Confirm-only GREEN: …" — then one malformed line `{"ts": "2026-09-05T10:05:00Z", "kind": "gate"` (no closing brace)
autopilot.json      active true, run_id as above, target/until US-000, stop_policy hard-failures+story-end, base_sha {US-000:"0000000"},
                    current {story US-000, stage spec-implementation, op Op-2, agent general-purpose, started_at, attempt 1}
PROJECT.md          "# Mini Project" + a paragraph + a GFM table
ARCHITECTURE.md     "# Architecture" + "## Modules" table (Module | Responsibility | Depends on) + "## ADRs" + "### ADR-001 …" + `![overview](architecture.png)`
architecture.png    1×1 PNG (`printf '\x89PNG…'` — write it with node: `Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==","base64")`)
DESIGN.md           "# Design" + "## Design Tokens" + "### Colour Palette" + table `| Token | Light | Dark | Usage |` with 3 rows (`--background` `#f8fafc` `#0f172a` …) + "### Typography" table
story-000-foundation/STORY.md       "# US-000 — Foundation" + "## User Story" + "## Acceptance Criteria" list
story-000-foundation/PLAN.md        REASONS headings `## R — Requirements` … `## S — Safeguards`, `### Operation 1: Greet`, `### Operation 2: Persist`, `## Test Plan` table with `| ID | Type | Op | Scenario | File |` rows T-01..T-03
story-000-foundation/state.json     schema_version 2, phase_local executing, current_operation Op-2, operations Op-1 {title Greet, covers_scenarios ["Greeting a visitor","Greeting by name"], operation_phase green, green_audit {verdict PASS, …}}, Op-2 {title Persist, covers_scenarios ["Remembering a visitor"], operation_phase red, confirm_only false},
                                    test_plan_rows T-01 {type BDD, op Op-1, scenario "Greeting a visitor", written true, passing true}, T-02 {type BDD, op Op-2, scenario "Remembering a visitor", written true, passing false}, T-03 {type manual, op Op-2, scenario "Operator checks the log", written false, passing false},
                                    quality_gates {simplified false, reviewed false, verified false}, decisions [{at, op Op-1, summary "…"}], summary {operations_total 2, operations_green 1, tests_written 3}
story-000-foundation/features/F-001-greeting.feature   `@US-000 @F-001` Feature with description, Background (1 step), Rule "Visitors are greeted" containing Scenario "Greeting a visitor" (Given/When/Then + a data table) and Scenario Outline "Greeting by name" with Examples (2 rows), plus top-level Scenario "Remembering a visitor" and Scenario "Operator checks the log"
story-000-foundation/features/broken.feature           `Feature: Broken\n  Scenario: x\n    Given a table\n      | a | b |\n      | 1 |\n` (inconsistent cell count → parser error at 5:7; note `Examples` after a plain `Scenario` and a bare line after `Feature:` are both valid Gherkin)
story-000-foundation/verification/qa-report.md, green-audit-Op-1.md   short markdown
story-000-foundation/verification/screenshots/home.png                the same 1×1 PNG
story-000-foundation/ui/UI-F-001-home.md                              short markdown
story-000-foundation/mockups/home.html                                `<!doctype html><title>Home mockup</title><h1>Hello</h1>`
story-001-farewell/STORY.md                                           one heading
legacy/SPECS.md                                                       must NOT appear on the site
```

- [ ] **Step 4: Failing tests** — `site/src/lib/specs.test.mjs` (set `process.env.SPECS_DIR` **before** the dynamic import):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
process.env.SPECS_DIR = fileURLToPath(new URL("../../../scripts/fixtures/specs/", import.meta.url));
const s = await import("./specs.mjs");

test("readStories / readBacklog / readAutopilot read the fixture; a missing file yields the fallback, not a throw", () => {
  assert.equal(s.readStories().data.stories.length, 2);
  assert.equal(s.readBacklog().data.items[0].id, "BL-001");
  assert.equal(s.readAutopilot().data.current.op, "Op-2");
  assert.deepEqual(s.readJsonFile(s.SPECS_DIR + "/nope.json", { x: 1 }), { data: { x: 1 }, error: null });
});

test("parseJsonl keeps line numbers and turns a malformed line into an `invalid` entry instead of dropping the file", () => {
  const j = s.readJournal();
  assert.equal(j.length, 9);
  assert.equal(j[0].line, 1);
  assert.equal(j.at(-1).kind, "invalid");
  assert.match(j.at(-1).summary, /line 9/);
  assert.deepEqual(s.parseJsonl("\n\n"), []);
});

test("storyDir finds the directory by number, readState reads it, opProgress orders ops numerically", () => {
  const story = s.readStories().data.stories[0];
  assert.equal(s.storyDir(story), "story-000-foundation");
  assert.equal(s.storyDir({ id: "US-999" }), null);
  const st = s.readState("story-000-foundation").data;
  assert.deepEqual(s.opProgress(st).map((o) => [o.id, o.phase, o.green_audit]), [["Op-1", "green", "PASS"], ["Op-2", "red", null]]);
  assert.deepEqual(s.opProgress(null), []);
});

test("scenarioStatus: rows first (manual > green > red > pending), ops' covers_scenarios as the fallback", () => {
  const st = s.readState("story-000-foundation").data;
  assert.equal(s.scenarioStatus(st, "Greeting a visitor"), "green");
  assert.equal(s.scenarioStatus(st, "Remembering a visitor"), "red");
  assert.equal(s.scenarioStatus(st, "Operator checks the log"), "manual");
  assert.equal(s.scenarioStatus(st, "Greeting by name"), "green"); // no row; Op-1 is green
  assert.equal(s.scenarioStatus(st, "Unknown"), "pending");
});

test("gateVerdicts keeps the last verdict per gate; listFiles returns SPECS_DIR-relative paths, recursively, sorted", () => {
  const g = s.gateVerdicts(s.readJournal(), "US-000");
  assert.equal(g.get("invest").verdict, "PASS");
  assert.deepEqual(s.listFiles("story-000-foundation", [".png", ".html"]),
    ["story-000-foundation/mockups/home.html", "story-000-foundation/verification/screenshots/home.png"]);
  assert.deepEqual(s.listFiles("does-not-exist", [".png"]), []);
});
```

`site/src/lib/gherkin.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
process.env.SPECS_DIR = fileURLToPath(new URL("../../../scripts/fixtures/specs/", import.meta.url));
const g = await import("./gherkin.mjs");

test("parseFeature: tags, background, rule, scenario with data table, outline with examples", () => {
  const f = g.parseFeature(`@US-000 @F-001
Feature: Greeting
  Visitors get a hello.

  Background:
    Given the app is running

  Rule: Visitors are greeted

    @happy-path
    Scenario: Greeting a visitor
      Given a visitor
      When they arrive
      Then they see:
        | text  |
        | Hello |

    Scenario Outline: Greeting by name
      Given a visitor named "<name>"
      Then they see "Hello <name>"
      Examples:
        | name |
        | Ada  |
        | Bob  |
`, "F-001.feature");
  assert.equal(f.error, null);
  assert.deepEqual(f.tags, ["@US-000", "@F-001"]);
  assert.equal(f.description, "Visitors get a hello.");
  assert.equal(f.children[0].kind, "background");
  const rule = f.children[1];
  assert.equal(rule.kind, "rule");
  assert.equal(rule.children[0].kind, "scenario");
  assert.deepEqual(rule.children[0].tags, ["@happy-path"]);
  assert.deepEqual(rule.children[0].steps[2], { keyword: "Then", text: "they see:", table: [["text"], ["Hello"]], docString: null });
  assert.equal(rule.children[1].kind, "outline");
  assert.deepEqual(rule.children[1].examples[0], { name: "", tags: [], header: ["name"], rows: [["Ada"], ["Bob"]] });
});

test("parseFeature: a syntax error is returned, not thrown", () => {
  const f = g.parseFeature("Feature: Broken\n  Scenario: x\n    Given a table\n      | a | b |\n      | 1 |\n", "broken.feature");
  assert.match(f.error, /\(5:7\): inconsistent cell count/);
  assert.equal(f.name, undefined);
});

test("readFeatures reads every .feature under the story's features/ dir, sorted, errors in place", () => {
  const all = g.readFeatures("story-000-foundation");
  assert.deepEqual(all.map((f) => [f.path, f.error === null]), [
    ["story-000-foundation/features/F-001-greeting.feature", true],
    ["story-000-foundation/features/broken.feature", false],
  ]);
  assert.deepEqual(g.readFeatures("story-001-farewell"), []);
});
```

- [ ] **Step 5: Run, expect failure** — `cd plugins/specs-site/skills/specs-site/site && npm test` → `ERR_MODULE_NOT_FOUND` for both modules.

- [ ] **Step 6: Implement `lib/specs.mjs`**

```js
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

// Absolute; specs-site.mjs sets it, tests set it before importing this module.
export const SPECS_DIR = resolve(process.env.SPECS_DIR ?? "specs");

export function readJsonFile(path, fallback = null) {
  if (!existsSync(path)) return { data: fallback, error: null };
  try {
    return { data: JSON.parse(readFileSync(path, "utf8")), error: null };
  } catch (err) {
    return { data: fallback, error: `${relative(SPECS_DIR, path)}: ${err.message}` };
  }
}

export const readStories = () =>
  readJsonFile(join(SPECS_DIR, "stories.json"), { stories: [], project: {}, epics: [], personas: [] });
export const readBacklog = () => readJsonFile(join(SPECS_DIR, "backlog.json"), { next_id: 1, items: [] });
export const readAutopilot = () => readJsonFile(join(SPECS_DIR, "autopilot.json"), null);

export function parseJsonl(text) {
  const entries = [];
  text.split("\n").forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = i + 1;
    try {
      entries.push({ line, ...JSON.parse(raw) });
    } catch (err) {
      entries.push({ line, kind: "invalid", ts: null, summary: `line ${line}: ${err.message}`, raw });
    }
  });
  return entries;
}

export function readJournal() {
  const p = join(SPECS_DIR, "journal.jsonl");
  return existsSync(p) ? parseJsonl(readFileSync(p, "utf8")) : [];
}

export function storyDirs() {
  if (!existsSync(SPECS_DIR)) return [];
  return readdirSync(SPECS_DIR)
    .filter((d) => /^story-\d+-/.test(d) && statSync(join(SPECS_DIR, d)).isDirectory())
    .sort();
}

export function storyDir(story) {
  const num = String(story?.id ?? "").match(/US-(\d+)/)?.[1];
  return num ? (storyDirs().find((d) => d.startsWith(`story-${num}-`)) ?? null) : null;
}

export const readState = (dir) =>
  dir ? readJsonFile(join(SPECS_DIR, dir, "state.json"), null) : { data: null, error: null };

export const PHASES = ["backlog", "scoped", "specced", "planned", "red", "green", "verified"];

const opNum = (id) => parseInt(String(id).replace(/\D/g, ""), 10) || 0;

export function opProgress(state) {
  return Object.entries(state?.operations ?? {})
    .sort(([a], [b]) => opNum(a) - opNum(b))
    .map(([id, op]) => ({
      id,
      title: op.title ?? "",
      phase: op.operation_phase ?? "pending",
      confirm_only: op.confirm_only === true,
      red_audit: op.red_audit?.verdict ?? null,
      green_audit: op.green_audit?.verdict ?? null,
    }));
}

const GREEN = new Set(["green", "refactored"]);
const RED = new Set(["red", "red_a", "red_b"]);

// Test Plan rows carry a `scenario` when /test-setup ≥ 3.x wrote them; older
// state files only have covers_scenarios per Op, so the Op's phase is the fallback.
export function scenarioStatus(state, name) {
  const rows = Object.values(state?.test_plan_rows ?? {}).filter((r) => r.scenario === name);
  if (rows.length) {
    if (rows.some((r) => r.type === "manual")) return "manual";
    if (rows.every((r) => r.passing)) return "green";
    return rows.some((r) => r.written) ? "red" : "pending";
  }
  const op = Object.values(state?.operations ?? {}).find((o) => (o.covers_scenarios ?? []).includes(name));
  if (!op) return "pending";
  if (GREEN.has(op.operation_phase)) return "green";
  if (RED.has(op.operation_phase)) return "red";
  return "pending";
}

export function gateVerdicts(journal, storyId) {
  const m = new Map();
  for (const e of journal) {
    if (e.kind === "gate" && e.story === storyId && e.gate)
      m.set(e.gate, { verdict: e.verdict ?? "?", ts: e.ts, report: e.report ?? null, op: e.op ?? null });
  }
  return m;
}

export function listFiles(dirRel, exts) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (exts.includes(extname(name))) out.push(relative(SPECS_DIR, p));
    }
  };
  const root = join(SPECS_DIR, dirRel);
  if (existsSync(root)) walk(root);
  return out.sort();
}
```

- [ ] **Step 7: Implement `lib/gherkin.mjs`**

```js
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import { SPECS_DIR } from "./specs.mjs";

export function parseFeature(source, path = "") {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  let doc;
  try {
    doc = parser.parse(source);
  } catch (err) {
    return { path, error: String(err.message ?? err) };
  }
  const f = doc.feature;
  if (!f) return { path, error: "empty feature file" };
  return {
    path,
    error: null,
    name: f.name,
    keyword: f.keyword,
    tags: f.tags.map((t) => t.name),
    description: f.description.trim(),
    children: f.children.map(child),
  };
}

function child(c) {
  if (c.background) return { kind: "background", ...scenario(c.background) };
  if (c.rule)
    return {
      kind: "rule",
      name: c.rule.name,
      tags: c.rule.tags.map((t) => t.name),
      description: c.rule.description.trim(),
      children: c.rule.children.map(child),
    };
  return { kind: c.scenario.examples?.length ? "outline" : "scenario", ...scenario(c.scenario) };
}

function scenario(s) {
  return {
    name: s.name,
    keyword: s.keyword,
    tags: (s.tags ?? []).map((t) => t.name),
    description: (s.description ?? "").trim(),
    steps: s.steps.map((st) => ({
      keyword: st.keyword.trim(),
      text: st.text,
      table: st.dataTable ? cells(st.dataTable.rows) : null,
      docString: st.docString?.content ?? null,
    })),
    examples: (s.examples ?? []).map((e) => ({
      name: e.name,
      tags: e.tags.map((t) => t.name),
      header: e.tableHeader ? e.tableHeader.cells.map((c) => c.value) : [],
      rows: cells(e.tableBody),
    })),
  };
}

const cells = (rows) => rows.map((r) => r.cells.map((c) => c.value));

export function readFeatures(dirRel) {
  const dir = join(SPECS_DIR, dirRel, "features");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".feature"))
    .sort()
    .map((f) => parseFeature(readFileSync(join(dir, f), "utf8"), relative(SPECS_DIR, join(dir, f))));
}
```

- [ ] **Step 8: Run** — `npm test` in the site dir. Expected: 8 tests pass. If the broken-feature error message does not contain `(4:3)`, print `f.error` and adjust the assertion to the parser's actual `(line:col)`.

- [ ] **Step 9: Validate + commit**

```bash
bash scripts/validate.sh
git add plugins/specs-site .claude-plugin/marketplace.json
git commit -m "feat(specs-site): plugin scaffold, fixture specs/, tracker readers and Gherkin parser with node --test"
```

---

### Task 5: Astro skeleton + `specs-site.mjs` CLI + build smoke

**Files:**
- Create: `site/astro.config.mjs`, `site/tsconfig.json`, `site/src/content.config.ts`, `site/src/styles/global.css`, `site/src/layouts/Base.astro`, `site/src/pages/index.astro` (placeholder, replaced in Task 6)
- Create: `plugins/specs-site/skills/specs-site/scripts/specs-site.mjs`, `scripts/specs-site.test.mjs`

**Interfaces:**
- Produces: CLI `node specs-site.mjs dev|build [--specs DIR] [--host [ADDR]] [--port N] [--out DIR]`; exported `parseArgs(argv) → {cmd, specs, host, port, out}` (absolute `specs`/`out`; `out` defaults to `<specs>/.site`; bare `--host` means `0.0.0.0`), `ensureDeps(siteDir) → boolean` (ran `npm ci`), `astroArgs(opts) → string[]`, `main(argv) → exit code`. Env for Astro: `SPECS_DIR=<abs>`.
- Produces: `docs` content collection, entry ids = SPECS_DIR-relative path without `.md` (`PROJECT`, `story-000-foundation/PLAN`, …); `Base.astro` props `{title: string}` with a nav to `/`, `/architecture`, `/design`, `/journal`, `/backlog`; CSS classes `.chip`, `.chip-<status>` (`pending red green manual verified backlog scoped specced planned ok warn fail info`), `.prose`, `.table-wrap`, `.grid`, `.card`, `.bar`, `.bar > i`.

- [ ] **Step 1: Config files**

`site/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  server: { host: "127.0.0.1", port: 4321 },
  devToolbar: { enabled: false },
});
```

`site/tsconfig.json`: `{ "extends": "astro/tsconfigs/base", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"] }`.

`site/src/content.config.ts`:

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { SPECS_DIR } from "./lib/specs.mjs";

// Every markdown document the site renders. Trackers (json/jsonl) are read
// per request in src/lib/specs.mjs; only markdown needs Astro's pipeline.
const docs = defineCollection({
  loader: glob({
    pattern: ["*.md", "story-*/*.md", "story-*/ui/*.md", "story-*/verification/*.md", "!legacy/**", "!.site/**"],
    base: SPECS_DIR,
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
});

export const collections = { docs };
```

- [ ] **Step 2: `global.css`** — light-dark tokens and the shared classes (this is the whole stylesheet; later tasks only add page markup):

```css
:root { color-scheme: light dark;
  --bg: light-dark(#f8fafc, #0f172a); --surface: light-dark(#fff, #1e293b); --text: light-dark(#0f172a, #f1f5f9);
  --muted: light-dark(#475569, #94a3b8); --border: light-dark(#e2e8f0, #334155); --primary: light-dark(#0f766e, #14b8a6);
  --green: light-dark(#15803d, #4ade80); --red: light-dark(#b91c1c, #f87171); --amber: light-dark(#b45309, #fbbf24); --blue: light-dark(#1d4ed8, #60a5fa);
  font: 15px/1.5 system-ui, sans-serif; }
body { margin: 0; background: var(--bg); color: var(--text); }
a { color: var(--primary); }
header.top { display: flex; gap: 1.5rem; align-items: baseline; padding: .75rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; }
header.top nav a { margin-right: 1rem; text-decoration: none; }
main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
h1, h2, h3 { line-height: 1.25; } h1 { font-size: 1.6rem; } h2 { font-size: 1.25rem; margin-top: 2rem; }
code, pre { font-family: ui-monospace, monospace; font-size: .9em; } pre { overflow-x: auto; padding: .75rem; background: var(--surface); border: 1px solid var(--border); }
.muted { color: var(--muted); } .small { font-size: .85rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
.chip { display: inline-block; padding: 0 .5em; border-radius: 999px; font-size: .8rem; border: 1px solid var(--border); background: var(--surface); white-space: nowrap; }
.chip-green, .chip-verified, .chip-ok, .chip-PASS { border-color: var(--green); color: var(--green); }
.chip-red, .chip-fail, .chip-FAIL, .chip-error { border-color: var(--red); color: var(--red); }
.chip-manual, .chip-warn, .chip-warning, .chip-PASS_WITH_WARNINGS, .chip-planned, .chip-specced { border-color: var(--amber); color: var(--amber); }
.chip-info, .chip-scoped, .chip-blue { border-color: var(--blue); color: var(--blue); }
.chip-pending, .chip-backlog { color: var(--muted); }
.bar { display: flex; gap: 2px; height: 10px; } .bar > i { flex: 1; background: var(--border); border-radius: 2px; }
.bar > i.green, .bar > i.refactored { background: var(--green); } .bar > i.red, .bar > i.red_a, .bar > i.red_b { background: var(--red); } .bar > i.blocked { background: var(--amber); }
.table-wrap { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: .92rem; }
th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
thead th { position: sticky; top: 0; background: var(--surface); }
.prose table { display: block; overflow-x: auto; } .prose img { max-width: 100%; } .prose h2 { border-bottom: 1px solid var(--border); }
.tabs { display: flex; flex-wrap: wrap; gap: .25rem 1rem; border-bottom: 1px solid var(--border); margin: 1rem 0; } .tabs a { text-decoration: none; padding: .25rem 0; }
.feature { border-left: 3px solid var(--border); padding-left: 1rem; margin: 1rem 0; } .scenario { margin: .75rem 0; padding: .5rem .75rem; border-radius: 4px; background: var(--surface); border: 1px solid var(--border); }
.scenario.green { border-color: var(--green); } .scenario.red { border-color: var(--red); } .scenario.manual { border-color: var(--amber); }
.step .kw { color: var(--primary); font-weight: 600; } .tags { color: var(--blue); font-size: .8rem; }
.error { color: var(--red); border: 1px solid var(--red); padding: .5rem .75rem; border-radius: 4px; }
.swatch { display: inline-block; width: 1.4em; height: 1.4em; border: 1px solid var(--border); vertical-align: middle; border-radius: 3px; }
.filters { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1rem 0; } .filters label { font-size: .85rem; } .filters select, .filters input { margin-left: .25rem; }
tr[hidden] { display: none; }
iframe.mockup { width: 100%; height: 480px; border: 1px solid var(--border); background: #fff; }
```

- [ ] **Step 3: `layouts/Base.astro`**

```astro
---
import "../styles/global.css";
import { readStories } from "../lib/specs.mjs";
interface Props { title: string; }
const { title } = Astro.props;
const project = readStories().data.project ?? {};
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · {project.name ?? "specs"}</title>
  </head>
  <body>
    <header class="top">
      <strong><a href="/">{project.name ?? "specs"}</a></strong>
      <nav>
        <a href="/">Dashboard</a><a href="/architecture">Architecture</a><a href="/design">Design</a><a href="/journal">Journal</a><a href="/backlog">Backlog</a>
      </nav>
    </header>
    <main><slot /></main>
  </body>
</html>
```

- [ ] **Step 4: Placeholder `pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
import { readStories } from "../lib/specs.mjs";
const { data } = readStories();
---
<Base title="Dashboard"><h1>{data.project.name}</h1><p class="muted">{data.stories.length} stories</p></Base>
```

- [ ] **Step 5: Failing CLI test** — `scripts/specs-site.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { astroArgs, parseArgs } from "./specs-site.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const FIXTURE = join(HERE, "fixtures", "specs");
export const CLI = join(HERE, "specs-site.mjs");

test("parseArgs: defaults, bare --host, --out default, unknown flag", () => {
  const o = parseArgs(["dev", "--specs", "x/specs"]);
  assert.equal(o.specs, resolve("x/specs"));
  assert.deepEqual([o.host, o.port, o.out], ["127.0.0.1", "4321", resolve("x/specs/.site")]);
  assert.equal(parseArgs(["dev", "--host"]).host, "0.0.0.0");
  assert.equal(parseArgs(["dev", "--host", "10.0.0.5", "--port", "5000"]).port, "5000");
  assert.deepEqual(astroArgs(parseArgs(["build", "--specs", "s", "--out", "/tmp/o"])), ["build", "--outDir", "/tmp/o"]);
  assert.throws(() => parseArgs(["serve"]), /usage/);
  assert.throws(() => parseArgs(["dev", "--nope"]), /unknown argument --nope/);
});

test("build against the fixture emits a static site", () => {
  const out = mkdtempSync(join(tmpdir(), "specs-site-"));
  execFileSync(process.execPath, [CLI, "build", "--specs", FIXTURE, "--out", out], { stdio: "pipe" });
  assert.ok(existsSync(join(out, "index.html")));
  assert.match(readFileSync(join(out, "index.html"), "utf8"), /Mini Project/);
});
```

- [ ] **Step 6: Implement `scripts/specs-site.mjs`**

```js
#!/usr/bin/env node
// specs-site dev|build --specs DIR — runs the bundled Astro site against a project's specs/.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");
const USAGE = "usage: specs-site dev|build [--specs DIR] [--host [ADDR]] [--port N] [--out DIR]";

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!["dev", "build"].includes(cmd)) throw new Error(USAGE);
  const o = { cmd, specs: "specs", host: "127.0.0.1", port: "4321", out: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--specs") o.specs = next();
    else if (a === "--port") o.port = next();
    else if (a === "--out") o.out = next();
    else if (a === "--host") o.host = rest[i + 1] && !rest[i + 1].startsWith("--") ? next() : "0.0.0.0";
    else throw new Error(`unknown argument ${a}\n${USAGE}`);
  }
  o.specs = resolve(o.specs);
  o.out = resolve(o.out ?? join(o.specs, ".site"));
  return o;
}

export function astroArgs(o) {
  return o.cmd === "dev" ? ["dev", "--host", o.host, "--port", o.port] : ["build", "--outDir", o.out];
}

// First run installs the site's deps from the committed lockfile.
export function ensureDeps(site = SITE) {
  if (existsSync(join(site, "node_modules", "astro", "astro.js"))) return false;
  const r = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: site, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`npm ci failed in ${site}`);
  return true;
}

export function main(argv) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  if (!existsSync(join(o.specs, "stories.json"))) {
    console.error(`no stories.json under ${o.specs} — pass --specs /path/to/project/specs`);
    return 1;
  }
  ensureDeps();
  if (o.cmd === "dev") console.error(`specs-site: ${o.specs} → http://${o.host}:${o.port}/`);
  const r = spawnSync(process.execPath, [join(SITE, "node_modules", "astro", "astro.js"), ...astroArgs(o)], {
    cwd: SITE,
    stdio: "inherit",
    env: { ...process.env, SPECS_DIR: o.specs },
  });
  return r.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 7: Run** — `node --test plugins/specs-site/skills/specs-site/scripts/` (from the repo root). Expected: 2 pass; the build test takes ~10–20 s. If Astro rejects the absolute `base`, switch to `base: pathToFileURL(SPECS_DIR + "/")` in `content.config.ts` (import `pathToFileURL` from `node:url`) — the loader accepts a `URL`.

- [ ] **Step 8: Commit**

```bash
git add plugins/specs-site
git commit -m "feat(specs-site): Astro 7 skeleton (docs collection over SPECS_DIR, base layout, css) and the dev/build CLI with a build smoke"
```

---

### Task 6: Dashboard `/` and story page `/stories/US-NNN`; live reload on `specs/**`

**Files:**
- Modify: `site/astro.config.mjs` (watch integration), `site/src/pages/index.astro` (replace the placeholder)
- Create: `site/src/components/{Chip,Markdown,Scenario,Feature}.astro`, `site/src/pages/stories/[id].astro`
- Modify: `scripts/specs-site.test.mjs` (route assertions on the built fixture)

**Interfaces:**
- Consumes: everything `lib/specs.mjs` and `lib/gherkin.mjs` export (Task 4), `Base.astro` (Task 5), the `docs` collection (Task 5).
- Produces: `Chip` props `{value, kind?}` → `<span class="chip chip-<kind|value>">`; `Markdown` props `{id, missing?}` renders the `docs` entry with that id or a muted "missing" line; `Feature` props `{feature, state}`; `Scenario` props `{s, status}`. Story-page section anchors `#story #features #plan #state #verification #ui #backlog` (linked from the Dashboard, Journal and Backlog pages).

- [ ] **Step 1: Watch `SPECS_DIR` in dev** — `astro.config.mjs` becomes:

```js
import { defineConfig } from "astro/config";
import { resolve } from "node:path";

const SPECS_DIR = resolve(process.env.SPECS_DIR ?? "specs");

// The trackers live outside the project root, so Vite does not watch them.
// Adding the directory makes Astro drop its route cache and the browser
// reload on every change under specs/** — the "live Op workflow" view.
const watchSpecs = {
  name: "watch-specs",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.watcher.add(SPECS_DIR);
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(SPECS_DIR)) server.hot.send({ type: "full-reload" });
      });
    },
  },
};

export default defineConfig({
  output: "static",
  server: { host: "127.0.0.1", port: 4321 },
  devToolbar: { enabled: false },
  integrations: [watchSpecs],
});
```

- [ ] **Step 2: Components**

`Chip.astro`:

```astro
---
interface Props { value: string | number | null | undefined; kind?: string }
const { value, kind } = Astro.props;
const cls = String(kind ?? value ?? "pending").replace(/[^A-Za-z0-9_-]/g, "_");
---
{value != null && <span class={`chip chip-${cls}`}>{value}</span>}
```

`Markdown.astro`:

```astro
---
import { getEntry, render } from "astro:content";
interface Props { id: string; missing?: string }
const { id, missing = `No ${id}.md` } = Astro.props;
const entry = await getEntry("docs", id);
const Content = entry ? (await render(entry)).Content : null;
---
{Content ? <div class="prose"><Content /></div> : <p class="muted">{missing}</p>}
```

`Scenario.astro`:

```astro
---
interface Props { s: any; status: string }
const { s, status } = Astro.props;
const isBg = s.kind === "background";
---
<article class={`scenario ${isBg ? "" : status}`} data-scenario={s.name}>
  <div>
    {s.tags.length > 0 && <span class="tags">{s.tags.join(" ")} </span>}
    <strong>{s.keyword}:</strong> {s.name} {!isBg && <span class={`chip chip-${status}`}>{status}</span>}
  </div>
  {s.description && <p class="muted small">{s.description}</p>}
  {s.steps.map((st) => (
    <div class="step">
      <span class="kw">{st.keyword}</span> {st.text}
      {st.table && <table class="small"><tbody>{st.table.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody></table>}
      {st.docString != null && <pre>{st.docString}</pre>}
    </div>
  ))}
  {s.examples.map((e) => (
    <div class="small">
      <em>Examples{e.name ? `: ${e.name}` : ""}</em>
      <table><thead><tr>{e.header.map((h) => <th>{h}</th>)}</tr></thead><tbody>{e.rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody></table>
    </div>
  ))}
</article>
```

`Feature.astro`:

```astro
---
import Scenario from "./Scenario.astro";
import { scenarioStatus } from "../lib/specs.mjs";
interface Props { feature: any; state: any }
const { feature, state } = Astro.props;
const status = (c) => (c.kind === "background" ? "pending" : scenarioStatus(state, c.name));
---
<section class="feature">
  {feature.error ? (
    <div class="error"><strong>{feature.path}</strong> — parse error: {feature.error}</div>
  ) : (
    <>
      <p class="tags">{feature.tags.join(" ")} <span class="muted">{feature.path}</span></p>
      <h3>{feature.keyword}: {feature.name}</h3>
      {feature.description && <pre class="muted">{feature.description}</pre>}
      {feature.children.map((c) =>
        c.kind === "rule" ? (
          <div class="feature">
            <h4>Rule: {c.name}</h4>
            {c.description && <p class="muted small">{c.description}</p>}
            {c.children.map((s) => <Scenario s={s} status={status(s)} />)}
          </div>
        ) : (
          <Scenario s={c} status={status(c)} />
        ),
      )}
    </>
  )}
</section>
```

- [ ] **Step 3: Dashboard `pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
import Chip from "../components/Chip.astro";
import { PHASES, gateVerdicts, opProgress, readAutopilot, readBacklog, readJournal, readState, readStories, storyDir } from "../lib/specs.mjs";

const stories = readStories();
const backlog = readBacklog();
const ap = readAutopilot();
const journal = readJournal();
const errors = [stories.error, backlog.error, ap.error].filter(Boolean);

const cards = stories.data.stories.map((s) => {
  const st = readState(storyDir(s));
  return { s, ops: opProgress(st.data), gates: [...gateVerdicts(journal, s.id)], stateError: st.error };
});
const byPhase = Object.fromEntries(PHASES.map((p) => [p, cards.filter((c) => c.s.phase === p)]));
const unknownPhase = cards.filter((c) => !PHASES.includes(c.s.phase));
const open = backlog.data.items.filter((i) => i.status === "open" || i.status === "in-progress");
const bySeverity = ["error", "warning", "info"].map((sev) => [sev, open.filter((i) => i.severity === sev).length]);
const lastVerified = stories.data.stories
  .filter((s) => s.phase === "verified")
  .sort((a, b) => String(a.verification?.verified_at ?? "").localeCompare(String(b.verification?.verified_at ?? "")))
  .at(-1);
const recent = journal.slice(-20).reverse();
const run = ap.data;
const cur = run?.active ? run.current : null;
---
<Base title="Dashboard">
  <h1>{stories.data.project?.name ?? "specs"} <span class="muted small">{stories.data.project?.description}</span></h1>
  {errors.map((e) => <p class="error">{e}</p>)}

  <section class="grid">
    <div class="card">
      <h2 style="margin-top:0">Now running</h2>
      {run?.active ? (
        <p>
          <Chip value="active" kind="green" /> <code>{run.run_id}</code><br />
          {cur ? (
            <>
              <a href={`/stories/${cur.story}`}>{cur.story}</a> · <strong>{cur.stage}</strong>{cur.op ? ` ${cur.op}` : ""} · attempt {cur.attempt}
              <span class="muted small"> since {cur.started_at}</span>
            </>
          ) : (
            <span class="muted">between stages</span>
          )}
          <br /><span class="small muted">target {run.target} · until {run.until} · {run.stop_policy}</span>
        </p>
      ) : (
        <p class="muted">No active run{run?.stop_reason ? ` — last run ${run.run_id} ended: ${run.stop_reason}` : ""}.</p>
      )}
    </div>
    <div class="card">
      <h2 style="margin-top:0">Open backlog</h2>
      <p>{bySeverity.map(([sev, n]) => <><Chip value={`${n} ${sev}`} kind={sev} /> </>)}</p>
      <a href="/backlog">All items →</a>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Last verified</h2>
      {lastVerified ? (
        <p><a href={`/stories/${lastVerified.id}`}>{lastVerified.id} — {lastVerified.title}</a><br /><span class="muted small">{lastVerified.verification?.verified_at}</span></p>
      ) : (
        <p class="muted">none yet</p>
      )}
    </div>
  </section>

  <h2>Stories by phase</h2>
  <div class="table-wrap">
    <table>
      <thead><tr>{PHASES.map((p) => <th>{p} <span class="muted">{byPhase[p].length}</span></th>)}</tr></thead>
      <tbody>
        <tr>
          {PHASES.map((p) => (
            <td>
              {byPhase[p].map(({ s, ops, gates, stateError }) => (
                <div class="card" style="margin-bottom:.5rem">
                  <a href={`/stories/${s.id}`}><strong>{s.id}</strong></a> <Chip value={s.rigor} kind="info" /><br />{s.title}
                  {ops.length > 0 && <div class="bar" title={ops.map((o) => `${o.id} ${o.phase}`).join(", ")}>{ops.map((o) => <i class={o.phase} />)}</div>}
                  <div>{gates.map(([g, v]) => <Chip value={`${g} ${v.verdict}`} kind={v.verdict} />)}</div>
                  {stateError && <p class="error small">{stateError}</p>}
                </div>
              ))}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
  {unknownPhase.length > 0 && <p class="error">Unknown phase: {unknownPhase.map((c) => `${c.s.id}=${c.s.phase}`).join(", ")}</p>}

  <h2>Last 20 journal events <a class="small" href="/journal">all →</a></h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>ts</th><th>story</th><th>op</th><th>stage</th><th>kind</th><th>summary</th></tr></thead>
      <tbody>
        {recent.map((e) => (
          <tr>
            <td class="small">{e.ts}</td>
            <td>{e.story && <a href={`/stories/${e.story}`}>{e.story}</a>}</td>
            <td>{e.op}</td><td>{e.stage}</td>
            <td><Chip value={e.kind} kind={e.kind === "invalid" ? "fail" : (e.verdict ?? "pending")} /></td>
            <td>{e.summary}{e.backlog_id && <> <a href={`/backlog/${e.backlog_id}`}>{e.backlog_id}</a></>}{e.sha && <> <code>{e.sha}</code></>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Base>
```

- [ ] **Step 4: Story page `pages/stories/[id].astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Chip from "../../components/Chip.astro";
import Markdown from "../../components/Markdown.astro";
import Feature from "../../components/Feature.astro";
import { gateVerdicts, listFiles, opProgress, readBacklog, readJournal, readState, readStories, storyDir } from "../../lib/specs.mjs";
import { readFeatures } from "../../lib/gherkin.mjs";

export function getStaticPaths() {
  return readStories().data.stories.map((s) => ({ params: { id: s.id } }));
}

const { id } = Astro.params;
const story = readStories().data.stories.find((s) => s.id === id);
if (!story) return new Response(`unknown story ${id}`, { status: 404 });
const dir = storyDir(story);
const state = readState(dir);
const ops = opProgress(state.data);
const features = dir ? readFeatures(dir) : [];
const journal = readJournal().filter((e) => e.story === id);
const gates = [...gateVerdicts(journal, id)];
const items = readBacklog().data.items.filter((i) => i.source?.story === id);
const docIds = dir ? (await getCollection("docs", (d) => d.id.startsWith(`${dir}/`))).map((d) => d.id).sort() : [];
const verificationDocs = docIds.filter((d) => d.startsWith(`${dir}/verification/`));
const uiDocs = docIds.filter((d) => d.startsWith(`${dir}/ui/`));
const mockups = dir ? listFiles(`${dir}/mockups`, [".html"]) : [];
const screenshots = dir ? listFiles(`${dir}/verification`, [".png", ".jpg", ".jpeg", ".gif", ".webp"]) : [];
const rows = Object.entries(state.data?.test_plan_rows ?? {});
const tabs = ["story", "features", "plan", "state", "verification", "ui", "backlog"];
---
<Base title={`${story.id} ${story.title}`}>
  <h1>{story.id} — {story.title} <Chip value={story.phase} /> <Chip value={story.rigor} kind="info" /></h1>
  <p class="muted">As a {story.as_a}, I want {story.i_want}, so that {story.so_that}.{story.depends_on_story_ids?.length > 0 && <> Depends on {story.depends_on_story_ids.map((d) => <><a href={`/stories/${d}`}>{d}</a> </>)}</>}</p>
  {!dir && <p class="error">No specs/story-{story.id.slice(3)}-* directory yet.</p>}
  {state.error && <p class="error">{state.error}</p>}
  <nav class="tabs">{tabs.map((t) => <a href={`#${t}`}>{t}</a>)}</nav>

  <section id="story"><h2>Story</h2>{dir ? <Markdown id={`${dir}/STORY`} /> : <p class="muted">not specced</p>}
    {story.acceptance_criteria?.length > 0 && <><h3>Acceptance criteria (stories.json)</h3><ol>{story.acceptance_criteria.map((a) => <li>{a}</li>)}</ol></>}
  </section>

  <section id="features"><h2>Features</h2>
    {features.length === 0 && <p class="muted">no .feature files</p>}
    {features.map((f) => <Feature feature={f} state={state.data} />)}
  </section>

  <section id="plan"><h2>Plan</h2>{dir ? <Markdown id={`${dir}/PLAN`} missing="not planned" /> : <p class="muted">not planned</p>}</section>

  <section id="state"><h2>State</h2>
    {ops.length === 0 ? <p class="muted">no state.json yet</p> : (
      <div class="table-wrap"><table>
        <thead><tr><th>Op</th><th>Title</th><th>Phase</th><th>RED audit</th><th>GREEN audit</th></tr></thead>
        <tbody>{ops.map((o) => <tr><td>{o.id}</td><td>{o.title}{o.confirm_only && <> <Chip value="confirm-only" kind="info" /></>}</td><td><Chip value={o.phase} /></td><td><Chip value={o.red_audit} /></td><td><Chip value={o.green_audit} /></td></tr>)}</tbody>
      </table></div>
    )}
    <h3>Gates</h3>
    <p>{gates.length === 0 ? <span class="muted">none journaled</span> : gates.map(([g, v]) => <><Chip value={`${g}${v.op ? ` ${v.op}` : ""} ${v.verdict}`} kind={v.verdict} /> </>)}</p>
    {state.data?.quality_gates && <p class="small muted">quality_gates: {JSON.stringify(state.data.quality_gates)}</p>}
    {rows.length > 0 && <><h3>Test Plan rows</h3><div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Type</th><th>Op</th><th>Scenario</th><th>File</th><th>Written</th><th>Passing</th></tr></thead>
      <tbody>{rows.map(([rid, r]) => <tr><td>{rid}</td><td>{r.type}</td><td>{r.op}</td><td>{r.scenario}</td><td><code>{r.file}</code></td><td>{String(r.written)}</td><td><Chip value={String(r.passing)} kind={r.passing ? "green" : r.type === "manual" ? "manual" : "red"} /></td></tr>)}</tbody>
    </table></div></>}
    {state.data?.decisions?.length > 0 && <><h3>Decisions</h3><ul>{state.data.decisions.map((d) => <li><span class="muted small">{d.at} {d.op}</span> {d.summary}</li>)}</ul></>}
    {state.data?.errors?.length > 0 && <><h3>Errors</h3><ul>{state.data.errors.map((e) => <li class="error">{e.operation}: {e.message} <span class="small">{e.details}</span></li>)}</ul></>}
    <h3>Journal ({journal.length}) <a class="small" href={`/journal#${id}`}>filter →</a></h3>
    <div class="table-wrap"><table><tbody>{journal.slice(-30).reverse().map((e) => <tr><td class="small">{e.ts}</td><td>{e.op}</td><td>{e.stage}</td><td><Chip value={e.kind} kind={e.verdict ?? "pending"} /></td><td>{e.summary}</td></tr>)}</tbody></table></div>
  </section>

  <section id="verification"><h2>Verification</h2>
    {verificationDocs.length === 0 && screenshots.length === 0 && <p class="muted">no reports yet</p>}
    {verificationDocs.map((d) => <details open><summary><code>{d.slice(dir.length + 1)}.md</code></summary><Markdown id={d} /></details>)}
    {screenshots.length > 0 && <><h3>Screenshots</h3><div class="grid">{screenshots.map((p) => <figure class="card"><a href={`/assets/${p}`}><img src={`/assets/${p}`} alt={p} loading="lazy" /></a><figcaption class="small muted">{p.split("/").at(-1)}</figcaption></figure>)}</div></>}
  </section>

  <section id="ui"><h2>UI specs &amp; mockups</h2>
    {uiDocs.length === 0 && mockups.length === 0 && <p class="muted">none</p>}
    {uiDocs.map((d) => <details open><summary><code>{d.slice(dir.length + 1)}.md</code></summary><Markdown id={d} /></details>)}
    {mockups.map((m) => <figure><figcaption class="small muted">{m.split("/").at(-1)} · <a href={`/assets/${m}`}>open</a></figcaption><iframe class="mockup" src={`/assets/${m}`} title={m} loading="lazy"></iframe></figure>)}
  </section>

  <section id="backlog"><h2>Backlog ({items.length})</h2>
    {items.length === 0 ? <p class="muted">no items sourced from this story</p> : (
      <div class="table-wrap"><table>
        <thead><tr><th>Id</th><th>Status</th><th>Severity</th><th>Kind</th><th>Op</th><th>Title</th></tr></thead>
        <tbody>{items.map((i) => <tr><td><a href={`/backlog/${i.id}`}>{i.id}</a></td><td><Chip value={i.status} kind={i.status === "done" ? "green" : i.status === "wontfix" ? "pending" : "warn"} /></td><td><Chip value={i.severity} /></td><td>{i.kind}</td><td>{i.source?.op}</td><td>{i.title}</td></tr>)}</tbody>
      </table></div>
    )}
  </section>
</Base>
```

- [ ] **Step 5: Route assertions** — replace the build test in `scripts/specs-site.test.mjs` with one that builds once and checks the story page (the Task 7 pages are appended to the same test later):

```js
import { readdirSync } from "node:fs";
const html = (out, p) => readFileSync(join(out, p, "index.html"), "utf8");

test("build against the fixture emits the dashboard and the story page", () => {
  const out = mkdtempSync(join(tmpdir(), "specs-site-"));
  execFileSync(process.execPath, [CLI, "build", "--specs", FIXTURE, "--out", out], { stdio: "pipe" });
  const index = html(out, ".");
  assert.match(index, /Mini Project/);
  assert.match(index, /Now running[\s\S]*spec-implementation<\/strong> Op-2/);
  assert.match(index, /1 warning/);
  assert.match(index, /chip chip-PASS">invest PASS/);
  const story = html(out, "stories/US-000");
  assert.match(story, /class="scenario green"[^>]*data-scenario="Greeting a visitor"/);
  assert.match(story, /class="scenario red"[^>]*data-scenario="Remembering a visitor"/);
  assert.match(story, /class="scenario manual"/);
  assert.match(story, /broken\.feature<\/strong> — parse error/);
  assert.match(story, /Rule: Visitors are greeted/);
  assert.match(story, /<th>name<\/th>[\s\S]*<td>Ada<\/td>/);
  assert.match(story, /Operation 1: Greet/); // PLAN.md rendered
  assert.match(story, /confirm-only|Op-2<\/td>/);
  assert.match(story, /assets\/story-000-foundation\/mockups\/home\.html/);
  assert.doesNotMatch(story, /LEGACY MARKER/);
  assert.ok(existsSync(join(out, "stories", "US-001", "index.html")));
});
```

- [ ] **Step 6: Run** — `node --test plugins/specs-site/skills/specs-site/scripts/`. Expected: 2 pass. Debug a failing regex by dumping the page: `node -e 'console.log(require("fs").readFileSync(process.argv[1],"utf8"))' <out>/stories/US-000/index.html | grep -n scenario`.

- [ ] **Step 7: Commit**

```bash
git add plugins/specs-site
git commit -m "feat(specs-site): dashboard (kanban, now-running, backlog counts, journal tail) and per-story page (story, features with scenario status, plan, state, verification, ui, backlog); live reload on specs/**"
```

---

### Task 7: `/architecture`, `/design`, `/journal`, `/backlog`, `/backlog/BL-NNN`, `/assets/*`; dev-freshness smoke; CI; SKILL.md + plugin README

**Files:**
- Modify: `site/src/lib/specs.mjs` (+ `designTokens`, `excerpt`; `listFiles` skips dot-dirs), `site/src/lib/specs.test.mjs`
- Create: `site/src/components/Filters.astro`, `site/src/pages/{architecture,design,journal,backlog}.astro`, `site/src/pages/backlog/[id].astro`, `site/src/pages/assets/[...path].ts`
- Modify: `scripts/specs-site.test.mjs` (route assertions + dev freshness), `.github/workflows/ci.yml`
- Modify: `plugins/specs-site/skills/specs-site/SKILL.md`, `plugins/specs-site/README.md`

**Interfaces:**
- Produces: `designTokens(markdown) → [{token, light, dark, usage}]` (every table row whose first cell is a `--token` and next two cells are hex colours); `excerpt(text, needle, radius=6) → string|null` (the ±radius lines around the first line containing `needle`); `Filters` props `{fields: {name, label, values: string[]}[], target: string}` — renders one `<select>` per field and hides `tr` rows of `#<target>` whose `data-<name>` differs from a chosen value (`data-*` attributes are set by the page).

- [ ] **Step 1: Failing unit tests** — append to `specs.test.mjs`:

```js
test("designTokens reads --token | light | dark rows out of DESIGN.md tables", () => {
  const md = readFileSync(join(s.SPECS_DIR, "DESIGN.md"), "utf8");
  const t = s.designTokens(md);
  assert.equal(t.length, 3);
  assert.deepEqual(t[0], { token: "--background", light: "#f8fafc", dark: "#0f172a", usage: "Page ground" });
  assert.deepEqual(s.designTokens("| Role | Font |\n|---|---|\n| Body | Inter |"), []);
});

test("excerpt returns the lines around the first hit, or null", () => {
  const text = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
  assert.equal(s.excerpt(text, "line 10", 2), "line 8\nline 9\nline 10\nline 11\nline 12");
  assert.equal(s.excerpt(text, "nope"), null);
});

test("listFiles skips dot-directories (a previous build under specs/.site is not an asset)", () => {
  assert.ok(s.listFiles(".", [".html"]).every((p) => !p.startsWith(".")));
});
```

(add `import { readFileSync } from "node:fs"; import { join } from "node:path";` at the top of the test file.)

- [ ] **Step 2: Implement in `specs.mjs`** — in `listFiles`'s walk, `if (name.startsWith(".")) continue;` before the `statSync`; append:

```js
const HEX = /^#[0-9a-fA-F]{3,8}$/;

// `| --token | #light | #dark | usage |` rows anywhere in DESIGN.md.
export function designTokens(markdown) {
  const out = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ""));
    if (cells.length >= 3 && cells[0].startsWith("--") && HEX.test(cells[1]) && HEX.test(cells[2]))
      out.push({ token: cells[0], light: cells[1], dark: cells[2], usage: cells.at(-1) ?? "" });
  }
  return out;
}

export function excerpt(text, needle, radius = 6) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  return i === -1 ? null : lines.slice(Math.max(0, i - radius), i + radius + 1).join("\n");
}
```

Run `npm test` in the site dir: 11 pass.

- [ ] **Step 3: `Filters.astro`**

```astro
---
interface Props { fields: { name: string; label: string; values: string[] }[]; target: string }
const { fields, target } = Astro.props;
---
<form class="filters" data-filters={target}>
  {fields.map((f) => (
    <label>{f.label}
      <select name={f.name}><option value="">all</option>{f.values.map((v) => <option value={v}>{v}</option>)}</select>
    </label>
  ))}
  <label>contains <input type="search" name="q" placeholder="text" /></label>
  <span class="muted small" data-count></span>
</form>
<script>
  for (const form of document.querySelectorAll<HTMLFormElement>("form[data-filters]")) {
    const table = document.getElementById(form.dataset.filters!);
    const rows = table ? Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr")) : [];
    const count = form.querySelector<HTMLElement>("[data-count]")!;
    const apply = () => {
      const want = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
      const q = (want.q ?? "").toLowerCase();
      let shown = 0;
      for (const tr of rows) {
        const ok = Object.entries(want).every(([k, v]) => k === "q" || !v || tr.dataset[k] === v) && (!q || tr.textContent!.toLowerCase().includes(q));
        tr.hidden = !ok;
        if (ok) shown++;
      }
      count.textContent = `${shown} / ${rows.length}`;
    };
    // deep link: /journal#US-002 preselects the story filter
    const hash = decodeURIComponent(location.hash.slice(1));
    const storySel = form.querySelector<HTMLSelectElement>('select[name="story"]');
    if (hash && storySel && [...storySel.options].some((o) => o.value === hash)) storySel.value = hash;
    form.addEventListener("input", apply);
    apply();
  }
</script>
```

- [ ] **Step 4: Pages**

`pages/architecture.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Markdown from "../components/Markdown.astro";
import { listFiles } from "../lib/specs.mjs";
const diagrams = listFiles(".", [".png", ".svg"]).filter((p) => !p.startsWith("story-") && !p.startsWith("legacy/"));
---
<Base title="Architecture">
  <h1>Architecture</h1>
  <Markdown id="ARCHITECTURE" missing="No specs/ARCHITECTURE.md — run /research-and-architecture" />
  {diagrams.length > 0 && <><h2>Diagrams</h2><div class="grid">{diagrams.map((p) => <figure class="card"><a href={`/assets/${p}`}><img src={`/assets/${p}`} alt={p} loading="lazy" /></a><figcaption class="small muted">{p}</figcaption></figure>)}</div></>}
  <h2>Project</h2>
  <Markdown id="PROJECT" missing="No specs/PROJECT.md" />
  <Markdown id="MIGRATION" missing="" />
</Base>
```

`pages/design.astro`:

```astro
---
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Base from "../layouts/Base.astro";
import Markdown from "../components/Markdown.astro";
import { SPECS_DIR, designTokens } from "../lib/specs.mjs";
const p = join(SPECS_DIR, "DESIGN.md");
const tokens = existsSync(p) ? designTokens(readFileSync(p, "utf8")) : [];
---
<Base title="Design">
  <h1>Design</h1>
  {tokens.length > 0 && <><h2>Tokens</h2><div class="table-wrap"><table>
    <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Usage</th></tr></thead>
    <tbody>{tokens.map((t) => <tr><td><code>{t.token}</code></td><td><i class="swatch" style={`background:${t.light}`}></i> <code>{t.light}</code></td><td><i class="swatch" style={`background:${t.dark}`}></i> <code>{t.dark}</code></td><td>{t.usage}</td></tr>)}</tbody>
  </table></div></>}
  <Markdown id="DESIGN" missing="No specs/DESIGN.md — run /ui-specs" />
</Base>
```

`pages/journal.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Chip from "../components/Chip.astro";
import Filters from "../components/Filters.astro";
import { readJournal } from "../lib/specs.mjs";
const journal = readJournal().slice().reverse();
const uniq = (k) => [...new Set(journal.map((e) => e[k]).filter(Boolean))].sort();
const fields = [
  { name: "story", label: "story", values: uniq("story") },
  { name: "op", label: "op", values: uniq("op") },
  { name: "stage", label: "stage", values: uniq("stage") },
  { name: "kind", label: "kind", values: uniq("kind") },
  { name: "day", label: "day", values: [...new Set(journal.map((e) => (e.ts ?? "").slice(0, 10)).filter(Boolean))].sort().reverse() },
];
---
<Base title="Journal">
  <h1>Journal <span class="muted small">{journal.length} entries</span></h1>
  <Filters fields={fields} target="journal" />
  <div class="table-wrap"><table id="journal">
    <thead><tr><th>ts</th><th>story</th><th>op</th><th>stage</th><th>agent</th><th>kind</th><th>summary</th><th>refs</th></tr></thead>
    <tbody>{journal.map((e) => (
      <tr data-story={e.story ?? ""} data-op={e.op ?? ""} data-stage={e.stage ?? ""} data-kind={e.kind ?? ""} data-day={(e.ts ?? "").slice(0, 10)} class={e.kind === "invalid" ? "error" : ""}>
        <td class="small">{e.ts ?? `line ${e.line}`}</td>
        <td>{e.story && <a href={`/stories/${e.story}`}>{e.story}</a>}</td>
        <td>{e.op}</td><td>{e.stage}</td><td class="small muted">{e.agent}</td>
        <td><Chip value={e.kind} kind={e.kind === "invalid" ? "fail" : (e.verdict ?? "pending")} />{e.gate && <> <Chip value={`${e.gate} ${e.verdict}`} kind={e.verdict} /></>}</td>
        <td>{e.summary}{e.raw && <pre class="small">{e.raw}</pre>}</td>
        <td class="small">{e.sha && <code>{e.sha}</code>} {e.backlog_id && <a href={`/backlog/${e.backlog_id}`}>{e.backlog_id}</a>} {e.report && <a href={e.story ? `/stories/${e.story}#verification` : "#"}>{e.report.split("/").at(-1)}</a>} {(e.refs ?? []).map((r) => <code>{r} </code>)} {e.run_id && <span class="muted">{e.run_id}</span>}</td>
      </tr>
    ))}</tbody>
  </table></div>
</Base>
```

`pages/backlog.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Chip from "../components/Chip.astro";
import Filters from "../components/Filters.astro";
import { readBacklog } from "../lib/specs.mjs";
const { data, error } = readBacklog();
const items = data.items.slice().reverse();
const uniq = (f) => [...new Set(items.map(f).filter(Boolean))].sort();
const fields = [
  { name: "status", label: "status", values: uniq((i) => i.status) },
  { name: "severity", label: "severity", values: uniq((i) => i.severity) },
  { name: "kind", label: "kind", values: uniq((i) => i.kind) },
  { name: "story", label: "story", values: uniq((i) => i.source?.story) },
];
const statusKind = (s) => (s === "done" ? "green" : s === "wontfix" ? "pending" : s === "in-progress" ? "info" : "warn");
---
<Base title="Backlog">
  <h1>Backlog <span class="muted small">{items.filter((i) => i.status === "open").length} open / {items.length}</span></h1>
  {error && <p class="error">{error}</p>}
  <Filters fields={fields} target="backlog" />
  <div class="table-wrap"><table id="backlog">
    <thead><tr><th>Id</th><th>Status</th><th>Severity</th><th>Kind</th><th>Story</th><th>Op</th><th>Stage / gate</th><th>Title</th><th>Created</th></tr></thead>
    <tbody>{items.map((i) => (
      <tr data-status={i.status} data-severity={i.severity} data-kind={i.kind} data-story={i.source?.story ?? ""}>
        <td><a href={`/backlog/${i.id}`}>{i.id}</a></td>
        <td><Chip value={i.status} kind={statusKind(i.status)} /></td>
        <td><Chip value={i.severity} /></td>
        <td>{i.kind}</td>
        <td>{i.source?.story && <a href={`/stories/${i.source.story}`}>{i.source.story}</a>}</td>
        <td>{i.source?.op}</td>
        <td class="small muted">{[i.source?.stage, i.source?.gate].filter(Boolean).join(" / ")}</td>
        <td>{i.title}</td>
        <td class="small">{i.created_at}</td>
      </tr>
    ))}</tbody>
  </table></div>
</Base>
```

`pages/backlog/[id].astro`:

```astro
---
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Base from "../../layouts/Base.astro";
import Chip from "../../components/Chip.astro";
import { SPECS_DIR, excerpt, readBacklog, readJournal } from "../../lib/specs.mjs";

export function getStaticPaths() {
  return readBacklog().data.items.map((i) => ({ params: { id: i.id } }));
}

const { id } = Astro.params;
const item = readBacklog().data.items.find((i) => i.id === id);
if (!item) return new Response(`unknown backlog item ${id}`, { status: 404 });
const journal = readJournal().filter((e) => e.backlog_id === id || (e.summary ?? "").includes(id));
// The report is a specs-relative path; show the paragraph that mentions the item, or the whole report when none does.
const reportPath = item.source?.report ? join(SPECS_DIR, item.source.report.replace(/^specs\//, "")) : null;
const report = reportPath && existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
const snippet = report ? (excerpt(report, id) ?? excerpt(report, item.title.slice(0, 40)) ?? report) : null;
---
<Base title={id}>
  <h1>{id} <Chip value={item.status} kind={item.status === "done" ? "green" : "warn"} /> <Chip value={item.severity} /> <Chip value={item.kind} kind="info" /></h1>
  <p><strong>{item.title}</strong></p>
  {item.detail && <p>{item.detail}</p>}
  <p class="small muted">source: {item.source?.story && <a href={`/stories/${item.source.story}`}>{item.source.story}</a>} {item.source?.op} {item.source?.stage} {item.source?.gate} · created {item.created_at}{item.resolved_at && <> · resolved {item.resolved_at} <code>{item.resolved_sha}</code> — {item.resolution}</>}</p>
  {item.files?.length > 0 && <ul>{item.files.map((f) => <li><code>{f}</code></li>)}</ul>}
  <h2>Implement it</h2>
  <pre><code>/backlog {id}</code></pre>
  {item.source?.report && <><h2>Source report <span class="muted small">{item.source.report}</span></h2>{snippet ? <pre>{snippet}</pre> : <p class="error">report file not found</p>}</>}
  {journal.length > 0 && <><h2>Journal</h2><ul>{journal.map((e) => <li><span class="small muted">{e.ts}</span> <Chip value={e.kind} /> {e.summary}</li>)}</ul></>}
</Base>
```

`pages/assets/[...path].ts`:

```ts
import type { APIRoute, GetStaticPaths } from "astro";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { SPECS_DIR, listFiles } from "../../lib/specs.mjs";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".html": "text/html; charset=utf-8",
};

// Diagrams, screenshots and mockups under specs/**, served verbatim.
export const getStaticPaths: GetStaticPaths = () =>
  listFiles(".", Object.keys(TYPES))
    .filter((p) => !p.startsWith("legacy/"))
    .map((p) => ({ params: { path: p } }));

export const GET: APIRoute = ({ params }) => {
  const rel = normalize(params.path ?? "");
  const type = TYPES[extname(rel)];
  if (!type || rel.startsWith("..") || rel.startsWith("legacy/")) return new Response("not found", { status: 404 });
  try {
    return new Response(readFileSync(join(SPECS_DIR, rel)), { headers: { "content-type": type } });
  } catch {
    return new Response("not found", { status: 404 });
  }
};
```

- [ ] **Step 5: Smoke assertions + dev freshness** — append to `scripts/specs-site.test.mjs` (the build test from Task 6 gains these lines after the story checks):

```js
  assert.match(html(out, "architecture"), /ADR-001/);
  assert.match(html(out, "architecture"), /assets\/architecture\.png/);
  assert.match(html(out, "design"), /<code>--background<\/code>[\s\S]*background:#f8fafc/);
  const journal = html(out, "journal");
  assert.match(journal, /data-kind="finding"[\s\S]*?BL-001/);
  assert.match(journal, /chip-fail">invalid/);
  assert.match(html(out, "backlog"), /data-status="open"[\s\S]*?BL-001/);
  const item = html(out, "backlog/BL-001");
  assert.match(item, /\/backlog BL-001/);
  assert.match(item, /Source report/);
  assert.ok(existsSync(join(out, "assets", "architecture.png")));
  assert.ok(existsSync(join(out, "assets", "story-000-foundation", "mockups", "home.html")));
  assert.ok(!existsSync(join(out, "assets", "legacy")));
  const all = execFileSync("grep", ["-rl", "LEGACY MARKER", out], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).catch?.() ?? "";
  assert.equal(all, "");
```

(replace the last two lines with a plain loop if `grep -rl` exiting 1 on no match is awkward: `assert.ok(!readdirSync(out, { recursive: true }).some((f) => f.endsWith(".html") && readFileSync(join(out, f), "utf8").includes("LEGACY MARKER")))`.)

and a new test:

```js
import { cpSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

test("dev server reflects a state.json edit on the next request", { timeout: 120_000 }, async () => {
  const specs = join(mkdtempSync(join(tmpdir(), "specs-site-dev-")), "specs");
  cpSync(FIXTURE, specs, { recursive: true });
  const port = String(4400 + Math.floor(Math.random() * 500));
  const child = spawn(process.execPath, [CLI, "dev", "--specs", specs, "--port", port], { stdio: "ignore", detached: true });
  const url = (p) => `http://127.0.0.1:${port}${p}`;
  try {
    let page = null;
    for (let i = 0; i < 60 && page === null; i++) {
      await sleep(1000);
      page = await fetch(url("/stories/US-000")).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    }
    assert.ok(page, "dev server did not come up");
    assert.match(page, /class="scenario red"[^>]*data-scenario="Remembering a visitor"/);
    const statePath = join(specs, "story-000-foundation", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.operations["Op-2"].operation_phase = "green";
    state.test_plan_rows["T-02"].passing = true;
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    await sleep(500);
    const after = await fetch(url("/stories/US-000")).then((r) => r.text());
    assert.match(after, /class="scenario green"[^>]*data-scenario="Remembering a visitor"/);
    assert.equal((await fetch(url("/assets/story-000-foundation/mockups/home.html"))).headers.get("content-type"), "text/html; charset=utf-8");
  } finally {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
  }
});
```

Run `node --test plugins/specs-site/skills/specs-site/scripts/` → 3 pass. If the dev fetch returns a 404 for `/stories/US-000` on the first request but 200 later, extend the poll; if the assets endpoint 404s in dev, the route cache did not see `getStaticPaths` — confirm `server.watcher.add` fired (the integration from Task 6) before changing anything else.

- [ ] **Step 6: CI** — add a job to `.github/workflows/ci.yml` after `validate`:

```yaml
  specs-site:
    name: specs-site tests (unit + build + dev smoke)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: plugins/specs-site/skills/specs-site/site/package-lock.json
      - run: npm ci --no-audit --no-fund
        working-directory: plugins/specs-site/skills/specs-site/site
      - run: npm test
        working-directory: plugins/specs-site/skills/specs-site/site
      - run: node --test plugins/specs-site/skills/specs-site/scripts/
```

- [ ] **Step 7: `SKILL.md` body** (keep the frontmatter from Task 4):

```markdown
# specs-site

Renders the current project's `specs/` as a local site. Nothing here is written by an LLM: every page is a function of `specs/**` (`stories.json`, `story-*/state.json`, `journal.jsonl`, `backlog.json`, `autopilot.json`, the markdown, the `.feature` files, diagrams, screenshots, mockups). If a fact is not in `specs/`, the site does not show it.

## Usage

```
/specs-site [--specs DIR] [--build] [--host [ADDR]] [--port N]
```

| Flag | Meaning |
| --- | --- |
| `--specs DIR` | The specs directory. Default `./specs` of the current project. |
| `--build` | Static export to `DIR/.site/` instead of a dev server. |
| `--host [ADDR]` | Bind the dev server to `ADDR` (bare `--host` = `0.0.0.0`, LAN). Default `127.0.0.1`. |
| `--port N` | Default `4321`. |

## Steps

1. **Locate the CLI**: `SS=$(find -L ~/.claude/skills ~/.claude/plugins -path '*/specs-site/scripts/specs-site.mjs' -not -path '*archive*' | head -1)`. If empty, tell the user to `/plugin install specs-site@claude-dev-skill` and stop.
2. **Check the target**: `DIR` must contain `stories.json`; otherwise print the CLI's own error and suggest `/high-level-scoping` or `/migrate-specs`. Node ≥ 22.12 is required (`node --version`).
3. **Dev (default)**: run `node "$SS" dev --specs "$DIR" [--host …] [--port N]` with `run_in_background: true` — this is the one command in the marketplace that must outlive the reply. The first run installs the site's dependencies (`npm ci`, ~30 s). Poll `curl -sf http://127.0.0.1:PORT/ >/dev/null` up to 30 × 2 s, then print the URL and one line of what the dashboard shows (`jq -r '.stories | group_by(.phase) | map("\(.[0].phase) \(length)") | join(", ")' "$DIR/stories.json"`). Say how to stop it: `kill <pid>` (the background task's pid) — never `pkill -f astro` on a shared host.
4. **`--build`**: `node "$SS" build --specs "$DIR"`; print the output directory (`DIR/.site/`) and, if `.gitignore` does not contain `specs/.site/`, say so (`/repo-initialization` ≥ 2.2 adds it).
5. Under autopilot (`specs/autopilot.json.active`), do nothing different: the site is read-only and the dashboard's "Now running" panel follows the run.

## Self-review (print as a checked list)

- [ ] the URL printed answers with HTTP 200 (or the build directory exists and contains `index.html`)
- [ ] nothing under `specs/` was modified except `specs/.site/` on `--build`
- [ ] the process id (dev) or output path (build) was printed
```

- [ ] **Step 8: plugin `README.md`** — replace the scaffold body with: what it renders (the route table from spec §5.3 in one table), Install, Usage (`/specs-site`, and the raw CLI `node skills/specs-site/scripts/specs-site.mjs dev --specs /path/to/specs`), Layout (`skills/specs-site/site/` is a normal Astro project — `npm run dev` there with `SPECS_DIR=/abs/path` set), Tests (`npm test` in the site dir; `node --test skills/specs-site/scripts/`), and "What it is not" (spec §5.4 verbatim).

- [ ] **Step 9: Validate + commit**

```bash
bash scripts/validate.sh && node --test plugins/specs-site/skills/specs-site/scripts/ && (cd plugins/specs-site/skills/specs-site/site && npm test)
git add plugins/specs-site .github/workflows/ci.yml
git commit -m "feat(specs-site): architecture, design tokens, filterable journal and backlog, item pages, asset endpoint; dev-freshness smoke; CI job; skill + README"
```

---

### Task 8: Catalog, marketplace changelog, local install, real-repo run on finfetch-web, handoff, PR

**Files:**
- Modify: `README.md` (Traceability table + versions + `specs/` tree), `CHANGELOG.md` (`[Unreleased]`)
- Create: `.claude/handoffs/autopilot-plan4-001.md`
- Modify (memory, outside the repo): `~/.claude/projects/-home-ttadmin-Codes-claude-dev-skill/memory/autopilot-plan3-status.md` → rename/update to the Plan 4 state

- [ ] **Step 1: README** — Traceability table gains `| \`specs-site\` | 1.0.0 | \`/specs-site [--specs DIR] [--build]\` — Astro 7 site over \`specs/**\`: Dashboard (phase kanban, Op bars, gate chips, open backlog by severity, "Now running" from \`autopilot.json\` + journal tail), \`/stories/US-NNN\` (story, features with scenario status colours, plan, state, verification, UI, backlog), \`/architecture\`, \`/design\` (token swatches), filterable \`/journal\` and \`/backlog\`. Live reload on every change under \`specs/\`. Read-only. |`; every version cell updated from `plugin.json` (`for p in plugins/*/; do jq -r '"\(.name) \(.version)"' $p/.claude-plugin/plugin.json; done`); the `specs/` tree gains `├── .site/                                    # static export of /specs-site --build (gitignored)`. In the `autopilot` row append `A finished run pauses story_end (until_reached = chain exhausted); base_sha from the story's first commit.`

- [ ] **Step 2: CHANGELOG.md** — under `[Unreleased] / ### Added`: `- **\`specs-site\`** plugin 1.0.0 (plan 4, design spec §5): Astro 7 site rendering a project's \`specs/**\` — dashboard, per-story pages, architecture, design, journal, backlog; \`specs-site.mjs\` CLI; CI job with unit + build + dev smoke.` Under `### Changed`: `- Run-2 dogfood fixes (\`.claude/handoffs/dogfood-US-002-run2-report.md\` P1–P8): \`autopilot\` 1.2.0 (story_end pause, base_sha heuristic, stop attribution, tracked-run-file refusal, async dispatch), contract §3/§4 (commit-then-journal only on success, uid-scoped pkill) resynced — \`dev-ledger\` 1.0.4 and eleven patch bumps.`

- [ ] **Step 3: Validate, tests, guard, install**

```bash
bash scripts/validate.sh && node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs && node --test plugins/autopilot/skills/autopilot/scripts/autopilot.test.mjs && node --test plugins/specs-site/skills/specs-site/scripts/ && bash scripts/install-local.sh --all
git diff --name-only main HEAD | grep '^plugins/' | awk -F/ '{print $2}' | sort -u > "$TMPDIR/touched.txt"
git diff --name-only main HEAD | grep 'CHANGELOG.md$' | grep '^plugins/' | awk -F/ '{print $2}' | sort -u | diff - "$TMPDIR/touched.txt" && echo "changelog guard: ok"
```

Expected: validate 0, ledger 32/32, autopilot 55/55, specs-site 3/3, 21 plugins linked, `changelog guard: ok`.

- [ ] **Step 4: Real-repo run on finfetch-web** (read-only for that repo: dev server + a build into the scratchpad)

```bash
SS="$HOME/.claude/skills/specs-site/scripts/specs-site.mjs"
node "$SS" dev --specs "$HOME/Codes/finfetch-web/specs" --port 4333 &   # background; note the pid
for i in $(seq 30); do curl -sf http://127.0.0.1:4333/ >/dev/null && break; sleep 2; done
for r in / /stories/US-002 /stories/US-008 /architecture /design /journal /backlog /backlog/BL-001 /assets/story-002-dates-and-identity/verification/screenshots/marker-zoom.png; do printf '%s ' "$r"; curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:4333$r"; done
curl -s http://127.0.0.1:4333/ | grep -o 'verified <span class="muted">[0-9]*' ; curl -s http://127.0.0.1:4333/stories/US-002 | grep -c 'class="scenario'
kill %1
node "$SS" build --specs "$HOME/Codes/finfetch-web/specs" --out "$SCRATCH/finfetch-site" && ls "$SCRATCH/finfetch-site"
cd "$HOME/Codes/finfetch-web" && git status --short   # expect unchanged: " M specs/journal.jsonl" only
```

Expected: nine `200`s; the dashboard shows `verified 4`; the US-002 page has 0 scenarios (that story owns no `features/` — its scenarios live in US-001's F-002/F-005 files; that is the migrated layout, note it in the handoff) while `/stories/US-001` has > 0; the build finishes with no error; finfetch-web's tree is unchanged. Take one screenshot of `/` and `/stories/US-001` with the Playwright MCP (`browser_navigate` + `browser_take_screenshot`) and look at it: overlapping chips, an unreadable kanban or an empty "Now running" panel are Task 6 bugs — fix them before continuing.

- [ ] **Step 5: Handoff** — write `.claude/handoffs/autopilot-plan4-001.md` (Goal / State / Next / Context, style of `autopilot-plan3-001.md`): what shipped (the versions table), the run-2 P1–P8 → task mapping, the finfetch-web route check output, deferred items (relative image links inside markdown are not rewritten to `/assets/`; `getStaticPaths` results for `/stories/*`, `/backlog/*`, `/assets/*` refresh on any `specs/**` change through the watch integration — verify once on a story added mid-run; no `specs:site` npm script in `/repo-initialization`; DESIGN.md tokens are shown, not adopted), and Next = user merges; then `/autopilot US-003 --skip-arch-check` on finfetch-web with `/specs-site --specs ~/Codes/finfetch-web/specs` open beside it; BL-021 / BL-029 remain the user's decisions.

Update the memory file: Plan 4 done (PR open), Plans 1–4 all shipped, spec §5 complete; the next dogfood is US-003 with the site watching.

- [ ] **Step 6: Commit, push, PR**

```bash
git add -A && git commit -m "docs: catalog + changelog for specs-site and the run-2 fixes; handoff; finfetch-web route check"
git push -u origin feat/autopilot-plan4-specs-site
gh pr create --title "feat: specs-site plugin (Astro) + run-2 dogfood fixes (plan 4)" --body-file <(printf '%s\n' "Plan: docs/superpowers/plans/2026-09-05-specs-site.md — design spec §5 (specs-site) plus P1–P8 of .claude/handoffs/dogfood-US-002-run2-report.md." "" "New plugin specs-site 1.0.0: Astro 7 site over a project's specs/** (dashboard, stories, architecture, design, journal, backlog), specs-site.mjs CLI, CI job (unit + build + dev smoke). autopilot 1.2.0 (story_end pause, base_sha heuristic, stop attribution, tracked autopilot.json refusal, async dispatch), contract §3/§4 resync (dev-ledger 1.0.4 + 11 patch bumps)." "" "Decisions (site under skills/specs-site/site, fs readers not collections for the trackers, no Tailwind/Vitest/Playwright, no specs:site npm script) are in the plan header." "" "🤖 Generated with [Claude Code](https://claude.com/claude-code)" "" "https://claude.ai/code/session_01ALRUiCwannFRvP1ZeUnVjT")
```

---

## Self-review against the spec and the report

- **Spec §5.1 invocation** → Task 5 CLI (`dev`/`build --specs`, `npm ci` on first run, `SPECS_DIR`, `127.0.0.1:4321`, `--host`), Task 7 SKILL. The `specs:site` npm script is dropped by decision (header). **§5.2 data model** → Task 4 readers (trackers, states, journal), Task 5 `docs` collection (markdown), Task 4 `gherkin.mjs` (features), Task 7 assets endpoint; "live reload on every file change under specs/" → Task 6 watch integration. Markdown tables scroll (`.prose table`, `.table-wrap`) and headers stick (`thead th`) → Task 5 CSS; REASONS in-page nav is the story page's tab bar (the `## R — …` headings render inside `#plan`). Scenario colour by Test Plan row status → `scenarioStatus` (Task 4) + `Scenario.astro` (Task 6). **§5.3 pages** → Dashboard (Task 6: kanban, Op bars, gate chips, backlog by severity, Now running + last 20 events, last verified), `/stories/US-NNN` tabs (Task 6), `/architecture` + diagrams (Task 7), `/design` swatches (Task 7), `/journal` filters by story/op/stage/kind/day (Task 7), `/backlog` filters + item page with report excerpt and the `/backlog BL-NNN` command (Task 7). Styling: plain CSS by decision; light/dark via `light-dark()`; client JS = filters only. **§5.4** → nothing rendered that is not in `specs/**` (Task 7 test greps for the legacy marker). **§7 loader errors in place** → `readJsonFile` errors, `parseJsonl` invalid entries, `parseFeature` errors, all rendered with `.error` (Tasks 4, 6, 7). **§8 tests** → unit (Task 4/7), build + dev freshness smoke (Tasks 5–7), CI job (Task 7), real-repo run (Task 8). **§9 versions** → table above (`specs-site` 1.0.0; `repo-initialization` patch, not 2.3.0, by decision).
- **Report P1** → Task 1 (`resolveVerified` order) + Task 3 (§8 table, README). **P2** → Task 2 (`recordBaseSha` git-log heuristic) + Task 3 (§6). **P3** → Task 1 (`current = null` when done). **P4** → Task 3 contract §3. **P5** → Task 3 contract §4. **P6** → Task 3 §5 step 4. **P7** is the conductor's own mistake covered by P5's text. **P8** → Task 2 (`preflight`) + Task 3 (§7, story-verifier explicit paths).
- **Placeholder scan:** every code step carries its code; the README/CHANGELOG/handoff steps carry their text; Task 7 Step 8 lists the README sections and where their content comes from.
- **Name consistency:** `SPECS_DIR`, `readJsonFile`, `readStories`, `readBacklog`, `readAutopilot`, `parseJsonl`, `readJournal`, `storyDirs`, `storyDir`, `readState`, `PHASES`, `opProgress`, `scenarioStatus`, `gateVerdicts`, `listFiles`, `designTokens`, `excerpt` (specs.mjs, Tasks 4/7) are the names Tasks 5–7 import; `parseFeature`, `readFeatures` (gherkin.mjs); `parseArgs`, `astroArgs`, `ensureDeps`, `main` (CLI); components `Chip {value, kind}`, `Markdown {id, missing}`, `Scenario {s, status}`, `Feature {feature, state}`, `Filters {fields, target}`; CSS classes `.scenario.green|red|manual` and `data-scenario` are what the smoke tests grep. Journal entry fields (`ts story op stage agent kind summary refs sha gate verdict report backlog_id run_id`) match `ledger.mjs`'s `log()`; backlog item fields (`id title detail source{stage gate story op report} severity kind files status created_at resolved_at resolved_sha resolution`) match `backlogAdd()`.
