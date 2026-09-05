# Changelog — verification-and-validation

All notable changes to the `verification-and-validation` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.3] — 2026-09-05

### Changed

- Contract resync (dogfood run 2, 2026-09-05): journal a commit only after the commit succeeded, commitlint header/subject rules; uid-scoped, end-anchored `pkill` for leftover servers.

## [2.1.2] — 2026-09-05

### Changed

- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op's RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.

## [2.1.1] — 2026-08-31

### Fixed

- Step 1 regress calls use `mktemp` report paths instead of fixed `/tmp/ledger-*.json` files.
- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [2.1.0] — 2026-08-30

### Added

- Toolchain placeholders; manual Test Plan rows walked and recorded in qa-report.md; regression baseline via ledger regress; pipeline contract + journaling; Co-Authored-By rule removed.
- Backlog templates carry the required `--title`.

## [2.0.1] — 2026-08-22

### Changed

- Documentation: explicitly designated as **the one mandatory quality gate** of the per-story pipeline — every story, light or full rigor, must pass it; the `*-verification` deep audits are opt-in precisely because this gate exists. No behavioural change.

## [2.0.0] — 2026-05-03

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
