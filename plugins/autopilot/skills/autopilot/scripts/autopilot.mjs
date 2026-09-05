#!/usr/bin/env node
// autopilot.mjs — deterministic driver for the story-based pipeline.
// Node >= 20, stdlib only. Delegates journal/backlog/regress bookkeeping to
// the sibling dev-ledger plugin's ledger.mjs (located, never vendored).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
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
  const storyMd = story ? join(storyDir(specs, target) ?? "", "STORY.md") : null;
  if (storyMd && existsSync(storyMd) && /\bTODO\b/.test(readFileSync(storyMd, "utf8"))) {
    warnings.push(
      `${target}: STORY.md still carries TODO markers (migrated stub) — the spec/plan audits will run against it; run /spec-writing ${target} to formalise it first`,
    );
  }

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
  const rendered = renderTemplate(sentinelTemplateFor(entry, op), story, op);
  const re = new RegExp(`${escapeRegExp(rendered)}(?![\\w-])`);
  return re.test(text) ? rendered : null;
}

function sentinelTemplateFor(entry, op) {
  return op == null && entry.sentinel_story_end ? entry.sentinel_story_end : entry.sentinel;
}

// Stages with no story-end mode: always need a real Op id. Asking for one of
// these with op == null is a caller bug, not a resolvable pipeline state —
// throw instead of returning an unrenderable "…_Op-X" sentinel the conductor
// could never match (see resolvePlanned's zero-Operation stop for the actual
// pipeline-state version of "no Op id").
const PER_OP_ONLY_STAGES = new Set(["test-setup", "spec-implementation-verification"]);

