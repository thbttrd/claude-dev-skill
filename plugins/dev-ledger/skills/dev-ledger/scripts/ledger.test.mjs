import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findSpecsDir,
  parseArgs,
  autopilotContext,
  log,
  readJournal,
  KINDS,
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
