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
