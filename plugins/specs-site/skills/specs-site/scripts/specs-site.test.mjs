import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { astroArgs, parseArgs } from "./specs-site.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const FIXTURE = join(HERE, "fixtures", "specs");
export const CLI = join(HERE, "specs-site.mjs");
const html = (out, p) => readFileSync(join(out, p, "index.html"), "utf8");

test("parseArgs: defaults, bare --host, --out default, unknown flag", () => {
  const o = parseArgs(["dev", "--specs", "x/specs"]);
  assert.equal(o.specs, resolve("x/specs"));
  assert.deepEqual([o.host, o.port, o.out], ["127.0.0.1", "4321", resolve("x/specs/.site")]);
  assert.equal(parseArgs(["dev", "--host"]).host, "0.0.0.0");
  assert.equal(parseArgs(["dev", "--host", "10.0.0.5", "--port", "5000"]).port, "5000");
  assert.deepEqual(astroArgs(parseArgs(["build", "--specs", "s", "--out", "/tmp/o"])), ["build"]);
  assert.deepEqual(astroArgs(parseArgs(["stop"])), ["dev", "stop"]);
  assert.throws(() => parseArgs(["serve"]), /usage/);
  assert.throws(() => parseArgs(["dev", "--nope"]), /unknown argument --nope/);
});

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
  assert.match(story, /assets\/story-000-foundation\/mockups\/home\.html/);
  assert.doesNotMatch(story, /LEGACY MARKER/);
  assert.ok(existsSync(join(out, "stories", "US-001", "index.html")));
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
  const leaked = readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith(".html") && readFileSync(join(out, String(f)), "utf8").includes("LEGACY MARKER"));
  assert.deepEqual(leaked, []);
});

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
    // Foreground (a human terminal, CI): the CLI forwards SIGTERM to its Astro child.
    // Daemon (Astro detected an AI agent): `specs-site stop` reads Astro's lock file.
    const exited = new Promise((r) => child.on("exit", r));
    child.kill("SIGTERM");
    await Promise.race([exited, sleep(5000)]);
    execFileSync(process.execPath, [CLI, "stop"], { stdio: "ignore" });
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
  }
  // pgrep through a shell would match the shell's own command line; call it directly (exit 1 = no match).
  const leftovers = () => { try { return execFileSync("pgrep", ["-u", String(process.getuid()), "-f", `astro.mjs dev --force --host 127.0.0.1 --port ${port}`], { encoding: "utf8" }).trim(); } catch { return ""; } };
  for (let i = 0; i < 10 && leftovers(); i++) await sleep(500);
  assert.equal(leftovers(), "", "no astro dev process left behind");
});
