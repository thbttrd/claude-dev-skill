#!/usr/bin/env node
// Audit a repository for spec/architecture/plan/design documents and emit a
// JSON report the /migrate-specs skill consumes for the interactive Plan phase.
//
// This is the deterministic, "obvious by filename" pass — content sniffing
// happens later in the skill body (the LLM reads ambiguous files). The script
// is intentionally simple: walk the tree with sane excludes, bucketize each
// path by extension + filename + parent directory.
//
// Usage:
//   node audit.mjs                   # audit the current working directory
//   node audit.mjs --root <path>     # audit a specific root
//   node audit.mjs --json            # emit JSON only (no human-readable summary)

import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, extname, sep } from "node:path";
import { argv, exit, cwd } from "node:process";

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  ".vercel",
  ".husky",
  ".idea",
  ".vscode",
  "vendor",
  "target",
  "venv",
  ".venv",
  "__pycache__",
  ".pytest_cache",
]);

const KEEP_FILE_BASENAMES = new Set([
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "AUTHORS.md",
  "MAINTAINERS.md",
]);

const DOC_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".rst",
  ".adoc",
  ".feature",
  ".html",
  ".json",
  ".yaml",
  ".yml",
  ".png",
  ".svg",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
]);

const DOC_DIR_HINTS = [
  "docs",
  "doc",
  "specs",
  "spec",
  "specifications",
  "specification",
  "documentation",
  "design",
  "designs",
  "wireframes",
  "mockups",
  "architecture",
  "plans",
  "planning",
  "stories",
  "features",
  "requirements",
  "rfcs",
  "adrs",
];

function parseArgs(args) {
  const opts = { root: cwd(), json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--root") opts.root = args[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        `audit.mjs — scan a repo for spec/architecture/plan/design files\n\n` +
          `  --root <path>   repo root to audit (default: cwd)\n` +
          `  --json          emit JSON only (no summary)\n` +
          `  --help          this message\n`,
      );
      exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      exit(2);
    }
  }
  return opts;
}

function walk(root, abs, files) {
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Skip dotfiles/dirs — except .github since RFCs sometimes live there.
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const child = join(abs, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(root, child, files);
    } else if (entry.isFile()) {
      const rel = relative(root, child);
      files.push(rel);
    }
  }
}

function isDocFile(rel) {
  const ext = extname(rel).toLowerCase();
  if (!DOC_EXTENSIONS.has(ext)) return false;
  const segments = rel.split(sep);
  const inDocDir = segments.some((s) => DOC_DIR_HINTS.includes(s.toLowerCase()));
  const looksLikeRootDoc =
    segments.length === 1 && ext === ".md" && !KEEP_FILE_BASENAMES.has(basename(rel));
  // Skip top-level conventional files (README, LICENSE, etc.) — they stay where they are.
  return inDocDir || looksLikeRootDoc;
}

function classify(rel) {
  const lower = rel.toLowerCase();
  const base = basename(lower);
  const segments = lower.split(sep);

  // Tracking files
  if (base === "project-tracking.json") return tag("legacy_tracking_json", "high");
  if (base === "stories.json") return tag("canonical_tracking_json", "high");
  if (base === "stories.md") return tag("backlog_md", "high");
  if (base === "backlog.md") return tag("backlog_md", "high");

  // Architecture
  if (base === "architecture.md" || base === "architecture.mdx") return tag("architecture", "high");
  if (segments.includes("architecture") && lower.endsWith(".md")) return tag("architecture", "high");
  if (segments.includes("architecture") && (lower.endsWith(".png") || lower.endsWith(".svg") || lower.endsWith(".jpg")))
    return tag("architecture_diagram", "high");
  if (base === "architecture.png" || base === "architecture-detailed.png")
    return tag("architecture_diagram", "high");

  // Design system
  if (base === "design.md") return tag("design_system", "high");
  if (segments.some((s) => /^design[-_]system$/i.test(s))) return tag("design_system", "high");
  if (segments.includes("design") && lower.endsWith(".md") && !lower.includes("/mockups/"))
    return tag("design_system", "medium");

  // Mockups
  if (lower.endsWith(".html") && (segments.includes("mockups") || segments.includes("mockup") || segments.includes("wireframes")))
    return tag("mockup", "high");
  if (lower.endsWith(".html") && segments.includes("design"))
    return tag("mockup", "medium");

  // UI screen specs
  if (/^ui[-_]?f[-_]?\d/i.test(base) && lower.endsWith(".md")) return tag("ui_screen_spec", "high");

  // Gherkin
  if (lower.endsWith(".feature")) return tag("gherkin_feature", "high");

  // Plans
  if (base === "plan.md" || base === "plan.mdx") return tag("plan", "high");
  if (base.startsWith("00-foundation")) return tag("plan_foundation", "high");
  if (/^w\d+[-_]/i.test(base) && lower.endsWith(".md") && segments.includes("plans"))
    return tag("plan_wave", "high");
  if (segments.includes("plans") && lower.endsWith(".md")) return tag("plan", "medium");
  if (base === "dag.md") return tag("plan_dag", "high");
  if (base === "implementation-state.json") return tag("plan_state", "high");

  // Specs
  if (base === "specs.md") return tag("specs_md", "high");
  if (/^story[-_]?\d/i.test(base) || base.startsWith("us-")) return tag("story_md", "high");
  if (base === "story.md") return tag("story_md", "high");
  if (base === "requirements.md") return tag("requirements", "high");

  // Project overview
  if (base === "project.md") return tag("project_md", "high");

  // QA / verification
  if (base === "qa-report.md" || base.startsWith("qa-")) return tag("qa_report", "high");
  if (segments.includes("verification") && lower.endsWith(".md")) return tag("qa_report", "medium");

  // ADRs / RFCs
  if (segments.includes("adrs") || segments.includes("adr") || /^adr[-_]\d/i.test(base))
    return tag("adr", "high");
  if (segments.includes("rfcs") || segments.includes("rfc")) return tag("rfc", "medium");

  // Generic doc — needs LLM classification
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return tag("unclassified_md", "low");
  if (lower.endsWith(".json")) return tag("unclassified_json", "low");
  if (lower.endsWith(".html")) return tag("unclassified_html", "low");

  return tag("other", "low");
}

