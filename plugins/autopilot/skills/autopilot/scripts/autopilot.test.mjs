import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import {
  DEFAULT_POLICY,
  locateLedger,
  matchSentinel,
  nextEligibleStory,
  nextStage,
  preflight,
  readJson,
  storyDir,
  writeJson,
} from "./autopilot.mjs";

export function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "autopilot-"));
  cpSync(fileURLToPath(new URL("./fixtures/mini-project", import.meta.url)), root, {
    recursive: true,
  });
  const git = (...a) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  return { root, specs: join(root, "specs") };
}

export function setStory(specs, id, patch) {
  const data = readJson(join(specs, "stories.json"));
  const story = data.stories.find((s) => s.id === id);
  Object.assign(story, patch);
  writeJson(join(specs, "stories.json"), data);
}

export function writeState(specs, id, state) {
  const dir = storyDir(specs, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

test("locateLedger falls back to the in-repo sibling and honours the override", () => {
  // The override must exist to win (see the "authoritative" fix-round test
  // below for the nonexistent-override case) — use a real, but arbitrary,
  // file so this only proves precedence, not existence-checking.
  const overridePath = join(mkdtempSync(join(tmpdir(), "autopilot-override-")), "ledger.mjs");
  writeFileSync(overridePath, "");
  assert.equal(locateLedger(overridePath), resolve(overridePath));

  const prevHome = process.env.HOME;
  const emptyHome = mkdtempSync(join(tmpdir(), "autopilot-home-"));
  process.env.HOME = emptyHome;
  try {
    const found = locateLedger(null);
    assert.ok(found, "expected a sibling ledger path, got null");
    assert.equal(existsSync(found), true);
    assert.match(found, /dev-ledger[\\/]skills[\\/]dev-ledger[\\/]scripts[\\/]ledger\.mjs$/);
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  }
});

test("preflight passes on the fixture target US-000", () => {
  const { specs } = fixtureProject();
  const result = preflight(specs, { target: "US-000" });
  assert.deepEqual(result, {
    ok: true,
    target: "US-000",
    until: "US-000",
    stop_policy: DEFAULT_POLICY,
    warnings: [],
  });
});

test("preflight collects every failure instead of stopping at the first", () => {
  const { root, specs } = fixtureProject();
  rmSync(join(specs, "ARCHITECTURE.md"));
  setStory(specs, "US-000", { phase: "backlog" });
  writeFileSync(join(root, "dirty.txt"), "oops\n");

  const result = preflight(specs, { target: "US-000" });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  assert.ok(
    result.errors.some((e) => /^no specs\/ARCHITECTURE\.md — run \/research-and-architecture first/.test(e)),
  );
  assert.ok(
    result.errors.some((e) => /^US-000 is still in backlog — run \/high-level-scoping update mode/.test(e)),
  );
  assert.ok(
    result.errors.some((e) => /^working tree not clean:.*dirty\.txt/.test(e)),
  );
});

test("preflight blocks on an unverified dependency and on an already-verified target without --until", () => {
  const { root, specs } = fixtureProject();
  const git = (...a) => execFileSync("git", a, { cwd: root, stdio: "pipe" });

  // US-002 depends on US-001, which is not a foundation story and starts
  // out only "scoped" — US-001's own (foundation) dependency on US-000 is
  // exempt, so this is the one real dependency violation in the fixture.
  const depErr = preflight(specs, { target: "US-002" });
  assert.equal(depErr.ok, false);
  assert.ok(
    depErr.errors.some((e) => e === "dependency US-001 of US-002 is scoped, not verified"),
  );

  setStory(specs, "US-000", { phase: "verified" });
  const noUntil = preflight(specs, { target: "US-000" });
  assert.equal(noUntil.ok, false);
  assert.ok(
    noUntil.errors.some(
      (e) => e === "US-000 is already verified — pass --until US-MMM to continue past it",
    ),
  );

  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "verify US-000");
  const withUntil = preflight(specs, { target: "US-000", until: "US-002" });
  assert.equal(withUntil.ok, true);
  assert.equal(withUntil.until, "US-002");
});

test("preflight demands --skip-arch-check when stories.json has neither tech_stack nor adrs", () => {
  const { root, specs } = fixtureProject();
  const data = readJson(join(specs, "stories.json"));
  delete data.architecture.tech_stack;
  delete data.architecture.adrs;
  writeJson(join(specs, "stories.json"), data);
  const git = (...a) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "strip arch fields");

  const blocked = preflight(specs, { target: "US-000" });
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.errors.some((e) =>
      e.startsWith(
        "ARCHITECTURE.md has not been through /research-and-architecture (no tech_stack/adrs in stories.json)",
      ),
    ),
  );

  const allowed = preflight(specs, { target: "US-000", skip_arch_check: true });
  assert.equal(allowed.ok, true);
  assert.match(allowed.warnings[0], /skip-arch-check/);
});

