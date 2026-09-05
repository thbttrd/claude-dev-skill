#!/usr/bin/env node
// autopilot.mjs — deterministic driver for the story-based pipeline.
// Node >= 20, stdlib only. Delegates journal/backlog/regress bookkeeping to
// the sibling dev-ledger plugin's ledger.mjs (located, never vendored).
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// ---- Locate + load the dev-ledger CLI --------------------------------------

// An explicit override (arg or $LEDGER) is authoritative: if set, we check
// only that path and never fall back to auto-discovery — a typo'd override
// must read as "not installed", not silently resolve to a different ledger.
export function locateLedger(override = process.env.LEDGER) {
  if (override) return existsSync(override) ? resolve(override) : null;
  const home = process.env.HOME || homedir();
  const r = spawnSync(
    "find",
    [
      "-L",
      join(home, ".claude", "skills"),
      join(home, ".claude", "plugins"),
      "-path",
      "*/dev-ledger/scripts/ledger.mjs",
      "-not",
      "-path",
      "*archive*",
    ],
    { encoding: "utf8" },
  );
  const hit = (r.stdout ?? "").split("\n").find(Boolean);
  if (hit) return resolve(hit);
  const sibling = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../dev-ledger/skills/dev-ledger/scripts/ledger.mjs",
  );
  return existsSync(sibling) ? sibling : null;
}

export async function loadLedger(path) {
  return import(pathToFileURL(path));
}

// ---- JSON + tracker helpers -------------------------------------------------

export function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

export function writeJson(p, obj) {
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  renameSync(tmp, p);
}

// specs/story-NNN-slug, resolved from stories[i].slug; falls back to
// globbing specs/story-NNN-* when the slug can't be looked up (unknown id,
// missing/corrupt stories.json).
export function storyDir(specs, id) {
  const num = String(id).match(/US-(\d+)/)?.[1];
  if (!num) return null;
  try {
    const { stories = [] } = readJson(join(specs, "stories.json"));
    const story = stories.find((s) => s.id === id);
    if (story?.slug) return join(specs, `story-${num}-${story.slug}`);
  } catch {
    // fall through to the glob fallback below
  }
  const prefix = `story-${num}-`;
  const hit = existsSync(specs)
    ? readdirSync(specs).find((d) => d.startsWith(prefix))
    : undefined;
  return hit ? join(specs, hit) : null;
}

export function readState(specs, id) {
  const dir = storyDir(specs, id);
  if (!dir) return null;
  const p = join(dir, "state.json");
  return existsSync(p) ? readJson(p) : null;
}

export function readAutopilot(specs) {
  const p = join(specs, "autopilot.json");
  return existsSync(p) ? readJson(p) : null;
}

// ---- Pre-flight -------------------------------------------------------------

export const DEFAULT_POLICY = "hard-failures+story-end";
export const POLICIES = ["hard-failures", "hard-failures+story-end"];

// Bookkeeping files a run writes as it goes; they don't count as "dirty" for
// the clean-tree check.
const RUN_OWNED_FILES = new Set([
  "specs/autopilot.json",
  "specs/journal.jsonl",
  "specs/backlog.json",
]);

const storyNum = (id) => parseInt(String(id).slice(3), 10);

// Paths reported dirty by `git status --porcelain -z`. A rename/copy entry
// is a 2-token pair ("XY newpath", "oldpath" with no status prefix) — we
// report the new path and consume the old-path token so it isn't
// mis-parsed as its own (status-less) entry.
function porcelainPaths(stdout) {
  const tokens = stdout.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < tokens.length; i++) {
    const status = tokens[i].slice(0, 2);
    paths.push(tokens[i].slice(3));
    if (status[0] === "R" || status[0] === "C") i++; // skip the paired old path
  }
  return paths;
}

