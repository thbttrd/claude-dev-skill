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
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import {
  DEFAULT_POLICY,
  loadLedger,
  locateLedger,
  matchSentinel,
  nextEligibleStory,
  nextStage,
  preflight,
  readAutopilot,
  readJson,
  report,
  stageEnd,
  stageStart,
  start,
  stop,
  storyDir,
  writeJson,
} from "./autopilot.mjs";

// Loaded once, hermetically, from the in-repo sibling — every run-lifecycle
// test injects it via deps.ledger instead of letting each call re-locate it.
const ledger = await loadLedger(locateLedger());

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

export function commitPaths(root, msg, paths) {
  execFileSync("git", ["add", "--", ...paths], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", msg], { cwd: root, stdio: "pipe" });
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
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

test("next: specced with a FAIL spec-audit.md re-runs spec-writing-verification", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-000", { phase: "specced" });
  const ap = dryRun("US-000");

  const dir = storyDir(specs, "US-000");
  mkdirSync(join(dir, "verification"), { recursive: true });
  const auditPath = join(dir, "verification", "spec-audit.md");

  writeFileSync(auditPath, "## Overall Verdict: FAIL\n\nsome reason\n");
  const stillAuditing = nextStage(specs, ap);
  assert.equal(stillAuditing.stage, "spec-writing-verification");

  writeFileSync(auditPath, "## Overall Verdict: PASS WITH WARNINGS\n");
  const advanced = nextStage(specs, ap);
  assert.equal(advanced.stage, "plan-writing");
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

test("next: planned with a FAIL plan-audit.md re-runs plan-writing-verification", () => {
  const { root, specs } = fixtureProject();
  writeFileSync(join(root, "package.json"), "{}\n");
  setStory(specs, "US-001", { phase: "planned" });
  const dir = storyDir(specs, "US-001");
  mkdirSync(join(dir, "verification"), { recursive: true });
  const auditPath = join(dir, "verification", "plan-audit.md");
  writeFileSync(join(dir, "PLAN.md"), "### Operation 1 — only\n");

  writeFileSync(auditPath, "## Overall Verdict: FAIL\n\nsome reason\n");
  const stillAuditing = nextStage(specs, dryRun("US-001"));
  assert.equal(stillAuditing.stage, "plan-writing-verification");

  writeFileSync(auditPath, "## Overall Verdict: PASS WITH WARNINGS\n");
  const advanced = nextStage(specs, dryRun("US-001"));
  assert.equal(advanced.stage, "test-setup");
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

test("next: red story whose state.json has no operations map → stop spec_contradiction", () => {
  const { specs } = fixtureProject();
  setStory(specs, "US-001", { phase: "red" });
  writeState(specs, "US-001", {
    story_id: "US-001",
    phase: "red",
    checkpoints: [],
    history: [],
  });
  const result = nextStage(specs, dryRun("US-001"));
  assert.equal(result.stop, true);
  assert.equal(result.reason, "spec_contradiction");
  assert.match(result.detail, /\/test-setup/);
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

// ---- run lifecycle: start / stage-start / stage-end / stop / report -------

const INVEST_ALL_TRUE = {
  i: true,
  n: true,
  v: true,
  e: true,
  s: true,
  t: true,
  checked_at: "2026-09-01",
};

test("start writes autopilot.json and journals the start (plus decisions for --force / --skip-arch-check)", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");

  const ap = await start(specs, { target: "US-000" }, { ledger, now });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dirname(specs), encoding: "utf8" }).trim();
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

  const journal1 = ledger.readJournal(specs);
  const startEntry = journal1.find((e) => e.kind === "action" && e.run_id === ap.run_id);
  assert.ok(startEntry, "expected a start action entry");
  assert.match(startEntry.summary, /target=US-000 until=US-000 policy=/);

  const now2 = new Date("2026-09-05T11:00:00.000Z");
  const ap2 = await start(
    specs,
    { target: "US-000", force: true, skip_arch_check: true },
    { ledger, now: now2 },
  );
  assert.equal(ap2.active, true);
  assert.notEqual(ap2.run_id, ap.run_id);

  const journal2 = ledger.readJournal(specs);
  const forceDecision = journal2.find(
    (e) => e.kind === "decision" && e.run_id === ap2.run_id && e.summary.includes(ap.run_id),
  );
  assert.ok(forceDecision, "expected a decision mentioning the old run_id");
  const skipDecision = journal2.find(
    (e) => e.kind === "decision" && e.run_id === ap2.run_id && /skip-arch-check/.test(e.summary),
  );
  assert.ok(skipDecision, "expected a decision about --skip-arch-check");
});

test("start refuses when preflight fails and writes nothing", async () => {
  const { specs } = fixtureProject();
  rmSync(join(specs, "ARCHITECTURE.md"));

  const result = await start(specs, { target: "US-000" }, { ledger, now: new Date() });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.equal(existsSync(join(specs, "autopilot.json")), false);
});

test("stageStart sets current with attempt 1 and journals stage_start with story/op/stage filled", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  const ap0 = await start(specs, { target: "US-000" }, { ledger, now });

  const now2 = new Date("2026-09-05T10:05:00.000Z");
  const ap = await stageStart(
    specs,
    { story: "US-000", stage: "invest", agent: "invest-assessor" },
    { ledger, now: now2 },
  );
  assert.deepEqual(ap.current, {
    story: "US-000",
    stage: "invest",
    op: null,
    agent: "invest-assessor",
    started_at: now2.toISOString(),
    attempt: 1,
  });
  assert.deepEqual(readAutopilot(specs).current, ap.current);

  const entry = ledger
    .readJournal(specs)
    .find((e) => e.kind === "stage_start" && e.run_id === ap0.run_id);
  assert.ok(entry);
  assert.equal(entry.story, "US-000");
  assert.equal(entry.op, null);
  assert.equal(entry.stage, "invest");
  assert.match(entry.summary, /invest US-000 via invest-assessor \(attempt 1\)/);
});

test("stageEnd sentinel → continue with the next stage and journals stage_end", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "spec-writing", agent: "general-purpose" },
    { ledger, now },
  );

  setStory(specs, "US-000", { invest: INVEST_ALL_TRUE, phase: "specced" });

  const result = await stageEnd(specs, { outcome: "sentinel" }, { ledger, now });
  assert.equal(result.action, "continue");
  assert.equal(result.next.stage, "spec-writing-verification");

  assert.deepEqual(readAutopilot(specs).last_next, result.next);
  const entry = ledger.readJournal(specs).find((e) => e.kind === "stage_end");
  assert.ok(entry);
  assert.match(entry.summary, /spec-writing US-000 ok/);
});

