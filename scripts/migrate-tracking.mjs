#!/usr/bin/env node
// Thin shim — the real implementation lives inside the migrate-specs plugin.
//
// Background: in the marketplace layout, plugins are self-contained so users
// who `/plugin install migrate-specs@claude-dev-skill` get the migration
// machinery without needing the marketplace root checked out. This shim keeps
// the legacy invocation `node scripts/migrate-tracking.mjs` working from a
// clone of this repo, and delegates to the real script.
//
// For interactive use, prefer `/migrate-specs` — it audits the whole repo,
// not only `docs/project-tracking.json`, and produces a richer migration log.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { exit } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(
  here,
  "..",
  "plugins",
  "migrate-specs",
  "skills",
  "migrate-specs",
  "scripts",
  "migrate-tracking.mjs",
);

if (!existsSync(target)) {
  console.error(
    `error: real migrate-tracking.mjs not found at ${target}.\n` +
      `hint: this shim expects the migrate-specs plugin to be present in the marketplace tree.\n` +
      `      if you installed only this script standalone, install the migrate-specs plugin instead:\n` +
      `      /plugin install migrate-specs@claude-dev-skill`,
  );
  exit(2);
}

const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
});
exit(result.status ?? 1);
