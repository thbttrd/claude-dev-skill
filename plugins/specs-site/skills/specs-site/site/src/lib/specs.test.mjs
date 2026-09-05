import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
