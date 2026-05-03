# Changelog — high-level-scoping

All notable changes to the `high-level-scoping` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] — 2026-05-03

### Added

- New reference `references/stories-json-schema.md` describing the story-based `specs/stories.json` shape. Documents per-skill ownership, the `phase` enum (`backlog → scoped → specced → planned → red → green → verified`), INVEST flags, and ID conventions.
- New reference `references/stories-md-template.md` defining the `specs/STORIES.md` kanban layout that downstream skills regenerate on every phase transition.

### Changed

- **BREAKING:** Skill rewritten to produce a story-based scope (story DAG anchored on a Foundation Story `US-000`) instead of a versioned roadmap (`V0`/`V1`/…). Outputs `specs/stories.json`, `specs/STORIES.md`, `specs/PROJECT.md`, `specs/ARCHITECTURE.md`, and `specs/architecture.png` — all under `specs/`, never under `docs/`.
- Pre-Flight detects the legacy `docs/project-tracking.json` / `docs/V*/` layout and hard-stops with the migration command (`node scripts/migrate-tracking.mjs --input docs/project-tracking.json --out specs/`). The migration script is non-destructive.
- Phase 4 ("Roadmap — Vertical Slices") replaced by a Story DAG phase. Stories declare `depends_on_story_ids`; the Foundation Story (US-000) is generated automatically as the root.
- A lightweight INVEST sanity pass now runs in Phase 2 (Step 3). The full INVEST gate still lives in `/spec-writing`.
- Diagram path moves from `docs/V0/architecture/architecture.png` to `specs/architecture.png`.

### Removed

- **BREAKING:** `references/json-schema.md` — replaced by `references/stories-json-schema.md`.
- **BREAKING:** Version snapshot rule, `roadmap.versions[]`, version-pinned paths, and the entire `V0/V1/V2/…` directory model.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/high-level-scoping/`.
