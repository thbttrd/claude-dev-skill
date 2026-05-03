---
name: migrate-specs
version: 1.0.0
description: Audits a repository's existing spec/architecture/plan/design documents — in any shape (legacy `docs/V*/` layout, ad-hoc `docs/`, scattered root-level Markdown, partial `specs/` directories, README-only backlogs, etc.) — and migrates them to the canonical story-based layout produced by the rest of this marketplace (`specs/stories.json` + `specs/STORIES.md` + `specs/PROJECT.md` + `specs/ARCHITECTURE.md` + `specs/DESIGN.md` + `specs/story-NNN-slug/{STORY.md,PLAN.md,features,mockups,ui,verification,state.json}`). Best-effort rewrites legacy wave-style plans into the REASONS canvas, drops version segments from paths, preserves unmappable content under `specs/legacy/`, and emits a `specs/MIGRATION.md` log. Use this skill whenever the user wants to onboard an existing repo onto the story-based pipeline, or says "migrate my specs", "convert to story-based layout", "reshape this repo's docs", "I have docs but they're in the old format", "/migrate-specs". Also auto-triggered by every other pipeline skill's pre-flight when a recognised legacy layout is detected.
---

# Migrate Specs Skill

Onboard any existing repository onto the story-based pipeline. The skill audits whatever spec/architecture/plan/design documents are already there, classifies them, and migrates them into the canonical `specs/` layout produced by the rest of this marketplace.