test("stageEnd sentinel with no tracker progress → stop stage_no_progress", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "spec-writing", agent: "general-purpose" },
    { ledger, now },
  );

  setStory(specs, "US-000", { invest: INVEST_ALL_TRUE }); // phase stays "scoped"

  const result = await stageEnd(specs, { outcome: "sentinel" }, { ledger, now });
  assert.equal(result.action, "stop");
  assert.equal(result.reason, "stage_no_progress");

  const ap = readAutopilot(specs);
  assert.equal(ap.active, false);
  assert.equal(ap.stop_reason, "stage_no_progress");
});

test("stageEnd rejects a missing or misspelled --outcome", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "spec-writing", agent: "general-purpose" },
    { ledger, now },
  );

  await assert.rejects(
    () => stageEnd(specs, { outcome: undefined }, { ledger, now }),
    /--outcome must be/,
  );
  await assert.rejects(
    () => stageEnd(specs, { outcome: "no-sentinel" }, { ledger, now }),
    /--outcome must be/,
  );

  const journalEntry = ledger.readJournal(specs).find((e) => e.kind === "stage_end");
  assert.equal(journalEntry, undefined);
});

test("stageEnd no_sentinel retries once then stops with stage_no_sentinel", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "spec-writing", agent: "general-purpose" },
    { ledger, now },
  );

  const retry = await stageEnd(
    specs,
    { outcome: "no_sentinel", tail: "no promise block found" },
    { ledger, now },
  );
  assert.deepEqual(retry, { action: "retry", attempt: 2 });
  assert.equal(readAutopilot(specs).current.attempt, 2);

  const stopped = await stageEnd(specs, { outcome: "no_sentinel", tail: "still nothing" }, { ledger, now });
  assert.deepEqual(stopped, { action: "stop", reason: "stage_no_sentinel" });
  const ap = readAutopilot(specs);
  assert.equal(ap.active, false);
  assert.equal(ap.stop_reason, "stage_no_sentinel");
});

