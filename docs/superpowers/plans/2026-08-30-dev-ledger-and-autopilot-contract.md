# dev-ledger + AUTOPILOT contract Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `dev-ledger` plugin (journal + backlog + regression CLI, `/backlog` skill), one shared `AUTOPILOT` contract document, and the unattended-mode fixes to the 11 pipeline skills, so every existing skill can be driven without a human and leaves a full audit trail.

**Architecture:** A single zero-dependency Node script (`ledger.mjs`) owns two tracker files (`specs/journal.jsonl` append-only, `specs/backlog.json`) and a runner-agnostic regression diff (git worktree of a base SHA vs the working tree). One markdown contract (`autopilot-contract.md`) is the canonical text every pipeline skill references for unattended behaviour, journaling, and toolchain resolution; a sync script copies it verbatim into each plugin and CI verifies the copies are identical. Skill edits are markdown-only.

**Tech Stack:** Node ≥ 20 (`node:test` for tests, no deps), bash + jq + yq (marketplace scripts, already required), Keep-a-Changelog + SemVer per plugin via `scripts/bump.sh`.

**Spec:** `docs/superpowers/specs/2026-08-30-autopilot-design.md` — sections 2 (contract + gap fixes) and 3 (dev-ledger). Sections 4 (autopilot plugin) and 5 (specs-site) are Plans 2 and 3.

**Deviations from the spec (decided while planning, ponytail ladder):**
- §3.1 "post-commit git hook journals commits" — dropped. Git already is the commit log; `ledger journal` merges `git log` entries whose scope is `(US-NNN)` into its view instead. No hook, no dirty-tree-after-every-commit loop.
- §3 "`/repo-initialization` adds an `npm run ledger` script" — dropped. The ledger path is machine-specific (plugin cache or `~/.claude/skills`); skills locate it with one `find` line (contract §5) instead of committing a path into `package.json`.
- §2.3 "`state.json` gains `tests_status: "manual"`" — realised as `test_plan_rows[T-N].type = "manual"`; an Op whose rows are all manual gets `tests_status: "manual"`.

## Global Constraints

- Node ≥ 20, stdlib only in `ledger.mjs` — no `package.json` dependencies in the plugin.
- Every plugin touched: `scripts/bump.sh <name> minor` (major for none in this plan), CHANGELOG entry filled, `scripts/validate.sh` green.
- `specs/journal.jsonl` is append-only; never rewritten. `specs/backlog.json` is rewritten whole, 2-space indented, trailing newline.
- Backlog ids: `BL-` + 3-digit zero-padded counter (`BL-001`), never reused.
- Journal `kind ∈ {stage_start, stage_end, decision, action, gate, finding, commit, stop}`; gate `verdict ∈ {PASS, PASS_WITH_WARNINGS, FAIL}`.
- Pipeline plugins that receive the contract (11): `spec-writing`, `spec-writing-verification`, `ui-specs`, `plan-writing`, `plan-writing-verification`, `test-setup`, `test-setup-verification`, `spec-implementation`, `spec-implementation-verification`, `verification-and-validation`, `repo-initialization`.
- Never edit `specs/**/*.feature` to add tags — Op filtering by scenario name is first-class.
- Commit messages: Conventional Commits, scope = plugin name for plugin changes (`feat(dev-ledger): …`), `chore(scripts): …` for marketplace scripts.
- All work on branch `feat/autopilot` in `/home/ttadmin/Codes/claude-dev-skill`.

---

## File structure

```
plugins/dev-ledger/
├── .claude-plugin/plugin.json
├── CHANGELOG.md
├── README.md
└── skills/
    ├── dev-ledger/
    │   ├── SKILL.md                      # /dev-ledger — journal view; documents the CLI for other skills
    │   ├── references/autopilot-contract.md   # CANONICAL contract (synced into the 11 pipeline plugins)
    │   └── scripts/
    │       ├── ledger.mjs                # the CLI (one file, ~350 lines, exported functions + main)
    │       ├── ledger.test.mjs           # node --test
    │       └── fixtures/{vitest.json,cucumber.json}
    └── backlog/
        └── SKILL.md                      # /backlog, /backlog BL-NNN, /backlog BL-NNN --wontfix
scripts/sync-contract.sh                  # copies the canonical contract into each pipeline plugin
scripts/validate.sh                       # + contract-identity check, + multi-skill plugin support
scripts/install-local.sh                  # + symlink every skills/* dir of a plugin, not only skills/<name>
plugins/<pipeline>/skills/<name>/references/autopilot-contract.md   # 11 verbatim copies
plugins/<pipeline>/skills/<name>/SKILL.md                            # edits per Tasks 9–14
plugins/plan-writing/skills/plan-writing/references/plan-template.md  # manual type, toolchain placeholders
plugins/test-setup/skills/test-setup/references/state-schema.md       # cursor rule, manual rows
plugins/spec-implementation/skills/spec-implementation/references/state-schema.md
README.md, .claude-plugin/marketplace.json, CHANGELOG.md            # catalog + versions
```

---

### Task 1: Scaffold the `dev-ledger` plugin and make the marketplace scripts multi-skill aware

**Files:**
- Create: `plugins/dev-ledger/**` (via `scripts/new-skill.sh`)
- Create: `plugins/dev-ledger/skills/backlog/SKILL.md` (placeholder frontmatter only; body in Task 8)
- Modify: `scripts/install-local.sh:70-75`
- Modify: `scripts/validate.sh` (plugin loop, after the `sm` checks)

**Interfaces:**
- Produces: plugin dir layout every later task writes into; `install-local.sh` symlinks `skills/backlog` too.

- [ ] **Step 1: Scaffold**

```bash
cd /home/ttadmin/Codes/claude-dev-skill
scripts/new-skill.sh dev-ledger "Journal + backlog + regression CLI for story-based projects: append-only specs/journal.jsonl of every decision, action and gate; specs/backlog.json of un-applied findings with BL-NNN ids; runner-agnostic regression diff against a base SHA. Use when a skill must record a decision or gate result, file a finding for later, list the journal, or check for regressions."
mkdir -p plugins/dev-ledger/skills/dev-ledger/scripts/fixtures plugins/dev-ledger/skills/dev-ledger/references plugins/dev-ledger/skills/backlog
cat > plugins/dev-ledger/skills/backlog/SKILL.md <<'EOF'
---
name: backlog
version: 0.1.0
description: Lists open backlog items (BL-NNN) or implements one by id. Triggers on "/backlog", "/backlog BL-012", "implement BL-012", "what is in the backlog", "close BL-012 as wontfix".
---

# backlog

(body written in Task 8)
EOF
```

- [ ] **Step 2: Make install-local.sh link every skill dir of a plugin**

Replace in `scripts/install-local.sh` the block

```bash
  skill_src="$plugin_dir/skills/$name"
  [ -d "$skill_src" ] || { warn "skip: $skill_src not found"; continue; }

  info "installing $name"
  link_into "$skill_src" "$HOME/.claude/skills/$name"
```

with

```bash
  [ -d "$plugin_dir/skills/$name" ] || { warn "skip: $plugin_dir/skills/$name not found"; continue; }

  info "installing $name"
  for skill_src in "$plugin_dir/skills/"*/; do
    skill_src="${skill_src%/}"
    link_into "$skill_src" "$HOME/.claude/skills/$(basename "$skill_src")"
  done
```

- [ ] **Step 3: Teach validate.sh about extra skills**

In `scripts/validate.sh`, after the line `ok "  $name @ $pj_version"` and before `done`, add:

```bash
  # extra skills bundled in the same plugin: frontmatter name must match dir, version must match plugin
  for extra in "$plugin_dir/skills/"*/; do
    extra="${extra%/}"; ename="$(basename "$extra")"
    [ "$ename" = "$name" ] && continue
    esm="$extra/SKILL.md"
    [ -f "$esm" ] || { fail "  $name: extra skill $ename has no SKILL.md"; continue; }
    [ "$(skill_field "$esm" name)" = "$ename" ] || fail "  $name: extra skill $ename frontmatter name mismatch"
    [ "$(skill_field "$esm" version)" = "$pj_version" ] || fail "  $name: extra skill $ename version ≠ plugin version"
  done
```

- [ ] **Step 4: Run validate**

Run: `scripts/validate.sh`
Expected: `✓ dev-ledger @ 0.1.0` appears; exit 0 (dev-ledger is already in marketplace.json? — `new-skill.sh` does NOT add it; if validate fails with "missing entry in marketplace.json", add this entry to `.claude-plugin/marketplace.json` `plugins[]`:)

```json
{
  "name": "dev-ledger",
  "source": "./plugins/dev-ledger",
  "description": "Journal + backlog + regression CLI for story-based projects (specs/journal.jsonl, specs/backlog.json, BL-NNN ids, ledger regress).",
  "version": "0.1.0"
}
```

Re-run until exit 0.

- [ ] **Step 5: Commit**

```bash
git add plugins/dev-ledger scripts/install-local.sh scripts/validate.sh .claude-plugin/marketplace.json
git commit -m "feat(dev-ledger): scaffold plugin; scripts support multi-skill plugins"
```

---

### Task 2: `ledger.mjs` — specs resolution, arg parsing, `log`

**Files:**
- Create: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs`
- Test: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs`

**Interfaces:**
- Produces (exported from `ledger.mjs`, used by Tasks 3–5):
  - `findSpecsDir(start = process.cwd(), override = process.env.LEDGER_SPECS): string`
  - `parseArgs(argv: string[]): {_: string[], [key]: string|true|string[]}` — `--ref` and `--file` accumulate into arrays.
  - `autopilotContext(specs): {run_id?, story?, op?, stage?, agent?}`
  - `log(specs, opts, now = new Date()): entry` — appends one line to `specs/journal.jsonl`.
  - `readJournal(specs): entry[]`
  - constants `KINDS`, `VERDICTS`.

- [ ] **Step 1: Write the failing tests**

