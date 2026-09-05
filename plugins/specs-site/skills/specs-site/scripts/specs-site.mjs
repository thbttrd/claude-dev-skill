#!/usr/bin/env node
// specs-site dev|build --specs DIR — runs the bundled Astro site against a project's specs/.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");
const USAGE = "usage: specs-site dev|build [--specs DIR] [--host [ADDR]] [--port N] [--out DIR]";

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!["dev", "build"].includes(cmd)) throw new Error(USAGE);
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

export function astroArgs(o) {
  return o.cmd === "dev" ? ["dev", "--host", o.host, "--port", o.port] : ["build", "--outDir", o.out];
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
  if (!existsSync(join(o.specs, "stories.json"))) {
    console.error(`no stories.json under ${o.specs} — pass --specs /path/to/project/specs`);
    return 1;
  }
  ensureDeps();
  if (o.cmd === "dev") console.error(`specs-site: ${o.specs} → http://${o.host}:${o.port}/`);
  const r = spawnSync(process.execPath, [astroBin(SITE), ...astroArgs(o)], {
    cwd: SITE,
    stdio: "inherit",
    env: { ...process.env, SPECS_DIR: o.specs },
  });
  return r.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
