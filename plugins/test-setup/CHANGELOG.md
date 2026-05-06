# Changelog — test-setup

All notable changes to the `test-setup` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] — 2026-05-06

### Changed

- **BREAKING:** Operates on **one Operation of one story at a time** (`/test-setup US-NNN [Op-X]`) instead of all Operations of the story in a single invocation. Reads only the slice of PLAN.md that belongs to the requested Operation: the matching `### Operation X` section plus the Test Plan rows tagged `Op = Op-X`.
- **BREAKING:** The `Op-X` arg is optional. With no `Op-X`, the skill resolves the next pending Operation via the smart-default picker (first Op where `operation_phase ∈ {pending, red_a}`), reading from `specs/story-NNN-slug/state.json`.
- **BREAKING:** Tests are now tagged with both `@US-NNN` (story tag, existing) and `@Op-X` (new). BDD scenarios carry the tag on the `Scenario:` or `Rule:` line; unit/integration tests carry it in the `describe()` or `test()` name. Runner filters use `bun bdd --tags="@US-NNN and @Op-X"` and `bun test --grep="@US-NNN.*@Op-X"`.
- **BREAKING:** Source stubs are created **lazily** — only the files this Operation's tests import that don't already exist. Earlier Operations' stubs are reused; later Operations' stubs are deferred to their own invocation.
- The story's project-level `phase` flips from `planned → red` on the **first** Operation's first RED-A and stays sticky through every subsequent per-Op invocation. `stories.json` is written only on this initial transition and again when the **last** Op reaches `operation_phase = "red"` (story-level `test_setup` summary block).
- BDD Toolchain Pre-Flight gate runs only on the first per-story invocation; subsequent per-Op invocations skip it.

### Added

- **v1 → v2 state.json migration** runs automatically on entry. Existing v1 `state.json` files are upgraded in place: per-Op `operation_phase` is derived from existing `tests_status` / `implementation_status` fields; empty `red_audit` / `green_audit` blobs are added; `current_operation` is set to the first non-green Op; `schema_version` is bumped to 2.
- New per-Op promise signals for ralph-loop integration: `<promise>RED_COMPLETE_US-NNN_Op-X</promise>` after each Op's RED commit; `<promise>TEST_SETUP_COMPLETE_US-NNN</promise>` once the last Op reaches RED (kept for backwards compat).
- New `--force` flag for re-RED'ing an Op already past `operation_phase = "red"` (rare; mainly for plan changes).

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