The skill is **open-ended on input** — it handles the legacy `docs/V*/` layout from the pre-2.0 version of this marketplace, plus ad-hoc shapes (root-level `ARCHITECTURE.md`, `requirements.md`, `BACKLOG.md`, README-only backlogs, partial `specs/` directories that don't follow the canonical shape, etc.) — and **closed on output** (always the canonical `specs/` tree).

The migration is **non-destructive by default** — files are moved (not copied or deleted) into the new tree, and anything the skill cannot confidently route lands under `specs/legacy/` for human review. The user always confirms the move plan before any file is touched.

---

## When to Use

- The user has an existing repo and wants to start using the story-based pipeline (`/spec-writing`, `/plan-writing`, etc.) without re-doing discovery from scratch.
- Another pipeline skill hard-stopped because it detected a legacy layout (the standard error message points users here).
- The user explicitly says: "migrate my specs", "convert to story-based layout", "I have docs but they're in the old V0/V1 shape", "reshape this repo's docs", `/migrate-specs`.

## When NOT to Use

- The repo has **no** spec/architecture/plan/design documents at all. → Run `/high-level-scoping` instead to scope from scratch.
- The repo already matches the canonical layout AND `specs/stories.json` exists at version `2.0.0`. → No migration needed; suggest the relevant pipeline skill.
- The user wants to update an existing canonical layout. → Use the corresponding pipeline skill (e.g. `/high-level-scoping` in update mode).

---

## CRITICAL: Always Use the AskUserQuestion Tool

**You MUST use the `AskUserQuestion` tool for every interactive question.** Plain-text questions are forbidden. Apply the same rules used by `/high-level-scoping` and `/spec-writing`:

- Batch up to 4 related questions per call.
- Always provide concrete options (2-4) plus "Other".
- `multiSelect: true` when answers aren't mutually exclusive.
- Short `header` labels (max 12 chars).
- Recommended option first, with "(Recommended)" suffix.
- Use `description` for trade-offs, `preview` for concrete artifacts (e.g., the proposed move plan).

---

## Pre-Flight

| Check                                             | Action                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `node` not on PATH                                | Hard-stop. Print: `migrate-specs requires node. Install Node.js 18+ and re-run.`                                                |
| Repo root is not a git repository                 | Soft-warn: "no git detected — strongly recommend committing the current state before migrating, since this skill moves files." Continue if the user accepts. |
| Working tree dirty (`git status --porcelain` non-empty) | Soft-warn: "uncommitted changes detected — strongly recommend committing first." Continue if the user accepts.                  |
| `specs/stories.json` exists                       | Read it and inspect `schema_version`. If `"2.0.0"` AND no legacy `docs/V*/` or `docs/project-tracking.json`, hard-stop with: "Repo already on the canonical layout. Nothing to migrate. Run the relevant pipeline skill instead." If the schema is older or absent, treat as a partial canonical layout and continue (the audit will route the existing canonical files through unchanged and migrate the rest). |
| Repo has no doc-shaped files anywhere             | Hard-stop. Print: "No specs to migrate. Run /high-level-scoping to scope the project from scratch."                              |

---

## Phase 1: Audit (read-only)

Run the deterministic file scanner first, then content-classify the leftovers.

### Step 1.1 — Deterministic scan

Run the bundled audit script:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/migrate-specs/scripts/audit.mjs --root <repo-root> --json
```

The script outputs JSON of the form:

```json
{
  "root": "<abs path>",
  "audited_at": "YYYY-MM-DD",
  "legacy_layout_detected": true,
  "legacy_versions": [0, 1, 2],
  "canonical_specs_detected": false,
  "files": [
    { "path": "docs/V0/architecture/ARCHITECTURE.md", "kind": "architecture", "confidence": "high", "legacy_version": 0, "story_hints": [] },
    { "path": "docs/V1/specs/features/F-001-auth.feature", "kind": "gherkin_feature", "confidence": "high", "legacy_version": 1, "story_hints": [{ "kind": "feature_id", "value": "F-001" }] },
    { "path": "BACKLOG.md", "kind": "unclassified_md", "confidence": "low", "legacy_version": null, "story_hints": [] }
  ],
  "unclassified": 1
}
```

Parse the JSON. Use the `kind` and `confidence` to drive the next step.

### Step 1.2 — LLM-classify the unclassified

For each file with `confidence: "low"` (kind starts with `unclassified_*`), read the file's head (~80 lines) and classify by content. Apply the signal patterns in `references/source-layouts.md` § "Open-ended fallback":

- **Architecture** — mentions modules, services, ADRs, tech stack, system diagrams, dependency graphs.
- **Spec / requirement** — contains "as a … I want … so that", or `Given/When/Then`, or AC checkbox lists.
- **Plan** — contains "RED-A", "GREEN", "REFACTOR", "wave", numbered task lists, REASONS section headers.
- **Design system** — color palette, typography, spacing, component listings.
- **Tracking / backlog** — JSON with `stories[]/epics[]/personas[]`, OR Markdown with kanban columns / status emojis (✅ 🟢 🔴) / a backlog-shaped table.
- **Mockup** — `.html` file in a design/mockup/wireframes directory.
- **Other** — preserve under `specs/legacy/` if it was found in a doc dir; otherwise leave it where it is.

Promote each newly-classified file from `unclassified_*` to one of the canonical kinds (`architecture`, `specs_md`, `plan`, `design_system`, `backlog_md`, `mockup`, etc.). Mark its confidence as `medium` (since it came from content sniffing, not from filename).

### Step 1.3 — Present the audit

Show the user a **single, scannable summary** in chat:

```
Audit summary — <repo path>

Detected layout: <one of: legacy docs/V*/ + project-tracking.json | ad-hoc docs/ tree | partial specs/ | README-only backlog | mixed>
Legacy versions found: V0, V1, V2 (if applicable)

Files by kind:
  3  architecture (high)
  1  architecture_diagram (high)
  1  design_system (high)
  6  gherkin_feature (high)
  4  mockup (high)
  2  plan_wave (high)
  1  plan_foundation (high)
  1  qa_report (high)
  1  legacy_tracking_json (high)
  4  unclassified_md → 2 architecture (medium), 1 plan (medium), 1 backlog_md (medium)

Stories detected (from tracking JSON or backlog table): 6 (US-000 … US-005)
Foundation candidate: US-000 — "Walking skeleton" (first story in V0)
```

This summary is for confirmation only — no questions yet. Then move to Phase 2.

---

## Phase 2: Plan (interactive)

Build the migration plan, confirm it with the user, and only THEN touch any files.

### Step 2.1 — Confirm the foundation story

Use `AskUserQuestion`:

- **Header: "Foundation"** — "Which story is the walking skeleton (Foundation Story, US-000)?"
  - Options: the migration's best guess as "(Recommended)", every other detected story, "None — let me pick later".

If the user picks a different story than the auto-detected one, update the candidate `stories.json` accordingly (the recommended story keeps its real ID; the picked story becomes US-000 by re-sequencing if necessary — but the cleaner default is to keep IDs and just flip `is_foundation`).

### Step 2.2 — Confirm latest-version source-of-truth (legacy V*/ only)

If multiple `V*/` directories were detected:

- **Header: "Latest"** — "Which version's `architecture/` and `specs/` are the source of truth for project-wide artifacts?"
  - Options: each detected version (highest as "(Recommended)"), "Other — show me the differences".

### Step 2.3 — Build the move plan

Build a complete table of source → target for every file the audit found, applying `references/mapping-rules.md`. Each row is one of:

- **MOVE** — source → target (no transformation).
- **TRANSFORM** — source → target with content rewrites (path rewrites, REASONS canvas conversion, header rewrites, etc.).
- **STASH** — source → `specs/legacy/<original-subpath>` (could not be confidently routed).
- **SKIP** — file matched a "do not move" rule (root-level conventional, source code, tooling).

Render the plan as a Markdown table in chat:

```
Move plan (N actions):

| Action     | Source                                              | Target                                                  | Notes                                              |
| ---------- | --------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| TRANSFORM  | docs/project-tracking.json                          | specs/stories.json + STORIES.md + MIGRATION.md          | via migrate-tracking.mjs                            |
| MOVE       | docs/V2/architecture/ARCHITECTURE.md                | specs/ARCHITECTURE.md                                   | latest version wins                                |
| MOVE       | docs/V2/architecture/architecture.png               | specs/architecture.png                                  |                                                    |
| MOVE       | docs/V2/specs/DESIGN.md                             | specs/DESIGN.md                                         |                                                    |
| TRANSFORM  | docs/V2/specs/SPECS.md                              | specs/PROJECT.md (project-level only)                   | per-feature content dropped — recreated per story  |
| MOVE       | docs/V2/specs/features/F-001-auth.feature           | specs/story-001-user-auth-golden-path/features/         |                                                    |
| MOVE       | docs/V2/specs/mockups/UI-F-001-login.html           | specs/story-001-user-auth-golden-path/mockups/          |                                                    |
| TRANSFORM  | docs/V2/plans/W1-auth.md                            | specs/story-001-user-auth-golden-path/PLAN.md           | best-effort REASONS canvas; stubs for E, A, N, S   |
| TRANSFORM  | docs/V2/plans/00-foundation.md                      | specs/story-000-foundation/PLAN.md                      | best-effort REASONS canvas                         |
| STASH      | docs/V0/research/notes.md                           | specs/legacy/V0/research/notes.md                       | unclassified — needs human review                  |
| SKIP       | README.md                                           | (unchanged)                                             | root-level conventional file                       |
```

### Step 2.4 — Confirm the plan

Use `AskUserQuestion`:

- **Header: "Confirm"** — "Apply this migration plan?"
  - Options: "Yes — execute all moves and transforms", "No — show me individual rows so I can adjust", "Cancel".

If "No", iterate row by row using AskUserQuestion until the user accepts the full plan.

If the user invoked the skill with `--dry-run`, stop here and emit only `specs/MIGRATION.md.preview` with the plan but no file changes.

---

## Phase 3: Execute

### Step 3.1 — Run the tracking-JSON migrator (if applicable)

If `docs/project-tracking.json` exists:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/migrate-specs/scripts/migrate-tracking.mjs \
  --input docs/project-tracking.json \
  --out specs/ \
  --force
```

This produces `specs/stories.json`, `specs/STORIES.md`, and an initial `specs/MIGRATION.md`. Read all three immediately — `stories.json` is the source of truth for story IDs and slugs in subsequent steps.

### Step 3.2 — Build a stories.json skeleton (if no tracking JSON)

If there was no `docs/project-tracking.json` (ad-hoc / README-only / partial-specs cases), build `specs/stories.json` directly using the schema from `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`:

- **Project block:** name from the user (use `AskUserQuestion`), description from the repo's README's first paragraph if available, dates today.
- **Personas:** empty array. The user runs `/high-level-scoping` next to fill these in.
- **Epics:** empty array initially. If a backlog/stories list was detected, group entries into a single "E-001 — Migrated backlog" epic; the user re-organises later.
- **Stories:** one entry per detected backlog item, each in `phase: backlog` with empty AC and INVEST flags, no Foundation Story marker (the user picks one in Phase 2).
- **Architecture block:** populate `architecture_doc: "specs/ARCHITECTURE.md"` if the migration is producing one; leave `modules: []`.
- Always write `schema_version: "2.0.0"` and `project.updated_at = today`.

Also generate `specs/STORIES.md` from `stories.json` using the same kanban renderer that `/high-level-scoping` uses (mirror the format from `migrate-tracking.mjs` — table per phase, dependency mermaid graph, epics table).

### Step 3.3 — Create story directories and `state.json`

For each story in `stories.json`:

```
specs/story-NNN-slug/
├── state.json             # always
├── STORY.md               # if a body was extractable; else a stub
├── features/              # if .feature files routed here
├── mockups/               # if mockups routed here
├── ui/                    # if screen specs routed here
├── PLAN.md                # if a legacy plan was rewritten
└── verification/          # if a QA report routed here
```

`state.json` skeleton:

```json
{
  "story_id": "US-NNN",
  "phase": "<phase from stories.json>",
  "history": [{ "phase": "<phase>", "at": "YYYY-MM-DD", "note": "migrated by /migrate-specs" }],
  "checkpoints": []
}
```

### Step 3.4 — Execute moves

For each MOVE / TRANSFORM / STASH row in the confirmed plan:

- **MOVE:** use `git mv` if the source is tracked; plain `mv` otherwise. Preserves history.
- **TRANSFORM:**
  - For project-wide artifacts (ARCHITECTURE.md, DESIGN.md, PROJECT.md): apply path rewrites from `references/mapping-rules.md` § 3, prepend the `> Migrated from … on … by /migrate-specs.` banner.
  - For STORY.md extractions from a `SPECS.md` "Feature N" section: build the file from `references/story-md-template.md` (in the spec-writing plugin), populate title + AC, mark INVEST flags `❌ — not yet checked`.
  - For PLAN.md rewrites: apply `references/plan-rewrite-rules.md`.
  - For `SPECS.md` → `PROJECT.md`: extract project-level concerns (NFRs, glossary, scope, tech-stack pointer); per-feature content is dropped here (it belongs in per-story STORY.md, written separately).
- **STASH:** create `specs/legacy/<sub-path>` mirroring the source structure, then move the file.
- **SKIP:** no-op.

After every action, update an in-memory log of `{ source, target, action, notes }` for use in MIGRATION.md.

### Step 3.5 — Apply path rewrites to all migrated Markdown

After all files are in place, walk every `.md` file under `specs/` (excluding `specs/legacy/`) and apply the regex rewrites from `references/mapping-rules.md` § 3. For ambiguous matches, leave the original link with a `<!-- MIGRATED: ... -->` comment.

### Step 3.6 — Write `specs/MIGRATION.md`

Use `references/migration-md-template.md`. Populate every section. The "Files preserved under `specs/legacy/`" section MUST list every file in `specs/legacy/` — no summarising.

If a prior `specs/MIGRATION.md` existed (from `migrate-tracking.mjs` Step 3.1 or a previous run), append a new dated section at the top rather than overwriting.

### Step 3.7 — Final summary in chat

Print a concise summary to the user:

```
Migration complete.

  ✓ N files moved
  ✓ N files transformed
  ✓ N files preserved under specs/legacy/ (need human review)
  ✓ N stories created/updated in specs/stories.json
  ✓ specs/MIGRATION.md written

Next steps:
  - Review specs/MIGRATION.md (especially the "What still needs manual attention" section).
  - Run /research-and-architecture-verification (if ARCHITECTURE.md was migrated).
  - Run /spec-writing-verification US-NNN per story whose phase >= specced.
  - Run /plan-writing-verification US-NNN per story whose phase >= planned.
  - Once you've confirmed the migration is clean: rm -rf docs/  (the migration left it in place).
```

---

## Optional flags

- `--dry-run` — stop after Phase 2 (no files touched). Emits `specs/MIGRATION.md.preview`.
- `--root <path>` — operate on a different repo root (default: cwd).
- `--no-tracking` — even if `docs/project-tracking.json` exists, skip the tracking-JSON migrator and ask the user to define stories from scratch. Useful when the legacy tracker is so out-of-date the user prefers to start from the audit.

---

## What this skill does NOT do

- Does **not** delete the source tree (`docs/`, root-level migrated files). The user runs `rm -rf docs/` at their discretion after reviewing.
- Does **not** invent content. Empty STORY.md AC lists, empty REASONS plan sections, and empty INVEST flags stay empty (with TODO markers) — the user runs the corresponding pipeline skill to fill them.
- Does **not** run the verification skills inline. It only suggests them in the final summary and in `MIGRATION.md`.
- Does **not** modify source code, tests, or tooling. Only spec/architecture/plan/design documents.
- Does **not** rewrite the project's git history. `git mv` preserves history per file; the migration is one or more new commits.

---

## References

- [`references/target-layout.md`](./references/target-layout.md) — the canonical destination layout.
- [`references/source-layouts.md`](./references/source-layouts.md) — catalog of recognised input shapes plus the open-ended fallback rules.
- [`references/mapping-rules.md`](./references/mapping-rules.md) — deterministic source → target rules and conflict resolution.
- [`references/plan-rewrite-rules.md`](./references/plan-rewrite-rules.md) — legacy wave-plan → REASONS-canvas conversion.
- [`references/migration-md-template.md`](./references/migration-md-template.md) — the `specs/MIGRATION.md` log template.

The canonical schemas / templates this skill writes against live in their owning plugins:

- `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md` — `specs/stories.json` schema.
- `plugins/high-level-scoping/skills/high-level-scoping/references/stories-md-template.md` — `specs/STORIES.md` rendering rules.
- `plugins/spec-writing/skills/spec-writing/references/story-md-template.md` — per-story `STORY.md` template.
- `plugins/research-and-architecture/skills/research-and-architecture/references/architecture-template.md` — `specs/ARCHITECTURE.md` template.
- `plugins/plan-writing/skills/plan-writing/references/plan-template.md` — per-story `PLAN.md` template (REASONS canvas).
