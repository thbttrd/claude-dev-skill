#!/usr/bin/env node
// Migrate a legacy `docs/project-tracking.json` (version+wave model) to the
// story-based `specs/stories.json` + `specs/STORIES.md` + `specs/MIGRATION.md`.
//
// Best-effort: copies straightforward fields verbatim, derives `phase` from
// the legacy version state, leaves `depends_on_story_ids` empty by default,
// and emits a MIGRATION.md listing the manual steps that remain (foundation
// pick, dependency edits, file moves under specs/story-NNN-slug/).
//
// Usage:
//   node scripts/migrate-tracking.mjs                       # default paths
//   node scripts/migrate-tracking.mjs --input <p> --out <d> # override paths
//   node scripts/migrate-tracking.mjs --force               # overwrite specs/

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { argv, exit } from "node:process";

const DEFAULT_INPUT = "docs/project-tracking.json";
const DEFAULT_OUTPUT_DIR = "specs";
const SCHEMA_VERSION = "2.0.0";

function parseArgs(args) {
  const opts = { input: DEFAULT_INPUT, outputDir: DEFAULT_OUTPUT_DIR, force: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--input") opts.input = args[++i];
    else if (a === "--out" || a === "--output-dir") opts.outputDir = args[++i];
    else if (a === "--force") opts.force = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        `migrate-tracking.mjs — convert docs/project-tracking.json to specs/stories.json\n\n` +
          `  --input <path>       legacy file (default: ${DEFAULT_INPUT})\n` +
          `  --out <dir>          output directory (default: ${DEFAULT_OUTPUT_DIR})\n` +
          `  --force              overwrite existing files in --out\n` +
          `  --help               this message\n`,
      );
      exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      exit(2);
    }
  }
  return opts;
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function indexBy(arr, key) {
  const out = new Map();
  for (const item of arr ?? []) out.set(item[key], item);
  return out;
}

function classifyPhase(versionEntry, story) {
  if (!versionEntry) {
    return story?.spec ? "specced" : "backlog";
  }
  if (versionEntry.verification?.status === "passed") return "verified";
  if (versionEntry.implementation?.status === "completed") return "green";
  if (versionEntry.test_setup?.status === "completed") return "red";
  if (versionEntry.planning?.status === "planned") return "planned";
  if (versionEntry.spec_status === "complete" || story?.spec) return "specced";
  return "scoped";
}

