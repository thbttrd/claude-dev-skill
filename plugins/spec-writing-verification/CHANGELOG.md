# Changelog — spec-writing-verification

All notable changes to the `spec-writing-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** Audits per-story `specs/story-NNN-slug/STORY.md` + `specs/story-NNN-slug/features/*.feature` instead of project-wide `docs/V{N}/specs/SPECS.md`.
- **BREAKING:** Cross-references `specs/stories.json#stories[i].invest` and `stories[i].phase` to confirm the INVEST gate ran.
- New audit area: INVEST Compliance (every flag must be `✅` and timestamps must agree between STORY.md and stories.json).
- New audit area: Dependencies & DAG sanity (every dependency exists, is verified or foundation, no cycles introduced).
- Pre-Flight hard-stops on detected legacy `docs/V*/` layout and points at the migration script.
- Skill takes a story id argument (`/spec-writing-verification US-NNN`); if omitted, the user picks from stories whose `phase = specced`.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/spec-writing-verification/`.
