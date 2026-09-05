# Changelog — autopilot

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-09-05

### Added

- `autopilot.json.base_sha[US-NNN]`: HEAD when a run first picks a story up, carried across resumes; the conductor reads it with `jq` (the `git log --grep` lookup is now the fallback and accepts `chore(US-NNN)`).
- `start` adds `specs/autopilot.json` to `.git/info/exclude` (journaled once) and returns preflight `warnings`, including a warning when the target's STORY.md is still a migrated TODO stub.
- Confirm-only Ops (`state.json.operations[Op-X].confirm_only = true`, written by `spec-implementation` 3.4.0) skip the per-Op green audit under `rigor: full`.
- `story-verifier` commits its outputs (report, state.json, backlog, journal) before its sentinel or stop, derives the Next Step from `state.json`, and treats confirm-only Ops as legitimate.

### Fixed

- A stop before any stage journals `story=target`, `stage=autopilot` and renders as `run — stop (<reason>)` instead of `null null — stop`.
- `stop` journals nothing when the stage agent already recorded the same `stop_reason` (contract §2.3) — no more duplicated stop lines.
- `report` dedupes gate lines (last verdict wins) and stop lines, lists commits in `git log` order and marks journaled shas no branch reaches as `(unreachable)`.
- Conductor: `retry` stops the previous attempt's agent before re-dispatching; the conductor journals nothing by hand.

### Changed

- Contract resync (see `dev-ledger` 1.0.3): synchronous stages, never-amend, filter fallbacks, baseline lanes, `<E2E>` for UI Ops.

## [1.0.0] — 2026-09-05

### Added

- /autopilot conductor (start/next/stage-start/stage-end/stop/report in autopilot.mjs), bundled agents invest-assessor / story-verifier / lazy-simplifier / story-reviewer, DAG chaining with --until, stop policies, retry + no-progress guards.