test("stageEnd invest verdicts: PASS writes invest flags; RE-TIER also rewrites rigor; SPLIT stops split_required; FAIL stops spec_contradiction", async () => {
  const now = new Date("2026-09-05T10:00:00.000Z");

  // PASS
  {
    const { specs } = fixtureProject();
    await start(specs, { target: "US-000" }, { ledger, now });
    await stageStart(
      specs,
      { story: "US-000", stage: "invest", agent: "invest-assessor" },
      { ledger, now },
    );
    const result = await stageEnd(specs, { outcome: "sentinel", verdict: "PASS" }, { ledger, now });
    assert.equal(result.action, "continue");
    const story = readJson(join(specs, "stories.json")).stories.find((s) => s.id === "US-000");
    assert.deepEqual(story.invest, {
      i: true,
      n: true,
      v: true,
      e: true,
      s: true,
      t: true,
      checked_at: "2026-09-05",
    });
    assert.equal(story.rigor, "full");
    const gate = ledger.readJournal(specs).find((e) => e.kind === "gate");
    assert.equal(gate.verdict, "PASS");
  }

  // RE-TIER light
  {
    const { specs } = fixtureProject();
    await start(specs, { target: "US-000" }, { ledger, now });
    await stageStart(
      specs,
      { story: "US-000", stage: "invest", agent: "invest-assessor" },
      { ledger, now },
    );
    const result = await stageEnd(
      specs,
      { outcome: "sentinel", verdict: "RE-TIER light" },
      { ledger, now },
    );
    assert.equal(result.action, "continue");
    const story = readJson(join(specs, "stories.json")).stories.find((s) => s.id === "US-000");
    assert.equal(story.invest.checked_at, "2026-09-05");
    assert.equal(story.rigor, "light");
    const decision = ledger.readJournal(specs).find((e) => e.kind === "decision");
    assert.match(decision.summary, /re-tiered to light by invest-assessor/);
    const gate = ledger.readJournal(specs).find((e) => e.kind === "gate" && e.gate === "invest");
    assert.equal(gate.verdict, "PASS");
  }

  // SPLIT
  {
    const { specs } = fixtureProject();
    await start(specs, { target: "US-000" }, { ledger, now });
    await stageStart(
      specs,
      { story: "US-000", stage: "invest", agent: "invest-assessor" },
      { ledger, now },
    );
    const result = await stageEnd(specs, { outcome: "sentinel", verdict: "SPLIT" }, { ledger, now });
    assert.deepEqual(result, { action: "stop", reason: "split_required" });
    const ap = readAutopilot(specs);
    assert.equal(ap.active, false);
    assert.equal(ap.stop_reason, "split_required");
  }

  // FAIL
  {
    const { specs } = fixtureProject();
    await start(specs, { target: "US-000" }, { ledger, now });
    await stageStart(
      specs,
      { story: "US-000", stage: "invest", agent: "invest-assessor" },
      { ledger, now },
    );
    const result = await stageEnd(
      specs,
      { outcome: "sentinel", verdict: "FAIL S: too big" },
      { ledger, now },
    );
    assert.deepEqual(result, { action: "stop", reason: "spec_contradiction" });
    const ap = readAutopilot(specs);
    assert.equal(ap.active, false);
    assert.equal(ap.stop_reason, "spec_contradiction");
    const gate = ledger.readJournal(specs).find((e) => e.kind === "gate");
    assert.equal(gate.verdict, "FAIL");
  }
});

test("stageEnd stop passes the subagent's reason through", async () => {
  const { specs } = fixtureProject();
  const now = new Date("2026-09-05T10:00:00.000Z");
  await start(specs, { target: "US-000" }, { ledger, now });
  await stageStart(
    specs,
    { story: "US-000", stage: "invest", agent: "invest-assessor" },
    { ledger, now },
  );

  const result = await stageEnd(
    specs,
    { outcome: "stop", reason: "verifier_fail" },
    { ledger, now },
  );
  assert.deepEqual(result, { action: "stop", reason: "verifier_fail" });
  const ap = readAutopilot(specs);
  assert.equal(ap.active, false);
  assert.equal(ap.stop_reason, "verifier_fail");
});

test("report aggregates this run's stages, gates, backlog ids and commits", async () => {
  const { specs } = fixtureProject();
  const now = new Date(); // real "now": no git commits exist after this instant
  const ap = await start(specs, { target: "US-000" }, { ledger, now });

  ledger.log(
    specs,
    { kind: "stage_end", summary: "invest US-000 ok", run_id: ap.run_id, story: "US-000", stage: "invest" },
    now,
  );
  ledger.log(
    specs,
    {
      kind: "stage_end",
      summary: "spec-writing US-000 ok",
      run_id: ap.run_id,
      story: "US-000",
      stage: "spec-writing",
    },
    now,
  );
  ledger.log(
    specs,
    {
      kind: "gate",
      gate: "code-review",
      verdict: "PASS_WITH_WARNINGS",
      summary: "gate code-review PASS_WITH_WARNINGS",
      run_id: ap.run_id,
      story: "US-000",
    },
    now,
  );
  ledger.backlogAdd(
    specs,
    { title: "Extract helper", severity: "warning", kind: "simplification", story: "US-000" },
    now,
  );

  const rep = await report(specs, { run_id: ap.run_id }, { ledger });
  assert.equal(rep.run_id, ap.run_id);
  assert.equal(rep.target, "US-000");
  assert.equal(rep.stages.length, 2);
  assert.equal(rep.gates.length, 1);
  assert.deepEqual(rep.backlog_ids, ["BL-001"]);
  assert.ok(Array.isArray(rep.commits));
  assert.ok(rep.text.includes("BL-001"));
  assert.ok(rep.text.includes(ap.run_id));
});

