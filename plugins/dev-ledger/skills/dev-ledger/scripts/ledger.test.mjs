import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  findSpecsDir,
  parseArgs,
  autopilotContext,
  log,
  readJournal,
  filterJournal,
  gitCommits,
  formatTable,
  KINDS,
  readBacklog,
  backlogAdd,
  backlogList,
  backlogResolve,
  backlogWontfix,
} from "./ledger.mjs";

export function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "ledger-"));
  mkdirSync(join(root, "specs", "story-001-x"), { recursive: true });
  writeFileSync(join(root, "specs", "stories.json"), '{"stories":[]}\n');
  return root;
}

test("findSpecsDir walks up to the dir holding specs/stories.json", () => {
  const root = fixtureProject();
  assert.equal(
    findSpecsDir(join(root, "specs", "story-001-x"), undefined),
    join(root, "specs"),
  );
  assert.throws(
    () => findSpecsDir(tmpdir(), undefined),
    /no specs\/stories.json/,
  );
});

test("parseArgs handles values, flags and repeated --ref/--file", () => {
  const o = parseArgs([
    "log",
    "--kind",
    "decision",
    "--summary",
    "x y",
    "--ref",
    "a",
    "--ref",
    "b",
    "--json",
  ]);
  assert.deepEqual(o._, ["log"]);
  assert.equal(o.kind, "decision");
  assert.equal(o.summary, "x y");
  assert.deepEqual(o.ref, ["a", "b"]);
  assert.equal(o.json, true);
});

test("log appends a journal line with defaults from autopilot.json when active", () => {
  const root = fixtureProject();
  const specs = join(root, "specs");
  assert.deepEqual(autopilotContext(specs), {});
  writeFileSync(
    join(specs, "autopilot.json"),
    JSON.stringify({
      active: true,
      run_id: "run-1",
      current: {
        story: "US-001",
        op: "Op-2",
        stage: "test-setup",
        agent: "agent-a",
      },
    }),
  );
  const now = new Date("2026-08-30T10:00:00Z");
  const e = log(
    specs,
    { kind: "decision", summary: "RED-B skipped", ref: ["specs/x.md"] },
    now,
  );
  assert.equal(e.ts, "2026-08-30T10:00:00.000Z");
  assert.equal(e.story, "US-001");
  assert.equal(e.op, "Op-2");
  assert.equal(e.stage, "test-setup");
  assert.equal(e.agent, "agent-a");
  assert.equal(e.run_id, "run-1");
  assert.deepEqual(e.refs, ["specs/x.md"]);
  assert.equal(e.sha, null);
  const lines = readFileSync(join(specs, "journal.jsonl"), "utf8")
    .trim()
    .split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), e);
  assert.deepEqual(readJournal(specs), [e]);
});

test("log: explicit args win over autopilot defaults; inactive autopilot gives nulls", () => {
  const root = fixtureProject();
  const specs = join(root, "specs");
  writeFileSync(
    join(specs, "autopilot.json"),
    JSON.stringify({ active: false, current: { story: "US-009" } }),
  );
  const e = log(specs, { kind: "action", summary: "s", story: "US-002" });
  assert.equal(e.story, "US-002");
  assert.equal(e.op, null);
  assert.equal(e.run_id, null);
});

test("log validates kind, summary and gate verdict", () => {
  const specs = join(fixtureProject(), "specs");
  assert.throws(
    () => log(specs, { kind: "nope", summary: "s" }),
    new RegExp(KINDS.join("\\|")),
  );
  assert.throws(() => log(specs, { kind: "decision" }), /--summary/);
  assert.throws(
    () =>
      log(specs, {
        kind: "gate",
        summary: "s",
        gate: "simplify",
        verdict: "MEH",
      }),
    /--verdict/,
  );
  const g = log(specs, {
    kind: "gate",
    summary: "s",
    gate: "simplify",
    verdict: "PASS",
    report: "r.md",
  });
  assert.equal(g.gate, "simplify");
  assert.equal(g.verdict, "PASS");
  assert.equal(g.report, "r.md");
});

test("readJournal on a missing file is an empty array", () => {
  assert.deepEqual(readJournal(join(fixtureProject(), "specs")), []);
});

test("filterJournal filters by story/op/kind/since", () => {
  const es = [
    {
      ts: "2026-08-29T00:00:00Z",
      story: "US-001",
      op: "Op-1",
      kind: "decision",
      summary: "a",
    },
    {
      ts: "2026-08-30T00:00:00Z",
      story: "US-001",
      op: "Op-2",
      kind: "gate",
      summary: "b",
    },
    {
      ts: "2026-08-30T00:00:00Z",
      story: "US-002",
      op: null,
      kind: "decision",
      summary: "c",
    },
  ];
  assert.equal(filterJournal(es, { story: "US-001" }).length, 2);
  assert.equal(filterJournal(es, { op: "Op-2" })[0].summary, "b");
  assert.equal(filterJournal(es, { kind: "decision" }).length, 2);
  assert.equal(filterJournal(es, { since: "2026-08-30" }).length, 2);
});

