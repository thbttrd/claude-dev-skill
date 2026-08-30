#!/usr/bin/env node
// ledger.mjs — journal + backlog + regression CLI for story-based projects.
// Node ≥ 20, stdlib only. Trackers: specs/journal.jsonl (append-only), specs/backlog.json.
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
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

export function filterJournal(entries, f = {}) {
  return entries.filter(
    (e) =>
      (!f.story || e.story === f.story) &&
      (!f.op || e.op === f.op) &&
      (!f.kind || e.kind === f.kind) &&
      (!f.since || e.ts >= new Date(f.since).toISOString()),
  );
}

export function gitCommits(root, f = {}) {
  const r = spawnSync("git", ["log", "--format=%h%x1f%aI%x1f%s"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) return [];
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, tsRaw, summary] = line.split("\x1f");
      const ts = new Date(tsRaw).toISOString();
      const story = summary.match(/^\w+\((US-\d{3})\)/)?.[1] ?? null;
      return {
        ts,
        story,
        op: null,
        stage: null,
        kind: "commit",
        summary,
        sha,
        refs: [],
      };
    })
    .filter((e) => !f.story || e.story === f.story);
}

export function formatTable(entries) {
  const pad = (s, n) =>
    String(s ?? "")
      .padEnd(n)
      .slice(0, n);
  return (
    [...entries]
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map(
        (e) =>
          `${e.ts.slice(0, 16).replace("T", " ")}  ${pad(e.story, 6)} ${pad(e.op, 5)} ${pad(e.stage, 22)} ${pad(e.kind, 11)} ${pad(e.verdict ?? e.sha ?? e.backlog_id ?? "", 18)} ${e.summary}`,
      )
      .join("\n") + "\n"
  );
}

// ---- Backlog ---------------------------------------------------------------
function backlogPath(specs) {
  return join(specs, "backlog.json");
}

export function readBacklog(specs) {
  return existsSync(backlogPath(specs))
    ? JSON.parse(readFileSync(backlogPath(specs), "utf8"))
    : { next_id: 1, items: [] };
}

function writeBacklog(specs, data) {
  writeFileSync(backlogPath(specs), JSON.stringify(data, null, 2) + "\n");
}

const day = (d) => d.toISOString().slice(0, 10);

export function backlogAdd(specs, opts, now = new Date()) {
  must(typeof opts.title === "string" && opts.title, "--title is required");
  must(
    SEVERITIES.includes(opts.severity),
    `--severity must be one of ${SEVERITIES.join("|")}`,
  );
  must(
    BACKLOG_KINDS.includes(opts.kind),
    `--kind must be one of ${BACKLOG_KINDS.join("|")}`,
  );
  const ctx = autopilotContext(specs);
  const data = readBacklog(specs);
  const item = {
    id: `BL-${String(data.next_id).padStart(3, "0")}`,
    title: opts.title,
    detail: opts.detail ?? "",
    source: {
      stage: opts.stage ?? ctx.stage ?? null,
      gate: opts.gate ?? null,
      story: opts.story ?? ctx.story ?? null,
      op: opts.op ?? ctx.op ?? null,
      report: opts.report ?? null,
    },
    severity: opts.severity,
    kind: opts.kind,
    files: opts.file ?? [],
    status: "open",
    created_at: day(now),
    resolved_at: null,
    resolved_sha: null,
    resolution: null,
  };
  log(
    specs,
    {
      kind: "finding",
      summary: `${item.id}: ${item.title}`,
      story: item.source.story,
      op: item.source.op,
      stage: item.source.stage,
      ref: item.source.report ? [item.source.report] : [],
      "backlog-id": item.id,
    },
    now,
  );
  data.items.push(item);
  data.next_id += 1;
  writeBacklog(specs, data);
  return item;
}

export function backlogList(specs, f = {}) {
  return readBacklog(specs).items.filter(
    (i) =>
      (!f.status || i.status === f.status) &&
      (!f.story || i.source.story === f.story) &&
      (!f.severity || i.severity === f.severity),
  );
}

function updateItem(specs, id, patch, summary, now) {
  const data = readBacklog(specs);
  const item = data.items.find((i) => i.id === id);
  must(item, `${id} not found`);
  must(
    item.status === "open" || item.status === "in-progress",
    `${id} is already ${item.status}`,
  );
  Object.assign(item, patch);
  log(
    specs,
    {
      kind: "action",
      summary,
      story: item.source.story,
      op: item.source.op,
      sha: patch.resolved_sha ?? null,
      "backlog-id": id,
    },
    now,
  );
  writeBacklog(specs, data);
  return item;
}

export function backlogResolve(
  specs,
  id,
  { sha, resolution },
  now = new Date(),
) {
  must(sha && resolution, "--sha and --resolution are required");
  return updateItem(
    specs,
    id,
    { status: "done", resolved_at: day(now), resolved_sha: sha, resolution },
    `${id} resolved: ${resolution}`,
    now,
  );
}

export function backlogWontfix(specs, id, { reason }, now = new Date()) {
  must(reason, "--reason is required");
  return updateItem(
    specs,
    id,
    { status: "wontfix", resolved_at: day(now), resolution: reason },
    `${id} wontfix: ${reason}`,
    now,
  );
}

export function formatBacklog(items) {
  return (
    items
      .map(
        (i) =>
          `${i.id}  ${i.status.padEnd(11)} ${i.severity.padEnd(7)} ${i.kind.padEnd(14)} ${(i.source.story ?? "").padEnd(6)} ${(i.source.op ?? "").padEnd(5)} ${i.title}`,
      )
      .join("\n") + (items.length ? "\n" : "")
  );
}

