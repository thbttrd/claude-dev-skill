# Changelog — plan-writing

All notable changes to the `plan-writing` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **REASONS canvas** plan template (`references/plan-template.md`) — Requirements / Entities / Approach / Structure / Operations / Norms / Safeguards plus explicit Test Strategy and Test Plan sections. Inspired by Martin Fowler's "Structured Prompt-Driven Development" article. Plans are dry (zero code) and read like an executable structured prompt.

### Changed

- **BREAKING:** Operates on **one story at a time** (`/plan-writing US-NNN`) instead of one version. Output is a single `specs/story-NNN-slug/PLAN.md`.
- **BREAKING:** RED → GREEN → REFACTOR is preserved at the **Operation** level inside each plan; the wave concept is gone. The story is the unit of planning, the operation is the unit of execution. Default ceiling: ≤ 6 operations per story (a higher count is a signal that INVEST `S` failed and the story should be split).
- **BREAKING:** No more `00-foundation.md`, `WN-…md`, `DAG.md`, or `implementation-state.json` per version. The story DAG lives in `specs/stories.json#stories[i].depends_on_story_ids`. Per-story execution state lives in `specs/story-NNN-slug/state.json` (created by `/test-setup`).
- **BREAKING:** Pre-Flight enforces dependency satisfaction — every story in `depends_on_story_ids` must be `verified` (or `is_foundation: true`) before this skill will plan a downstream story.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.
- Foundation Story (US-000) uses the same template; only its content (Approach, Structure, Operations) is special.

### Removed

- **BREAKING:** `references/dag-analysis.md` — wave-centric, replaced by per-story `depends_on_story_ids` in `specs/stories.json`.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/plan-writing/`.
