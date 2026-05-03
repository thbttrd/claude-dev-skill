# Changelog — claude-dev-skill marketplace

All notable changes to **the marketplace infrastructure itself** (scripts, layout, CI, install flow) are documented here. This is **separate** from the per-plugin changelogs in `plugins/<name>/CHANGELOG.md` — those track changes to individual skills.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the marketplace follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial marketplace bootstrap (Stage 1).
- `scripts/migrate-tracking.mjs` — best-effort one-shot converter from a legacy `docs/project-tracking.json` (version+wave model) to `specs/stories.json` + `specs/STORIES.md` + `specs/MIGRATION.md` (story-based model). Pure Node.js, no dependencies. Idempotent via `--force`. Step 1 of the story-based-workflow rollout (see `PROPOSAL-story-based-workflow.md`).
