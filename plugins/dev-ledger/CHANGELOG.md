# Changelog — dev-ledger

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] — 2026-09-05

### Changed

- Contract resync from the finfetch-web dogfood (2026-09-05): stages finish synchronously (no background tool calls); never `--amend` a journaled commit — a trailing journal line is expected; a unit `-t` filter must select > 0 tests, else run the Op's RED-B files by path; third BDD fallback by scenario-name union for stories that own no `features/`; `<E2E>` in the GREEN self-review and audit of UI-touching Ops; the regression baseline is the default lanes only, env-gated lanes file warnings; anchored `pkill` pattern for leftover servers.

### Added

- `ledger --help` prints per-command usage (flags per subcommand) on stdout and exits 0.

## [1.0.2] — 2026-09-05

### Fixed

- `backlog list` prints `(no backlog items)` instead of nothing when the list is empty.

## [1.0.1] — 2026-08-31

### Fixed

- `regress` fails closed on load-broken test files: a vitest file with `status: "failed"` and no failed assertions now counts as a failure (`::(file failed to run)`), and any runner exiting non-zero while reporting zero failures is an error instead of a clean baseline.
- `regress` realpaths the repo root and the base worktree, so runner-reported realpath'd file names produce matching repo-relative ids (fixes every pre-existing failure becoming a false regression on macOS `/var` tmpdirs and symlinked checkouts).
- `regress` reports `suspect_base` — base-commit failures belonging to stories already `verified` in `specs/stories.json` are surfaced and exit 1 instead of being grandfathered as scaffold-RED.
- `backlog add`/`resolve`/`wontfix` serialize `backlog.json` read-modify-writes behind an `O_EXCL` lockfile (parallel gate agents no longer mint duplicate BL ids or clobber each other), and the journal `finding` line is written only after the backlog write succeeds.
- `readJournal` skips malformed journal lines with a warning instead of throwing forever after a crash mid-append.
- The CLI resolves `specs/` lazily: `ledger failures` (a pure stdin filter) and the bare usage message work outside a specs project.
- Contract §4: `mktemp` report paths, story-wide BDD path fallback for untagged feature files, suspect-base-failure semantics.

## [1.0.0] — 2026-08-30

### Added

- Journal (`ledger log`, `ledger journal`), backlog (`add/list/resolve/wontfix`), `failures` parsers and `regress` worktree diff, canonical pipeline contract, `/dev-ledger` and `/backlog` skills.
- Symlink-safe CLI entry (realpath main-guard); contract §5 uses find -L so symlinked installs are found.
- `regress` fails closed: the shared report file is removed before each run so a base run that fails to write cannot reuse the head's results; `find -L` in the SKILL/README locator snippets.
