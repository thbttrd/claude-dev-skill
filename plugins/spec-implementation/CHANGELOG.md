# Changelog — spec-implementation

All notable changes to the `spec-implementation` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] — 2026-05-06

### Changed

- **BREAKING:** Operates on **one Operation of one story at a time** (`/spec-implementation US-NNN [Op-X]`) in per-op mode, instead of looping through every Operation in a single invocation. Each per-op call writes only the GREEN (and optional REFACTOR) for the requested Operation, runs the per-story suite (`@US-NNN`) to confirm that Op's tests pass and earlier Ops still pass, commits, and exits.
- **BREAKING:** The skill is now dual-mode. **Per-op mode** is the default while ops still have `operation_phase = "red"`. **Story-end mode** triggers automatically when invoked with no `Op-X` arg and every op has reached `operation_phase ∈ {green, refactored}`: it runs the three story-level quality gates (Simplify, Code Review, Verify) and flips `stories[i].phase` to `"green"`. Per-op invocations skip the gates.
- **BREAKING:** The `Op-X` arg is optional. With no `Op-X`, the smart-default picker resolves the next op where `operation_phase = "red"` AND `implementation_status ≠ "green"`; if no such op exists, the picker either runs story-end mode or reports "Story is GREEN".
- **BREAKING:** `stories.json` is no longer touched in per-op mode. The single `stories.json` write happens only when story-end mode finishes (`stories[i].implementation`, `phase = "green"`, history entry).
- New per-op promise signal: `<promise>GREEN_COMPLETE_US-NNN_Op-X</promise>` after each Op's GREEN commit. The story-end signal `<promise>IMPLEMENTATION_COMPLETE_US-NNN</promise>` is preserved for backwards compat.
- New ralph-loop signal `<promise>STORY_OPS_COMPLETE_US-NNN</promise>` emitted when the last per-op GREEN finishes (handoff to story-end mode).
- New `--force` flag for re-implementing an Op already at `green` or `refactored` (rare; mainly for plan changes mid-flight).

### Added

- **v1 → v2 state.json migration** runs automatically on entry. Existing v1 files are upgraded in place: per-Op `operation_phase` is derived from existing fields; empty `red_audit` / `green_audit` blobs are added; `current_operation` cursor is initialized; `schema_version` bumped to 2.

## [2.0.0] — 2026-05-03

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
