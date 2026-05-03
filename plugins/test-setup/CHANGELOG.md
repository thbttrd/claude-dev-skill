# Changelog — test-setup

All notable changes to the `test-setup` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] — 2026-05-03

### Changed

- **BREAKING:** Operates on **one story at a time** (`/test-setup US-NNN`) instead of one version. Reads the story's REASONS-canvas `PLAN.md` (Test Plan + Test Strategy + Operations) and writes BDD step definitions, unit/integration tests, and source stubs for that single story.
- **BREAKING:** Per-story state file moves from `docs/V{N}/plans/implementation-state.json` to `specs/story-NNN-slug/state.json`. The `phase_local` field replaces the legacy global `phase` and reflects which sub-skill is operating on the story (`test_setup | executing | verifying`).
- **BREAKING:** BDD toolchain pre-flight gate's wiring path moves from `docs/V{N}/specs/features/**/*.feature` to `specs/story-*/features/**/*.feature`. Otherwise unchanged.
- Pre-Flight enforces dependency satisfaction: every story in `depends_on_story_ids` must be `verified` (or `is_foundation`).
- On completion, writes `stories[i].test_setup` block, flips `phase` to `red`, appends history, regenerates `specs/STORIES.md`.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/test-setup/`.
