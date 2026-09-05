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
  assert.deepEqual(astroArgs(parseArgs(["build", "--specs", "s", "--out", "/tmp/o"])), ["build", "--outDir", "/tmp/o"]);
  assert.throws(() => parseArgs(["serve"]), /usage/);
  assert.throws(() => parseArgs(["dev", "--nope"]), /unknown argument --nope/);
});

test("build against the fixture emits a static site", () => {
  const out = mkdtempSync(join(tmpdir(), "specs-site-"));
  execFileSync(process.execPath, [CLI, "build", "--specs", FIXTURE, "--out", out], { stdio: "pipe" });
  assert.ok(existsSync(join(out, "index.html")));
  assert.match(html(out, "."), /Mini Project/);
});
