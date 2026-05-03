# Changelog — research-and-architecture-verification

All notable changes to the `research-and-architecture-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] — 2026-05-03

### Changed

- **BREAKING:** Audits `specs/ARCHITECTURE.md` (project-wide) instead of `docs/V{N}/architecture/ARCHITECTURE.md`.
- Cross-references against `specs/stories.json` and per-story `.feature` files (for stories whose phase is ≥ `specced`) instead of the legacy `SPECS.md`.
- New section in the audit checklist: ADR append-only-log integrity check.
- Pre-Flight hard-stops on detected legacy `docs/V*/` layout and points at the migration script.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/research-and-architecture-verification/`.