test("preflight ignores the run's own bookkeeping files in the clean-tree check", () => {
  const { specs } = fixtureProject();
  writeFileSync(join(specs, "autopilot.json"), JSON.stringify({ active: false }) + "\n");
  writeFileSync(join(specs, "journal.jsonl"), "");
  writeFileSync(join(specs, "backlog.json"), JSON.stringify({ next_id: 1, items: [] }) + "\n");

  const result = preflight(specs, { target: "US-000" });
  assert.equal(result.ok, true);
});

test("preflight refuses a second active run unless --force", () => {
  const { specs } = fixtureProject();
  writeFileSync(
    join(specs, "autopilot.json"),
    JSON.stringify({ active: true, run_id: "run-42" }) + "\n",
  );

  const blocked = preflight(specs, { target: "US-000" });
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.errors.some(
      (e) => e === "another run is active (run_id run-42) — pass --force to take over",
    ),
  );

  const forced = preflight(specs, { target: "US-000", force: true });
  assert.equal(forced.ok, true);
});

test("CLI: preflight prints JSON and exits 1 on failure", () => {
  const { specs } = fixtureProject();
  const script = fileURLToPath(new URL("./autopilot.mjs", import.meta.url));
  // No dev-ledger install to rely on: HOME points at an empty dir, so the
  // CLI must resolve the ledger via the in-repo sibling fallback.
  const emptyHome = mkdtempSync(join(tmpdir(), "autopilot-home-"));
  const r = spawnSync(process.execPath, [script, "preflight", "US-999", "--specs", specs], {
    encoding: "utf8",
    env: { ...process.env, HOME: emptyHome, LEDGER: "" },
  });
  assert.equal(r.status, 1, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e === "unknown story US-999"));
});

test("CLI: preflight still returns its JSON contract when dev-ledger cannot be found", () => {
  const { specs } = fixtureProject();
  const script = fileURLToPath(new URL("./autopilot.mjs", import.meta.url));
  const emptyHome = mkdtempSync(join(tmpdir(), "autopilot-home-"));
  // $LEDGER is authoritative once set (locateLedger stops searching), and a
  // nonexistent override reads as "not installed" rather than falling back
  // to the in-repo sibling — this is how we force the "no ledger" branch
  // deterministically even though a real sibling always exists in this repo.
  const r = spawnSync(process.execPath, [script, "preflight", "US-000", "--specs", specs], {
    encoding: "utf8",
    env: { ...process.env, HOME: emptyHome, LEDGER: "/nonexistent/ledger.mjs" },
  });
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.stderr, "");
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /dev-ledger not installed/.test(e)));
});

test("preflight names the new path (not the old, not a v1 arrow) when a tracked file is renamed", () => {
  const { root, specs } = fixtureProject();
  execFileSync("git", ["mv", "specs/PROJECT.md", "specs/PROJECT2.md"], { cwd: root });

  const result = preflight(specs, { target: "US-000" });
  assert.equal(result.ok, false);
  const err = result.errors.find((e) => e.startsWith("working tree not clean:"));
  assert.ok(err, `expected a working-tree-not-clean error, got ${JSON.stringify(result.errors)}`);
  assert.ok(err.includes("specs/PROJECT2.md"));
  assert.ok(!err.includes(" -> "));
});

// ---- next: the stage resolver ----------------------------------------------

function dryRun(target, patch = {}) {
  return { target, until: target, stop_policy: DEFAULT_POLICY, current: null, ...patch };
}

