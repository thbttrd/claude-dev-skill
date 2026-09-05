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
const html = (out, p) => readFileSync(join(out, p, "index.html"), "utf8");

test("parseArgs: defaults, bare --host, --out default, unknown flag", () => {
  const o = parseArgs(["dev", "--specs", "x/specs"]);
  assert.equal(o.specs, resolve("x/specs"));
  assert.deepEqual([o.host, o.port, o.out], ["127.0.0.1", "4321", resolve("x/specs/.site")]);
  assert.equal(parseArgs(["dev", "--host"]).host, "0.0.0.0");
  assert.equal(parseArgs(["dev", "--host", "10.0.0.5", "--port", "5000"]).port, "5000");
  assert.deepEqual(astroArgs(parseArgs(["build", "--specs", "s", "--out", "/tmp/o"])), ["build"]);
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
});