```js
// plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findSpecsDir, parseArgs, autopilotContext, log, readJournal, KINDS } from './ledger.mjs';

export function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'ledger-'));
  mkdirSync(join(root, 'specs', 'story-001-x'), { recursive: true });
  writeFileSync(join(root, 'specs', 'stories.json'), '{"stories":[]}\n');
  return root;
}

test('findSpecsDir walks up to the dir holding specs/stories.json', () => {
  const root = fixtureProject();
  assert.equal(findSpecsDir(join(root, 'specs', 'story-001-x'), undefined), join(root, 'specs'));
  assert.throws(() => findSpecsDir(tmpdir(), undefined), /no specs\/stories.json/);
});

test('parseArgs handles values, flags and repeated --ref/--file', () => {
  const o = parseArgs(['log', '--kind', 'decision', '--summary', 'x y', '--ref', 'a', '--ref', 'b', '--json']);
  assert.deepEqual(o._, ['log']);
  assert.equal(o.kind, 'decision');
  assert.equal(o.summary, 'x y');
  assert.deepEqual(o.ref, ['a', 'b']);
  assert.equal(o.json, true);
});

test('log appends a journal line with defaults from autopilot.json when active', () => {
  const root = fixtureProject();
  const specs = join(root, 'specs');
  assert.deepEqual(autopilotContext(specs), {});
  writeFileSync(join(specs, 'autopilot.json'), JSON.stringify({
    active: true, run_id: 'run-1', current: { story: 'US-001', op: 'Op-2', stage: 'test-setup', agent: 'agent-a' },
  }));
  const now = new Date('2026-08-30T10:00:00Z');
  const e = log(specs, { kind: 'decision', summary: 'RED-B skipped', ref: ['specs/x.md'] }, now);
  assert.equal(e.ts, '2026-08-30T10:00:00.000Z');
  assert.equal(e.story, 'US-001'); assert.equal(e.op, 'Op-2'); assert.equal(e.stage, 'test-setup');
  assert.equal(e.agent, 'agent-a'); assert.equal(e.run_id, 'run-1');
  assert.deepEqual(e.refs, ['specs/x.md']); assert.equal(e.sha, null);
  const lines = readFileSync(join(specs, 'journal.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), e);
  assert.deepEqual(readJournal(specs), [e]);
});

test('log: explicit args win over autopilot defaults; inactive autopilot gives nulls', () => {
  const root = fixtureProject(); const specs = join(root, 'specs');
  writeFileSync(join(specs, 'autopilot.json'), JSON.stringify({ active: false, current: { story: 'US-009' } }));
  const e = log(specs, { kind: 'action', summary: 's', story: 'US-002' });
  assert.equal(e.story, 'US-002'); assert.equal(e.op, null); assert.equal(e.run_id, null);
});

test('log validates kind, summary and gate verdict', () => {
  const specs = join(fixtureProject(), 'specs');
  assert.throws(() => log(specs, { kind: 'nope', summary: 's' }), new RegExp(KINDS.join('\\|')));
  assert.throws(() => log(specs, { kind: 'decision' }), /--summary/);
  assert.throws(() => log(specs, { kind: 'gate', summary: 's', gate: 'simplify', verdict: 'MEH' }), /--verdict/);
  const g = log(specs, { kind: 'gate', summary: 's', gate: 'simplify', verdict: 'PASS', report: 'r.md' });
  assert.equal(g.gate, 'simplify'); assert.equal(g.verdict, 'PASS'); assert.equal(g.report, 'r.md');
});

test('readJournal on a missing file is an empty array', () => {
  assert.deepEqual(readJournal(join(fixtureProject(), 'specs')), []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd plugins/dev-ledger/skills/dev-ledger/scripts && node --test ledger.test.mjs`
Expected: FAIL — `Cannot find module './ledger.mjs'`.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// ledger.mjs — journal + backlog + regression CLI for story-based projects.
// Node ≥ 20, stdlib only. Trackers: specs/journal.jsonl (append-only), specs/backlog.json.
import { appendFileSync, existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const KINDS = ['stage_start', 'stage_end', 'decision', 'action', 'gate', 'finding', 'commit', 'stop'];
export const VERDICTS = ['PASS', 'PASS_WITH_WARNINGS', 'FAIL'];
export const SEVERITIES = ['info', 'warning', 'error'];
export const BACKLOG_KINDS = ['bug', 'simplification', 'refactor', 'test-gap', 'spec-gap', 'doc', 'perf', 'security'];
export const STATUSES = ['open', 'in-progress', 'done', 'wontfix'];

export function findSpecsDir(start = process.cwd(), override = process.env.LEDGER_SPECS) {
  if (override) return resolve(override);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'specs', 'stories.json'))) return join(dir, 'specs');
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no specs/stories.json found above ${start}`);
    dir = parent;
  }
}

const MULTI = new Set(['ref', 'file']);
export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { opts._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    const val = next === undefined || next.startsWith('--') ? true : argv[++i];
    if (MULTI.has(key)) (opts[key] ??= []).push(val); else opts[key] = val;
  }
  return opts;
}

export function autopilotContext(specs) {
  const p = join(specs, 'autopilot.json');
  if (!existsSync(p)) return {};
  const ap = JSON.parse(readFileSync(p, 'utf8'));
  if (!ap.active) return {};
  return { run_id: ap.run_id, ...(ap.current ?? {}) };
}

function must(cond, msg) { if (!cond) throw new Error(msg); }

export function log(specs, opts, now = new Date()) {
  must(KINDS.includes(opts.kind), `--kind must be one of ${KINDS.join('|')}`);
  must(typeof opts.summary === 'string' && opts.summary.length > 0, '--summary is required');
  const ctx = autopilotContext(specs);
  const entry = {
    ts: now.toISOString(),
    run_id: opts.run_id ?? ctx.run_id ?? null,
    story: opts.story ?? ctx.story ?? null,
    op: opts.op ?? ctx.op ?? null,
    stage: opts.stage ?? ctx.stage ?? null,
    agent: opts.agent ?? ctx.agent ?? null,
    kind: opts.kind,
    summary: opts.summary,
    refs: opts.ref ?? [],
    sha: opts.sha ?? null,
  };
  if (opts.kind === 'gate') {
    must(VERDICTS.includes(opts.verdict), `--verdict must be one of ${VERDICTS.join('|')}`);
    must(typeof opts.gate === 'string', '--gate is required for kind=gate');
    Object.assign(entry, { gate: opts.gate, verdict: opts.verdict, report: opts.report ?? null });
  }
  if (opts['backlog-id']) entry.backlog_id = opts['backlog-id'];
  appendFileSync(join(specs, 'journal.jsonl'), JSON.stringify(entry) + '\n');
  return entry;
}

export function readJournal(specs) {
  const p = join(specs, 'journal.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ---- CLI -------------------------------------------------------------------
export function main(argv) {
  const opts = parseArgs(argv);
  const [cmd] = opts._;
  const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
  switch (cmd) {
    case 'log': { const e = log(specs, opts); process.stdout.write(JSON.stringify(e) + '\n'); return 0; }
    default:
      process.stderr.write('usage: ledger <log|journal|backlog|failures|regress> [--specs dir] ...\n');
      return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (err) { process.stderr.write(`ledger: ${err.message}\n`); process.exit(1); }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test ledger.test.mjs`
Expected: 6 pass.

- [ ] **Step 5: Smoke the CLI from a project dir**

Run: `cd "$(mktemp -d)" && mkdir specs && echo '{}' > specs/stories.json && node /home/ttadmin/Codes/claude-dev-skill/plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs log --kind decision --summary "hello" && cat specs/journal.jsonl`
Expected: one JSON line printed twice (stdout + file), `"kind":"decision"`.

- [ ] **Step 6: Commit**

```bash
git add plugins/dev-ledger/skills/dev-ledger/scripts
git commit -m "feat(dev-ledger): ledger.mjs — specs resolution, arg parsing, journal log"
```

---

### Task 3: `ledger journal` — filtered view merged with `git log`

**Files:**
- Modify: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs`
- Test: `plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs`

**Interfaces:**
- Produces: `filterJournal(entries, {story, op, kind, since}) → entry[]`; `gitCommits(root, {story}) → entry[]` (kind `commit`, `sha`, `summary` = subject, `story` parsed from `(US-NNN)` scope, `ts` = author date ISO); `formatTable(entries) → string`; CLI `journal [--story] [--op] [--kind] [--since YYYY-MM-DD] [--json] [--no-git]`.

- [ ] **Step 1: Failing tests**

```js
import { filterJournal, gitCommits, formatTable } from './ledger.mjs';
import { execFileSync } from 'node:child_process';

test('filterJournal filters by story/op/kind/since', () => {
  const es = [
    { ts: '2026-08-29T00:00:00Z', story: 'US-001', op: 'Op-1', kind: 'decision', summary: 'a' },
    { ts: '2026-08-30T00:00:00Z', story: 'US-001', op: 'Op-2', kind: 'gate', summary: 'b' },
    { ts: '2026-08-30T00:00:00Z', story: 'US-002', op: null, kind: 'decision', summary: 'c' },
  ];
  assert.equal(filterJournal(es, { story: 'US-001' }).length, 2);
  assert.equal(filterJournal(es, { op: 'Op-2' })[0].summary, 'b');
  assert.equal(filterJournal(es, { kind: 'decision' }).length, 2);
  assert.equal(filterJournal(es, { since: '2026-08-30' }).length, 2);
});

test('gitCommits turns conventional commits with a US-NNN scope into commit entries', () => {
  const root = fixtureProject();
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  git('add', '.'); git('commit', '-qm', 'feat(US-001): implement Op-1 — thing');
  git('commit', '-q', '--allow-empty', '-m', 'chore: unrelated');
  const all = gitCommits(root, {});
  assert.equal(all.length, 2);
  const only = gitCommits(root, { story: 'US-001' });
  assert.equal(only.length, 1);
  assert.equal(only[0].kind, 'commit'); assert.equal(only[0].story, 'US-001');
  assert.match(only[0].sha, /^[0-9a-f]{7,}$/); assert.match(only[0].ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(only[0].summary, 'feat(US-001): implement Op-1 — thing');
});

test('formatTable renders one line per entry, sorted by ts', () => {
  const s = formatTable([
    { ts: '2026-08-30T10:00:00Z', story: 'US-001', op: 'Op-2', kind: 'gate', verdict: 'PASS', summary: 'b' },
    { ts: '2026-08-30T09:00:00Z', story: 'US-001', op: null, kind: 'decision', summary: 'a' },
  ]);
  const lines = s.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /09:00.*US-001.*decision.*a/);
  assert.match(lines[1], /10:00.*Op-2.*gate.*PASS.*b/);
});
```

- [ ] **Step 2: Run** → FAIL (`filterJournal is not exported`).

- [ ] **Step 3: Implement** (add to `ledger.mjs`, above `main`, and a `case 'journal'`):

```js
export function filterJournal(entries, f = {}) {
  return entries.filter((e) =>
    (!f.story || e.story === f.story) &&
    (!f.op || e.op === f.op) &&
    (!f.kind || e.kind === f.kind) &&
    (!f.since || e.ts >= new Date(f.since).toISOString()));
}

