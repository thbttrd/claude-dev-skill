import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

// Absolute; specs-site.mjs sets it, tests set it before importing this module.
export const SPECS_DIR = resolve(process.env.SPECS_DIR ?? "specs");

export function readJsonFile(path, fallback = null) {
  if (!existsSync(path)) return { data: fallback, error: null };
  try {
    return { data: JSON.parse(readFileSync(path, "utf8")), error: null };
  } catch (err) {
    return { data: fallback, error: `${relative(SPECS_DIR, path)}: ${err.message}` };
  }
}

export const readStories = () =>
  readJsonFile(join(SPECS_DIR, "stories.json"), { stories: [], project: {}, epics: [], personas: [] });
export const readBacklog = () => readJsonFile(join(SPECS_DIR, "backlog.json"), { next_id: 1, items: [] });
export const readAutopilot = () => readJsonFile(join(SPECS_DIR, "autopilot.json"), null);

export function parseJsonl(text) {
  const entries = [];
  text.split("\n").forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = i + 1;
    try {
      entries.push({ line, ...JSON.parse(raw) });
    } catch (err) {
      entries.push({ line, kind: "invalid", ts: null, summary: `line ${line}: ${err.message}`, raw });
    }
  });
  return entries;
}

export function readJournal() {
  const p = join(SPECS_DIR, "journal.jsonl");
  return existsSync(p) ? parseJsonl(readFileSync(p, "utf8")) : [];
}

export function storyDirs() {
  if (!existsSync(SPECS_DIR)) return [];
  return readdirSync(SPECS_DIR)
    .filter((d) => /^story-\d+-/.test(d) && statSync(join(SPECS_DIR, d)).isDirectory())
    .sort();
}

export function storyDir(story) {
  const num = String(story?.id ?? "").match(/US-(\d+)/)?.[1];
  return num ? (storyDirs().find((d) => d.startsWith(`story-${num}-`)) ?? null) : null;
}

export const readState = (dir) =>
  dir ? readJsonFile(join(SPECS_DIR, dir, "state.json"), null) : { data: null, error: null };

export const PHASES = ["backlog", "scoped", "specced", "planned", "red", "green", "verified"];

const opNum = (id) => parseInt(String(id).replace(/\D/g, ""), 10) || 0;

export function opProgress(state) {
  return Object.entries(state?.operations ?? {})
    .sort(([a], [b]) => opNum(a) - opNum(b))
    .map(([id, op]) => ({
      id,
      title: op.title ?? "",
      phase: op.operation_phase ?? "pending",
      confirm_only: op.confirm_only === true,
      red_audit: op.red_audit?.verdict ?? null,
      green_audit: op.green_audit?.verdict ?? null,
    }));
}

const GREEN = new Set(["green", "refactored"]);
const RED = new Set(["red", "red_a", "red_b"]);

// Test Plan rows carry a `scenario` when /test-setup ≥ 3.x wrote them; older
// state files only have covers_scenarios per Op, so the Op's phase is the fallback.
export function scenarioStatus(state, name) {
  const rows = Object.values(state?.test_plan_rows ?? {}).filter((r) => r.scenario === name);
  if (rows.length) {
    if (rows.some((r) => r.type === "manual")) return "manual";
    if (rows.every((r) => r.passing)) return "green";
    return rows.some((r) => r.written) ? "red" : "pending";
  }
  const op = Object.values(state?.operations ?? {}).find((o) => (o.covers_scenarios ?? []).includes(name));
  if (!op) return "pending";
  if (GREEN.has(op.operation_phase)) return "green";
  if (RED.has(op.operation_phase)) return "red";
  return "pending";
}

export function gateVerdicts(journal, storyId) {
  const m = new Map();
  for (const e of journal) {
    if (e.kind === "gate" && e.story === storyId && e.gate)
      m.set(e.gate, { verdict: e.verdict ?? "?", ts: e.ts, report: e.report ?? null, op: e.op ?? null });
  }
  return m;
}

// Files under SPECS_DIR/dirRel with one of `exts`, SPECS_DIR-relative, sorted.
// Dot-directories are skipped: a previous `--build` under specs/.site is not an asset.
export function listFiles(dirRel, exts) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      if (name.startsWith(".")) continue;
      const p = join(abs, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (exts.includes(extname(name))) out.push(relative(SPECS_DIR, p));
    }
  };
  const root = join(SPECS_DIR, dirRel);
  if (existsSync(root)) walk(root);
  return out.sort();
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

// `| --token | #light | #dark | usage |` rows anywhere in DESIGN.md.
export function designTokens(markdown) {
  const out = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ""));
    if (cells.length >= 3 && cells[0].startsWith("--") && HEX.test(cells[1]) && HEX.test(cells[2]))
      out.push({ token: cells[0], light: cells[1], dark: cells[2], usage: cells.at(-1) ?? "" });
  }
  return out;
}

export function excerpt(text, needle, radius = 6) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  return i === -1 ? null : lines.slice(Math.max(0, i - radius), i + radius + 1).join("\n");
}
