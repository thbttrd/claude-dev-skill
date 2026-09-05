# Changelog — spec-implementation-verification

All notable changes to the `spec-implementation-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.1] — 2026-09-05

### Changed

- Contract resync (dogfood run 2, 2026-09-05): journal a commit only after the commit succeeded, commitlint header/subject rules; uid-scoped, end-anchored `pkill` for leftover servers.

## [1.3.0] — 2026-09-05

### Added

- Per-Op audit runs `<E2E>` for UI Ops; confirm-only Ops are audited on their regression evidence, not flagged for a missing RED phase; the Next Step is derived from `state.json` (dogfood P10/P14/P17).

### Changed

- Contract resync (see `dev-ledger` 1.0.3).

## [1.2.1] — 2026-08-31

### Fixed

- Story-end audit Step 4 no longer requires the unfiltered `<TEST>`/`<BDD>` suites to pass (they may be permanently red with RED scaffolds, per contract §4); it now requires the story-filtered suites to pass plus zero regressions via `ledger regress --base $BASE_SHA`.
- Contract §4 resync: `mktemp` report paths for `ledger regress` (concurrent sessions no longer share `/tmp/ledger-*.json`), story-wide BDD selection falls back to the story's feature directory path when feature files carry no `@US-NNN` tag (e.g. `/migrate-specs` onboarding), and base failures of already-`verified` stories are "suspect base failures" — never grandfathered by the regression baseline.

## [1.2.0] — 2026-08-30

### Added

- Pipeline contract; verdict journaled; warnings filed as backlog items (BL-NNN); toolchain placeholders.

## [1.1.0] — 2026-08-22

### Changed

- Repositioned as an **opt-in deep audit**, no longer a mandatory pipeline stage. The default GREEN gates are `/spec-implementation`'s per-Op self-review checklist and its story-end Simplify / Code Review / Verify gates, with `/verification-and-validation` as the mandatory story-end E2E pass. Recommended for `US-000` and full-rigor Ops touching security, data rules, or tricky invariants. Light-rigor stories skip it by design.

## [1.0.0] — 2026-05-06

### Added

- Initial release. Per-Operation audit of `/spec-implementation` output. Mirrors `/test-setup-verification`'s structure on the GREEN side.
- Two modes:
  - **Per-op mode** (default while ops still need verification): spawns a fresh Opus agent that audits one Operation's implementation diff. Checks that only Op-X's tests pass at the assertion level expected, that the impl doesn't exceed Op-X's scope (no logic only justified by future ops), that files Op-X touched respect `specs/ARCHITECTURE.md` module boundaries, and that earlier Ops' tests still pass with no regression.
  - **Story-end mode** (no Op-X arg, all ops green, all `quality_gates` true): full-story audit confirming every Op's tests pass, every gate passed, and the story is ready for `/verification-and-validation`.
- Smart-default picker: with no `Op-X` arg, picks the first Op where `operation_phase ∈ {green, refactored}` AND `green_audit.verdict ≠ "PASS"`.
- Verdict + report path written to `state.json.operations[Op-X].green_audit` (per-op mode) or to a story-end audit slot.
- Reports persisted under `specs/story-NNN-slug/verification/green-audit-Op-X.md` (per-op) or `specs/story-NNN-slug/verification/green-audit-story-end.md` (story-end).
- Ralph-loop signal: `<promise>GREEN_AUDIT_COMPLETE_US-NNN_Op-X</promise>` and `<promise>GREEN_AUDIT_COMPLETE_US-NNN</promise>` (story-end).
