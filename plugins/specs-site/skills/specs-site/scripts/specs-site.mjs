#!/usr/bin/env node
// specs-site dev|build --specs DIR — runs the bundled Astro site against a project's specs/.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");
const USAGE = "usage: specs-site dev|build|stop|status [--specs DIR] [--host [ADDR]] [--port N] [--out DIR]";

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!["dev", "build", "stop", "status"].includes(cmd)) throw new Error(USAGE);
  const o = { cmd, specs: "specs", host: "127.0.0.1", port: "4321", out: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--specs") o.specs = next();
    else if (a === "--port") o.port = next();
    else if (a === "--out") o.out = next();
    else if (a === "--host") o.host = rest[i + 1] && !rest[i + 1].startsWith("--") ? next() : "0.0.0.0";
    else throw new Error(`unknown argument ${a}\n${USAGE}`);
  }
  o.specs = resolve(o.specs);
  o.out = resolve(o.out ?? join(o.specs, ".site"));
  return o;
}

// `build` always writes the site's own dist/ and is copied to --out afterwards:
// Astro moves prerendered assets with rename(), which fails with EXDEV when
// --out is on another filesystem (a tmpfs /tmp, a mounted specs dir).
// Astro 7 keeps one dev server per project (a lock file). `--force` replaces a
// running one, so `specs-site dev` always serves the specs dir it was given.
// In a human terminal the server stays in the foreground (the CLI forwards
// SIGINT/SIGTERM to it); under an AI agent Astro daemonizes it and the CLI
// returns once it is up — `specs-site stop` / `status` then manage it.
export function astroArgs(o) {
  if (o.cmd === "dev") return ["dev", "--force", "--host", o.host, "--port", o.port];
  if (o.cmd === "build") return ["build"];
  return ["dev", o.cmd];
}

const astroBin = (site) => {
  const pkg = join(site, "node_modules", "astro", "package.json");
  return existsSync(pkg) ? join(site, "node_modules", "astro", JSON.parse(readFileSync(pkg, "utf8")).bin.astro) : null;
};

// First run installs the site's deps from the committed lockfile.
export function ensureDeps(site = SITE) {
  if (astroBin(site)) return false;
  const r = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: site, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`npm ci failed in ${site}`);
  return true;
}

export function main(argv) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  if (o.cmd !== "stop" && o.cmd !== "status" && !existsSync(join(o.specs, "stories.json"))) {
    console.error(`no stories.json under ${o.specs} — pass --specs /path/to/project/specs`);
    return 1;
  }
  ensureDeps();
  const bin = astroBin(SITE);
  const env = { ...process.env, SPECS_DIR: o.specs };
  if (o.cmd !== "dev") {
    const r = spawnSync(process.execPath, [bin, ...astroArgs(o)], { cwd: SITE, stdio: "inherit", env });
    if (r.status !== 0 || o.cmd !== "build") return r.status ?? 1;
    rmSync(o.out, { recursive: true, force: true });
    cpSync(join(SITE, "dist"), o.out, { recursive: true });
    console.error(`specs-site: built → ${o.out}`);
    return 0;
  }
  console.error(`specs-site: ${o.specs} → http://${o.host}:${o.port}/  (stop: specs-site stop, or kill pid ${process.pid})`);
  const child = spawn(process.execPath, [bin, ...astroArgs(o)], { cwd: SITE, stdio: "inherit", env });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
  return new Promise((done) => child.on("exit", (code, signal) => done(code ?? (signal ? 1 : 0))));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
