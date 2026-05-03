# Changelog — plan-writing-verification

All notable changes to the `plan-writing-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Audits a single story's `specs/story-NNN-slug/PLAN.md` instead of `docs/V{N}/plans/`.
- New audit areas:
  - A. REASONS Canvas Completeness (every section must be present and populated)
  - B. Operations Quality (each Operation prescribes RED-A → RED-B → GREEN → REFACTOR with concrete file paths and commit messages)
  - C. Test Plan Traceability (every row points at a Gherkin scenario, AC id, or Safeguard)
  - F. Norms & Safeguards Quality (load-bearing, observable, measurable)
  - H. Size & Splitability (operations count ≤ 6 default; warns if higher)
- Skill takes a story id argument (`/plan-writing-verification US-NNN`); if omitted, the user picks from stories whose `phase = planned`.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/plan-writing-verification/`.
