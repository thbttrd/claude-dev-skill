# `specs/stories.json` Schema

`specs/stories.json` is the **single source of truth** for the entire project lifecycle in the story-based workflow. It lives at `specs/stories.json` — never under `docs/` and never at the repository root. This file replaces the legacy `docs/project-tracking.json` (see `MIGRATION.md` in the project's `specs/` folder for upgrade notes if a legacy file is detected).

## Documentation layout this file references

All artifacts are organised per-story under `specs/`:

```
specs/
├── stories.json                              # this file — project-wide tracker
├── STORIES.md                                # human-readable kanban (regenerated)
├── PROJECT.md                                # project overview, NFRs, glossary, tech-stack pointer
├── ARCHITECTURE.md                           # project-wide architecture (evolves additively)
├── DESIGN.md                                 # project-wide design system (one-time, re-runnable)
├── architecture.png                          # project-wide high-level diagram
├── architecture-detailed.png                 # project-wide detailed MIM AA diagram
├── MIGRATION.md                              # only if migrated from a legacy `docs/V*/` layout
├── story-000-foundation/
│   ├── STORY.md                              # the INVEST story
│   ├── PLAN.md                               # REASONS-canvas plan
│   ├── features/F-000-*.feature
│   ├── mockups/                              # only if UI; populated by /ui-specs
│   ├── ui/UI-F-000-*.md                      # only if UI; per-screen markdown
│   ├── verification/qa-report.md
│   └── state.json                            # per-story phase + checkpoints
├── story-001-…/
└── …
```

There is **no version directory.** A "version" is the set of stories whose `phase` is `verified`. There is **no version snapshot rule.** Stories are not duplicated when new ones are added; their content is frozen by `phase` advancement, not by directory copies.

## Multi-skill ownership

`stories.json` is created by `/high-level-scoping` and progressively enriched by other skills. Every skill MUST read the existing file, merge its changes, and write back to the same path. No skill may delete or overwrite fields owned by another skill.

| Skill                                 | Owns these sections                                                                                                                  | When                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `/high-level-scoping`                 | `project`, `personas`, `epics` (with `story_ids`), `stories[]` (id, title, slug, INVEST core fields, AC, deps, epic_id), `architecture.modules` (high-level only), Foundation Story (US-000) | Project kickoff, backlog grooming, story splitting |
| `/spec-writing`                       | Writes `stories[i].artifacts.story_doc`, `artifacts.feature_files`, `spec.rules`, `spec.specified_at`. May flip `phase` `backlog → scoped → specced`. | Per story                                         |
| `/ui-specs` (project-wide)            | Adds `design_system` block at the project level                                                                                        | Once, re-runnable                                 |
| `/ui-specs` (per story)               | Writes `stories[i].ui` block (mockup paths, screen specs)                                                                              | Per story with UI                                 |
| `/research-and-architecture`          | Enriches `architecture` (`detailed_modules`, `tech_stack`, `adrs`, `detailed_diagram_path`, `architecture_doc`)                        | Once at project bootstrap, re-runnable additively |
| `/repo-initialization`                | Writes `project.scaffolded_at` and `project.repo_branch`                                                                                | Once                                              |
| `/plan-writing`                       | Writes `stories[i].artifacts.plan` and `planning.planned_at`. Flips `phase` `specced → planned`.                                       | Per story                                         |
| `/test-setup`                         | Writes `stories[i].test_setup` (counts, completed_at). Flips `phase` `planned → red`.                                                  | Per story                                         |
| `/spec-implementation`                | Writes `stories[i].implementation` (started_at, completed_at). Flips `phase` `red → green`.                                            | Per story                                         |
| `/verification-and-validation`        | Writes `stories[i].verification` (qa_report, scenarios_passed, scenarios_failed). Flips `phase` `green → verified`.                    | Per story                                         |

Common rules:

- ALWAYS update `project.updated_at` when modifying the file.
- ALWAYS append a row to `stories[i].history` whenever `phase` changes (`{ "phase": "<new>", "at": "<ISO date>" }`).
- ALWAYS re-render `specs/STORIES.md` after any phase change by running `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/regen_stories_md.py specs/stories.json` (the script is owned by `/high-level-scoping` and lives at `plugins/high-level-scoping/skills/high-level-scoping/scripts/regen_stories_md.py`). If the user's repo has a copy at `scripts/regen-stories-md.py`, run that instead so the project repo stays self-contained.
- New top-level keys are allowed — the schema is open for extension.

---

## Base schema (created by `/high-level-scoping`)

```json
{
  "schema_version": "2.0.0",
  "project": {
    "name": "string — project name",
    "description": "string — one-paragraph elevator pitch",
    "created_at": "string — ISO date (YYYY-MM-DD)",
    "updated_at": "string — ISO date",
    "scaffolded_at": "string — ISO date | null",
    "repo_branch": "string | null"
  },
  "personas": [
    {
      "id": "P-001",
      "name": "string — short persona name",
      "role": "string — their role or context",
      "goals": ["string"],
      "pain_points": ["string"],
      "tech_savviness": "low | medium | high",
      "primary": true
    }
  ],
  "epics": [
    {
      "id": "E-001",
      "title": "string — short epic title",
      "description": "string — 2-3 sentence description",
      "persona_ids": ["P-001"],
      "priority": "must-have | should-have | could-have | wont-have",
      "business_impact": "high | medium | low",
      "story_ids": ["US-000", "US-001"]
    }
  ],
  "stories": [
    {
      "id": "US-000",
      "slug": "foundation",
      "title": "string — short story title",
      "is_foundation": true,
      "epic_id": "E-001",
      "as_a": "string — persona or role",
      "i_want": "string — the action or capability",
      "so_that": "string — the benefit or goal",
      "priority": "must-have | should-have | could-have | wont-have",
      "business_impact": "high | medium | low",
      "acceptance_criteria": ["string — concrete, testable criterion"],
      "depends_on_story_ids": ["US-NNN"],
      "invest": {
        "i": "boolean — Independent",
        "n": "boolean — Negotiable",
        "v": "boolean — Valuable",
        "e": "boolean — Estimable",
        "s": "boolean — Small",
        "t": "boolean — Testable",
        "checked_at": "string — ISO date | null"
      },
      "phase": "backlog | scoped | specced | planned | red | green | verified",
      "artifacts": {
        "story_doc": "specs/story-NNN-slug/STORY.md | null",
        "plan": "specs/story-NNN-slug/PLAN.md | null",
        "feature_files": ["specs/story-NNN-slug/features/F-NNN-*.feature"],
        "mockups": ["specs/story-NNN-slug/mockups/UI-F-NNN-*.html"],
        "ui_specs": ["specs/story-NNN-slug/ui/UI-F-NNN-*.md"],
        "qa_report": "specs/story-NNN-slug/verification/qa-report.md | null"
      },
      "history": [
        { "phase": "backlog", "at": "2026-05-03" },
        { "phase": "scoped", "at": "2026-05-03" }
      ]
    }
  ],
  "architecture": {
    "modules": [
      {
        "id": "M-001",
        "name": "string",
        "description": "string",
        "responsibilities": ["string"],
        "depends_on": ["M-002"]
      }
    ],
    "diagram_path": "specs/architecture.png"
  }
}
```

## Fields added by `/spec-writing`

`/spec-writing` writes per story when generating the STORY.md and feature files:

```json
{
  "id": "US-NNN",
  "...existing fields...": "",
  "artifacts": {
    "story_doc": "specs/story-NNN-slug/STORY.md",
    "feature_files": ["specs/story-NNN-slug/features/F-NNN-name.feature"]
  },
  "spec": {
    "rules": ["Rule summary 1", "Rule summary 2"],
    "specified_at": "2026-05-04"
  },
  "phase": "specced",
  "history": [
    "...prior history...",
    { "phase": "scoped", "at": "2026-05-03" },
    { "phase": "specced", "at": "2026-05-04" }
  ]
}
```

## Fields added by `/ui-specs`

Project-wide (one-time, re-runnable):

```json
{
  "design_system": {
    "design_md": "specs/DESIGN.md",
    "source": "copy:linear | tweak:stripe | scratch | user-provided",
    "specified_at": "2026-05-04"
  }
}
```

Per story with UI:

```json
{
  "id": "US-NNN",
  "ui": {
    "screen_specs": ["specs/story-NNN-slug/ui/UI-F-NNN-screen.md"],
    "mockups_desktop": ["specs/story-NNN-slug/mockups/UI-F-NNN-screen.html"],
    "mockups_mobile": ["specs/story-NNN-slug/mockups/UI-F-NNN-screen-mobile.html"],
    "specified_at": "2026-05-04"
  }
}
```

## Fields added by `/research-and-architecture`

Project-wide architecture, additive over time. No version pinning:

```json
{
  "architecture": {
    "modules": ["...existing high-level modules..."],
    "diagram_path": "specs/architecture.png",
    "tech_stack": { "layer": "technology" },
    "adrs": [
      {
        "id": "ADR-001",
        "title": "string",
        "decision": "string",
        "rationale": "string",
        "alternatives": ["string"]
      }
    ],
    "detailed_modules": [
      {
        "id": "BM-001",
        "name": "string",
        "type": "business | infrastructure | standalone",
        "maps_to_high_level": "M-001",
        "public_api": ["string"],
        "data_ownership": ["string"]
      }
    ],
    "detailed_diagram_path": "specs/architecture-detailed.png",
    "architecture_doc": "specs/ARCHITECTURE.md",
    "detailed_at": "2026-05-04"
  }
}
```

When the architecture is later extended (a new story needs a new module), the same fields are merged additively. ADRs accumulate; no entry is ever deleted.

## Fields added by `/plan-writing`

Per story:

```json
{
  "id": "US-NNN",
  "artifacts": {
    "plan": "specs/story-NNN-slug/PLAN.md"
  },
  "planning": {
    "operations_count": 6,
    "planned_at": "2026-05-04"
  },
  "phase": "planned"
}
```

## Fields added by `/test-setup`

Per story:

```json
{
  "id": "US-NNN",
  "test_setup": {
    "bdd_step_files": 1,
    "unit_test_files": 3,
    "integration_test_files": 1,
    "completed_at": "2026-05-04"
  },
  "phase": "red"
}
```

## Fields added by `/spec-implementation`

Per story:

```json
{
  "id": "US-NNN",
  "implementation": {
    "started_at": "2026-05-04",
    "completed_at": "2026-05-04"
  },
  "phase": "green"
}
```

## Fields added by `/verification-and-validation`

Per story:

```json
{
  "id": "US-NNN",
  "verification": {
    "qa_report": "specs/story-NNN-slug/verification/qa-report.md",
    "scenarios_passed": 5,
    "scenarios_failed": 0,
    "verified_at": "2026-05-05"
  },
  "phase": "verified"
}
```

---

## ID conventions

| Entity                       | Prefix | Example | Introduced by                |
| ---------------------------- | ------ | ------- | ---------------------------- |
| Persona                      | P-     | P-001   | `/high-level-scoping`        |
| Epic                         | E-     | E-001   | `/high-level-scoping`        |
| User Story                   | US-    | US-000  | `/high-level-scoping`        |
| Feature (in Gherkin)         | F-     | F-001   | `/spec-writing`              |
| UI feature / screen          | UI-F-  | UI-F-001 | `/ui-specs`                  |
| Module (high-level)          | M-     | M-001   | `/high-level-scoping`        |
| Module (detailed MIM)        | BM-    | BM-001  | `/research-and-architecture` |
| Architecture Decision Record | ADR-   | ADR-001 | `/research-and-architecture` |

- IDs are **sequential within their type** (P-001, P-002, …).
- Story IDs are **globally unique** across all epics. The Foundation Story is **always** `US-000`.
- New stories get the next free integer; never reuse a retired ID.

## Phase enum

A story progresses linearly through phases:

```
backlog → scoped → specced → planned → red → green → verified
```

| Phase     | Meaning                                                         | Set by                          |
| --------- | --------------------------------------------------------------- | ------------------------------- |
| backlog   | Story exists in the backlog; nothing else has happened.         | `/high-level-scoping` (initial) |
| scoped    | INVEST-checked, AC drafted, dependencies declared.              | `/high-level-scoping`           |
| specced   | STORY.md + feature files exist.                                 | `/spec-writing`                 |
| planned   | PLAN.md exists with REASONS canvas + Test Strategy + Test Plan. | `/plan-writing`                 |
| red       | All tests written and failing (RED state).                      | `/test-setup`                   |
| green     | All tests pass (GREEN state); implementation complete.          | `/spec-implementation`          |
| verified  | E2E `curl` + Playwright walkthrough passed; QA report written.  | `/verification-and-validation`  |

A story can move backwards if scope changes (e.g., re-scoping after dependency changes flips `planned → scoped`). Each transition appends a `history` row.

## INVEST flags

Recorded under `stories[i].invest`. A story SHOULD have all six flags `true` before transitioning past `scoped`. The flags are advisory at the schema level; `/spec-writing`'s INVEST gate enforces them interactively.

## Rules

- Every story MUST have at least 2 acceptance criteria.
- Every epic MUST be linked to at least one persona.
- Every story MUST belong to exactly one epic (`epic_id` required).
- The Foundation Story (`US-000`) MUST exist, MUST have `is_foundation: true`, and MUST have `depends_on_story_ids: []`.
- A story's `depends_on_story_ids` MUST reference only ids that exist in `stories[]`. The DAG MUST be acyclic. Workflow timing — *when* during the lifecycle a dependency must be `verified` — is enforced by each skill's Pre-Flight (`/plan-writing`, `/test-setup`, `/spec-implementation`, `/verification-and-validation`), not by this schema. The current convention is that each of those skills requires every dependency to be `verified` (or `is_foundation: true`) before it will run on a downstream story; teams that want to relax that — e.g., allow `/test-setup` to run on a story whose dep is still `green` — change the skill's Pre-Flight, not the schema.
- Every path stored in this file MUST live under `specs/`. Paths under `docs/V*/` are forbidden — if detected, the skill MUST hard-stop with the legacy-layout error and a pointer to `scripts/migrate-tracking.mjs`.
- `phase` MUST progress in order; backwards transitions are allowed but MUST be logged in `history` with a note.
