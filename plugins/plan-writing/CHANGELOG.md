# Changelog — plan-writing

All notable changes to the `plan-writing` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.4.1] — 2026-09-05

### Changed

- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op's RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.

## [2.4.0] — 2026-09-05

### Added

- Autopilot: PLAN_COMPLETE sentinel.
- Per-story self-review: full `backlog add` form (title/severity/kind/story).

## [2.3.1] — 2026-08-31

### Fixed

- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [2.3.0] — 2026-08-30

### Added

- `manual` Test Plan type for out-of-repo assertions; toolchain placeholders; pipeline contract (autopilot, journaling).

## [2.2.0] — 2026-08-22

### Added

- Compact mode for light-rigor stories: full R / A / O sections and full Test Plan, one-liner E / S / N / S sections, single-line Test Strategy unless overridden, and an Operations budget of ≤ 3 (exceeding it triggers a re-tier-or-split question). Typically runs in the same session as `/spec-writing`.
- Phase 7 now starts with a mandatory printed self-review checklist (REASONS completeness, RED-A→REFACTOR prescription, Test Plan traceability, `Op` tags, no code, module alignment, Operations budget) — the default quality gate for this phase.

### Changed

- Phase 7 next-step recommendation is now "/test-setup US-NNN"; `/plan-writing-verification` is offered as an opt-in deep audit for `US-000` and high-stakes full-rigor stories.

## [2.1.0] — 2026-05-06

### Added

- **`Op` column in the Test Plan table** — every test row is now tagged with the Operation that owns it (`Op-1`, `Op-2`, …). The per-Operation skills (`/test-setup`, `/test-setup-verification`, `/spec-implementation`, `/spec-implementation-verification`) filter the table by this column. Backward-compatible: pre-existing PLAN.md files without the column degrade gracefully — downstream skills fall back to the legacy heuristic of matching scenario names.
- Updated "Rules for the planner" with a corresponding rule: every Test Plan row MUST have an `Op` value matching one of the Operations defined above.

## [2.0.0] — 2026-05-03

### Added

- **REASONS canvas** plan template (`references/plan-template.md`) — Requirements / Entities / Approach / Structure / Operations / Norms / Safeguards plus explicit Test Strategy and Test Plan sections. Inspired by Martin Fowler's "Structured Prompt-Driven Development" article. Plans are dry (zero code) and read like an executable structured prompt.

### Changed

- **BREAKING:** Operates on **one story at a time** (`/plan-writing US-NNN`) instead of one version. Output is a single `specs/story-NNN-slug/PLAN.md`.
- **BREAKING:** RED → GREEN → REFACTOR is preserved at the **Operation** level inside each plan; the wave concept is gone. The story is the unit of planning, the operation is the unit of execution. Default ceiling: ≤ 6 operations per story (a higher count is a signal that INVEST `S` failed and the story should be split).
- **BREAKING:** No more `00-foundation.md`, `WN-…md`, `DAG.md`, or `implementation-state.json` per version. The story DAG lives in `specs/stories.json#stories[i].depends_on_story_ids`. Per-story execution state lives in `specs/story-NNN-slug/state.json` (created by `/test-setup`).
- **BREAKING:** Pre-Flight enforces dependency satisfaction — every story in `depends_on_story_ids` must be `verified` (or `is_foundation: true`) before this skill will plan a downstream story.
- Pre-Flight detects legacy `docs/V*/` layout and hard-stops with the migration command.
- Foundation Story (US-000) uses the same template; only its content (Approach, Structure, Operations) is special.

### Removed

- **BREAKING:** `references/dag-analysis.md` — wave-centric, replaced by per-story `depends_on_story_ids` in `specs/stories.json`.

## [1.0.0] — 2026-04-30

### Added

- Initial release in the `claude-dev-skill` marketplace. Migrated from `~/.claude/skills/plan-writing/`.
