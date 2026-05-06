# Changelog — spec-implementation-verification

All notable changes to the `spec-implementation-verification` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