test("next: scoped story without INVEST → invest (invest-assessor)", () => {
  const { specs } = fixtureProject();
  const result = nextStage(specs, dryRun("US-000"));
  assert.deepEqual(result, {
    story: "US-000",
    stage: "invest",
    op: null,
    skill: null,
    agent: "invest-assessor",
    sentinel: "INVEST_VERDICT: (PASS|RE-TIER (light|full)|SPLIT|FAIL .*)",
    rigor: "full",
    args: "US-000",
  });
});

test("next: scoped story with INVEST all true → spec-writing", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", {
    invest: { i: true, n: true, v: true, e: true, s: true, t: true, checked_at: "2026-09-05" },
  });
  const result = nextStage(specs, dryRun("US-000"));
  assert.equal(result.stage, "spec-writing");
  assert.equal(result.skill, "spec-writing");
  assert.equal(result.agent, "general-purpose");
  assert.equal(result.op, null);
  assert.equal(result.args, "US-000");
  assert.equal(result.sentinel, "SPEC_COMPLETE_US-000");
});

test("next: specced → spec-writing-verification until spec-audit.md exists, then plan-writing", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "specced" });
  const ap = dryRun("US-000");

  const before = nextStage(specs, ap);
  assert.equal(before.stage, "spec-writing-verification");
  assert.equal(before.agent, "story-verifier");
  assert.equal(before.sentinel, "SPEC_AUDIT_COMPLETE_US-000");

  const dir = storyDir(specs, "US-000");
  mkdirSync(join(dir, "verification"), { recursive: true });
  writeFileSync(join(dir, "verification", "spec-audit.md"), "PASS\n");

  const after = nextStage(specs, ap);
  assert.equal(after.stage, "plan-writing");
  assert.equal(after.sentinel, "PLAN_COMPLETE_US-000");
});

test("next: planned → plan-writing-verification, then repo-initialization for US-000 on an empty repo, then test-setup Op-1", () => {
  const { root, specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "planned" });
  const ap = dryRun("US-000");

  const step1 = nextStage(specs, ap);
  assert.equal(step1.stage, "plan-writing-verification");
  assert.equal(step1.sentinel, "PLAN_AUDIT_COMPLETE_US-000");

  const dir = storyDir(specs, "US-000");
  mkdirSync(join(dir, "verification"), { recursive: true });
  writeFileSync(join(dir, "verification", "plan-audit.md"), "PASS\n");

  const step2 = nextStage(specs, ap);
  assert.equal(step2.stage, "repo-initialization");
  assert.equal(step2.op, null);
  assert.equal(step2.sentinel, "REPO_INIT_COMPLETE");

  writeFileSync(join(root, "package.json"), "{}\n");
  const step3 = nextStage(specs, ap);
  assert.equal(step3.stage, "test-setup");
  assert.equal(step3.op, "Op-1");
  assert.equal(step3.args, "US-000 Op-1");
  assert.equal(step3.sentinel, "RED_COMPLETE_US-000_Op-1");
});

test("next: planned non-foundation story with package.json present → test-setup Op-1 from PLAN.md headings", () => {
  const { root, specs } = fixtureProject();
  writeFileSync(join(root, "package.json"), "{}\n");
  setStory(specs, "US-001", { phase: "planned" });
  const dir = storyDir(specs, "US-001");
  mkdirSync(join(dir, "verification"), { recursive: true });
  writeFileSync(join(dir, "verification", "plan-audit.md"), "PASS\n");
  writeFileSync(join(dir, "PLAN.md"), "### Operation 1 — only\n");

  const result = nextStage(specs, dryRun("US-001"));
  assert.equal(result.stage, "test-setup");
  assert.equal(result.op, "Op-1");
  assert.equal(result.args, "US-001 Op-1");
  assert.equal(result.sentinel, "RED_COMPLETE_US-001_Op-1");
});

test("next: planned story whose PLAN.md has no Operations → stop spec_contradiction", () => {
  const { root, specs } = fixtureProject();
  writeFileSync(join(root, "package.json"), "{}\n");
  setStory(specs, "US-001", { phase: "planned" });
  const dir = storyDir(specs, "US-001");
  mkdirSync(join(dir, "verification"), { recursive: true });
  writeFileSync(join(dir, "verification", "plan-audit.md"), "PASS\n");
  writeFileSync(join(dir, "PLAN.md"), "# Plan\n\nNo operations here.\n");

  const result = nextStage(specs, dryRun("US-001"));
  assert.deepEqual(result, {
    stop: true,
    reason: "spec_contradiction",
    detail: "PLAN.md lists no Operations (no '### Operation N' heading) and no state.json exists",
  });
});

