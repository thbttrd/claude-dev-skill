# claude-dev-skill

A Claude Code plugin **marketplace** of custom dev skills for **story-based, spec-driven development**. Each skill is published as its own plugin with its own [SemVer](https://semver.org/) version and [Keep-a-Changelog](https://keepachangelog.com/en/1.1.0/) changelog, so you can install only the ones you want and upgrade them independently.

## Philosophy

A project is a backlog of [INVEST](https://en.wikipedia.org/wiki/INVEST_(mnemonic)) stories. Each pipeline skill operates on **one user story (`US-NNN`) at a time**. All artifacts live under `specs/story-NNN-slug/` plus a few project-wide docs at `specs/`. There are no version directories — a "version" is the set of stories whose `phase` is `verified`. The first story (`US-000`) is the **Foundation Story** — a walking skeleton that proves the architecture end-to-end. Every subsequent story is a vertical slice that adds value on top of what is already verified.

The plan for each story is a **structured prompt in the [REASONS canvas](https://martinfowler.com/articles/structured-prompt-driven/) format** — Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards — plus an explicit Test Strategy and Test Plan. Each Operation prescribes RED-A → RED-B → GREEN → REFACTOR so an agent can execute it autonomously.

The full rationale and design doc lives in [`PROPOSAL-story-based-workflow.md`](./PROPOSAL-story-based-workflow.md).

## Install

In any Claude Code session:

```
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install <skill>@claude-dev-skill
```

For example:

```
/plugin install spec-writing@claude-dev-skill
/plugin install d2-architect@claude-dev-skill
```

To install everything at once, see the catalog below and run `/plugin install` for each name.

### Onboarding an existing repo

If you already have a project with docs in some other shape (legacy `docs/V*/` directories from the pre-2.0 version of this marketplace, ad-hoc `docs/`, root-level `ARCHITECTURE.md`, README-only backlog, partial `specs/`, etc.), install **`migrate-specs`** first. It audits whatever's there and migrates everything into the canonical `specs/` tree, including a best-effort REASONS-canvas rewrite of legacy wave plans.

```
/plugin install migrate-specs@claude-dev-skill
/migrate-specs
```

Every other pipeline skill performs a pre-flight check for legacy layouts and points you here when one is detected.

## Catalog

The skills are organised into **project-wide** (one-time / re-runnable) and **per-story** (the loop you walk for every user story).

### Project-wide

| Skill                                       | Version | What it does |
| ------------------------------------------- | ------- | ------------ |
| `high-level-scoping`                        | 2.0.0   | Personas, epics, INVEST story backlog, story DAG anchored on `US-000` (Foundation Story). Produces `specs/stories.json` + `specs/STORIES.md` + `specs/PROJECT.md` + lightweight `specs/ARCHITECTURE.md`. |
| `research-and-architecture`                 | 2.0.0   | Project-wide `specs/ARCHITECTURE.md` following [MIM AA](./plugins/research-and-architecture/skills/research-and-architecture/references/mim-architecture.md). Evolves additively as new stories require new modules. |
| `research-and-architecture-verification`    | 2.0.0   | Audits the architecture for MIM AA compliance, template completeness, and consistency with `stories.json`. |
| `ui-specs` (`--design-system`)              | 2.0.0   | Project-wide `specs/DESIGN.md` (Google-Stitch / VoltAgent 9-section format). One-time, re-runnable to swap brand. |
| `repo-initialization`                       | 2.0.0   | Scaffolds the repo from `specs/ARCHITECTURE.md` + `specs/PROJECT.md` + the Foundation Story (`US-000`). Tooling, hooks, CLAUDE.md, README.md. |
| `repo-initialization-verification`          | 2.0.0   | Audits the scaffold against `specs/ARCHITECTURE.md`. |

### Per-story loop

Run this loop for every story (the Foundation Story `US-000` first, then each subsequent story in DAG order):

| #   | Skill                          | Version | What it does |
| --- | ------------------------------ | ------- | ------------ |
| 1   | `spec-writing`                 | 2.0.0   | Per-story `STORY.md` (User Story + INVEST + AC + Rules) + Cucumber-compatible `.feature` files. Runs an INVEST gate before generating. |
| 1.5 | `spec-writing-verification`    | 2.0.0   | Audits the story spec for INVEST + Gherkin completeness. |
| 1.6 | `ui-specs US-NNN`              | 2.0.0   | Per-story HTML mockups + screen specs (only for stories with UI). 2-3 variants side-by-side, user picks one. Auto-invoked by `/spec-writing` when a story has UI. |
| 2   | `plan-writing`                 | 2.0.0   | Per-story `PLAN.md` in REASONS canvas + Test Strategy + Test Plan. Each Operation prescribes RED-A → RED-B → GREEN → REFACTOR. |
| 2.5 | `plan-writing-verification`    | 2.0.0   | Audits the plan for REASONS-canvas compliance, TDD prescription, Test Plan traceability, and architecture alignment. |
| 3   | `test-setup`                   | 2.0.0   | RED phase — writes failing BDD step defs + unit tests + source stubs. Tests are real (call actual code) but stubs are empty, so failures are at assertion time, not import time. |
| 3.5 | `test-setup-verification`      | 2.0.0   | Audits the RED state — confirms tests are real and failing for the right reason, and the BDD runner is wired. |
| 4   | `spec-implementation`          | 2.0.0   | GREEN phase — minimal implementation that makes every test pass. Per-story Simplify / Code-Review / Verify quality gates at the end. |
| 5   | `verification-and-validation`  | 2.0.0   | E2E verification — runs the full test suite, starts the app, exercises every endpoint with `curl`, walks every UI scenario via Playwright MCP, and FIXES deviations. Flips story phase to `verified`. |

### Orthogonal tooling

| Skill            | Version | What it does |
| ---------------- | ------- | ------------ |
| `migrate-specs`  | 1.0.0   | Audits any existing spec/architecture/plan/design layout and migrates it to the canonical `specs/` tree. Use when onboarding an existing repo onto the story-based pipeline. |
| `d2-architect`   | 2.5.0   | Architecture diagrams via TALA + hand-coded HTML/SVG polish + agent-driven readability review. |
| `html-architect` | 1.3.0   | Hand-coded HTML/SVG diagrams for layouts where auto-layout struggles. |

## Documentation layout

Every project that uses these skills produces this `specs/` tree:

```
specs/
├── stories.json                              # tracker (machine-readable, single source of truth)
├── STORIES.md                                # kanban (human-readable, regenerated)
├── PROJECT.md                                # project overview, NFRs, glossary, tech-stack pointer
├── ARCHITECTURE.md                           # MIM AA architecture, evolves additively
├── DESIGN.md                                 # design system (only if the project has UI)
├── architecture.png                          # high-level diagram
├── architecture-detailed.png                 # detailed module diagram
├── MIGRATION.md                              # only when migrated from a prior layout
├── story-000-foundation/
│   ├── STORY.md                              # User Story + INVEST + AC + Rules
│   ├── PLAN.md                               # REASONS canvas + Test Strategy + Test Plan
│   ├── features/F-000-walking-skeleton.feature
│   ├── mockups/UI-F-000-*.html               # only if UI
│   ├── ui/UI-F-000-*.md                      # only if UI
│   ├── verification/qa-report.md             # only after /verification-and-validation
│   └── state.json                            # per-story phase + checkpoints
├── story-001-…/
└── …
```

No `docs/` directory. No version segments. A story's progress is tracked by its `phase` (`backlog → scoped → specced → planned → red → green → verified`), not by directory copies.

## Versioning

- **Each plugin** has its own SemVer in `plugins/<name>/.claude-plugin/plugin.json` and a corresponding `plugins/<name>/CHANGELOG.md`.
- **The marketplace itself** has its own SemVer in `.claude-plugin/marketplace.json` and the top-level [`CHANGELOG.md`](./CHANGELOG.md). It tracks marketplace-infra changes only (layout, scripts, CI), **not** individual skill changes.

## Local development

If you're hacking on a skill in this repo and want your edits to flow live into your local Claude Code without re-publishing:

```bash
scripts/install-local.sh <skill>      # symlink one skill
scripts/install-local.sh --all        # symlink everything
scripts/uninstall-local.sh            # restore from backup
```

This symlinks each `plugins/<name>/skills/<name>/` into `~/.claude/skills/<name>/` and any bundled agents into `~/.claude/agents/`. Edits in this repo are reflected immediately on the next Claude Code session.

If `~/.claude/skills/<name>/` already exists, the original is moved to `~/.claude/skills-archive/<timestamp>/<name>/` (sibling tree, **outside** `skills/` so Claude Code does not load it as a duplicate). Same convention for agents at `~/.claude/agents-archive/<timestamp>/`. Restore manually if needed.

## Repo layout

```
claude-dev-skill/
├── .claude-plugin/marketplace.json       # marketplace manifest
├── plugins/<skill-name>/                 # one folder per plugin
│   ├── .claude-plugin/plugin.json        # plugin manifest (name, version, description)
│   ├── CHANGELOG.md                      # per-plugin Keep-a-Changelog
│   ├── README.md                         # human-readable overview
│   ├── skills/<skill-name>/SKILL.md      # the actual skill body
│   ├── skills/<skill-name>/references/   # ancillary docs (optional)
│   ├── skills/<skill-name>/scripts/      # ancillary scripts (optional)
│   └── agents/<agent-name>.md            # bundled agents (optional)
├── scripts/                              # marketplace + dev tooling
└── .github/workflows/ci.yml              # validation guard
```

## License

[MIT](./LICENSE) © thbttrd
