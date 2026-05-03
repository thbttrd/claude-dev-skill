# Changelog — research-and-architecture

All notable changes to the `research-and-architecture` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Output moves from `docs/V{N}/architecture/ARCHITECTURE.md` to project-wide `specs/ARCHITECTURE.md`. The document is additive — when new stories require new modules, the file is enriched in place rather than duplicated per version.
- **BREAKING:** Reads from `specs/stories.json` (story-based tracker) instead of `docs/project-tracking.json`. Personas, epics, and the story DAG drive feature-to-module mapping; the version snapshot rule is removed entirely.
- Pre-Flight detects the legacy `docs/V*/` layout and hard-stops with the migration command.
- ADRs are append-only: new ADRs that reverse prior decisions reference the superseded ADR id rather than rewriting it.
- Detailed diagram path moves to `specs/architecture-detailed.png`.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/research-and-architecture/`.
