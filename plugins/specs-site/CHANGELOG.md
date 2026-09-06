# Changelog — specs-site

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-09-06

### Added

- Journal entries carry a stable id `jl-NNN` (= line NNN of `specs/journal.jsonl`) on the journal page and in a story's journal table, with `/journal#jl-NNN` anchors, so a user can name an entry when asking about it.
- ```` ```mermaid ```` fences in ARCHITECTURE.md / PLAN.md / any rendered markdown are drawn in the browser (mermaid 11, bundled; excluded from shiki) instead of showing as a highlighted code block.

### Changed

- Backlog table: `done` / `wontfix` rows are dimmed with a struck-through title and a new `Resolved` column (date, sha, resolution), so a closed item no longer reads like an open one.

## [1.0.0] — 2026-09-05

### Added

- Initial release: Astro 7 site over `specs/**` (dashboard, stories, architecture, design, journal, backlog), `specs-site.mjs` CLI (`dev` / `build --specs DIR`), fixture-driven `node --test` suite.
