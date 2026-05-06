# Changelog — test-setup-verification

All notable changes to the `test-setup-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] — 2026-05-06

### Changed

- **BREAKING:** Audits **one Operation of one story at a time** (`/test-setup-verification US-NNN [Op-X]`) instead of the whole story in a single sweep. Reads only the Operation's RED-A / RED-B sections in PLAN.md, the Test Plan rows where `Op = Op-X`, and the test files those rows reference.
- **BREAKING:** The `Op-X` arg is optional. With no `Op-X`, the skill resolves the next RED'd Op that hasn't passed verification yet (first Op where `operation_phase = "red"` AND `red_audit.verdict ≠ "PASS"`).
- **BREAKING:** Test-suite filters are now per-Op: `bun bdd --tags="@US-NNN and @Op-X"` and `bun test --grep="@US-NNN.*@Op-X"`. The skill does not run the full `@US-NNN` suite — earlier Ops may already be GREEN, which is expected.
- **BREAKING:** Verdict is written to `state.json.operations[Op-X].red_audit` (per-Op record), not to a story-level field. The full report is saved to `specs/story-NNN-slug/verification/red-audit-Op-X.md`.
- BDD Toolchain Wiring gate runs only on the first per-story verification (when no earlier Op has a `red_audit` record). Subsequent per-Op verifications skip it.
- Test Plan Coverage check is scoped to rows tagged `Op = Op-X`. Rows without an `Op` value (legacy v1 PLAN.md) fall back to scenario-name matching against the Operation's `Covers scenarios:` line; the missing column is flagged as a warning.

### Added

- New ralph-loop signal: `<promise>RED_AUDIT_COMPLETE_US-NNN_Op-X</promise>` after each per-Op verification.

## [2.0.0] — 2026-05-03

### Changed

- **BREAKING:** Audits a single story's tests + stubs at `specs/story-NNN-slug/` instead of a version's tests at `docs/V{N}/`.
- Replaces wave-plan cross-checks with PLAN.md (REASONS canvas) cross-checks: every Test Plan row must be present on disk; every Operation's RED-A and RED-B must have tests.
- BDD toolchain wiring check now expects `specs/story-*/features/**/*.feature`.
- Test-suite filter switches to `@US-NNN` tags (`bun test --grep="@US-NNN"`, `bun bdd --tags="@US-NNN"`); expected outcome: 0 passed.
- New audit area: state.json + stories.json integration (phase_local, test_setup block, phase = red, history).
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops.
- Skill takes a story id argument; if omitted, the user picks from stories whose `phase = red`.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/test-setup-verification/`.