function dropVersionSegment(p) {
  if (!p || typeof p !== "string") return p;
  return p.replace(/^docs\/V\d+\//, "specs/").replace(/^docs\//, "specs/");
}

function migrate(legacy) {
  const project = {
    name: legacy.project?.name ?? "Unnamed project",
    description: legacy.project?.description ?? "",
    created_at: legacy.project?.created_at ?? todayISO(),
    updated_at: todayISO(),
    scaffolded_at: null,
    repo_branch: null,
  };

  const versionsById = indexBy(legacy.roadmap?.versions ?? [], "id");
  const storyToVersion = new Map();
  for (const v of legacy.roadmap?.versions ?? []) {
    for (const usId of v.user_story_ids ?? []) storyToVersion.set(usId, v.id);
  }

  // Find foundation: the first story listed in V0, if V0 exists.
  const v0 = versionsById.get("V0");
  const foundationId = v0?.user_story_ids?.[0] ?? null;

  // Flatten epics.user_stories[] into top-level stories[], add epic_id.
  const stories = [];
  const epics = (legacy.epics ?? []).map((e) => {
    const storyIds = (e.user_stories ?? []).map((s) => s.id);
    for (const us of e.user_stories ?? []) {
      const versionId = storyToVersion.get(us.id);
      const versionEntry = versionId ? versionsById.get(versionId) : null;
      const phase = classifyPhase(versionEntry, us);
      const isFoundation = us.id === foundationId;

      const story = {
        id: us.id,
        slug: slugify(us.title || us.id),
        title: us.title ?? "",
        is_foundation: isFoundation,
        epic_id: e.id,
        as_a: us.as_a ?? "",
        i_want: us.i_want ?? "",
        so_that: us.so_that ?? "",
        priority: us.priority ?? "should-have",
        business_impact: us.business_impact ?? "medium",
        acceptance_criteria: us.acceptance_criteria ?? [],
        depends_on_story_ids: [], // user fills in (see MIGRATION.md)
        invest: { i: false, n: false, v: false, e: false, s: false, t: false, checked_at: null },
        phase,
        artifacts: {
          story_doc: null,
          plan: null,
          feature_files: us.spec?.feature_file ? [dropVersionSegment(us.spec.feature_file)] : [],
          mockups: us.ui?.mockup_desktop ? [dropVersionSegment(us.ui.mockup_desktop)] : [],
          ui_specs: us.ui?.screen_spec ? [dropVersionSegment(us.ui.screen_spec)] : [],
          qa_report: null,
        },
        history: [{ phase, at: todayISO(), note: "migrated from project-tracking.json" }],
      };

      if (us.spec?.specified_at) story.spec = { rules: us.spec.rules ?? [], specified_at: us.spec.specified_at };
      if (versionEntry?.planning?.planned_at)
        story.planning = { operations_count: null, planned_at: versionEntry.planning.planned_at };
      if (versionEntry?.test_setup?.completed_at)
        story.test_setup = { completed_at: versionEntry.test_setup.completed_at };
      if (versionEntry?.implementation?.completed_at)
        story.implementation = {
          started_at: versionEntry.implementation.started_at ?? null,
          completed_at: versionEntry.implementation.completed_at,
        };
      if (versionEntry?.verification?.status === "passed")
        story.verification = {
          qa_report: null,
          scenarios_passed: versionEntry.verification.scenarios_passed ?? null,
          scenarios_failed: versionEntry.verification.scenarios_failed ?? null,
          verified_at: versionEntry.verification.verified_at ?? null,
        };

      stories.push(story);
    }
    return {
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      persona_ids: e.persona_ids ?? [],
      priority: e.priority ?? "should-have",
      business_impact: e.business_impact ?? "medium",
      story_ids: storyIds,
    };
  });

  const arch = legacy.architecture ?? {};
  const architecture = {
    modules: arch.modules ?? [],
    diagram_path: dropVersionSegment(arch.diagram_path) ?? "specs/architecture.png",
  };
  if (arch.detailed_modules) architecture.detailed_modules = arch.detailed_modules;
  if (arch.tech_stack) architecture.tech_stack = arch.tech_stack;
  if (arch.adrs) architecture.adrs = arch.adrs;
  if (arch.detailed_diagram_path)
    architecture.detailed_diagram_path = dropVersionSegment(arch.detailed_diagram_path);
  if (arch.architecture_doc)
    architecture.architecture_doc = dropVersionSegment(arch.architecture_doc);
  if (arch.detailed_at) architecture.detailed_at = arch.detailed_at;

  return {
    schema_version: SCHEMA_VERSION,
    project,
    personas: legacy.personas ?? [],
    epics,
    stories,
    architecture,
  };
}

const PHASE_ORDER = ["verified", "green", "red", "planned", "specced", "scoped", "backlog"];
const PHASE_HEADINGS = {
  verified: "✅ Verified",
  green: "🟢 Green (awaiting verification)",
  red: "🔴 Red (tests written, awaiting implementation)",
  planned: "📋 Planned (PLAN.md ready)",
  specced: "📝 Specced (STORY.md + features ready)",
  scoped: "🟡 Scoped (in backlog, INVEST-checked)",
  backlog: "⚪ Backlog",
};

function renderStoriesMd(data) {
  const counts = Object.fromEntries(PHASE_ORDER.map((p) => [p, 0]));
  for (const s of data.stories) counts[s.phase] = (counts[s.phase] ?? 0) + 1;
  const total = data.stories.length;

  const lines = [];
  lines.push(`# Stories — ${data.project.name}`);
  lines.push("");
  lines.push(
    `_Regenerated from \`specs/stories.json\` on ${data.project.updated_at}. Manual edits will be overwritten._`,
  );
  lines.push("");
  const summary = PHASE_ORDER.map((p) => `${counts[p]} ${p}`).join(" · ");
  lines.push(`**Project phase summary:** ${summary} (out of ${total} total)`);
  lines.push("");
  lines.push("## Kanban");
  lines.push("");

  for (const phase of PHASE_ORDER) {
    lines.push(`### ${PHASE_HEADINGS[phase]}`);
    lines.push("");
    const inPhase = data.stories
      .filter((s) => s.phase === phase)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (phase === "backlog") {
      lines.push("| ID | Title | Epic | Priority |");
      lines.push("| --- | --- | --- | --- |");
      for (const s of inPhase)
        lines.push(`| ${s.id} | ${s.title} | ${s.epic_id} | ${s.priority} |`);
    } else if (phase === "verified") {
      lines.push("| ID | Title | Epic | Priority | Depends on | Verified |");
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const s of inPhase)
        lines.push(
          `| ${s.id} | ${s.title} | ${s.epic_id} | ${s.priority} | ${
            s.depends_on_story_ids.join(", ") || "—"
          } | ${s.verification?.verified_at ?? ""} |`,
        );
    } else {
      lines.push("| ID | Title | Epic | Priority | Depends on |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const s of inPhase)
        lines.push(
          `| ${s.id} | ${s.title} | ${s.epic_id} | ${s.priority} | ${
            s.depends_on_story_ids.join(", ") || "—"
          } |`,
        );
    }
    lines.push("");
  }

  lines.push("## Dependency view");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  const phaseEmoji = {
    verified: "✅",
    green: "🟢",
    red: "🔴",
    planned: "📋",
    specced: "📝",
    scoped: "🟡",
    backlog: "⚪",
  };
  for (const s of data.stories) {
    if (s.phase === "backlog") continue;
    const id = s.id.replace(/-/g, "");
    lines.push(`  ${id}[${s.id} ${s.title} ${phaseEmoji[s.phase]}]`);
  }
  for (const s of data.stories) {
    if (s.phase === "backlog") continue;
    for (const dep of s.depends_on_story_ids) {
      lines.push(`  ${dep.replace(/-/g, "")} --> ${s.id.replace(/-/g, "")}`);
    }
  }
  lines.push("```");
  lines.push("");

  lines.push("## Epics");
  lines.push("");
  lines.push("| Epic | Title | Stories | Priority |");
  lines.push("| --- | --- | --- | --- |");
  for (const e of data.epics)
    lines.push(`| ${e.id} | ${e.title} | ${e.story_ids.join(", ") || "—"} | ${e.priority} |`);
  lines.push("");

  return lines.join("\n");
}

function renderMigrationMd(data, opts) {
  const today = todayISO();
  const foundation = data.stories.find((s) => s.is_foundation);
  const moves = [];
  for (const s of data.stories) {
    const dir = `specs/story-${s.id.replace("US-", "").padStart(3, "0")}-${s.slug}`;
    for (const f of s.artifacts.feature_files ?? [])
      moves.push(`mv ${legacyPathHint(f)} ${dir}/features/`);
    for (const m of s.artifacts.mockups ?? []) moves.push(`mv ${legacyPathHint(m)} ${dir}/mockups/`);
    for (const u of s.artifacts.ui_specs ?? []) moves.push(`mv ${legacyPathHint(u)} ${dir}/ui/`);
  }

  const lines = [
    "# Migration log",
    "",
    `_Generated on ${today} by \`scripts/migrate-tracking.mjs\` from \`${opts.input}\`._`,
    "",
    "## What was migrated",
    "",
    `- **Project:** ${data.project.name}`,
    `- **Personas:** ${data.personas.length}`,
    `- **Epics:** ${data.epics.length}`,
    `- **Stories:** ${data.stories.length}`,
    `- **Foundation candidate:** ${foundation ? foundation.id + " — " + foundation.title : "(none — set `is_foundation: true` on the right story manually)"}`,
    "",
    "## What still needs manual attention",
    "",
    "1. **Pick the Foundation Story.** The migration script defaulted to V0's first story.",
    "   If a different story is the true walking skeleton, update `is_foundation` in `specs/stories.json` and rename the directory accordingly.",
    "2. **Set `depends_on_story_ids`.** The migration left every story's dependency list empty.",
    "   Walk the backlog top-to-bottom and add the upstream stories each one needs.",
    "3. **Run INVEST checks.** Every story has `invest.{i,n,v,e,s,t} = false`.",
    "   `/spec-writing` will run the INVEST gate when each story is specced; you may also pre-fill these via `/high-level-scoping` in update mode.",
    "4. **Move per-story artifacts.** Migrate feature files, mockups, and per-screen specs from the legacy `docs/V*/` tree into the new `specs/story-NNN-slug/` directories. Suggested moves below — review before running.",
    "5. **Move project-wide artifacts.** Architecture diagrams, ARCHITECTURE.md, DESIGN.md, and any QA reports should move from `docs/V*/architecture/` and `docs/V*/specs/` to `specs/`. Use the latest version's copy as the source of truth.",
    "6. **Delete `docs/V*/` and `docs/project-tracking.json`** once the moves are complete and verified.",
    "",
    "## Suggested file moves",
    "",
    "Review and adapt before running. The script does NOT move files — only copies tracking metadata.",
    "",
    "```bash",
    "# Per-story artifacts (sourced from stories[i].artifacts paths)",
    ...(moves.length ? moves : ["# (none detected in the legacy file)"]),
    "",
    "# Project-wide artifacts (manual; pick the latest V*/ that has the freshest copy)",
    "# mv docs/V<latest>/architecture/ARCHITECTURE.md specs/ARCHITECTURE.md",
    "# mv docs/V<latest>/architecture/architecture.png specs/architecture.png",
    "# mv docs/V<latest>/architecture/architecture-detailed.png specs/architecture-detailed.png",
    "# mv docs/V<latest>/specs/DESIGN.md specs/DESIGN.md",
    "```",
    "",
    "## Verification",
    "",
    "After moves are complete, run the relevant `*-verification` skills (e.g. `/research-and-architecture-verification`, `/spec-writing-verification` per story) to confirm the new layout passes each skill's pre-flight checks.",
    "",
    "Once everything is verified, delete `docs/`:",
    "",
    "```bash",
    "rm -rf docs/",
    "```",
    "",
  ];
  return lines.join("\n");
}

function legacyPathHint(p) {
  // The migration drops V0/V1 segments; reconstruct a plausible legacy path
  // hint for the suggested-mv command. The user adjusts the version segment.
  if (!p) return p;
  return p.replace(/^specs\//, "docs/V<latest>/");
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function main() {
  const opts = parseArgs(argv.slice(2));

  if (!existsSync(opts.input)) {
    console.error(`error: legacy file not found at ${opts.input}`);
    console.error(`hint: pass --input <path> if your tracking file lives elsewhere.`);
    exit(1);
  }

  const outJson = join(opts.outputDir, "stories.json");
  const outMd = join(opts.outputDir, "STORIES.md");
  const outMigration = join(opts.outputDir, "MIGRATION.md");

  if (!opts.force && (existsSync(outJson) || existsSync(outMd))) {
    console.error(`error: output exists at ${outJson} or ${outMd}.`);
    console.error(`hint: pass --force to overwrite, or remove the files first.`);
    exit(1);
  }

  const legacy = JSON.parse(readFileSync(opts.input, "utf8"));
  const data = migrate(legacy);

  ensureDir(opts.outputDir);
  writeFileSync(outJson, JSON.stringify(data, null, 2) + "\n", "utf8");
  writeFileSync(outMd, renderStoriesMd(data) + "\n", "utf8");
  writeFileSync(outMigration, renderMigrationMd(data, opts) + "\n", "utf8");

  const counts = data.stories.reduce((acc, s) => ((acc[s.phase] = (acc[s.phase] ?? 0) + 1), acc), {});
  const summary = PHASE_ORDER.map((p) => `${counts[p] ?? 0} ${p}`).join(" · ");
  console.log(`✓ wrote ${outJson}`);
  console.log(`✓ wrote ${outMd}`);
  console.log(`✓ wrote ${outMigration}`);
  console.log(`  ${data.stories.length} stories migrated → ${summary}`);
  console.log(`  read ${outMigration} for the manual steps still needed.`);
}

main();
