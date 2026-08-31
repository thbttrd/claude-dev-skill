# Changelog — spec-writing

All notable changes to the `spec-writing` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.1] — 2026-08-31

### Fixed

- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [2.2.0] — 2026-08-30

### Added

- Autopilot: INVEST auto-checks are final, no discovery conversation, SPEC_COMPLETE sentinel; pipeline contract; self-review journaled.

## [2.1.0] — 2026-08-22

### Changed

- Phase 0 INVEST gate is now rigor-aware: light stories get a single-batch confirmation (auto-checked six-letter table, one `AskUserQuestion`); full stories keep the fully interactive gate. Oversized light stories are offered a re-tier to `full`.
- Phase 3 renamed to "Self-Review & Handoff": walking the Writing Quality Checklist is now a mandatory printed step before any handoff, and it is the default quality gate for this phase.
- Handoff options are rigor-aware: light stories chain straight into `/plan-writing US-NNN` compact mode in the same session (recommended); full stories default to "/plan-writing" with `/spec-writing-verification` offered as an opt-in deep audit for `US-000` and high-stakes stories.

### Removed

- The inline Opus spec-review agent in Phase 3 — it duplicated `/spec-writing-verification`. The fresh-agent deep audit now lives exclusively in that (opt-in) skill, so each quality layer exists exactly once.

## [2.0.0] — 2026-05-03

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