function tag(kind, confidence) {
  return { kind, confidence };
}

function detectVersionSegment(rel) {
  const m = rel.match(/^docs[\\/]V(\d+)[\\/]/i);
  return m ? Number(m[1]) : null;
}

function detectStoryHints(rel) {
  const matches = [];
  const idMatch = rel.match(/US[-_]?(\d{1,3})/i);
  if (idMatch) matches.push({ kind: "story_id", value: `US-${idMatch[1].padStart(3, "0")}` });
  const featureMatch = rel.match(/F[-_](\d{1,3})/i);
  if (featureMatch) matches.push({ kind: "feature_id", value: `F-${featureMatch[1].padStart(3, "0")}` });
  const uiMatch = rel.match(/UI[-_]?F[-_]?(\d{1,3})/i);
  if (uiMatch) matches.push({ kind: "ui_id", value: `UI-F-${uiMatch[1].padStart(3, "0")}` });
  return matches;
}

function summarize(report) {
  const counts = new Map();
  for (const f of report.files) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const lines = [];
  lines.push(`audit summary — ${report.files.length} doc-shaped files in ${report.root}`);
  if (report.legacy_layout_detected) {
    lines.push(`  ⚠ legacy docs/V*/ layout detected (V${report.legacy_versions.join(", V")})`);
  }
  if (report.canonical_specs_detected) {
    lines.push(`  ✓ canonical specs/ directory present (partial migration?)`);
  }
  for (const [kind, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${String(count).padStart(4)}  ${kind}`);
  }
  if (report.unclassified > 0) {
    lines.push(``);
    lines.push(`  ${report.unclassified} files need content-based classification (LLM pass).`);
  }
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(argv.slice(2));

  if (!existsSync(opts.root)) {
    console.error(`error: root not found: ${opts.root}`);
    exit(1);
  }
  const stats = statSync(opts.root);
  if (!stats.isDirectory()) {
    console.error(`error: root is not a directory: ${opts.root}`);
    exit(1);
  }

  const allFiles = [];
  walk(opts.root, opts.root, allFiles);

  const docFiles = allFiles.filter(isDocFile);
  const enriched = docFiles.map((rel) => {
    const cls = classify(rel);
    return {
      path: rel,
      kind: cls.kind,
      confidence: cls.confidence,
      legacy_version: detectVersionSegment(rel),
      story_hints: detectStoryHints(rel),
    };
  });

  const legacyVersions = [
    ...new Set(enriched.map((f) => f.legacy_version).filter((v) => v !== null)),
  ].sort((a, b) => a - b);
  const trackingJson = enriched.find((f) => f.kind === "legacy_tracking_json");
  const canonicalSpecsDir = existsSync(join(opts.root, "specs", "stories.json"));
  const unclassifiedCount = enriched.filter((f) => f.confidence === "low").length;

  const report = {
    root: opts.root,
    audited_at: new Date().toISOString().slice(0, 10),
    legacy_layout_detected: Boolean(trackingJson) || legacyVersions.length > 0,
    legacy_versions: legacyVersions,
    canonical_specs_detected: canonicalSpecsDir,
    files: enriched,
    unclassified: unclassifiedCount,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(summarize(report));
    console.log("");
    console.log("(re-run with --json for the full machine-readable report.)");
  }
}

main();
