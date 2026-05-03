# Changelog — repo-initialization

All notable changes to the `repo-initialization` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