export function preflight(specs, opts = {}) {
  const errors = [];
  const target = opts.target;

  const storiesPath = join(specs, "stories.json");
  let data = null;
  if (!existsSync(storiesPath)) {
    errors.push(
      "no specs/stories.json — run /high-level-scoping first (autopilot will not run it)",
    );
  } else {
    try {
      data = readJson(storiesPath);
    } catch (err) {
      errors.push(`specs/stories.json is not valid JSON: ${err.message}`);
    }
  }

  if (!existsSync(join(specs, "ARCHITECTURE.md"))) {
    errors.push(
      "no specs/ARCHITECTURE.md — run /research-and-architecture first (autopilot will not run it)",
    );
  }

  const stories = data?.stories ?? [];
  const story = data ? stories.find((s) => s.id === target) : null;
  if (data && !story) errors.push(`unknown story ${target}`);

  let until = opts.until ?? target;
  if (story) {
    if (story.phase === "backlog") {
      errors.push(
        `${target} is still in backlog — run /high-level-scoping update mode to scope it`,
      );
    }
    if (story.phase === "verified" && !opts.until) {
      errors.push(
        `${target} is already verified — pass --until US-MMM to continue past it`,
      );
    }

    const untilStory = stories.find((s) => s.id === until);
    if (!untilStory) {
      errors.push(`--until ${until} is unknown`);
    } else if (storyNum(until) < storyNum(target)) {
      errors.push(`--until ${until} must not be earlier than ${target}`);
    }

    for (const depId of story.depends_on_story_ids ?? []) {
      const dep = stories.find((s) => s.id === depId);
      if (dep?.is_foundation === true) continue;
      if (dep?.phase !== "verified") {
        errors.push(
          `dependency ${depId} of ${target} is ${dep?.phase ?? "unknown"}, not verified`,
        );
      }
    }

    const architecture = data.architecture ?? {};
    if (
      architecture.tech_stack === undefined &&
      architecture.adrs === undefined &&
      !opts.skip_arch_check
    ) {
      errors.push(
        "ARCHITECTURE.md has not been through /research-and-architecture (no tech_stack/adrs in stories.json) — pass --skip-arch-check for a migrated repo",
      );
    }
  }

  const root = dirname(specs);
  // -z: NUL-separated, no C-style path quoting, and renames come through as
  // an unambiguous "XY newpath\0oldpath\0" pair — plain --porcelain's
  // "oldpath -> newpath" line and quoted paths both break a slice(3) parse.
  const git = spawnSync("git", ["status", "--porcelain", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.error || git.status !== 0) {
    errors.push("not a git repository");
  } else {
    const dirty = porcelainPaths(git.stdout).filter((p) => !RUN_OWNED_FILES.has(p));
    if (dirty.length) {
      errors.push(`working tree not clean: ${dirty.slice(0, 3).join(", ")}`);
    }
  }

  const ap = readAutopilot(specs);
  if (ap?.active === true && !opts.force) {
    errors.push(
      `another run is active (run_id ${ap.run_id ?? "unknown"}) — pass --force to take over`,
    );
  }

  if (!locateLedger(opts.ledger)) {
    errors.push("dev-ledger not installed: /plugin install dev-ledger@claude-dev-skill");
  }

  const stop_policy = opts.stop_policy ?? DEFAULT_POLICY;
  if (!POLICIES.includes(stop_policy)) {
    errors.push(`--stop-policy must be ${POLICIES.join("|")}`);
  }

  if (errors.length) return { ok: false, errors };

  const warnings = [];
  if (opts.skip_arch_check)
    warnings.push("--skip-arch-check used: skipping the /research-and-architecture check");
  if (opts.force) warnings.push("--force used: taking over any active run");

  return { ok: true, target, until, stop_policy, warnings };
}

// ---- Stage resolution --------------------------------------------------------

// One entry per stage name (insertion order matches the pipeline sequence).
// `skill` is the skill this stage invokes, or null when the stage has no
// skill of its own (invest / simplify / code-review are driven by a bundled
// agent instead). `sentinel` is the per-story or per-Op template; the
// story-end call of `spec-implementation` (op === null) uses
// `sentinel_story_end` instead of `sentinel`.
export const STAGES = {
  invest: {
    skill: null,
    agent: "invest-assessor",
    sentinel: "INVEST_VERDICT: (PASS|RE-TIER (light|full)|SPLIT|FAIL .*)",
  },
  "spec-writing": {
    skill: "spec-writing",
    agent: "general-purpose",
    sentinel: "SPEC_COMPLETE_US-NNN",
  },
  "spec-writing-verification": {
    skill: "spec-writing-verification",
    agent: "story-verifier",
    sentinel: "SPEC_AUDIT_COMPLETE_US-NNN",
  },
  "plan-writing": {
    skill: "plan-writing",
    agent: "general-purpose",
    sentinel: "PLAN_COMPLETE_US-NNN",
  },
  "plan-writing-verification": {
    skill: "plan-writing-verification",
    agent: "story-verifier",
    sentinel: "PLAN_AUDIT_COMPLETE_US-NNN",
  },
  "repo-initialization": {
    skill: "repo-initialization",
    agent: "general-purpose",
    sentinel: "REPO_INIT_COMPLETE",
  },
  "test-setup": {
    skill: "test-setup",
    agent: "general-purpose",
    sentinel: "RED_COMPLETE_US-NNN_Op-X",
  },
  "spec-implementation": {
    skill: "spec-implementation",
    agent: "general-purpose",
    sentinel: "GREEN_COMPLETE_US-NNN_Op-X",
    sentinel_story_end: "IMPLEMENTATION_COMPLETE_US-NNN",
  },
  "spec-implementation-verification": {
    skill: "spec-implementation-verification",
    agent: "story-verifier",
    sentinel: "GREEN_AUDIT_COMPLETE_US-NNN_Op-X",
  },
  simplify: {
    skill: null,
    agent: "lazy-simplifier",
    sentinel: "SIMPLIFY_COMPLETE_US-NNN",
  },
  "code-review": {
    skill: null,
    agent: "story-reviewer",
    sentinel: "REVIEW_COMPLETE_US-NNN",
  },
  "verification-and-validation": {
    skill: "verification-and-validation",
    agent: "general-purpose",
    sentinel: "VERIFICATION_COMPLETE_US-NNN",
  },
};

const GREEN_PHASES = new Set(["green", "refactored"]);
const PASSING_VERDICTS = new Set(["PASS", "PASS_WITH_WARNINGS"]);

function renderTemplate(template, story, op) {
  let out = template.replaceAll("US-NNN", story);
  if (op) out = out.replaceAll("Op-X", op);
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const AUTOPILOT_STOP_RE = /AUTOPILOT_STOP_([A-Za-z0-9_]+)/;
const INVEST_VERDICT_RE = /INVEST_VERDICT:\s*(PASS|RE-TIER (?:light|full)|SPLIT|FAIL[^\n<]*)/;

// text may be bare ("SENTINEL") or wrapped ("<promise>SENTINEL</promise>");
// a plain substring search handles both. The lookahead boundary keeps
// "…_Op-1" from matching inside "…_Op-10".
export function matchSentinel(text, stage, story, op) {
  const stop = AUTOPILOT_STOP_RE.exec(text);
  if (stop) return { stop: stop[1] };

  if (stage === "invest") {
    const m = INVEST_VERDICT_RE.exec(text);
    return m ? m[1].trim() : null;
  }

  const entry = STAGES[stage];
  if (!entry) return null;
  const template = op == null && entry.sentinel_story_end ? entry.sentinel_story_end : entry.sentinel;
  const rendered = renderTemplate(template, story, op);
  const re = new RegExp(`${escapeRegExp(rendered)}(?![\\w-])`);
  return re.test(text) ? rendered : null;
}

function stageResult(story, stage, op, rigor) {
  const entry = STAGES[stage];
  const template = op == null && entry.sentinel_story_end ? entry.sentinel_story_end : entry.sentinel;
  return {
    story,
    stage,
    op: op ?? null,
    skill: entry.skill,
    agent: entry.agent,
    sentinel: renderTemplate(template, story, op),
    rigor,
    args: op == null ? story : `${story} ${op}`,
  };
}

function opNum(opId) {
  return parseInt(String(opId).slice(3), 10);
}

function sortOpIds(ids) {
  return [...ids].sort((a, b) => opNum(a) - opNum(b));
}

// Op ids from PLAN.md's "### Operation N — …" headings, used when
// state.json doesn't exist yet (the common case while phase is "planned").
function planOpIds(dir) {
  const planPath = dir && join(dir, "PLAN.md");
  if (!planPath || !existsSync(planPath)) return [];
  const text = readFileSync(planPath, "utf8");
  return [...text.matchAll(/^### Operation (\d+)/gm)].map((m) => `Op-${m[1]}`);
}

function firstOpId(specs, story, dir) {
  const st = readState(specs, story);
  const ids = st?.operations ? Object.keys(st.operations) : planOpIds(dir);
  return sortOpIds(ids)[0] ?? null;
}

function resolveScoped(story, s, rigor) {
  const inv = s.invest ?? {};
  const allTrue = Boolean(inv.i && inv.n && inv.v && inv.e && inv.s && inv.t && inv.checked_at);
  return stageResult(story, allTrue ? "spec-writing" : "invest", null, rigor);
}

function resolveSpecced(story, dir, rigor) {
  const auditPath = dir && join(dir, "verification", "spec-audit.md");
  if (!auditPath || !existsSync(auditPath)) {
    return stageResult(story, "spec-writing-verification", null, rigor);
  }
  return stageResult(story, "plan-writing", null, rigor);
}

function resolvePlanned(specs, story, dir, rigor) {
  const auditPath = dir && join(dir, "verification", "plan-audit.md");
  if (!auditPath || !existsSync(auditPath)) {
    return stageResult(story, "plan-writing-verification", null, rigor);
  }
  const root = dirname(specs);
  if (story === "US-000" && !existsSync(join(root, "package.json"))) {
    return stageResult(story, "repo-initialization", null, rigor);
  }
  return stageResult(story, "test-setup", firstOpId(specs, story, dir), rigor);
}

function resolveRed(specs, story, rigor) {
  const st = readState(specs, story);
  if (!st) {
    return {
      stop: true,
      reason: "spec_contradiction",
      detail: `${story} is phase red but has no state.json`,
    };
  }
  const ops = sortOpIds(Object.keys(st.operations ?? {})).map((id) => ({
    id,
    ...st.operations[id],
  }));

  if (rigor === "full") {
    const needsAudit = ops.find(
      (op) =>
        GREEN_PHASES.has(op.operation_phase) && !PASSING_VERDICTS.has(op.green_audit?.verdict),
    );
    if (needsAudit) {
      return stageResult(story, "spec-implementation-verification", needsAudit.id, rigor);
    }
  }

  const cur = ops.find((op) => !GREEN_PHASES.has(op.operation_phase));
  if (cur) {
    return cur.operation_phase === "red"
      ? stageResult(story, "spec-implementation", cur.id, rigor)
      : stageResult(story, "test-setup", cur.id, rigor);
  }

  if (!st.quality_gates?.simplified) return stageResult(story, "simplify", null, rigor);
  if (!st.quality_gates?.reviewed) return stageResult(story, "code-review", null, rigor);
  return stageResult(story, "spec-implementation", null, rigor);
}

// Lowest-id story with id in (afterId, untilId], eligible to run next: not
// backlog/verified, and every dependency is either the foundation story or
// already verified (mirrors the dependency exemption in `preflight`).
export function nextEligibleStory(stories, afterId, untilId) {
  const afterNum = storyNum(afterId);
  const untilNum = storyNum(untilId);
  const eligible = (s) =>
    storyNum(s.id) > afterNum &&
    storyNum(s.id) <= untilNum &&
    s.phase !== "backlog" &&
    s.phase !== "verified" &&
    (s.depends_on_story_ids ?? []).every((depId) => {
      const dep = stories.find((d) => d.id === depId);
      return dep?.is_foundation === true || dep?.phase === "verified";
    });
  const candidates = stories.filter(eligible).sort((a, b) => storyNum(a.id) - storyNum(b.id));
  return candidates[0]?.id ?? null;
}

function resolveVerified(specs, ap, story, stories) {
  if (story === ap.until) return { done: true, reason: "until_reached", story };
  const storyEndPolicy = String(ap.stop_policy ?? "").includes("story-end");
  if (
    storyEndPolicy &&
    ap.current?.stage === "verification-and-validation" &&
    ap.current.story === story
  ) {
    return { done: true, reason: "story_end", story };
  }
  const next = nextEligibleStory(stories, story, ap.until);
  return next ? resolveForStory(specs, ap, next) : { done: true, reason: "until_reached", story };
}

function resolveForStory(specs, ap, storyId) {
  const data = readJson(join(specs, "stories.json"));
  const stories = data.stories ?? [];
  const s = stories.find((st) => st.id === storyId);
  if (!s) {
    return { stop: true, reason: "spec_contradiction", detail: `unknown story ${storyId}` };
  }
  const rigor = s.rigor ?? "full";
  const dir = storyDir(specs, storyId);

  switch (s.phase) {
    case "verified":
      return resolveVerified(specs, ap, storyId, stories);
    case "scoped":
      return resolveScoped(storyId, s, rigor);
    case "specced":
      return resolveSpecced(storyId, dir, rigor);
    case "planned":
      return resolvePlanned(specs, storyId, dir, rigor);
    case "red":
      return resolveRed(specs, storyId, rigor);
    case "green":
      return stageResult(storyId, "verification-and-validation", null, rigor);
    case "backlog":
      return {
        stop: true,
        reason: "spec_contradiction",
        detail: `${storyId} is still in backlog (preflight should have caught this)`,
      };
    default:
      return {
        stop: true,
        reason: "spec_contradiction",
        detail: `${storyId} has unknown phase ${s.phase}`,
      };
  }
}

// ap is the parsed autopilot.json, or { target, until, stop_policy, current: null }
// for a dry run. Pure: reads trackers, writes nothing.
export function nextStage(specs, ap) {
  const story = ap.current?.story ?? ap.target;
  return resolveForStory(specs, ap, story);
}

// ---- CLI ---------------------------------------------------------------------

// Local copies of ledger.mjs's parseArgs/findSpecsDir: `preflight` must print
// its JSON contract (including "dev-ledger not installed" as one collected
// error) even when the ledger can't be found, so argv/specs resolution can't
// depend on having loaded it first. Subcommands that actually need the
// ledger module (journal/backlog/regress, added by later tasks) load it
// themselves and are free to hard-require it.
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      opts._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    opts[key] = next === undefined || next.startsWith("--") ? true : argv[++i];
  }
  return opts;
}

function findSpecsDir(start = process.cwd(), override = process.env.LEDGER_SPECS) {
  if (override) return resolve(override);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "specs", "stories.json"))) return join(dir, "specs");
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no specs/stories.json found above ${start}`);
    dir = parent;
  }
}

export async function main(argv) {
  const opts = parseArgs(argv);
  const [cmd, arg1] = opts._;

  switch (cmd) {
    case "preflight": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const result = preflight(specs, {
        target: arg1,
        until: opts.until,
        stop_policy: opts["stop-policy"],
        skip_arch_check: Boolean(opts["skip-arch-check"]),
        force: Boolean(opts.force),
        ledger: opts.ledger,
      });
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return result.ok ? 0 : 1;
    }
    case "next": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      let ap;
      if (opts.story) {
        // Dry run: ignore any on-disk autopilot.json entirely.
        ap = {
          target: opts.story,
          until: opts.until ?? opts.story,
          stop_policy: opts["stop-policy"] ?? DEFAULT_POLICY,
          current: null,
        };
      } else {
        ap = readAutopilot(specs);
        if (!ap?.active) {
          process.stderr.write(
            "autopilot: no active run (specs/autopilot.json missing or active=false) — pass --story US-NNN for a dry run\n",
          );
          return 1;
        }
      }
      process.stdout.write(JSON.stringify(nextStage(specs, ap), null, 2) + "\n");
      return 0;
    }
    default:
      process.stderr.write(
        "usage: autopilot preflight US-NNN [--specs dir] [--until US-MMM] [--stop-policy p] [--skip-arch-check] [--force] [--ledger path]\n" +
          "       autopilot next [--story US-NNN] [--until US-MMM] [--stop-policy p] [--specs dir]\n",
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
    main(process.argv.slice(2)).then(
      (code) => process.exit(code),
      (err) => {
        process.stderr.write(`autopilot: ${err.message}\n`);
        process.exit(1);
      },
    );
  }
}
