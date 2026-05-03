# Target layout (canonical)

This is the destination shape every migration targets. It's the same layout produced by `/high-level-scoping`, `/spec-writing`, `/research-and-architecture`, `/ui-specs`, `/plan-writing`, `/test-setup`, `/spec-implementation`, and `/verification-and-validation`.

```
specs/
├── stories.json                              # tracker (machine-readable, single source of truth)
├── STORIES.md                                # kanban (human-readable, regenerated from stories.json)
├── PROJECT.md                                # project overview, NFRs, glossary, tech-stack pointer
├── ARCHITECTURE.md                           # MIM AA architecture, evolves additively
├── DESIGN.md                                 # design system (only if the project has UI)
├── architecture.png                          # high-level diagram
├── architecture-detailed.png                 # detailed module diagram (only after /research-and-architecture)
├── MIGRATION.md                              # migration log (only when migrated from a prior shape)
├── story-000-foundation/
│   ├── STORY.md                              # User Story + INVEST + Acceptance Criteria + Rules
│   ├── PLAN.md                               # REASONS canvas + Test Strategy + Test Plan
│   ├── features/F-000-walking-skeleton.feature
│   ├── mockups/UI-F-000-*.html               # only if UI
│   ├── ui/UI-F-000-*.md                      # only if UI
│   ├── verification/qa-report.md             # only after /verification-and-validation
│   └── state.json                            # per-story phase + checkpoints
├── story-001-…/
│   └── …
└── …
```

**Rules.** Migration MUST respect:

- **No `docs/` directory.** Everything is under `specs/`. If pre-existing top-level `docs/` content cannot be classified into the canonical layout, preserve it under `specs/legacy/` and flag it in `MIGRATION.md` for human review.
- **No version directories.** Drop any `V0/`, `V1/`, … segment from paths. The "version" of a story is its `phase` in `stories.json`.
- **No version snapshots.** Stories are not duplicated. The latest content of any story-scoped artifact is the only copy.
- **Project-wide vs per-story.** `stories.json`, `STORIES.md`, `PROJECT.md`, `ARCHITECTURE.md`, `DESIGN.md`, and the top-level diagrams are project-wide. Everything else is per-story under `story-NNN-slug/`.
- **Slug = kebab-case from the story title**, max 60 chars. ID format is `US-NNN` zero-padded; the directory is `story-NNN-slug/`.
- **`stories.json` schema.** See `plugins/high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md`. The migration always writes `schema_version: "2.0.0"`.
- **Phase ladder.** A story's phase is one of `backlog → scoped → specced → planned → red → green → verified`. The migration sets the most conservative phase consistent with the artifacts found:

  | Found                                                  | Phase set     |
  | ------------------------------------------------------ | ------------- |
  | only a row in a backlog table or a one-line story idea | `backlog`     |
  | a story body with AC                                   | `scoped`      |
  | story body + ≥1 `.feature` file                        | `specced`     |
  | the above + a plan file                                | `planned`     |
  | the above + tests written                              | `red`         |
  | the above + implementation done (tests pass)           | `green`       |
  | the above + a QA report                                | `verified`    |

  When in doubt, pick the lower phase. Downstream verifiers will surface gaps; the goal is to never claim a phase the artifacts don't support.

  **Caveat for tracker-derived phases.** When a story's phase is set from a legacy tracker entry (e.g. `versionEntry.implementation.status === "completed"` → `green`, `verification.status === "passed"` → `verified`), the migration trusts what the tracker recorded. The canonical contract for `green` is "tests pass on disk" and for `verified` is "Playwright walkthrough succeeded against the running app" — neither is re-verified during migration. The user should re-run the test suite (and `/verification-and-validation US-NNN` for stories the tracker said were verified) to confirm.

- **Path rewrites inside docs.** Any string of the form `docs/V{N}/…` inside any migrated Markdown file MUST be rewritten to its `specs/…` equivalent. References to old artifacts that no longer exist (e.g. a per-version `SPECS.md`) become links to the new canonical location (e.g. `specs/PROJECT.md`).

- **Frontmatter and headers.** Headers in legacy docs that mention a version (e.g. "V0 Architecture") are rewritten to drop the version prefix. The migration prepends a one-line note to each migrated doc: `> Migrated from <legacy path> on YYYY-MM-DD by /migrate-specs.` This note can be removed by the user after review.