test("next: red — cursor rules", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-001", { phase: "red" }); // light rigor
  const ap = dryRun("US-001");

  writeState(specs, "US-001", {
    operations: {
      "Op-1": { operation_phase: "red" },
      "Op-2": { operation_phase: "pending" },
    },
  });
  let result = nextStage(specs, ap);
  assert.equal(result.stage, "spec-implementation");
  assert.equal(result.op, "Op-1");
  assert.equal(result.sentinel, "GREEN_COMPLETE_US-001_Op-1");

  writeState(specs, "US-001", {
    operations: {
      "Op-1": { operation_phase: "green", green_audit: { verdict: "PASS" } },
      "Op-2": { operation_phase: "pending" },
    },
  });
  result = nextStage(specs, ap);
  assert.equal(result.stage, "test-setup");
  assert.equal(result.op, "Op-2");
  assert.equal(result.sentinel, "RED_COMPLETE_US-001_Op-2");

  writeState(specs, "US-001", {
    operations: {
      "Op-1": { operation_phase: "green" },
      "Op-2": { operation_phase: "red_b" },
    },
  });
  result = nextStage(specs, ap);
  assert.equal(result.stage, "test-setup");
  assert.equal(result.op, "Op-2");
});

test("next: red — full rigor audits the last GREEN'd op before moving on", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "red" }); // full rigor
  const ap = dryRun("US-000");

  writeState(specs, "US-000", {
    operations: {
      "Op-1": { operation_phase: "green", green_audit: { verdict: null } },
      "Op-2": { operation_phase: "pending" },
    },
  });
  let result = nextStage(specs, ap);
  assert.equal(result.stage, "spec-implementation-verification");
  assert.equal(result.op, "Op-1");
  assert.equal(result.sentinel, "GREEN_AUDIT_COMPLETE_US-000_Op-1");

  writeState(specs, "US-000", {
    operations: {
      "Op-1": { operation_phase: "green", green_audit: { verdict: "PASS" } },
      "Op-2": { operation_phase: "pending" },
    },
  });
  result = nextStage(specs, ap);
  assert.equal(result.stage, "test-setup");
  assert.equal(result.op, "Op-2");
});

test("next: red — all ops green → simplify → code-review → spec-implementation story-end", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-001", { phase: "red" }); // light rigor, no audits required
  const ap = dryRun("US-001");
  const ops = {
    "Op-1": { operation_phase: "green" },
    "Op-2": { operation_phase: "refactored" },
  };

  writeState(specs, "US-001", { operations: ops });
  let result = nextStage(specs, ap);
  assert.equal(result.stage, "simplify");
  assert.equal(result.op, null);
  assert.equal(result.agent, "lazy-simplifier");
  assert.equal(result.sentinel, "SIMPLIFY_COMPLETE_US-001");

  writeState(specs, "US-001", { operations: ops, quality_gates: { simplified: true } });
  result = nextStage(specs, ap);
  assert.equal(result.stage, "code-review");
  assert.equal(result.agent, "story-reviewer");
  assert.equal(result.sentinel, "REVIEW_COMPLETE_US-001");

  writeState(specs, "US-001", {
    operations: ops,
    quality_gates: { simplified: true, reviewed: true },
  });
  result = nextStage(specs, ap);
  assert.equal(result.stage, "spec-implementation");
  assert.equal(result.op, null);
  assert.equal(result.sentinel, "IMPLEMENTATION_COMPLETE_US-001");
});

test("next: red without state.json → stop spec_contradiction", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-001", { phase: "red" });
  const result = nextStage(specs, dryRun("US-001"));
  assert.equal(result.stop, true);
  assert.equal(result.reason, "spec_contradiction");
  assert.match(result.detail, /state\.json/);
});

test("next: green → verification-and-validation", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-001", { phase: "green" });
  const result = nextStage(specs, dryRun("US-001"));
  assert.equal(result.stage, "verification-and-validation");
  assert.equal(result.op, null);
  assert.equal(result.agent, "general-purpose");
  assert.equal(result.sentinel, "VERIFICATION_COMPLETE_US-001");
});