// ---- Failures & Regress ---------------------------------------------------
const rel = (p, root) =>
  root && p.startsWith(root + "/") ? p.slice(root.length + 1) : p;

export function failuresFromVitest(json, root) {
  const r = JSON.parse(json);
  const out = [];
  for (const f of r.testResults ?? [])
    for (const a of f.assertionResults ?? [])
      if (a.status === "failed")
        out.push(`${rel(f.name, root)}::${a.fullName}`);
  return out.sort();
}

const BAD_STEP = new Set(["failed", "undefined", "ambiguous", "pending"]);
export function failuresFromCucumber(json, root) {
  const out = [];
  for (const feat of JSON.parse(json))
    for (const el of feat.elements ?? []) {
      if (el.type !== "scenario") continue;
      if ((el.steps ?? []).some((s) => BAD_STEP.has(s.result?.status)))
        out.push(`${rel(feat.uri, root)}::${el.name}`);
    }
  return out.sort();
}

export function failuresFromLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .sort();
}

const PARSERS = {
  vitest: failuresFromVitest,
  cucumber: failuresFromCucumber,
  lines: (t) => failuresFromLines(t),
};

function runFailures(cwd, cmd, runner, reportFile) {
  must(
    PARSERS[runner],
    `--runner must be one of ${Object.keys(PARSERS).join("|")}`,
  );
  if (reportFile) rmSync(resolve(cwd, reportFile), { force: true });
  const r = spawnSync("sh", ["-c", cmd], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });
  if (r.error)
    throw new Error(
      `ledger regress: could not run \`${cmd}\` in ${cwd}: ${r.error.message}`,
    );
  const text = reportFile
    ? readFileSync(resolve(cwd, reportFile), "utf8")
    : r.stdout;
  try {
    return PARSERS[runner](text, cwd);
  } catch (err) {
    throw new Error(
      `ledger regress: ${runner} output of \`${cmd}\` in ${cwd} is not parseable (${err.message}). stderr tail: ${(r.stderr ?? "").slice(-500)}`,
    );
  }
}

export function regress({ root, base, cmd, runner, reportFile }) {
  must(base && cmd, "--base and --cmd are required");
  const head = runFailures(root, cmd, runner, reportFile);
  const wt = mkdtempSync(join(tmpdir(), "ledger-regress-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", "-f", wt, base], {
      cwd: root,
      stdio: "ignore",
    });
    if (
      existsSync(join(root, "node_modules")) &&
      !existsSync(join(wt, "node_modules"))
    )
      symlinkSync(join(root, "node_modules"), join(wt, "node_modules"), "dir");
    const baseFailures = runFailures(wt, cmd, runner, reportFile);
    const baseSet = new Set(baseFailures);
    return {
      base: baseFailures,
      head,
      regressions: head.filter((id) => !baseSet.has(id)),
    };
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", wt], {
      cwd: root,
      stdio: "ignore",
    });
    rmSync(wt, { recursive: true, force: true });
  }
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
    case "journal": {
      let entries = filterJournal(readJournal(specs), opts);
      if (!opts["no-git"])
        entries = entries.concat(
          filterJournal(gitCommits(dirname(specs), opts), opts),
        );
      process.stdout.write(
        opts.json
          ? JSON.stringify(entries, null, 2) + "\n"
          : formatTable(entries),
      );
      return 0;
    }
    case "backlog": {
      const [, sub, id] = opts._;
      if (sub === "add") {
        const it = backlogAdd(specs, opts);
        process.stdout.write(it.id + "\n");
        return 0;
      }
      if (sub === "list" || sub === undefined) {
        const items = backlogList(specs, opts);
        process.stdout.write(
          opts.json
            ? JSON.stringify(items, null, 2) + "\n"
            : formatBacklog(items),
        );
        return 0;
      }
      if (sub === "resolve") {
        process.stdout.write(
          JSON.stringify(backlogResolve(specs, id, opts)) + "\n",
        );
        return 0;
      }
      if (sub === "wontfix") {
        process.stdout.write(
          JSON.stringify(backlogWontfix(specs, id, opts)) + "\n",
        );
        return 0;
      }
      process.stderr.write(
        "usage: ledger backlog <add|list|resolve BL-NNN|wontfix BL-NNN>\n",
      );
      return 2;
    }
    case "failures": {
      const text = opts["report-file"]
        ? readFileSync(opts["report-file"], "utf8")
        : readFileSync(0, "utf8");
      must(
        PARSERS[opts.runner],
        `--runner must be one of ${Object.keys(PARSERS).join("|")}`,
      );
      process.stdout.write(
        PARSERS[opts.runner](text, process.cwd()).join("\n") + "\n",
      );
      return 0;
    }
    case "regress": {
      const r = regress({
        root: dirname(specs),
        base: opts.base,
        cmd: opts.cmd,
        runner: opts.runner,
        reportFile: opts["report-file"],
      });
      if (opts.json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
      else
        process.stdout.write(
          `base failures: ${r.base.length}\nhead failures: ${r.head.length}\nregressions:  ${r.regressions.length}\n${r.regressions.map((x) => "  " + x).join("\n")}${r.regressions.length ? "\n" : ""}`,
        );
      return r.regressions.length ? 1 : 0;
    }
    default:
      process.stderr.write(
        "usage: ledger <log|journal|backlog|failures|regress> [--specs dir] ...\n",
      );
      return 2;
  }
}

if (process.argv[1]) {
  let invoked;
  try {
    invoked = pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    invoked = pathToFileURL(process.argv[1]).href;
  }
  if (import.meta.url === invoked) {
    try {
      process.exit(main(process.argv.slice(2)));
    } catch (err) {
      process.stderr.write(`ledger: ${err.message}\n`);
      process.exit(1);
    }
  }
}
