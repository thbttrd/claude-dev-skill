# Changelog — spec-implementation

All notable changes to the `spec-implementation` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Operates on **one story at a time** (`/spec-implementation US-NNN`) instead of one version. Reads the story's REASONS-canvas `PLAN.md` and executes Operations sequentially (no waves).
- **BREAKING:** Quality gates (Simplify / Code Review / Verify) run **once per story** at the end, not per wave.
- **BREAKING:** Per-story state file moves to `specs/story-NNN-slug/state.json`. The `quality_gates` block tracks `simplified`, `reviewed`, `verified` per story.
- **NEW:** Foundation Auto-Chain — if invoked for `US-000` against an empty repo with `phase = planned`, the skill chains `/repo-initialization` first (and re-runs `/test-setup US-000` if needed), then proceeds with GREEN. Eliminates the "did I run repo-init yet?" friction for new projects.
- Pre-Flight enforces dependency satisfaction: every story in `depends_on_story_ids` must be `verified` (or `is_foundation`).
- On completion, writes `stories[i].implementation` block, flips `phase` to `green`, appends history, regenerates `specs/STORIES.md`.
- Output completion signal becomes `IMPLEMENTATION_COMPLETE_US-NNN` (story-scoped) instead of the legacy global `IMPLEMENTATION_COMPLETE`.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/spec-implementation/`.