export function gitCommits(root, f = {}) {
  const r = spawnSync('git', ['log', '--format=%h%x1f%aI%x1f%s'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout.split('\n').filter(Boolean).map((line) => {
    const [sha, ts, summary] = line.split('\x1f');
    const story = summary.match(/^\w+\((US-\d{3})\)/)?.[1] ?? null;
    return { ts, story, op: null, stage: null, kind: 'commit', summary, sha, refs: [] };
  }).filter((e) => !f.story || e.story === f.story);
}

export function formatTable(entries) {
  const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  return [...entries].sort((a, b) => a.ts.localeCompare(b.ts)).map((e) =>
    `${e.ts.slice(0, 16).replace('T', ' ')}  ${pad(e.story, 6)} ${pad(e.op, 5)} ${pad(e.stage, 22)} ${pad(e.kind, 11)} ${pad(e.verdict ?? e.sha ?? e.backlog_id ?? '', 18)} ${e.summary}`)
    .join('\n') + '\n';
}
```

and in `main`:

```js
    case 'journal': {
      let entries = filterJournal(readJournal(specs), opts);
      if (!opts['no-git']) entries = entries.concat(filterJournal(gitCommits(dirname(specs), opts), opts));
      process.stdout.write(opts.json ? JSON.stringify(entries, null, 2) + '\n' : formatTable(entries));
      return 0;
    }
```

- [ ] **Step 4: Run** → all pass.
- [ ] **Step 5: Smoke on finfetch-web:** `cd /home/ttadmin/Codes/finfetch-web && node /home/ttadmin/Codes/claude-dev-skill/plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs journal --story US-008` → lists the US-008 commits (`test(US-008)`, `feat(US-008)`, `chore(US-008)` …).
- [ ] **Step 6: Commit** — `git commit -m "feat(dev-ledger): ledger journal — filtered view merged with git log"`

---

### Task 4: `ledger backlog add | list | resolve | wontfix`

**Files:**
- Modify: `ledger.mjs`; Test: `ledger.test.mjs`

**Interfaces:**
- Produces: `readBacklog(specs) → {next_id, items[]}`; `backlogAdd(specs, opts, now) → item` (also journals a `finding` with `backlog_id`); `backlogList(specs, {status, story, severity}) → item[]`; `backlogResolve(specs, id, {sha, resolution}, now) → item`; `backlogWontfix(specs, id, {reason}, now) → item`. Item shape exactly as spec §3.2.

- [ ] **Step 1: Failing tests**

```js
import { readBacklog, backlogAdd, backlogList, backlogResolve, backlogWontfix } from './ledger.mjs';

test('backlog add assigns BL-NNN ids, persists, and journals a finding', () => {
  const specs = join(fixtureProject(), 'specs');
  assert.deepEqual(readBacklog(specs), { next_id: 1, items: [] });
  const now = new Date('2026-08-30T12:00:00Z');
  const a = backlogAdd(specs, { title: 'Extract helper', severity: 'warning', kind: 'simplification', file: ['a.ts'], story: 'US-008', op: 'Op-1', stage: 'spec-implementation', gate: 'code-review', report: 'r.md', detail: 'd' }, now);
  assert.equal(a.id, 'BL-001'); assert.equal(a.status, 'open'); assert.equal(a.created_at, '2026-08-30');
  assert.deepEqual(a.source, { stage: 'spec-implementation', gate: 'code-review', story: 'US-008', op: 'Op-1', report: 'r.md' });
  assert.deepEqual(a.files, ['a.ts']); assert.equal(a.resolved_sha, null);
  const b = backlogAdd(specs, { title: 'Second', severity: 'info', kind: 'doc' }, now);
  assert.equal(b.id, 'BL-002');
  assert.equal(readBacklog(specs).next_id, 3);
  const j = readJournal(specs);
  assert.equal(j.length, 2); assert.equal(j[0].kind, 'finding'); assert.equal(j[0].backlog_id, 'BL-001');
  assert.equal(j[0].story, 'US-008');
});

test('backlog add validates severity and kind', () => {
  const specs = join(fixtureProject(), 'specs');
  assert.throws(() => backlogAdd(specs, { title: 't', severity: 'huge', kind: 'bug' }), /--severity/);
  assert.throws(() => backlogAdd(specs, { title: 't', severity: 'info', kind: 'vibe' }), /--kind/);
  assert.throws(() => backlogAdd(specs, { severity: 'info', kind: 'bug' }), /--title/);
});

test('backlog list filters; resolve and wontfix update status and journal an action', () => {
  const specs = join(fixtureProject(), 'specs');
  backlogAdd(specs, { title: 'a', severity: 'error', kind: 'bug', story: 'US-001' });
  backlogAdd(specs, { title: 'b', severity: 'info', kind: 'doc', story: 'US-002' });
  assert.equal(backlogList(specs, {}).length, 2);
  assert.equal(backlogList(specs, { story: 'US-001' })[0].title, 'a');
  assert.equal(backlogList(specs, { severity: 'info' })[0].id, 'BL-002');
  const r = backlogResolve(specs, 'BL-001', { sha: 'abc1234', resolution: 'fixed in shared helper' }, new Date('2026-09-01T00:00:00Z'));
  assert.equal(r.status, 'done'); assert.equal(r.resolved_sha, 'abc1234'); assert.equal(r.resolved_at, '2026-09-01');
  const w = backlogWontfix(specs, 'BL-002', { reason: 'not worth it' });
  assert.equal(w.status, 'wontfix'); assert.equal(w.resolution, 'not worth it');
  assert.equal(backlogList(specs, { status: 'open' }).length, 0);
  assert.throws(() => backlogResolve(specs, 'BL-999', { sha: 'x', resolution: 'y' }), /BL-999 not found/);
  const actions = readJournal(specs).filter((e) => e.kind === 'action');
  assert.equal(actions.length, 2); assert.equal(actions[0].backlog_id, 'BL-001');
});
```

- [ ] **Step 2: Run** → FAIL (not exported).

- [ ] **Step 3: Implement**

```js
function backlogPath(specs) { return join(specs, 'backlog.json'); }
export function readBacklog(specs) {
  return existsSync(backlogPath(specs)) ? JSON.parse(readFileSync(backlogPath(specs), 'utf8')) : { next_id: 1, items: [] };
}
function writeBacklog(specs, data) { writeFileSync(backlogPath(specs), JSON.stringify(data, null, 2) + '\n'); }
const day = (d) => d.toISOString().slice(0, 10);

export function backlogAdd(specs, opts, now = new Date()) {
  must(typeof opts.title === 'string' && opts.title, '--title is required');
  must(SEVERITIES.includes(opts.severity), `--severity must be one of ${SEVERITIES.join('|')}`);
  must(BACKLOG_KINDS.includes(opts.kind), `--kind must be one of ${BACKLOG_KINDS.join('|')}`);
  const ctx = autopilotContext(specs);
  const data = readBacklog(specs);
  const item = {
    id: `BL-${String(data.next_id).padStart(3, '0')}`,
    title: opts.title,
    detail: opts.detail ?? '',
    source: { stage: opts.stage ?? ctx.stage ?? null, gate: opts.gate ?? null, story: opts.story ?? ctx.story ?? null, op: opts.op ?? ctx.op ?? null, report: opts.report ?? null },
    severity: opts.severity, kind: opts.kind, files: opts.file ?? [],
    status: 'open', created_at: day(now), resolved_at: null, resolved_sha: null, resolution: null,
  };
  data.items.push(item); data.next_id += 1; writeBacklog(specs, data);
  log(specs, { kind: 'finding', summary: `${item.id}: ${item.title}`, story: item.source.story, op: item.source.op, stage: item.source.stage, ref: item.source.report ? [item.source.report] : [], 'backlog-id': item.id }, now);
  return item;
}

export function backlogList(specs, f = {}) {
  return readBacklog(specs).items.filter((i) =>
    (!f.status || i.status === f.status) && (!f.story || i.source.story === f.story) && (!f.severity || i.severity === f.severity));
}

function updateItem(specs, id, patch, summary, now) {
  const data = readBacklog(specs);
  const item = data.items.find((i) => i.id === id);
  must(item, `${id} not found`);
  Object.assign(item, patch); writeBacklog(specs, data);
  log(specs, { kind: 'action', summary, story: item.source.story, op: item.source.op, sha: patch.resolved_sha ?? null, 'backlog-id': id }, now);
  return item;
}
export function backlogResolve(specs, id, { sha, resolution }, now = new Date()) {
  must(sha && resolution, '--sha and --resolution are required');
  return updateItem(specs, id, { status: 'done', resolved_at: day(now), resolved_sha: sha, resolution }, `${id} resolved: ${resolution}`, now);
}
export function backlogWontfix(specs, id, { reason }, now = new Date()) {
  must(reason, '--reason is required');
  return updateItem(specs, id, { status: 'wontfix', resolved_at: day(now), resolution: reason }, `${id} wontfix: ${reason}`, now);
}

export function formatBacklog(items) {
  return items.map((i) => `${i.id}  ${i.status.padEnd(11)} ${i.severity.padEnd(7)} ${i.kind.padEnd(14)} ${(i.source.story ?? '').padEnd(6)} ${(i.source.op ?? '').padEnd(5)} ${i.title}`).join('\n') + (items.length ? '\n' : '');
}
```

and in `main`:

```js
    case 'backlog': {
      const [, sub, id] = opts._;
      if (sub === 'add') { const it = backlogAdd(specs, opts); process.stdout.write(it.id + '\n'); return 0; }
      if (sub === 'list' || sub === undefined) { const items = backlogList(specs, opts); process.stdout.write(opts.json ? JSON.stringify(items, null, 2) + '\n' : formatBacklog(items)); return 0; }
      if (sub === 'resolve') { process.stdout.write(JSON.stringify(backlogResolve(specs, id, opts)) + '\n'); return 0; }
      if (sub === 'wontfix') { process.stdout.write(JSON.stringify(backlogWontfix(specs, id, opts)) + '\n'); return 0; }
      process.stderr.write('usage: ledger backlog <add|list|resolve BL-NNN|wontfix BL-NNN>\n'); return 2;
    }
```

- [ ] **Step 4: Run** → all pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(dev-ledger): backlog add/list/resolve/wontfix with BL-NNN ids"`

---

### Task 5: `ledger failures` parsers and `ledger regress`

**Files:**
- Create: `scripts/fixtures/vitest.json`, `scripts/fixtures/cucumber.json`
- Modify: `ledger.mjs`; Test: `ledger.test.mjs`

**Interfaces:**
- Produces: `failuresFromVitest(json, root) → string[]` (ids `path/from/root::fullName`, sorted); `failuresFromCucumber(json, root) → string[]` (`uri::scenario name`; failed = any step status ∈ {failed, undefined, ambiguous, pending}); `failuresFromLines(text) → string[]`; `regress({root, base, cmd, runner, reportFile?}) → {base: string[], head: string[], regressions: string[]}`; CLI `failures --runner vitest|cucumber|lines [--report-file f]` (reads stdin or the file) and `regress --base <sha> --cmd "<shell>" --runner <r> [--report-file f] [--json]` (exit 1 when regressions exist).

- [ ] **Step 1: Fixtures**

`fixtures/vitest.json` (shape of `vitest run --reporter=json`):

```json
{"numTotalTests":3,"testResults":[
 {"name":"/repo/src/a.test.ts","status":"failed","assertionResults":[
   {"fullName":"@US-001 @Op-1 does x","status":"passed"},
   {"fullName":"@US-001 @Op-2 does y","status":"failed"}]},
 {"name":"/repo/tests/unit/b.test.ts","status":"failed","assertionResults":[
   {"fullName":"parses z","status":"failed"}]}]}
```

`fixtures/cucumber.json` (shape of `cucumber-js --format json`):

```json
[{"uri":"specs/story-001-x/features/F-001.feature","name":"F-001","elements":[
  {"type":"scenario","name":"Happy path","steps":[{"result":{"status":"passed"}},{"result":{"status":"passed"}}]},
  {"type":"scenario","name":"Sad path","steps":[{"result":{"status":"passed"}},{"result":{"status":"failed"}}]},
  {"type":"scenario","name":"Undefined path","steps":[{"result":{"status":"undefined"}}]},
  {"type":"background","name":"","steps":[{"result":{"status":"passed"}}]}]}]
```

- [ ] **Step 2: Failing tests**

```js
import { failuresFromVitest, failuresFromCucumber, failuresFromLines, regress } from './ledger.mjs';
const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('failuresFromVitest lists failed assertions as root-relative ids, sorted', () => {
  assert.deepEqual(failuresFromVitest(fx('vitest.json'), '/repo'),
    ['src/a.test.ts::@US-001 @Op-2 does y', 'tests/unit/b.test.ts::parses z']);
});

test('failuresFromCucumber lists scenarios with any failed/undefined step; skips backgrounds', () => {
  assert.deepEqual(failuresFromCucumber(fx('cucumber.json'), '/repo'),
    ['specs/story-001-x/features/F-001.feature::Sad path', 'specs/story-001-x/features/F-001.feature::Undefined path']);
});

test('failuresFromLines trims, drops blanks, sorts', () => {
  assert.deepEqual(failuresFromLines(' b \n\na\n'), ['a', 'b']);
});

test('regress diffs failures of the working tree against a base sha via a worktree', () => {
  const root = fixtureProject();
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  writeFileSync(join(root, 'failures.txt'), 'a\nb\n');
  git('add', '.'); git('commit', '-qm', 'base');
  writeFileSync(join(root, 'failures.txt'), 'a\nc\n');            // working tree: b fixed, c new
  const r = regress({ root, base: 'HEAD', cmd: 'cat failures.txt', runner: 'lines' });
  assert.deepEqual(r.base, ['a', 'b']); assert.deepEqual(r.head, ['a', 'c']); assert.deepEqual(r.regressions, ['c']);
  assert.equal(git('worktree', 'list').split('\n').length, 1);   // temp worktree removed
});

test('regress reads a report file when --report-file is given', () => {
  const root = fixtureProject();
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  writeFileSync(join(root, 'gen.sh'), 'printf "x\\n" > out.txt');
  git('add', '.'); git('commit', '-qm', 'base');
  writeFileSync(join(root, 'gen.sh'), 'printf "x\\ny\\n" > out.txt');
  const r = regress({ root, base: 'HEAD', cmd: 'sh gen.sh', runner: 'lines', reportFile: 'out.txt' });
  assert.deepEqual(r.regressions, ['y']);
});
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Implement**

```js
const rel = (p, root) => (root && p.startsWith(root + '/')) ? p.slice(root.length + 1) : p;

export function failuresFromVitest(json, root) {
  const r = JSON.parse(json); const out = [];
  for (const f of r.testResults ?? []) for (const a of f.assertionResults ?? [])
    if (a.status === 'failed') out.push(`${rel(f.name, root)}::${a.fullName}`);
  return out.sort();
}
const BAD_STEP = new Set(['failed', 'undefined', 'ambiguous', 'pending']);
export function failuresFromCucumber(json, root) {
  const out = [];
  for (const feat of JSON.parse(json)) for (const el of feat.elements ?? []) {
    if (el.type !== 'scenario') continue;
    if ((el.steps ?? []).some((s) => BAD_STEP.has(s.result?.status))) out.push(`${rel(feat.uri, root)}::${el.name}`);
  }
  return out.sort();
}
export function failuresFromLines(text) { return text.split('\n').map((l) => l.trim()).filter(Boolean).sort(); }
const PARSERS = { vitest: failuresFromVitest, cucumber: failuresFromCucumber, lines: (t) => failuresFromLines(t) };

function runFailures(cwd, cmd, runner, reportFile) {
  must(PARSERS[runner], `--runner must be one of ${Object.keys(PARSERS).join('|')}`);
  const r = spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  const text = reportFile ? readFileSync(join(cwd, reportFile), 'utf8') : r.stdout;
  return PARSERS[runner](text, cwd);
}

export function regress({ root, base, cmd, runner, reportFile }) {
  must(base && cmd, '--base and --cmd are required');
  const head = runFailures(root, cmd, runner, reportFile);
  const wt = mkdtempSync(join(tmpdir(), 'ledger-regress-'));
  execFileSync('git', ['worktree', 'add', '--detach', '-f', wt, base], { cwd: root, stdio: 'ignore' });
  try {
    if (existsSync(join(root, 'node_modules')) && !existsSync(join(wt, 'node_modules')))
      symlinkSync(join(root, 'node_modules'), join(wt, 'node_modules'), 'dir');
    const baseFailures = runFailures(wt, cmd, runner, reportFile);
    const baseSet = new Set(baseFailures);
    return { base: baseFailures, head, regressions: head.filter((id) => !baseSet.has(id)) };
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: root, stdio: 'ignore' });
  }
}
```

`main` cases:

```js
    case 'failures': {
      const text = opts['report-file'] ? readFileSync(opts['report-file'], 'utf8') : readFileSync(0, 'utf8');
      must(PARSERS[opts.runner], `--runner must be one of ${Object.keys(PARSERS).join('|')}`);
      process.stdout.write(PARSERS[opts.runner](text, process.cwd()).join('\n') + '\n'); return 0;
    }
    case 'regress': {
      const r = regress({ root: dirname(specs), base: opts.base, cmd: opts.cmd, runner: opts.runner, reportFile: opts['report-file'] });
      if (opts.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      else process.stdout.write(`base failures: ${r.base.length}\nhead failures: ${r.head.length}\nregressions:  ${r.regressions.length}\n${r.regressions.map((x) => '  ' + x).join('\n')}${r.regressions.length ? '\n' : ''}`);
      return r.regressions.length ? 1 : 0;
    }
```

- [ ] **Step 5: Run** → all pass (`node --test ledger.test.mjs`).

- [ ] **Step 6: Real-world smoke on finfetch-web (the suite is permanently red there — exactly the case this exists for)**

```bash
cd /home/ttadmin/Codes/finfetch-web
L=/home/ttadmin/Codes/claude-dev-skill/plugins/dev-ledger/skills/dev-ledger/scripts/ledger.mjs
node $L regress --base HEAD --runner vitest --cmd "npx vitest run --reporter=json --outputFile=.vitest-report.json" --report-file .vitest-report.json
```

Expected: `base failures: N`, `head failures: N`, `regressions: 0`, exit 0 (working tree vs HEAD on the same code). Then `rm -f .vitest-report.json` and add `.vitest-report.json` to nothing — the command is only a smoke; the skills will use a report file under `/tmp` (see contract §4).

- [ ] **Step 7: Commit** — `git commit -m "feat(dev-ledger): failures parsers (vitest, cucumber, lines) and regress worktree diff"`

---

### Task 6: The canonical `autopilot-contract.md` + `scripts/sync-contract.sh` + CI identity check

**Files:**
- Create: `plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md`
- Create: `scripts/sync-contract.sh`
- Modify: `scripts/validate.sh` (new section 5)
- Create (by sync): `plugins/<11 pipeline>/skills/<name>/references/autopilot-contract.md`

**Interfaces:**
- Produces: the contract text every SKILL.md references as `references/autopilot-contract.md` (§1 activation, §2 rules, §3 journaling, §4 toolchain, §5 locating the ledger). `PIPELINE_PLUGINS` list in `scripts/_lib.sh`.

- [ ] **Step 1: Write the contract** (full text — this is the deliverable):

````markdown
# Pipeline contract: AUTOPILOT, journaling, toolchain

This file is identical in every pipeline plugin (`scripts/sync-contract.sh` keeps it so; CI checks it). Skills reference it instead of restating the rules. Sections 3–5 apply **always**; sections 1–2 apply only while autopilot is active.

## 1. Activation

Autopilot is active when `specs/autopilot.json` exists with `"active": true`, or the environment variable `AUTOPILOT=1` is set. Check this in Pre-Flight, once per invocation.

```json
{ "active": true, "run_id": "run-2026-08-30T15:00:00Z", "target": "US-000", "until": "US-000",
  "stop_policy": "hard-failures+story-end",
  "current": { "story": "US-000", "stage": "spec-implementation", "op": "Op-2", "agent": "agent-7f3a", "started_at": "…" },
  "started_at": "…", "stopped_at": null, "stop_reason": null }
```

## 2. Rules while active

1. **Never call `AskUserQuestion`.** Wherever this skill would ask, take the option marked *(Recommended)*; if none is marked, take the first option. Journal the choice: `ledger log --kind decision --summary "<question> → <option taken>"`.
2. **Warnings never stop the run.** A verifier verdict `PASS_WITH_WARNINGS` → file every warning with `ledger backlog add` (severity `warning`, the verifier's report as `--report`) and continue. Self-review checklist items that fail and are not fixed in place → `ledger backlog add` likewise.
3. **Hard stops.** Write `stop_reason` into `specs/autopilot.json`, journal `--kind stop`, print the reason, and end the invocation with `<promise>AUTOPILOT_STOP_<reason></promise>`:
   - `verifier_fail` — any verifier verdict `FAIL`;
   - `op_blocked` — an Operation still `blocked` after 2 retries;
   - `regression` — `ledger regress` reports a regression in a story already `verified`;
   - `spec_contradiction` — the spec cannot be satisfied as written (V&V "flag only" case; INVEST letter failing in `/spec-writing`);
   - `tooling_not_ready` — `/test-setup`'s toolchain gate fails;
   - `split_required` — a story needs splitting (INVEST `S`, or > 6 Operations).
4. **Sentinels stay.** Emit this skill's existing `<promise>…COMPLETE…</promise>` on success exactly as documented in the skill.
5. **Retries are explicit.** Log every retry (`--kind action --summary "retry N/2: <what>"`).

## 3. Journaling (always, autopilot or not)

`specs/journal.jsonl` is the audit trail. Append with the ledger CLI (§5); never edit the file.

| When | Call |
| --- | --- |
| A choice the plan/spec did not force (a skipped phase, an interpretation, an alternative taken) | `ledger log --kind decision --summary "…" [--ref path]` |
| A self-review checklist result | `ledger log --kind gate --gate self-review --verdict PASS\|PASS_WITH_WARNINGS\|FAIL --summary "N/M checks"` |
| A verifier / story-end gate / V&V verdict | `ledger log --kind gate --gate <invest\|spec-verification\|plan-verification\|red-audit\|green-audit\|simplify\|code-review\|verify\|v-and-v> --verdict … --report <path> --summary "…"` |
| A finding not fixed in place | `ledger backlog add --title "…" --severity info\|warning\|error --kind bug\|simplification\|refactor\|test-gap\|spec-gap\|doc\|perf\|security [--file p]… [--report path] [--detail "…"]` (journals the `finding` itself) |
| A commit made by this skill | `ledger log --kind commit --sha $(git rev-parse --short HEAD) --summary "<subject>"` |
| An Op or stage retried / blocked | `ledger log --kind action --summary "…"` |

`--story`, `--op`, `--stage` default from `specs/autopilot.json.current` when active; pass them explicitly otherwise. Keep `state.json.decisions[]` writes where the skill already makes them — they are the per-story view; the journal is the project view.

## 4. Toolchain resolution (always)

Skills write commands as placeholders. Resolve them once per invocation from the project's `package.json`:

| Placeholder | `package.json` script | Required by |
| --- | --- | --- |
| `<TEST>` | `test` | every skill that runs unit/integration tests |
| `<BDD>` | `bdd` | every skill that runs Gherkin |
| `<LINT>` | `lint` | story-end gates, V&V (skip with a journaled decision if absent) |
| `<TYPES>` | `typecheck` | same |
| `<DEV>` | `dev` | V&V |
| `<E2E>` | `e2e` | V&V (optional) |

Run through the package manager the lockfile implies: `bun.lock`/`bun.lockb` → `bun run <script>`, `pnpm-lock.yaml` → `pnpm <script>`, `yarn.lock` → `yarn <script>`, otherwise `npm run <script> --`. Extra args go after `--` for npm.

**Op filtering.** Never edit `specs/**/*.feature` to add tags.
- BDD: if the story's feature files already carry `@Op-X` tags → `<BDD> --tags "@US-NNN and @Op-X"`. Otherwise select by name from the Operation's `Covers scenarios:` line in PLAN.md: `<BDD> --name "^(<scenario 1>|<scenario 2>)$"` (regex-escape the names).
- Unit/integration: tests are named `@US-NNN @Op-X …` by `/test-setup`, so `<TEST> -t "@US-NNN.*@Op-X"` (Vitest/Jest `-t`); story-wide: `-t "@US-NNN"`.
- `manual` Test Plan rows are never run by `<TEST>`/`<BDD>`; only `/verification-and-validation` walks them.

**Regression baseline.** The unfiltered suite may be permanently red (RED scaffolds of unstarted stories). "No regression" therefore means: no test fails in the working tree that passed at the base commit. Compute it, never eyeball it:

```bash
node "$LEDGER" regress --base <sha> --runner vitest   --cmd "<TEST> --reporter=json --outputFile=/tmp/ledger-vitest.json" --report-file /tmp/ledger-vitest.json
node "$LEDGER" regress --base <sha> --runner cucumber --cmd "<BDD> --format json:/tmp/ledger-bdd.json"                    --report-file /tmp/ledger-bdd.json
```

`<sha>` is `HEAD` before committing an Op's GREEN (working tree vs last commit), or the story's `BASE_SHA` (parent of its first `test(US-NNN):` commit) at story-end. Exit code 1 = regressions; each id is printed.

## 5. Locating the ledger

```bash
LEDGER="$(find "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
node "$LEDGER" <command> …
```

If `LEDGER` is empty, the `dev-ledger` plugin is not installed: print `Install dev-ledger: /plugin install dev-ledger@claude-dev-skill` and, under autopilot, hard-stop with reason `tooling_not_ready`.
````

- [ ] **Step 2: Add the plugin list and the sync script**

Append to `scripts/_lib.sh`:

```bash
# Plugins that carry a verbatim copy of the pipeline contract.
PIPELINE_PLUGINS=(spec-writing spec-writing-verification ui-specs plan-writing plan-writing-verification test-setup test-setup-verification spec-implementation spec-implementation-verification verification-and-validation repo-initialization)
CONTRACT_CANONICAL="plugins/dev-ledger/skills/dev-ledger/references/autopilot-contract.md"
```

Create `scripts/sync-contract.sh`:

```bash
#!/usr/bin/env bash
# Copy the canonical pipeline contract into every pipeline plugin. Idempotent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
SRC="$ROOT/$CONTRACT_CANONICAL"
[ -f "$SRC" ] || die "canonical contract missing: $SRC"
for name in "${PIPELINE_PLUGINS[@]}"; do
  dest="$ROOT/plugins/$name/skills/$name/references/autopilot-contract.md"
  mkdir -p "$(dirname "$dest")"
  cp "$SRC" "$dest"
  ok "$name"
done
```

`chmod +x scripts/sync-contract.sh && scripts/sync-contract.sh`.

- [ ] **Step 3: CI identity check** — in `scripts/validate.sh` before the final `echo ""`:

```bash
# 5. Pipeline contract copies are byte-identical to the canonical one
canon_sum="$(sha256sum "$ROOT/$CONTRACT_CANONICAL" | cut -d' ' -f1)"
for name in "${PIPELINE_PLUGINS[@]}"; do
  copy="$ROOT/plugins/$name/skills/$name/references/autopilot-contract.md"
  [ -f "$copy" ] || { fail "$name: missing references/autopilot-contract.md (run scripts/sync-contract.sh)"; continue; }
  [ "$(sha256sum "$copy" | cut -d' ' -f1)" = "$canon_sum" ] || fail "$name: autopilot-contract.md differs from canonical (run scripts/sync-contract.sh)"
  grep -q "autopilot-contract.md" "$ROOT/plugins/$name/skills/$name/SKILL.md" || fail "$name: SKILL.md does not reference references/autopilot-contract.md"
done
```

- [ ] **Step 4: Run** `scripts/validate.sh` → expect 11 failures of the form `SKILL.md does not reference references/autopilot-contract.md` (fixed by Tasks 9–14) and zero "differs"/"missing" failures.
- [ ] **Step 5: Commit** — `git commit -m "feat(dev-ledger): canonical pipeline contract; sync-contract.sh; CI identity check"`

---

### Task 7: `dev-ledger` SKILL.md and README

**Files:**
- Modify: `plugins/dev-ledger/skills/dev-ledger/SKILL.md`, `plugins/dev-ledger/README.md`

- [ ] **Step 1: Write SKILL.md**

````markdown
---
name: dev-ledger
version: 0.1.0
description: Journal + backlog + regression CLI for story-based projects. `/dev-ledger` prints the project journal (specs/journal.jsonl merged with git log); `/dev-ledger US-008` filters one story. Other pipeline skills call the bundled `scripts/ledger.mjs` to record decisions, gate results and findings, to file backlog items (BL-NNN), and to compute a regression baseline. Triggers on "show the journal", "what happened on US-008", "what did autopilot decide", "/dev-ledger".
---

# dev-ledger

The audit trail of the story-based pipeline. Two tracker files, one CLI, no dependencies.

| File | Written by | Shape |
| --- | --- | --- |
| `specs/journal.jsonl` | `ledger log`, `ledger backlog *` | one JSON object per line, append-only |
| `specs/backlog.json` | `ledger backlog *` | `{ next_id, items[] }` — see `/backlog` |

The rules for *when* skills log are in `references/autopilot-contract.md` §3 (canonical copy lives here). The CLI:

```bash
LEDGER="$(find "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
node "$LEDGER" log      --kind decision|action|gate|finding|commit|stage_start|stage_end|stop --summary "…" [--story US-NNN] [--op Op-X] [--stage s] [--ref p]… [--sha h] [--gate g --verdict PASS|PASS_WITH_WARNINGS|FAIL --report p]
node "$LEDGER" journal  [--story US-NNN] [--op Op-X] [--kind k] [--since YYYY-MM-DD] [--json] [--no-git]
node "$LEDGER" backlog  add --title "…" --severity info|warning|error --kind bug|simplification|refactor|test-gap|spec-gap|doc|perf|security [--file p]… [--report p] [--detail "…"]
node "$LEDGER" backlog  list [--status open|in-progress|done|wontfix] [--story US-NNN] [--severity s] [--json]
node "$LEDGER" backlog  resolve BL-NNN --sha <sha> --resolution "…"
node "$LEDGER" backlog  wontfix BL-NNN --reason "…"
node "$LEDGER" failures --runner vitest|cucumber|lines [--report-file p]      # stdin → sorted failing test ids
node "$LEDGER" regress  --base <sha> --cmd "<shell>" --runner vitest|cucumber|lines [--report-file p] [--json]   # exit 1 on regressions
```

`--specs <dir>` (or `LEDGER_SPECS`) overrides the `specs/` lookup, which otherwise walks up from the cwd to the directory holding `specs/stories.json`.

## `/dev-ledger [US-NNN] [--since date] [--kind k]`

1. Locate the ledger (snippet above). If not found, print the install command and stop.
2. Run `node "$LEDGER" journal` with the given filters and print the table verbatim.
3. Below it, print `node "$LEDGER" backlog list --status open` filtered to the same story (if any).

No files are written by this skill.
````

- [ ] **Step 2: README.md** — replace the scaffold's README with: purpose (two paragraphs from the SKILL.md intro), the CLI table, the tracker file shapes (copy the JSON examples from spec §3.1 and §3.2), and "Tests: `node --test skills/dev-ledger/scripts/ledger.test.mjs`".
- [ ] **Step 3:** `scripts/validate.sh` → `dev-ledger` line ok. Commit `docs(dev-ledger): SKILL.md and README`.

---

### Task 8: `/backlog` skill

**Files:**
- Modify: `plugins/dev-ledger/skills/backlog/SKILL.md`

- [ ] **Step 1: Write the body**

````markdown
---
name: backlog
version: 0.1.0
description: Lists open backlog items (BL-NNN) filed by the pipeline's verifiers and gates, or implements one by id with a minimal RED → GREEN → REFACTOR cycle and resolves it. Triggers on "/backlog", "/backlog BL-012", "implement BL-012", "what's in the backlog", "close BL-012 as wontfix".
---

# backlog

Items land here from `*-verification` audits, story-end gates and V&V — findings that were proposed but not applied at the time. Each is retrievable by id, so you can come back later and say `/backlog BL-012`.

Follows `../dev-ledger/references/autopilot-contract.md` (§3 journaling, §4 toolchain, §5 locating the ledger); under autopilot (§1–2) it never asks.

## `/backlog` — list

1. `node "$LEDGER" backlog list --status open` (add `--story US-NNN` if given). Print the table grouped by story, `error` first.
2. For each item print its id, title, severity/kind, source (`stage`/`gate`, story/op) and files. Nothing else.

## `/backlog BL-NNN` — implement one item

1. Read the item (`node "$LEDGER" backlog list --json`, pick the id) and its `source.report` if set. Set `status` to `in-progress` by editing `specs/backlog.json` in place (only that field), journal `--kind action --summary "BL-NNN started"`.
2. **Reproduce first when it is a bug** (`kind = bug`, `test-gap`): write the failing test at the file the item names (or the story's existing test file), run it with the Op filter from §4, confirm it fails at assertion time.
3. **Fix with the ponytail ladder**, stopping at the first rung that holds: delete instead of add → reuse a helper already in the repo → stdlib → native platform feature → an installed dependency → one line → minimum code. No new dependency. No abstraction with one caller.
4. Run the story's suite (`<TEST> -t "@US-NNN"`, `<BDD>` story filter) and `node "$LEDGER" regress --base HEAD …` per §4. Both clean.
5. Commit `fix(US-NNN): BL-NNN — <title>` (or `refactor`/`test`/`docs` by `kind`), journal `--kind commit`.
6. `node "$LEDGER" backlog resolve BL-NNN --sha $(git rev-parse --short HEAD) --resolution "<one line>"`.
7. If the item cannot be done without an architecture change, stop: set it back to `open`, journal a decision saying why, and (outside autopilot) tell the user to run `/research-and-architecture` for an ADR.

## `/backlog BL-NNN --wontfix "reason"`

`node "$LEDGER" backlog wontfix BL-NNN --reason "…"`. Nothing else.

## Self-review (mandatory, print as a checked list)

- [ ] For bugs: a test failed before the fix and passes after
- [ ] The story suite and `ledger regress` are clean
- [ ] Exactly one item changed status; the journal has the `action`, `commit` and resolution entries
````

- [ ] **Step 2:** `scripts/validate.sh` passes for dev-ledger; `scripts/install-local.sh dev-ledger` symlinks both `dev-ledger` and `backlog`. Commit `feat(dev-ledger): /backlog skill`.

---

### Task 9: `plan-writing` — `manual` test type, toolchain placeholders, contract

**Files:**
- Modify: `plugins/plan-writing/skills/plan-writing/SKILL.md` (Pre-Flight table; Phase 4; Phase 7)
- Modify: `plugins/plan-writing/skills/plan-writing/references/plan-template.md:100,147-149,416-419`

- [ ] **Step 1: Pre-Flight row** — append to the Pre-Flight table:

```markdown
| `specs/autopilot.json` has `"active": true` (or env `AUTOPILOT=1`) | Follow `references/autopilot-contract.md` §1–2 for this whole invocation: no `AskUserQuestion`, take the *(Recommended)* option, journal decisions and gates, stop only on the contract's hard conditions. Journaling (§3) and toolchain resolution (§4) apply regardless. |
```

- [ ] **Step 2: Phase 4 (Test Plan)** — after the sentence "Every Gherkin scenario gets at least one BDD row…", add:

```markdown
**`manual` rows.** A row may be typed `manual` only when its Asserts column references something outside the repository — a remote host, a network path, a human observation (e.g. "the container port is refused from any host but dc2"). `manual` rows are skipped by `/test-setup` and `/spec-implementation` and are walked by `/verification-and-validation`, which records each outcome in `verification/qa-report.md`. Their `File` column is `specs/story-NNN-slug/verification/qa-report.md`. A row that *can* be automated in-repo must not be `manual`; a whole story of `manual` rows is a signal the story is an ops runbook, not software — say so in the report.
```

- [ ] **Step 3: Phase 7** — after the self-review list add: `Journal the self-review: \`node "$LEDGER" log --kind gate --gate self-review --verdict <PASS|PASS_WITH_WARNINGS> --story US-NNN --stage plan-writing --summary "<n>/6 checks"\` (contract §3, §5). Any unchecked item not fixed → \`ledger backlog add\`.` And in the `AskUserQuestion` block prefix: `Outside autopilot, use \`AskUserQuestion\`:`.
- [ ] **Step 4: plan-template.md** — line 100: `` `bun test && bun bdd` still PASS `` → `` `<TEST>` and `<BDD>` (contract §4) still PASS ``. Test Plan table header comment: change the `Type` legend sentence to `Type ∈ BDD | unit | integration | bench | manual`. Lines 416–419 (Verification): replace `bun test`/`bun bdd`/`bun lint && bun typecheck`/`bun dev` with `<TEST>`/`<BDD>`/`<LINT> && <TYPES>`/`<DEV>` and add step `Walk every \`manual\` Test Plan row; record each in qa-report.md`.
- [ ] **Step 5:** `scripts/bump.sh plan-writing minor` → 2.3.0; fill CHANGELOG: `- `manual` Test Plan type for out-of-repo assertions; toolchain placeholders; pipeline contract (autopilot, journaling).`
- [ ] **Step 6:** `scripts/validate.sh` → plan-writing no longer listed as missing reference. Commit `feat(plan-writing): manual test type, toolchain placeholders, pipeline contract`.

---

### Task 10: `test-setup` — toolchain, no feature-file edits, manual rows, cursor rule, contract, journaling

**Files:**
- Modify: `plugins/test-setup/skills/test-setup/SKILL.md`
- Modify: `plugins/test-setup/skills/test-setup/references/state-schema.md:39,168,232,255`

- [ ] **Step 1: Pre-Flight row** (same row text as Task 9 Step 1).
- [ ] **Step 2: Resolving the target Operation** — replace `Pick the first Op where operation_phase ∈ {pending, red_a}.` with `Pick the first Op where operation_phase ∉ {red, green, refactored} (i.e. the cursor rule: current_operation = first Op not yet RED-complete for this skill; the shared rule across skills is "first Op not yet GREEN").`
- [ ] **Step 3: Phase 1** — add: `Rows typed \`manual\` are not written. Record each as \`test_plan_rows[T-N] = { type: "manual", op: "Op-X", file: <qa-report path>, written: false, passing: false }\`. If every row of Op-X is manual, skip Phases 2–4, set \`Op-X.tests_status = "manual"\`, and treat Op-X as RED in Phase 5; journal the decision.`
- [ ] **Step 4: Phase 2** — replace the paragraph starting `**Tag each scenario with `@US-NNN @Op-X`.**` with:

```markdown
**Never edit `specs/**/*.feature`.** Select this Operation's scenarios per `references/autopilot-contract.md` §4: by `@Op-X` tag if the feature files already carry one, otherwise by scenario name from the Operation's `Covers scenarios:` line.
```

Replace `` Run `bun bdd --tags="@US-NNN and @Op-X"`. `` with `` Run `<BDD>` with the Op filter (§4). `` After the commit block add: `` Journal: `node "$LEDGER" log --kind commit --sha $(git rev-parse --short HEAD) --summary "test(US-NNN): add BDD steps for Op-X"`. ``
- [ ] **Step 5: Phase 3** — replace `` The runner filter `bun test --grep="@US-NNN.*@Op-X"` `` with `` The runner filter `<TEST> -t "@US-NNN.*@Op-X"` (§4) `` and `` Run `bun test --grep="@US-NNN.*@Op-X"`. `` with `` Run `<TEST> -t "@US-NNN.*@Op-X"`. `` Add the same journal-commit line.
- [ ] **Step 6: Phase 5** — replace the two `bun` bullets with `` - `<BDD>` Op filter → every scenario FAIL at assertion time. `` / `` - `<TEST> -t "@US-NNN.*@Op-X"` → every test FAIL at assertion time. `` Add: `A test that passes in RED *by nature* (it pins an external tool's semantics and no repo file can make it fail) is allowed if journaled as a decision naming the test.` Replace the cursor bullet with `` - Advance `current_operation` to the first Op whose `operation_phase ∉ {green, refactored}` (the shared cursor rule), or `null` if every Op is GREEN. ``
- [ ] **Step 7: Phase 7** — after the self-review list: journal the gate (same line pattern as Task 9 Step 3 with `--stage test-setup --op Op-X`); prefix the AskUserQuestion with `Outside autopilot,`; replace the `If running in a ralph-loop…` sentence with `Under autopilot (contract §2), skip the question and emit \`<promise>RED_COMPLETE_US-NNN_Op-X</promise>\`; if every Op is now RED also emit \`<promise>TEST_SETUP_COMPLETE_US-NNN</promise>\`.`
- [ ] **Step 8: Decision Rules** — replace the `### Inside a ralph-loop` and `### Outside the loop` sections with one section `### Asking vs deciding` → `See \`references/autopilot-contract.md\` §2. Outside autopilot, use \`AskUserQuestion\` when a Gherkin scenario is ambiguous about what to assert, or when a Test Plan row's file path or assertion is unclear. Under autopilot, take the reading closest to the scenario text and journal it.`
- [ ] **Step 9: Commit Rules** — delete `NEVER add a \`Co-Authored-By\` trailer.` Also delete the `TOOLING_NOT_READY` prose's implicit "stop" and add `Under autopilot this is hard stop \`tooling_not_ready\` (contract §2).`
- [ ] **Step 10: state-schema.md** — line 39 comment → `pending | in_progress | red | manual`; line 168 → `tests_status: pending → in_progress → red (or manual when every row is manual)`; line 232 already states the correct cursor rule — leave; line 255 append `; rows typed manual are recorded but never written`. Add to the `test_plan_rows` example one row `"T-07": { "type": "manual", "op": "Op-4", "file": "specs/story-NNN-slug/verification/qa-report.md", "written": false, "passing": false }`.
- [ ] **Step 11:** `scripts/bump.sh test-setup minor` → 3.2.0; CHANGELOG: `- Toolchain placeholders from package.json (no more hardcoded bun); Op selection by scenario name, never editing feature files; manual Test Plan rows; unified cursor rule; pipeline contract + journaling; Co-Authored-By rule removed.`
- [ ] **Step 12:** `grep -n "bun " plugins/test-setup/skills/test-setup/SKILL.md` → no matches. `scripts/validate.sh` ok. Commit `feat(test-setup): unattended-mode fixes and pipeline contract`.

---

### Task 11: `spec-implementation` — toolchain, cursor, slim Gate 3, regress, contract, journaling

**Files:**
- Modify: `plugins/spec-implementation/skills/spec-implementation/SKILL.md`
- Modify: `plugins/spec-implementation/skills/spec-implementation/references/state-schema.md` (verification_results keys)

- [ ] **Step 1: Pre-Flight row** (Task 9 Step 1 text).
- [ ] **Step 2: Picker** — `If any op.operation_phase = red AND implementation_status ≠ green:` → `If any op.operation_phase = red (or tests_status = "manual" and implementation_status ≠ green):`. Add after the picker: `The cursor rule is shared: \`current_operation\` = first Op whose \`operation_phase ∉ {green, refactored}\`; \`null\` only when every Op is GREEN.`
- [ ] **Step 3: Phase 1** — the two `bun` bullets → `` - `<BDD>` with the Op filter (contract §4) `` / `` - `<TEST> -t "@US-NNN.*@Op-X"` ``. Add: `Ops whose rows are all \`manual\` have nothing to run here; proceed to GREEN (the deliverable is the artefact the manual rows describe).`
- [ ] **Step 4: Phase 2** — the "After writing the code, run:" bullets become:

```markdown
- `<TEST> -t "@US-NNN"` and `<BDD>` (story filter) — Op-X's tests pass; earlier Ops' tests still pass.
- Regression baseline (contract §4): `node "$LEDGER" regress --base HEAD --runner vitest --cmd "<TEST> --reporter=json --outputFile=/tmp/ledger-vitest.json" --report-file /tmp/ledger-vitest.json` and the cucumber equivalent. Exit 0 required. A regression in a story already `verified` is hard stop `regression` under autopilot; otherwise back out and re-think.
```

After the commit block: journal the commit (contract §3).
- [ ] **Step 5: Phase 3** — `bun test --grep=…`/`bun bdd --tags=…` → `<TEST> -t "@US-NNN"` / `<BDD>` story filter; journal the refactor commit.
- [ ] **Step 6: Phase 4** — cursor bullet → `` - Advance `current_operation` to the first Op whose `operation_phase ∉ {green, refactored}`, or `null` if every Op is now GREEN. `` Add: `` - `test_plan_rows[T-N].passing = true` only for rows whose `type ≠ "manual"`. ``
- [ ] **Step 7: Phase 5** — journal the self-review gate; `Outside autopilot, use AskUserQuestion`; replace the ralph-loop sentence with the autopilot equivalent (`GREEN_COMPLETE_US-NNN_Op-X`, `STORY_OPS_COMPLETE_US-NNN`).
- [ ] **Step 8: When an Operation Fails** — step 3 → `Journal \`--kind action --summary "Op-X blocked: <error>"\`. Outside autopilot ask the user; under autopilot retry once from Phase 1 (journal \`retry 1/2\`), then a second time (\`retry 2/2\`); still failing → hard stop \`op_blocked\` (contract §2).`
- [ ] **Step 9: Gate 1** — `git diff --name-only $BASE_SHA..HEAD` kept; `bun test --grep…` → `<TEST> -t "@US-NNN"` + `<BDD>`; add `Journal the gate: \`ledger log --kind gate --gate simplify --verdict PASS --summary "<n> files simplified"\`. Every simplification deliberately not applied → \`ledger backlog add --kind simplification --severity info\`.`
- [ ] **Step 10: Gate 2** — after "Act on critical findings; warnings are at the user's discretion." → `Act on critical findings. Every warning not acted on → \`ledger backlog add --kind <bug|refactor|…> --severity warning --gate code-review --report <path>\`; persist the ids in \`state.json.quality_gates.review_findings[]\`. Journal the gate verdict.`
- [ ] **Step 11: Gate 3** — replace the 8-step list with:

```markdown
1. `<TEST>` — unit + integration (story + previously verified stories) — evaluated through `node "$LEDGER" regress --base $BASE_SHA …` (contract §4): zero regressions.
2. `<BDD>` — same, cucumber runner.
3. `<LINT> && <TYPES>` — clean (skip with a journaled decision if the script is absent).
4. Architecture compliance: files in the modules PLAN.md's Structure assigns; no cross-module imports (`<LINT>` boundary rules if present, else grep imports).

Live-app checks (start the app, `curl`, Playwright, visual compliance) belong to `/verification-and-validation` only — do not duplicate them here.
```

Populate `verification_results` with `{ tests_regressions, bdd_regressions, lint_passed, types_passed, architecture_ok }` — update `references/state-schema.md` accordingly (replace the six keys with these five). Journal the gate.
- [ ] **Step 12: Story Completion** — step 6 prefixed `Outside autopilot, use AskUserQuestion`; step 5 sentence → `Emit \`<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>\`.`
- [ ] **Step 13: Autonomous Loop Execution** section — replace its body with: `Unattended runs are driven by \`/autopilot\` (see \`references/autopilot-contract.md\`). The legacy \`claude -p\` bash loop still works: it just needs \`AUTOPILOT=1\` in the environment.` Keep the bash block but add `AUTOPILOT=1` before `claude -p`.
- [ ] **Step 14: Commit Rules** — delete `NEVER add a \`Co-Authored-By\` trailer.` **Decision Rules → When to ask the user** — `Ralph-loop mode: never…` → `Under autopilot: never (contract §2).`
- [ ] **Step 15:** `scripts/bump.sh spec-implementation minor` → 3.2.0; CHANGELOG line: `- Toolchain placeholders; shared cursor rule; regression baseline via ledger regress; Gate 3 slimmed to suite/lint/types/boundaries (live-app checks live in V&V only); warnings → backlog; pipeline contract + journaling; Co-Authored-By rule removed.`
- [ ] **Step 16:** `grep -c "bun " …/SKILL.md` → 0 except inside the legacy bash block (allowed: it does not contain `bun`). `scripts/validate.sh` ok. Commit `feat(spec-implementation): unattended-mode fixes, slim gate 3, pipeline contract`.

---

### Task 12: `verification-and-validation` — toolchain, manual rows, contract, journaling

**Files:**
- Modify: `plugins/verification-and-validation/skills/verification-and-validation/SKILL.md`

- [ ] **Step 1: Pre-Flight row** (Task 9 Step 1 text).
- [ ] **Step 2: Step 1** — bash block → `<TEST>` / `<BDD>` / `<LINT>` / `<TYPES>` plus `node "$LEDGER" regress --base $BASE_SHA …` for both runners; `All must pass` → `Zero regressions; lint and types clean.`
- [ ] **Step 3: Step 2** — `bun dev &` → `<DEV> &` (bind per project convention; read the port from the dev script or `.env`).
- [ ] **Step 4: New Step 4.5 — Manual Test Plan rows** inserted after Step 4:

```markdown
## Step 4.5: Manual Test Plan rows

For every `test_plan_rows[T-N]` with `type = "manual"` (from `state.json`): perform the check the PLAN.md row's Asserts column describes (SSH, `curl` from another host, `dig`, reading a unit file, observing a notification…). Record in `qa-report.md` under "Manual checks": row id, what was done (the exact command or observation), outcome PASS/FAIL, evidence (output excerpt or screenshot path). Set `test_plan_rows[T-N].passing = true` on PASS. A FAIL is fixed like any other deviation; if it cannot be fixed from this repo (host-side change), file it: `ledger backlog add --kind bug --severity error --story US-NNN --op <op> --report specs/story-NNN-slug/verification/qa-report.md` and treat the story as **not** verified until resolved.
```

- [ ] **Step 5: Step 6** — after writing qa-report: `Journal: \`ledger log --kind gate --gate v-and-v --verdict PASS --report specs/story-NNN-slug/verification/qa-report.md --summary "<scenarios> scenarios, <fixes> fixes"\`.` Replace the `VERIFICATION_COMPLETE` prose reference to ralph-loop with autopilot wording.
- [ ] **Step 6: Decision Rules → When to fix vs. when to flag** — add `Under autopilot, the "flag only" case is hard stop \`spec_contradiction\` (contract §2) after journaling the contradiction and filing it as \`ledger backlog add --kind spec-gap --severity error\`.` **When to ask the user** — `Ralph-loop mode: never` → `Under autopilot: never (contract §2).`
- [ ] **Step 7: Autonomous Loop Execution** — same treatment as Task 11 Step 13. **Commit Rules** — delete the Co-Authored-By line.
- [ ] **Step 8:** `scripts/bump.sh verification-and-validation minor` → 2.1.0; CHANGELOG: `- Toolchain placeholders; manual Test Plan rows walked and recorded in qa-report.md; regression baseline via ledger regress; pipeline contract + journaling; Co-Authored-By rule removed.`
- [ ] **Step 9:** grep for `bun` → 0; validate ok. Commit `feat(verification-and-validation): manual rows, toolchain, pipeline contract`.

---

### Task 13: The four verification skills — contract, findings → backlog, toolchain

**Files:**
- Modify: `plugins/spec-writing-verification/skills/spec-writing-verification/SKILL.md:200-210`
- Modify: `plugins/plan-writing-verification/skills/plan-writing-verification/SKILL.md:211-221`
- Modify: `plugins/test-setup-verification/skills/test-setup-verification/SKILL.md:126-127,236-247`
- Modify: `plugins/spec-implementation-verification/skills/spec-implementation-verification/SKILL.md:119-124,301-317,307-309,362`

For each of the four, in "After the Agent Returns":

- [ ] **Step 1:** Add the Pre-Flight row (Task 9 Step 1 text) to the skill's Pre-Flight table (create a two-row table under `## Pre-Flight` if the skill has none — `spec-writing-verification` and `plan-writing-verification` have prose pre-flights; add the table right after the heading).
- [ ] **Step 2:** Replace the three verdict bullets (`If FAIL… ask`, `If PASS WITH WARNINGS… ask whether to address or proceed`, `If PASS…`) with:

```markdown
4. Journal the verdict: `node "$LEDGER" log --kind gate --gate <spec-verification|plan-verification|red-audit|green-audit> --verdict <PASS|PASS_WITH_WARNINGS|FAIL> --report <report path> --story US-NNN [--op Op-X] --summary "<one line>"`.
5. **FAIL**: list critical issues. Outside autopilot ask whether to fix now (loops back into `<producing skill>` with `--force`). Under autopilot: hard stop `verifier_fail` (contract §2).
6. **PASS_WITH_WARNINGS**: file every warning — `node "$LEDGER" backlog add --title "<warning>" --severity warning --kind <spec-gap|test-gap|refactor|doc|bug> --gate <gate> --report <report path> --story US-NNN [--op Op-X]` — print the ids, then proceed as PASS. Outside autopilot you may instead offer to address them now.
7. **PASS**: confirm readiness and name the next skill (unchanged text).
```

- [ ] **Step 3:** Replace `If running in a ralph-loop, skip the AskUserQuestion and emit …` with `Under autopilot, skip the question and emit …` (same sentinel).
- [ ] **Step 4:** Toolchain: in `test-setup-verification` lines 126–127 and `spec-implementation-verification` lines 119–124 and 307–309, replace `bun test --grep=…`/`bun bdd --tags=…`/`bun test`/`bun bdd`/`bun lint && bun typecheck` with `<TEST> -t …`/`<BDD> <Op filter>`/`<TEST>`/`<BDD>`/`<LINT> && <TYPES>` and add the sentence `Commands resolve per \`references/autopilot-contract.md\` §4.` once near the top of the agent prompt.
- [ ] **Step 5:** For each: `scripts/bump.sh <name> minor`; CHANGELOG line `- Pipeline contract; verdict journaled; warnings filed as backlog items (BL-NNN); toolchain placeholders.` Commit each: `feat(<name>): pipeline contract, findings to backlog`.
- [ ] **Step 6:** `scripts/validate.sh` → the four no longer missing the reference.

---

### Task 14: `spec-writing`, `ui-specs`, `repo-initialization` — contract + autopilot behaviour

**Files:**
- Modify: `plugins/spec-writing/skills/spec-writing/SKILL.md` (Pre-Flight; Phase 0; Phase 1; Phase 3)
- Modify: `plugins/ui-specs/skills/ui-specs/SKILL.md` (Pre-Flight; "Always Use AskUserQuestion")
- Modify: `plugins/repo-initialization/skills/repo-initialization/SKILL.md` (Pre-Flight; quality-gate commands at 266–278; hooks at 202)

- [ ] **Step 1: spec-writing Pre-Flight** — add the contract row. **Phase 0** — after the light-stories paragraph add:

```markdown
**Under autopilot (contract §2):** run the six auto-checks yourself for any tier and take the result as final — every letter ✅ → continue (journal `--kind gate --gate invest --verdict PASS`); a letter ❌ that a re-tier fixes (`S` with ≤ 3 Ops → `light`, > 3 → `full`) → write `stories[i].rigor`, journal the decision, continue; any other ❌ → journal `--gate invest --verdict FAIL` and hard stop `split_required` (for `S`/`I`) or `spec_contradiction` (for `N`/`V`/`E`/`T`). `/autopilot` (Plan 2) replaces the auto-checks with the `invest-assessor` agent; the verdict handling stays as written here.
```

**Phase 1 (Discovery)** — add: `Under autopilot there is no discovery conversation: derive everything from \`stories.json\` (AC, so_that, persona), \`PROJECT.md\` and \`ARCHITECTURE.md\`; every interpretation you make is journaled as a decision.` **Phase 3 Step 2 (Handoff)** — prefix `Outside autopilot,` before the `AskUserQuestion`; add `Under autopilot emit \`<promise>SPEC_COMPLETE_US-NNN</promise>\` (new sentinel).` Journal the self-review gate.
- [ ] **Step 2: ui-specs** — add the contract row to its Pre-Flight; in `### Always Use AskUserQuestion` append: `Under autopilot (contract §2) no question is asked: design-system branch = "start from scratch with neutral defaults" unless \`DESIGN.md\` exists; screens to mock = every screen the feature files name; the mockup variant picked = variant 1. Each pick is journaled.` Add sentinel `<promise>UI_SPECS_COMPLETE_US-NNN</promise>` at the end of the per-story flow.
- [ ] **Step 3: repo-initialization** — contract row; lines 266–278: keep the per-stack table but change the "verify the quality gates" block to use `<TYPES>`, `<LINT>`, `<TEST>`, `<DEV>` resolved per §4 (the scaffold has just written `package.json`, so the scripts exist by construction — note this). Add to the scaffold checklist: `\`specs/journal.jsonl\` and \`specs/backlog.json\` are tracked (never gitignored); \`specs/.site/\` is gitignored (Plan 3).` Prefix its single `AskUserQuestion` with `Outside autopilot,` and add `<promise>REPO_INIT_COMPLETE</promise>`.
- [ ] **Step 4:** bumps: `spec-writing` minor → 2.2.0 (`- Autopilot: INVEST auto-checks are final, no discovery conversation, SPEC_COMPLETE sentinel; pipeline contract; self-review journaled.`), `ui-specs` minor → 2.1.0, `repo-initialization` minor → 2.2.0. Commit each.
- [ ] **Step 5:** `scripts/validate.sh` → **zero** failures now (all 11 reference the contract, all copies identical).

---

### Task 15: Marketplace catalog, top-level changelog, dev-ledger 1.0.0, dogfood

**Files:**
- Modify: `README.md` (Philosophy, Per-Operation cycle, Catalog → new "Traceability" table, Documentation layout tree), `CHANGELOG.md`, `.claude-plugin/marketplace.json` (versions already bumped by bump.sh — verify)

- [ ] **Step 1: README** — under `### Orthogonal tooling` add a `### Traceability` table with one row `dev-ledger` (1.0.0) + a second line for its `/backlog` skill; in `## Documentation layout` add `├── journal.jsonl   # append-only audit trail (decisions, gates, findings, commits)` and `├── backlog.json    # BL-NNN un-applied findings`, and `autopilot.json  # present only while /autopilot runs`. In `## Philosophy` add one paragraph: *"Every skill journals its decisions and gate results to `specs/journal.jsonl` and files un-applied findings as `BL-NNN` items in `specs/backlog.json` — implement first, audit after. The pipeline contract (`references/autopilot-contract.md`, identical in every pipeline plugin) defines unattended behaviour so `/autopilot` (separate plugin) can drive a story end-to-end."* Update every version cell of the bumped plugins to match `plugin.json`.
- [ ] **Step 2: top-level CHANGELOG `[Unreleased]`** — add under `### Added`: `- **\`dev-ledger\`** plugin (journal + backlog + regress CLI, \`/backlog\` skill). \`scripts/sync-contract.sh\` + validate check for the pipeline contract. Multi-skill plugins supported by \`install-local.sh\` and \`validate.sh\`.`
- [ ] **Step 3: promote dev-ledger to 1.0.0** — `scripts/bump.sh dev-ledger major` (0.1.0 → 1.0.0); fix the `backlog` skill's frontmatter `version: 1.0.0` by hand (bump.sh only touches `skills/<name>/SKILL.md`); CHANGELOG `[1.0.0]`: `- Journal (\`ledger log\`, \`ledger journal\`), backlog (\`add/list/resolve/wontfix\`), \`failures\` parsers and \`regress\` worktree diff, canonical pipeline contract, \`/dev-ledger\` and \`/backlog\` skills.` Remove the scaffold's `[0.1.0]` entry.
- [ ] **Step 4:** `scripts/validate.sh` → exit 0. `node --test plugins/dev-ledger/skills/dev-ledger/scripts/ledger.test.mjs` → all pass.
- [ ] **Step 5: Install locally and dogfood on finfetch-web**

```bash
scripts/install-local.sh --all
cd /home/ttadmin/Codes/finfetch-web
L="$(find "$HOME/.claude/skills" -path '*/dev-ledger/scripts/ledger.mjs' | head -1)"
# back-fill the five Op-1 decisions already sitting in state.json so the journal starts complete
node -e '
const s=require("./specs/story-008-staging-deployment/state.json");
for (const d of s.decisions) console.log(JSON.stringify(d));' | while read -r d; do
  node "$L" log --kind decision --story US-008 --op "$(echo "$d" | node -pe 'JSON.parse(require("fs").readFileSync(0)).operation')" --stage spec-implementation --summary "$(echo "$d" | node -pe 'JSON.parse(require("fs").readFileSync(0)).decision')"
done
node "$L" journal --story US-008
node "$L" regress --base HEAD --runner vitest --cmd "npm test -- --reporter=json --outputFile=/tmp/ledger-vitest.json" --report-file /tmp/ledger-vitest.json
```

Expected: journal shows 5 decisions + the US-008 commits; regress reports 0 regressions, exit 0. Commit the new `specs/journal.jsonl` in finfetch-web: `chore(US-008): start the pipeline journal (back-filled Op-1 decisions)`.

- [ ] **Step 6: Commit the marketplace** — `git add -A && git commit -m "docs: catalog dev-ledger, pipeline contract; release dev-ledger 1.0.0"`; then open the PR from `feat/autopilot` to `main` (`gh pr create` if the remote is GitHub; the CI `changelog-bump-guard` job must be green).

---

## Self-review against the spec

- §2.1 activation → contract §1 (Task 6). §2.2 rules 1–5 → contract §2 + per-skill edits (Tasks 9–14). §2.3 gaps: toolchain (contract §4 + Tasks 10–14), `manual` (Tasks 9, 10, 11, 12), cursor (Tasks 10, 11), Gate 3 (Task 11 Step 11), regression baseline (Task 5 + contract §4), Co-Authored-By (Tasks 10, 11, 12), INVEST (Task 14 Step 1 — auto-checks final; agent arrives in Plan 2).
- §3.1 journal → Task 2 (+ deviation: git log merge instead of a hook, Task 3). §3.2 backlog → Task 4. §3.3 `/backlog` → Task 8. Ledger location → contract §5 (deviation: no npm script).
- Not in this plan by design: §4 (autopilot plugin, agents, `invest-assessor`), §5 (specs-site), §2.3 `--skip-arch-check` (belongs to `/autopilot`'s pre-flight).
- Names used consistently: `ledger.mjs` exports `findSpecsDir, parseArgs, autopilotContext, log, readJournal, filterJournal, gitCommits, formatTable, readBacklog, backlogAdd, backlogList, backlogResolve, backlogWontfix, formatBacklog, failuresFromVitest, failuresFromCucumber, failuresFromLines, regress, main`; CLI verbs `log | journal | backlog add|list|resolve|wontfix | failures | regress`; placeholders `<TEST> <BDD> <LINT> <TYPES> <DEV> <E2E>`; stop reasons `verifier_fail | op_blocked | regression | spec_contradiction | tooling_not_ready | split_required`.
