# Changelog — dev-ledger

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-08-30

### Added

- Journal (`ledger log`, `ledger journal`), backlog (`add/list/resolve/wontfix`), `failures` parsers and `regress` worktree diff, canonical pipeline contract, `/dev-ledger` and `/backlog` skills.
- Symlink-safe CLI entry (realpath main-guard); contract §5 uses find -L so symlinked installs are found.
- `regress` fails closed: the shared report file is removed before each run so a base run that fails to write cannot reuse the head's results; `find -L` in the SKILL/README locator snippets.