test("next: verified target with until=target → done until_reached", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "verified" });
  const result = nextStage(specs, dryRun("US-000"));
  assert.deepEqual(result, { done: true, reason: "until_reached", story: "US-000" });
});

test("next: verified in this run under hard-failures+story-end → done story_end; under hard-failures → next eligible story's stage", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "verified" });
  const ap1 = dryRun("US-000", {
    until: "US-002",
    stop_policy: "hard-failures+story-end",
    current: { story: "US-000", stage: "verification-and-validation" },
  });
  const result1 = nextStage(specs, ap1);
  assert.deepEqual(result1, { done: true, reason: "story_end", story: "US-000" });

  const ap2 = { ...ap1, stop_policy: "hard-failures" };
  const result2 = nextStage(specs, ap2);
  assert.equal(result2.story, "US-001");
  assert.equal(result2.stage, "invest");
});

test("next: resume after story_end moves to the next eligible story (current null)", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "verified" });
  const ap = dryRun("US-000", {
    until: "US-002",
    stop_policy: "hard-failures+story-end",
    current: null,
  });
  const result = nextStage(specs, ap);
  assert.equal(result.story, "US-001");
  assert.equal(result.stage, "invest");
});

test("nextEligibleStory skips stories with unverified deps and stops at until", () => {
  const { specs } = fixtureProject();

  const data = readJson(join(specs, "stories.json"));
  assert.equal(nextEligibleStory(data.stories, "US-000", "US-001"), "US-001");
  assert.equal(nextEligibleStory(data.stories, "US-000", "US-000"), null);

  setStory(specs, "US-000", { phase: "verified" });
  const data2 = readJson(join(specs, "stories.json"));
  // US-002 depends on US-001, still "scoped" (not foundation) → skipped.
  assert.equal(nextEligibleStory(data2.stories, "US-000", "US-002"), "US-001");

  setStory(specs, "US-001", { phase: "verified" });
  const data3 = readJson(join(specs, "stories.json"));
  assert.equal(nextEligibleStory(data3.stories, "US-001", "US-002"), "US-002");
});

test("matchSentinel accepts bare and <promise>-wrapped sentinels, extracts INVEST verdicts and AUTOPILOT_STOP reasons", () => {
  assert.equal(
    matchSentinel("GREEN_COMPLETE_US-000_Op-1", "spec-implementation", "US-000", "Op-1"),
    "GREEN_COMPLETE_US-000_Op-1",
  );
  assert.equal(
    matchSentinel(
      "<promise>GREEN_COMPLETE_US-000_Op-1</promise>",
      "spec-implementation",
      "US-000",
      "Op-1",
    ),
    "GREEN_COMPLETE_US-000_Op-1",
  );
  // A trailing digit must not falsely match Op-1 as a prefix of Op-10.
  assert.equal(
    matchSentinel("GREEN_COMPLETE_US-000_Op-10", "spec-implementation", "US-000", "Op-1"),
    null,
  );
  assert.equal(matchSentinel("nothing here", "spec-implementation", "US-000", "Op-1"), null);

  assert.equal(matchSentinel("INVEST_VERDICT: PASS", "invest", "US-000", null), "PASS");
  assert.equal(
    matchSentinel("<promise>INVEST_VERDICT: RE-TIER light</promise>", "invest", "US-000", null),
    "RE-TIER light",
  );
  assert.equal(
    matchSentinel("INVEST_VERDICT: FAIL S: too big", "invest", "US-000", null),
    "FAIL S: too big",
  );

  assert.deepEqual(
    matchSentinel(
      "<promise>AUTOPILOT_STOP_spec_contradiction</promise>",
      "spec-writing",
      "US-000",
      null,
    ),
    { stop: "spec_contradiction" },
  );
  assert.deepEqual(matchSentinel("AUTOPILOT_STOP_verifier_fail", "invest", "US-000", null), {
    stop: "verifier_fail",
  });
});

test("CLI: next --story US-000 dry-runs without autopilot.json", () => {
  const { specs } = fixtureProject();
  const script = fileURLToPath(new URL("./autopilot.mjs", import.meta.url));
  const r = spawnSync(
    process.execPath,
    [script, "next", "--story", "US-000", "--specs", specs],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.story, "US-000");
  assert.equal(out.stage, "invest");
  assert.equal(out.agent, "invest-assessor");
});
