# Changelog — autopilot

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-09-05

### Added

- /autopilot conductor (start/next/stage-start/stage-end/stop/report in autopilot.mjs), bundled agents invest-assessor / story-verifier / lazy-simplifier / story-reviewer, DAG chaining with --until, stop policies, retry + no-progress guards.