test("report with no run returns an empty report, not every null-run_id journal line", async () => {
  const { specs } = fixtureProject();
  const now = new Date();
  ledger.log(
    specs,
    { kind: "stage_end", summary: "leftover legacy line", run_id: null, story: "US-000", stage: "invest" },
    now,
  );

  const rep = await report(specs, {}, { ledger, now });
  assert.equal(rep.run_id, null);
  assert.deepEqual(rep.stages, []);
  assert.deepEqual(rep.gates, []);
  assert.deepEqual(rep.backlog_ids, []);
  assert.deepEqual(rep.commits, []);
  assert.match(rep.text, /no autopilot run on record/);
});

test("CLI: start → stage-start → stage-end → stop round-trips through main", () => {
  const { specs } = fixtureProject();
  const script = fileURLToPath(new URL("./autopilot.mjs", import.meta.url));
  const emptyHome = mkdtempSync(join(tmpdir(), "autopilot-home-"));
  const env = { ...process.env, HOME: emptyHome, LEDGER: "" };
  const run = (...args) => {
    const r = spawnSync(process.execPath, [script, ...args, "--specs", specs], {
      encoding: "utf8",
      env,
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };

  const started = run("start", "US-000");
  assert.equal(started.active, true);
  assert.ok(started.run_id);

  const afterStageStart = run(
    "stage-start",
    "--story",
    "US-000",
    "--stage",
    "invest",
    "--agent",
    "invest-assessor",
  );
  assert.equal(afterStageStart.current.stage, "invest");

  const afterStageEnd = run("stage-end", "--outcome", "sentinel", "--verdict", "PASS");
  assert.equal(afterStageEnd.action, "continue");
  assert.equal(afterStageEnd.next.stage, "spec-writing");

  const stopped = run("stop", "--reason", "test_done");
  assert.equal(stopped.stop_reason, "test_done");

  const ap = readAutopilot(specs);
  assert.equal(ap.active, false);
  assert.equal(ap.stop_reason, "test_done");
});

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
  writeFileSync(join(root, "note.txt"), "x\n");
  const real = commitPaths(root, "feat(US-000): real", ["note.txt"]);
  // A journaled sha that an --amend left dangling: the object still exists, no branch reaches it.
  writeFileSync(join(root, "orphan.txt"), "y\n");
  const orphan = commitPaths(root, "chore: amended away", ["orphan.txt"]);
  execFileSync("git", ["reset", "-q", "--hard", real], { cwd: root, stdio: "pipe" });
  ledger.log(specs, { kind: "commit", sha: orphan, summary: "chore: amended away", run_id: ap.run_id, story: "US-000" }, now);

  await stop(specs, { reason: "verifier_fail", summary: "C1" }, { ledger, now: new Date() });
  await stop(specs, { reason: "verifier_fail" }, { ledger, now: new Date() }); // a second stop with the same reason journals nothing

  const rep = await report(specs, { run_id: ap.run_id }, { ledger });
  assert.equal(rep.gates.length, 1);
  assert.equal(rep.gates[0].verdict, "PASS_WITH_WARNINGS", "last verdict wins");
  assert.equal(rep.stages.filter((s) => s.outcome === "stop").length, 1);
  assert.match(rep.text, /run — stop \(verifier_fail\)/);
  assert.equal(rep.commits[0].sha, real);
  const dead = rep.commits.find((c) => c.sha === orphan);
  assert.equal(dead.unreachable, true);
  assert.match(dead.summary, /\(unreachable\)$/);
  assert.ok(rep.text.includes(`${orphan} chore: amended away (unreachable)`), rep.text);
});

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
  await start(specs, { target: "US-000" }, { ledger, now }); // clean tree first; the trackers move below
  setStory(specs, "US-000", { phase: "green", invest: INVEST_ALL_TRUE });
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
