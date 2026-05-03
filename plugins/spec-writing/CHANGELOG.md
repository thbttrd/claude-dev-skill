# Changelog — spec-writing

All notable changes to the `spec-writing` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New `references/story-md-template.md` for the per-story `STORY.md` (User Story + INVEST table + AC + Rules + feature-file map).
- New Phase 0 — INVEST Gate. Six interactive checks (Independent / Negotiable / Valuable / Estimable / Small / Testable) run via `AskUserQuestion` before any discovery or generation. Failure on any letter blocks the skill until the user resolves it (split, rephrase, add dependency, etc.).
- Skill now accepts a story argument: `/spec-writing US-NNN`. If omitted, the user picks from stories whose `phase ∈ { scoped }`.

### Changed

- **BREAKING:** Output moves from project-wide `docs/V{N}/specs/SPECS.md` + `docs/V{N}/specs/features/*.feature` to per-story `specs/story-NNN-slug/STORY.md` + `specs/story-NNN-slug/features/F-NNN-*.feature`.
- **BREAKING:** Reads from `specs/stories.json` instead of `docs/project-tracking.json`. Updates `stories[i].invest`, `stories[i].artifacts`, `stories[i].spec`, `stories[i].phase`, and `stories[i].history` on completion.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.
- Project-wide concerns (NFRs, glossary, tech-stack pointer) are no longer owned by this skill — they live in `specs/PROJECT.md`, owned by `/high-level-scoping`.
- `/ui-specs` is invoked per-story (`/ui-specs US-NNN`) rather than per-version.
- `references/feature-file-template.md` updated for `specs/story-NNN-slug/features/` paths and feature ids that are local to the parent story.

### Removed

- **BREAKING:** `references/specs-template.md` — replaced by `references/story-md-template.md` and `specs/PROJECT.md` ownership in `/high-level-scoping`.
- **BREAKING:** Version snapshot rule, V{N} directories, and the project-wide `SPECS.md` document.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/spec-writing/`.
