# Changelog — repo-initialization

All notable changes to the `repo-initialization` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.3] — 2026-09-05

### Changed

- Contract resync (dogfood run 2, 2026-09-05): journal a commit only after the commit succeeded, commitlint header/subject rules; uid-scoped, end-anchored `pkill` for leftover servers.

## [2.2.2] — 2026-09-05

### Changed

- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op's RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.

## [2.2.1] — 2026-08-31

### Fixed

- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [2.2.0] — 2026-08-30

### Added

- Pipeline contract; toolchain placeholders for the quality-gate verification; journal/backlog tracked in the scaffold; REPO_INIT_COMPLETE sentinel.

## [2.1.0] — 2026-08-22

### Added

- Step 12 gains a mandatory printed structural checklist (module-map directory tree, six passing verification commands, Claude hooks firing, CLAUDE.md / README.md / .gitignore completeness). This is the default quality gate; `/repo-initialization-verification` is an opt-in deep audit on top, with `US-000`'s own tests exercising the scaffold right after.

## [2.0.0] — 2026-05-03

### Changed

- **BREAKING:** Driven by the Foundation Story (`specs/story-000-foundation/STORY.md`) and project-wide architecture (`specs/ARCHITECTURE.md` + `specs/PROJECT.md`) instead of `docs/V{N}/specs/SPECS.md` + `docs/V{N}/architecture/ARCHITECTURE.md`.
- **BREAKING:** Working branch convention switches from `impl/spec-<datetime>` to `impl/US-NNN-slug` (typically `impl/US-000-foundation`).
- **BREAKING:** No `docs/` directory is created. Story plans, tests, and verification reports live under `specs/story-NNN-slug/` (owned by other skills); the scaffolder only creates `data/` and `public/uploads/` as runtime support directories.
- **BREAKING:** `.gitignore` must NOT ignore `specs/`. The specs directory is part of the repo.
- BDD runner is wired to discover `.feature` files at `specs/story-*/features/**/*.feature` (no `e2e/features/` symlinks or copies).
- After scaffolding, writes `project.scaffolded_at` and `project.repo_branch` into `specs/stories.json`.
- CLAUDE.md and README.md draw their Stories section from `specs/stories.json`. CLAUDE.md adds story-based-workflow rules (phase enum, branch naming, "do not write into docs/V*/").
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/repo-initialization/`.
