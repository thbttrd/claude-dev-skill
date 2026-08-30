#!/usr/bin/env node
// ledger.mjs — journal + backlog + regression CLI for story-based projects.
// Node ≥ 20, stdlib only. Trackers: specs/journal.jsonl (append-only), specs/backlog.json.
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const KINDS = [
  "stage_start",
  "stage_end",
  "decision",
  "action",
  "gate",
  "finding",
  "commit",
  "stop",
];
export const VERDICTS = ["PASS", "PASS_WITH_WARNINGS", "FAIL"];
export const SEVERITIES = ["info", "warning", "error"];
export const BACKLOG_KINDS = [
  "bug",
  "simplification",
  "refactor",
  "test-gap",
  "spec-gap",
  "doc",
  "perf",
  "security",
];
export const STATUSES = ["open", "in-progress", "done", "wontfix"];

export function findSpecsDir(
  start = process.cwd(),
  override = process.env.LEDGER_SPECS,
) {
  if (override) return resolve(override);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "specs", "stories.json")))
      return join(dir, "specs");
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`no specs/stories.json found above ${start}`);
    dir = parent;
  }
}

const MULTI = new Set(["ref", "file"]);
export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      opts._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    const val = next === undefined || next.startsWith("--") ? true : argv[++i];
    if (MULTI.has(key)) (opts[key] ??= []).push(val);
    else opts[key] = val;
  }
  return opts;
}

export function autopilotContext(specs) {
  const p = join(specs, "autopilot.json");
  if (!existsSync(p)) return {};
  const ap = JSON.parse(readFileSync(p, "utf8"));
  if (!ap.active) return {};
  return { run_id: ap.run_id, ...(ap.current ?? {}) };
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

export function log(specs, opts, now = new Date()) {
  must(KINDS.includes(opts.kind), `--kind must be one of ${KINDS.join("|")}`);
  must(
    typeof opts.summary === "string" && opts.summary.length > 0,
    "--summary is required",
  );
  const ctx = autopilotContext(specs);
  const entry = {
    ts: now.toISOString(),
    run_id: opts.run_id ?? ctx.run_id ?? null,
    story: opts.story ?? ctx.story ?? null,
    op: opts.op ?? ctx.op ?? null,
    stage: opts.stage ?? ctx.stage ?? null,
    agent: opts.agent ?? ctx.agent ?? null,
    kind: opts.kind,
    summary: opts.summary,
    refs: opts.ref ?? [],
    sha: opts.sha ?? null,
  };
  if (opts.kind === "gate") {
    must(
      VERDICTS.includes(opts.verdict),
      `--verdict must be one of ${VERDICTS.join("|")}`,
    );
    must(typeof opts.gate === "string", "--gate is required for kind=gate");
    Object.assign(entry, {
      gate: opts.gate,
      verdict: opts.verdict,
      report: opts.report ?? null,
    });
  }
  if (opts["backlog-id"]) entry.backlog_id = opts["backlog-id"];
  appendFileSync(join(specs, "journal.jsonl"), JSON.stringify(entry) + "\n");
  return entry;
}

export function readJournal(specs) {
  const p = join(specs, "journal.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ---- CLI -------------------------------------------------------------------
export function main(argv) {
  const opts = parseArgs(argv);
  const [cmd] = opts._;
  const specs = findSpecsDir(
    process.cwd(),
    opts.specs ?? process.env.LEDGER_SPECS,
  );
  switch (cmd) {
    case "log": {
      const e = log(specs, opts);
      process.stdout.write(JSON.stringify(e) + "\n");
      return 0;
    }
    default:
      process.stderr.write(
        "usage: ledger <log|journal|backlog|failures|regress> [--specs dir] ...\n",
      );
      return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`ledger: ${err.message}\n`);
    process.exit(1);
  }
}