test("gitCommits turns conventional commits with a US-NNN scope into commit entries", () => {
  const root = fixtureProject();
  const git = (...a) =>
    execFileSync("git", a, { cwd: root, stdio: "pipe" }).toString().trim();
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("add", ".");
  git("commit", "-qm", "feat(US-001): implement Op-1 — thing");
  git("commit", "-q", "--allow-empty", "-m", "chore: unrelated");
  const all = gitCommits(root, {});
  assert.equal(all.length, 2);
  const only = gitCommits(root, { story: "US-001" });
  assert.equal(only.length, 1);
  assert.equal(only[0].kind, "commit");
  assert.equal(only[0].story, "US-001");
  assert.match(only[0].sha, /^[0-9a-f]{7,}$/);
  assert.match(only[0].ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(only[0].summary, "feat(US-001): implement Op-1 — thing");
});

test("formatTable renders one line per entry, sorted by ts", () => {
  const s = formatTable([
    {
      ts: "2026-08-30T10:00:00Z",
      story: "US-001",
      op: "Op-2",
      kind: "gate",
      verdict: "PASS",
      summary: "b",
    },
    {
      ts: "2026-08-30T09:00:00Z",
      story: "US-001",
      op: null,
      kind: "decision",
      summary: "a",
    },
  ]);
  const lines = s.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /09:00.*US-001.*decision.*a/);
  assert.match(lines[1], /10:00.*Op-2.*gate.*PASS.*b/);
});

test("gitCommits normalizes non-UTC timestamps to UTC and sorts correctly", () => {
  const root = fixtureProject();
  const git = (...a) =>
    execFileSync("git", a, { cwd: root, stdio: "pipe" }).toString().trim();
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("add", ".");
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: "2026-08-30T15:05:00+02:00",
    GIT_COMMITTER_DATE: "2026-08-30T15:05:00+02:00",
  };
  execFileSync("git", ["commit", "-qm", "feat(US-001): with +02:00 offset"], {
    cwd: root,
    stdio: "pipe",
    env,
  });
  const commits = gitCommits(root, {});
  assert.equal(commits[0].ts, "2026-08-30T13:05:00.000Z");
  const later = {
    ts: "2026-08-30T14:00:00.000Z",
    story: null,
    op: null,
    kind: "decision",
    summary: "later",
  };
  const table = formatTable([commits[0], later]);
  const lines = table.trim().split("\n");
  assert.match(lines[0], /13:05.*feat\(US-001\)/);
  assert.match(lines[1], /14:00.*later/);
});

test("backlog add assigns BL-NNN ids, persists, and journals a finding", () => {
  const specs = join(fixtureProject(), "specs");
  assert.deepEqual(readBacklog(specs), { next_id: 1, items: [] });
  const now = new Date("2026-08-30T12:00:00Z");
  const a = backlogAdd(
    specs,
    {
      title: "Extract helper",
      severity: "warning",
      kind: "simplification",
      file: ["a.ts"],
      story: "US-008",
      op: "Op-1",
      stage: "spec-implementation",
      gate: "code-review",
      report: "r.md",
      detail: "d",
    },
    now,
  );
  assert.equal(a.id, "BL-001");
  assert.equal(a.status, "open");
  assert.equal(a.created_at, "2026-08-30");
  assert.deepEqual(a.source, {
    stage: "spec-implementation",
    gate: "code-review",
    story: "US-008",
    op: "Op-1",
    report: "r.md",
  });
  assert.deepEqual(a.files, ["a.ts"]);
  assert.equal(a.resolved_sha, null);
  const b = backlogAdd(
    specs,
    { title: "Second", severity: "info", kind: "doc" },
    now,
  );
  assert.equal(b.id, "BL-002");
  assert.equal(readBacklog(specs).next_id, 3);
  const j = readJournal(specs);
  assert.equal(j.length, 2);
  assert.equal(j[0].kind, "finding");
  assert.equal(j[0].backlog_id, "BL-001");
  assert.equal(j[0].story, "US-008");
});

test("backlog add validates severity and kind", () => {
  const specs = join(fixtureProject(), "specs");
  assert.throws(
    () => backlogAdd(specs, { title: "t", severity: "huge", kind: "bug" }),
    /--severity/,
  );
  assert.throws(
    () => backlogAdd(specs, { title: "t", severity: "info", kind: "vibe" }),
    /--kind/,
  );
  assert.throws(
    () => backlogAdd(specs, { severity: "info", kind: "bug" }),
    /--title/,
  );
});

test("backlog list filters; resolve and wontfix update status and journal an action", () => {
  const specs = join(fixtureProject(), "specs");
  backlogAdd(specs, {
    title: "a",
    severity: "error",
    kind: "bug",
    story: "US-001",
  });
  backlogAdd(specs, {
    title: "b",
    severity: "info",
    kind: "doc",
    story: "US-002",
  });
  assert.equal(backlogList(specs, {}).length, 2);
  assert.equal(backlogList(specs, { story: "US-001" })[0].title, "a");
  assert.equal(backlogList(specs, { severity: "info" })[0].id, "BL-002");
  const r = backlogResolve(
    specs,
    "BL-001",
    { sha: "abc1234", resolution: "fixed in shared helper" },
    new Date("2026-09-01T00:00:00Z"),
  );
  assert.equal(r.status, "done");
  assert.equal(r.resolved_sha, "abc1234");
  assert.equal(r.resolved_at, "2026-09-01");
  const w = backlogWontfix(specs, "BL-002", { reason: "not worth it" });
  assert.equal(w.status, "wontfix");
  assert.equal(w.resolution, "not worth it");
  assert.equal(backlogList(specs, { status: "open" }).length, 0);
  assert.throws(
    () => backlogResolve(specs, "BL-999", { sha: "x", resolution: "y" }),
    /BL-999 not found/,
  );
  assert.throws(
    () => backlogWontfix(specs, "BL-001", { reason: "x" }),
    /BL-001 is already done/,
  );
  assert.throws(
    () => backlogResolve(specs, "BL-001", { sha: "y", resolution: "z" }),
    /BL-001 is already done/,
  );
  const actions = readJournal(specs).filter((e) => e.kind === "action");
  assert.equal(actions.length, 2);
  assert.equal(actions[0].backlog_id, "BL-001");
});
