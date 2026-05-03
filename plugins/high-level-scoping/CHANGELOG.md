# Changelog — high-level-scoping

All notable changes to the `high-level-scoping` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New reference `references/stories-json-schema.md` describing the story-based `specs/stories.json` shape (replaces the legacy version+wave `references/json-schema.md`). Documents per-skill ownership, the `phase` enum (`backlog → scoped → specced → planned → red → green → verified`), INVEST flags, and ID conventions.
- New reference `references/stories-md-template.md` defining the `specs/STORIES.md` kanban layout that downstream skills regenerate on every phase transition.

### Notes

- The skill body has not been rewritten yet; it still consumes the legacy `references/json-schema.md`. The schema rewrite lands in a follow-up commit.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/high-level-scoping/`.
