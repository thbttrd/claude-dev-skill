# Changelog — ui-specs

All notable changes to the `ui-specs` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] — 2026-05-03

### Changed

- **BREAKING:** Splits into two operating modes:
  - **Project-wide mode** (`/ui-specs --design-system`): produces a single `specs/DESIGN.md` once per project, re-runnable to swap brand inspiration or tweak tokens. No version-pinned copy.
  - **Per-story mode** (`/ui-specs US-NNN`): produces mockups + per-screen specs under `specs/story-NNN-slug/{mockups,ui}/`.
- **BREAKING:** All output paths move from `docs/V{N}/specs/{DESIGN.md,UI-F-*.md,mockups/}` to project-wide `specs/DESIGN.md` + per-story `specs/story-NNN-slug/{mockups,ui}/`.
- **BREAKING:** Reads from `specs/stories.json` and is invoked per story by `/spec-writing US-NNN`. Updates `stories[i].ui` and project-level `design_system` block instead of the legacy version-scoped fields.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.
- Update mode for `specs/DESIGN.md` rewrites in place rather than snapshotting per version. Append a Changelog entry inside the file.
- `references/ui-screen-template.md`, `references/mockup-html-template.md`, and `references/design-md-template.md` updated for `specs/`-rooted paths.

### Removed

- **BREAKING:** Version snapshot rule and any version-pinned UI artifact paths.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/ui-specs/`.
