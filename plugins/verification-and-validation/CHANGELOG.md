# Changelog — verification-and-validation

All notable changes to the `verification-and-validation` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Operates on **one story at a time** (`/verification-and-validation US-NNN`) instead of one version. The story-level outcome is the QA report at `specs/story-NNN-slug/verification/qa-report.md` and a `phase = verified` flip in `specs/stories.json`.
- **NEW:** `--all-pending` flag — walks every story whose `phase = green` in DAG order (respecting `depends_on_story_ids`), running the full single-story flow on each. Stops on the first failure.
- **BREAKING:** Per-story state file at `specs/story-NNN-slug/state.json`. The `verification` block records automated_suite, app_running, api_verification, ui_verification, issues_fixed, completed_at.
- README completeness check (Step 5) only runs when verifying the highest-id story whose dependencies are all `verified` — i.e., once per release-ready state, not once per story.
- Test-suite filter uses `@US-NNN` tags so only the target story's BDD scenarios run during the API/UI walkthrough; previously verified stories run as a regression set.
- Output completion signal becomes `VERIFICATION_COMPLETE_US-NNN` (story-scoped) instead of the legacy global `VERIFICATION_COMPLETE`.
- QA report path moves from `docs/V{N}/qa-report.md` to `specs/story-NNN-slug/verification/qa-report.md`.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/verification-and-validation/`.
