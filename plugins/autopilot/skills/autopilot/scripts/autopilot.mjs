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

export function locateLedger(override = process.env.LEDGER) {
  if (override) return resolve(override);
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
  const git = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.error || git.status !== 0) {
    errors.push("not a git repository");
  } else {
    const dirty = git.stdout
      .split("\n")
      .filter(Boolean)
      .filter((line) => !RUN_OWNED_FILES.has(line.slice(3).trim()));
    if (dirty.length) {
      errors.push(
        `working tree not clean: ${dirty
          .slice(0, 3)
          .map((line) => line.slice(3).trim())
          .join(", ")}`,
      );
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

// ---- CLI ---------------------------------------------------------------------

export async function main(argv) {
  const ledgerPath = locateLedger();
  if (!ledgerPath) {
    process.stderr.write(
      "autopilot: dev-ledger not installed: /plugin install dev-ledger@claude-dev-skill\n",
    );
    return 1;
  }
  const ledger = await loadLedger(ledgerPath);
  const opts = ledger.parseArgs(argv);
  const [cmd, arg1] = opts._;
  const getSpecs = () =>
    ledger.findSpecsDir(process.cwd(), opts.specs ?? process.env.LEDGER_SPECS);

  switch (cmd) {
    case "preflight": {
      const result = preflight(getSpecs(), {
        target: arg1,
        until: opts.until,
        stop_policy: opts["stop-policy"],
        skip_arch_check: Boolean(opts["skip-arch-check"]),
        force: Boolean(opts.force),
      });
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return result.ok ? 0 : 1;
    }
    default:
      process.stderr.write(
        "usage: autopilot preflight US-NNN [--specs dir] [--until US-MMM] [--stop-policy p] [--skip-arch-check] [--force]\n",
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
