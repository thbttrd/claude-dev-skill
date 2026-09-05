# Changelog — spec-writing-verification

All notable changes to the `spec-writing-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.2] — 2026-09-05

### Changed

- Contract resync (dogfood run 2, 2026-09-05): journal a commit only after the commit succeeded, commitlint header/subject rules; uid-scoped, end-anchored `pkill` for leftover servers.

## [2.3.1] — 2026-09-05

### Changed

- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op's RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.

## [2.3.0] — 2026-09-05

### Added

- Report persisted to verification/spec-audit.md; SPEC_AUDIT_COMPLETE sentinel; under /autopilot the audit runs in the story-verifier agent.

## [2.2.1] — 2026-08-31

### Fixed

- FAIL recovery no longer points at a nonexistent `/spec-writing --force` flag; `/spec-writing` enters update mode when STORY.md already exists.
- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [2.2.0] — 2026-08-30

### Added

- Pipeline contract; verdict journaled; warnings filed as backlog items (BL-NNN); toolchain placeholders.

## [2.1.0] — 2026-08-22

### Changed

- Repositioned as an **opt-in deep audit**, no longer a mandatory pipeline stage. The default gates are `/spec-writing`'s built-in self-review checklist and the story-end `/verification-and-validation` E2E pass. Recommended for `US-000`, full-rigor stories touching security / payments / data migration, or specs that feel off. Light-rigor stories skip it by design.

## [2.0.0] — 2026-05-03

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