function stageResult(story, stage, op, rigor) {
  const entry = STAGES[stage];
  if (op == null && PER_OP_ONLY_STAGES.has(stage)) {
    throw new Error(`stageResult: ${stage} requires an Op id, got null`);
  }
  return {
    story,
    stage,
    op: op ?? null,
    skill: entry.skill,
    agent: entry.agent,
    sentinel: renderTemplate(sentinelTemplateFor(entry, op), story, op),
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

// A verification report existing isn't enough — story-verifier writes the
// report file before it handles a FAIL, so a FAILed audit must re-resolve to
// the audit stage on resume rather than being treated as passed.
function auditPassed(p) {
  if (!p || !existsSync(p)) return false;
  return !/^## Overall Verdict:\s*FAIL/m.test(readFileSync(p, "utf8"));
}

function resolveSpecced(story, dir, rigor) {
  const auditPath = dir && join(dir, "verification", "spec-audit.md");
  if (!auditPassed(auditPath)) {
    return stageResult(story, "spec-writing-verification", null, rigor);
  }
  return stageResult(story, "plan-writing", null, rigor);
}

function resolvePlanned(specs, story, dir, rigor) {
  const auditPath = dir && join(dir, "verification", "plan-audit.md");
  if (!auditPassed(auditPath)) {
    return stageResult(story, "plan-writing-verification", null, rigor);
  }
  const root = dirname(specs);
  if (story === "US-000" && !existsSync(join(root, "package.json"))) {
    return stageResult(story, "repo-initialization", null, rigor);
  }
  const op = firstOpId(specs, story, dir);
  if (!op) {
    return {
      stop: true,
      reason: "spec_contradiction",
      detail: "PLAN.md lists no Operations (no '### Operation N' heading) and no state.json exists",
    };
  }
  return stageResult(story, "test-setup", op, rigor);
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
  const opIds = st.operations && typeof st.operations === "object" ? Object.keys(st.operations) : [];
  if (opIds.length === 0) {
    return {
      stop: true,
      reason: "spec_contradiction",
      detail:
        "state.json has no operations map (legacy shape) — run /test-setup US-NNN to (re)create it from PLAN.md, or /migrate-specs",
    };
  }
  const ops = sortOpIds(opIds).map((id) => ({ id, ...st.operations[id] }));

  if (rigor === "full") {
    const needsAudit = ops.find(
      (op) =>
        GREEN_PHASES.has(op.operation_phase) &&
        op.confirm_only !== true && // green at base, no production diff: nothing to audit per Op
        !PASSING_VERDICTS.has(op.green_audit?.verdict),
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

// ---- Run lifecycle ------------------------------------------------------------

// Every lifecycle function loads the ledger itself when the caller (a fresh
// CLI invocation) hasn't already loaded one; `main` loads it once per
// subcommand and passes it down via deps so a whole `start`..`stop` process
// group only pays the locate+import cost once per command.
async function defaultLedger(override) {
  const path = locateLedger(override);
  if (!path) {
    throw new Error("dev-ledger not installed: /plugin install dev-ledger@claude-dev-skill");
  }
  return loadLedger(path);
}

function withAutopilot(specs) {
  const ap = readAutopilot(specs);
  if (!ap?.active) {
    throw new Error("autopilot: no active run (specs/autopilot.json missing or active=false)");
  }
  return ap;
}

function autopilotPath(specs) {
  return join(specs, "autopilot.json");
}

function stageArgs(story, op) {
  return op ? `${story} ${op}` : story;
}

const todayStr = (now) => now.toISOString().slice(0, 10);

function gitOut(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

// specs/autopilot.json is per-machine run state. Keep it out of `git status`
// through the repo-local exclude file, not the tracked .gitignore — editing
// .gitignore would dirty the tree start() just checked was clean.
function excludeAutopilotJson(root) {
  const rel = gitOut(root, ["rev-parse", "--git-path", "info/exclude"]);
  if (!rel) return false;
  const p = resolve(root, rel);
  const text = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (text.split("\n").includes("specs/autopilot.json")) return false;
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, `${text && !text.endsWith("\n") ? "\n" : ""}specs/autopilot.json\n`);
  return true;
}

// The story's diff base for the simplify / code-review gates: HEAD when a run
// first picks the story up, recorded once and carried across resumes so a
// later run never moves the base past the story's own commits.
function recordBaseSha(specs, ap, story) {
  ap.base_sha ??= {};
  if (ap.base_sha[story]) return;
  const sha = gitOut(dirname(specs), ["rev-parse", "HEAD"]);
  if (sha) ap.base_sha[story] = sha;
}

// The invest-assessor agent only emits a verdict word (PASS / RE-TIER tier);
// unlike the skill-driven stages, which write their own tracker state,
// autopilot has to turn that verdict into the stories.json write itself.
function applyInvestPass(specs, story, now, rigor) {
  const storiesPath = join(specs, "stories.json");
  const data = readJson(storiesPath);
  const s = data.stories.find((st) => st.id === story);
  const today = todayStr(now);
  s.invest = { i: true, n: true, v: true, e: true, s: true, t: true, checked_at: today };
  if (rigor) s.rigor = rigor;
  data.project.updated_at = today;
  writeJson(storiesPath, data);
}

export async function start(specs, opts, deps = {}) {
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const now = deps.now ?? new Date();

  const pf = preflight(specs, {
    target: opts.target,
    until: opts.until,
    stop_policy: opts.stop_policy,
    skip_arch_check: opts.skip_arch_check,
    force: opts.force,
  });
  if (!pf.ok) return { ok: false, errors: pf.errors };

  const prevAp = readAutopilot(specs);
  const ap = {
    active: true,
    run_id: `run-${now.toISOString()}`,
    target: pf.target,
    until: pf.until,
    stop_policy: pf.stop_policy,
    skip_arch_check: Boolean(opts.skip_arch_check),
    base_sha: { ...(prevAp?.base_sha ?? {}) },
    current: null,
    last_next: null,
    started_at: now.toISOString(),
    stopped_at: null,
    stop_reason: null,
  };
  recordBaseSha(specs, ap, pf.target);
  writeJson(autopilotPath(specs), ap);

  ledger.log(
    specs,
    {
      kind: "action",
      summary: `autopilot start target=${ap.target} until=${ap.until} policy=${ap.stop_policy}`,
      run_id: ap.run_id,
      story: ap.target,
      op: null,
      stage: "autopilot",
    },
    now,
  );

  if (prevAp?.active) {
    ledger.log(
      specs,
      {
        kind: "decision",
        summary: `force: took over run ${prevAp.run_id}`,
        run_id: ap.run_id,
        story: ap.target,
        op: null,
        stage: "autopilot",
      },
      now,
    );
  }

  if (opts.skip_arch_check) {
    ledger.log(
      specs,
      {
        kind: "decision",
        summary: "--skip-arch-check: architecture check bypassed (migrated repo)",
        run_id: ap.run_id,
        story: ap.target,
        op: null,
        stage: "autopilot",
      },
      now,
    );
  }

  if (excludeAutopilotJson(dirname(specs))) {
    ledger.log(
      specs,
      {
        kind: "action",
        summary: "added specs/autopilot.json to .git/info/exclude (local run state, never committed)",
        run_id: ap.run_id,
        story: ap.target,
        op: null,
        stage: "autopilot",
      },
      now,
    );
  }

  return { ...ap, warnings: pf.warnings };
}

export async function stageStart(specs, opts, deps = {}) {
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const now = deps.now ?? new Date();
  const ap = withAutopilot(specs);

  const { story, stage, agent } = opts;
  const op = opts.op ?? null;
  const prev = ap.current;
  const sameStage =
    prev && prev.story === story && prev.stage === stage && (prev.op ?? null) === op;
  const attempt = sameStage ? prev.attempt : 1;

  ap.current = { story, stage, op, agent, started_at: now.toISOString(), attempt };
  writeJson(autopilotPath(specs), ap);

  ledger.log(
    specs,
    {
      kind: "stage_start",
      summary: `${stage} ${stageArgs(story, op)} via ${agent} (attempt ${attempt})`,
      run_id: ap.run_id,
      story,
      op,
      stage,
      agent,
    },
    now,
  );

  return ap;
}

export async function stageEnd(specs, opts, deps = {}) {
  if (!["sentinel", "no_sentinel", "stop"].includes(opts.outcome)) {
    throw new Error(`stage-end: --outcome must be sentinel|no_sentinel|stop, got ${opts.outcome}`);
  }
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const now = deps.now ?? new Date();
  const ap = withAutopilot(specs);
  const current = ap.current;
  const { story, stage, op, agent } = current;
  const args = stageArgs(story, op);

  if (opts.outcome === "stop") {
    await stop(specs, { reason: opts.reason }, { ledger, now });
    return { action: "stop", reason: opts.reason };
  }

  if (opts.outcome === "no_sentinel") {
    if (current.attempt === 1) {
      const tail = (opts.tail ?? "").slice(0, 400);
      ledger.log(
        specs,
        {
          kind: "action",
          summary: `retry ${current.attempt + 1}/2: ${stage} returned no sentinel: ${tail}`,
          run_id: ap.run_id,
          story,
          op,
          stage,
          agent,
        },
        now,
      );
      ap.current = { ...current, attempt: 2 };
      writeJson(autopilotPath(specs), ap);
      return { action: "retry", attempt: 2 };
    }
    await stop(
      specs,
      {
        reason: "stage_no_sentinel",
        summary: `${stage} ${args} returned no sentinel after 2 attempts`,
      },
      { ledger, now },
    );
    return { action: "stop", reason: "stage_no_sentinel" };
  }

  // opts.outcome === "sentinel"
  ledger.log(
    specs,
    {
      kind: "stage_end",
      summary: `${stage} ${args} ok`,
      run_id: ap.run_id,
      story,
      op,
      stage,
      agent,
    },
    now,
  );

  if (stage === "invest") {
    const verdict = opts.verdict;
    if (verdict === "PASS") {
      applyInvestPass(specs, story, now, null);
      ledger.log(
        specs,
        { kind: "gate", gate: "invest", verdict: "PASS", summary: "gate invest PASS", run_id: ap.run_id, story, op, stage },
        now,
      );
    } else if (verdict?.startsWith("RE-TIER")) {
      const tier = verdict.split(" ")[1];
      applyInvestPass(specs, story, now, tier);
      ledger.log(
        specs,
        { kind: "gate", gate: "invest", verdict: "PASS", summary: `gate invest PASS (re-tiered to ${tier})`, run_id: ap.run_id, story, op, stage },
        now,
      );
      ledger.log(
        specs,
        {
          kind: "decision",
          summary: `re-tiered to ${tier} by invest-assessor`,
          run_id: ap.run_id,
          story,
          op,
          stage,
        },
        now,
      );
    } else if (verdict === "SPLIT") {
      await stop(
        specs,
        { reason: "split_required", summary: `invest verdict ${verdict}` },
        { ledger, now },
      );
      return { action: "stop", reason: "split_required" };
    } else if (verdict?.startsWith("FAIL")) {
      ledger.log(
        specs,
        {
          kind: "gate",
          gate: "invest",
          verdict: "FAIL",
          summary: `gate invest FAIL: ${verdict}`,
          run_id: ap.run_id,
          story,
          op,
          stage,
        },
        now,
      );
      await stop(specs, { reason: "spec_contradiction", summary: verdict }, { ledger, now });
      return { action: "stop", reason: "spec_contradiction" };
    }
  }

  const next = nextStage(specs, ap);
  ap.last_next = next;

  if (!next.done && !next.stop) {
    const same =
      next.story === current.story && next.stage === current.stage && (next.op ?? null) === op;
    if (same) {
      writeJson(autopilotPath(specs), ap);
      await stop(
        specs,
        { reason: "stage_no_progress", summary: `${stage} ${args} made no progress` },
        { ledger, now },
      );
      return { action: "stop", reason: "stage_no_progress" };
    }
  }

  if (!next.done && !next.stop && next.story !== current.story) recordBaseSha(specs, ap, next.story);
  writeJson(autopilotPath(specs), ap);
  return { action: "continue", next };
}

export async function stop(specs, opts, deps = {}) {
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const now = deps.now ?? new Date();
  const ap = readAutopilot(specs) ?? {};
  // A stage agent that hard-stops per contract §2.3 has already written
  // stop_reason and journaled the stop; the conductor's stage-end must not
  // record the same stop a second time.
  const alreadyJournaled = opts.reason != null && ap.stop_reason === opts.reason;

  if (ap.active === true) {
    ap.active = false;
    ap.stopped_at = now.toISOString();
    ap.stop_reason = opts.reason ?? null;
    writeJson(autopilotPath(specs), ap);
  }

  if (!alreadyJournaled) {
    ledger.log(
      specs,
      {
        kind: "stop",
        summary: opts.summary ? `${opts.reason}: ${opts.summary}` : String(opts.reason),
        run_id: ap.run_id ?? null,
        story: ap.current?.story ?? ap.target ?? null,
        op: ap.current?.op ?? null,
        stage: ap.current?.stage ?? "autopilot",
      },
      now,
    );
  }

  return report(specs, { run_id: ap.run_id ?? null }, { ledger, now });
}

function renderReportText({ run_id, target, until, stop_reason, stages, gates, backlog_ids, commits }) {
  const block = (label, lines) => `${label}:\n${lines.length ? lines.join("\n") : "  (none)"}`;
  return (
    [
      `autopilot report ${run_id}  target=${target ?? "?"}  until=${until ?? "?"}  stop_reason=${stop_reason ?? "?"}`,
      "",
      block(
        "stages",
        stages.map((s) =>
          s.outcome === "stop"
            ? `  ${s.stage == null || s.stage === "autopilot" ? "run" : `${stageArgs(s.story, s.op)} ${s.stage}`} — stop (${s.reason})`
            : `  ${stageArgs(s.story, s.op)} ${s.stage} — ok`,
        ),
      ),
      "",
      block(
        "gates",
        gates.map((g) => `  ${stageArgs(g.story, g.op)} ${g.gate} — ${g.verdict}`),
      ),
      "",
      block(
        "backlog",
        backlog_ids.map((id) => `  ${id}`),
      ),
      "",
      block(
        "commits",
        commits.map((c) => `  ${c.sha} ${c.summary}`),
      ),
    ].join("\n") + "\n"
  );
}

export async function report(specs, opts, deps = {}) {
  const { run_id } = opts;
  if (run_id == null) {
    return {
      run_id: null,
      target: null,
      until: null,
      stop_reason: null,
      stages: [],
      gates: [],
      backlog_ids: [],
      commits: [],
      text: "autopilot report: no autopilot run on record\n",
    };
  }
  const ledger = deps.ledger ?? (await defaultLedger(opts.ledger));
  const entries = ledger.readJournal(specs).filter((e) => e.run_id === run_id);
  const ap = readAutopilot(specs);
  const matchesRun = ap?.run_id === run_id;

  const stopReason = (e) => (e.summary ?? "").split(":")[0].trim() || "?";
  const seenStages = new Set();
  const stages = [];
  for (const e of entries) {
    if (e.kind !== "stage_end" && e.kind !== "stop") continue;
    const s = { stage: e.stage, story: e.story, op: e.op, outcome: e.kind === "stage_end" ? "ok" : "stop" };
    if (e.kind === "stop") s.reason = stopReason(e);
    const key = [s.story, s.op, s.stage, s.outcome].join("|");
    if (seenStages.has(key)) continue; // the same stage journaled twice (two agents, or agent + conductor) is one line
    seenStages.add(key);
    stages.push(s);
  }

  // One line per gate: the last verdict wins, first appearance keeps its place.
  const gateByKey = new Map();
  for (const e of entries.filter((e) => e.kind === "gate")) {
    gateByKey.set([e.story, e.op, e.gate].join("|"), {
      gate: e.gate, verdict: e.verdict, story: e.story, op: e.op, report: e.report ?? null,
    });
  }
  const gates = [...gateByKey.values()];

  const backlog_ids = entries.filter((e) => e.kind === "finding" && e.backlog_id).map((e) => e.backlog_id);

  const journaledCommits = entries
    .filter((e) => e.kind === "commit")
    .map((e) => ({ sha: e.sha, summary: e.summary }));

  const since = matchesRun ? ap.started_at : [...entries].map((e) => e.ts).sort()[0];
  let gitCommits = [];
  if (since) {
    const r = spawnSync("git", ["log", `--since=${since}`, "--format=%h%x1f%s"], {
      cwd: dirname(specs),
      encoding: "utf8",
    });
    if (r.status === 0) {
      gitCommits = (r.stdout ?? "")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [sha, summary] = line.split("\x1f");
          return { sha, summary };
        });
    }
  }

  // git's own order first (newest first, as `git log` prints); journaled
  // shas HEAD no longer reaches (an --amend after journaling) come last,
  // marked. `rev-parse --verify` is not enough: a dangling pre-amend commit
  // still exists in the object store until gc — ancestry of HEAD is the test.
  const root = dirname(specs);
  const reachable = (sha) =>
    spawnSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: root, stdio: "ignore" }).status === 0;
  const sameSha = (a, b) => a.startsWith(b) || b.startsWith(a);
  const commits = [...gitCommits];
  for (const c of journaledCommits) {
    if (!c.sha || commits.some((k) => sameSha(k.sha, c.sha))) continue;
    commits.push(reachable(c.sha) ? c : { ...c, summary: `${c.summary} (unreachable)`, unreachable: true });
  }

  const result = {
    run_id,
    target: matchesRun ? ap.target : null,
    until: matchesRun ? ap.until : null,
    stop_reason: matchesRun ? ap.stop_reason : null,
    stages,
    gates,
    backlog_ids,
    commits,
  };
  result.text = renderReportText(result);
  return result;
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
    case "start": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const ledger = await defaultLedger(opts.ledger);
      const result = await start(
        specs,
        {
          target: arg1,
          until: opts.until,
          stop_policy: opts["stop-policy"],
          skip_arch_check: Boolean(opts["skip-arch-check"]),
          force: Boolean(opts.force),
        },
        { ledger },
      );
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return result.ok === false ? 1 : 0;
    }
    case "stage-start": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const ledger = await defaultLedger(opts.ledger);
      const result = await stageStart(
        specs,
        { story: opts.story, stage: opts.stage, op: opts.op ?? null, agent: opts.agent },
        { ledger },
      );
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return 0;
    }
    case "stage-end": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const ledger = await defaultLedger(opts.ledger);
      const result = await stageEnd(
        specs,
        { outcome: opts.outcome, verdict: opts.verdict, reason: opts.reason, tail: opts.tail },
        { ledger },
      );
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return 0;
    }
    case "stop": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const ledger = await defaultLedger(opts.ledger);
      const result = await stop(specs, { reason: opts.reason, summary: opts.summary }, { ledger });
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return 0;
    }
    case "report": {
      const specs = findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);
      const ledger = await defaultLedger(opts.ledger);
      const run_id = opts["run-id"] ?? readAutopilot(specs)?.run_id;
      if (!run_id) throw new Error("autopilot report: no --run-id given and no specs/autopilot.json found");
      const result = await report(specs, { run_id }, { ledger });
      process.stdout.write(opts.json ? JSON.stringify(result, null, 2) + "\n" : result.text);
      return 0;
    }
    default:
      process.stderr.write(
        "usage: autopilot preflight US-NNN [--specs dir] [--until US-MMM] [--stop-policy p] [--skip-arch-check] [--force] [--ledger path]\n" +
          "       autopilot next [--story US-NNN] [--until US-MMM] [--stop-policy p] [--specs dir]\n" +
          "       autopilot start US-NNN [--until US-MMM] [--stop-policy p] [--skip-arch-check] [--force] [--specs dir]\n" +
          "       autopilot stage-start --story US-NNN --stage s [--op Op-N] [--agent a] [--specs dir]\n" +
          "       autopilot stage-end --outcome sentinel|no_sentinel|stop [--verdict v] [--reason r] [--tail t] [--specs dir]\n" +
          "       autopilot stop --reason r [--summary s] [--specs dir]\n" +
          "       autopilot report [--run-id id] [--json] [--specs dir]\n",
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
