# Changelog — test-setup-verification

All notable changes to the `test-setup-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
