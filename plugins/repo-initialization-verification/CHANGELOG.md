# Changelog — repo-initialization-verification

All notable changes to the `repo-initialization-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Audits the scaffolded repo against `specs/ARCHITECTURE.md` + `specs/PROJECT.md` (not `docs/V{N}/`).
- New audit area: K. `specs/stories.json` Integration — confirms `project.scaffolded_at` and `project.repo_branch` are set.
- Quality gate matrix gains a `bdd discovery` row: the runner must list `.feature` files at `specs/story-*/features/**/*.feature` with exit code 0.
- A.4 Support Directories now expects no `docs/` directory at the repo root.
- F. `.gitignore` must NOT ignore `specs/`.
- G. CLAUDE.md must reference `specs/STORIES.md`, document the phase enum, and forbid writes into `docs/V*/`.
- H. README.md must include a Stories section / pointer to `specs/STORIES.md`.
- Pre-Flight hard-stops on detected legacy `docs/V*/` layout.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/repo-initialization-verification/`.
