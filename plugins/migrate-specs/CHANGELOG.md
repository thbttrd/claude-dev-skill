# Changelog — migrate-specs

All notable changes to the `migrate-specs` skill are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the skill follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-05-03

### Added

- Initial release. Audits a repo's existing spec/architecture/plan/design documents and migrates them to the canonical `specs/` layout used by the rest of this marketplace.
- Open-ended source-layout recognition: handles the legacy `docs/V*/` + `docs/project-tracking.json` layout from the pre-2.0 pipeline, plus ad-hoc shapes (root `ARCHITECTURE.md`, `docs/architecture.md`, `requirements.md`, `BACKLOG.md`, `STORIES.md`, scattered `*.feature` files, design-system docs, mockup HTML in `design/`, etc.).
- Three-phase interactive flow — **Audit** (read-only repo scan + classification), **Plan** (interactive confirmation of every move/rewrite via `AskUserQuestion`), **Execute** (file moves + path rewrites + best-effort REASONS-canvas plan conversion + `specs/MIGRATION.md` emission).
- `scripts/audit.mjs` — pure-Node repo scanner. Walks doc directories with sane excludes, classifies files by filename + extension heuristics, emits a JSON report.
- `scripts/migrate-tracking.mjs` — moved from the marketplace root into the plugin so `migrate-specs` is self-contained. Converts a legacy `docs/project-tracking.json` to `specs/stories.json` + `specs/STORIES.md` + `specs/MIGRATION.md`.
- Best-effort rewrite of legacy wave-style plans (`docs/V*/plans/W*-*.md`, `00-foundation.md`, `DAG.md`) into per-story `specs/story-NNN-slug/PLAN.md` files in the REASONS canvas format. Sections that cannot be derived are stubbed with a `<!-- MIGRATED: ... -->` banner so downstream verifiers flag them for human review.
- CLI flags: `--dry-run` (stop after audit + plan phase, no files touched), `--root <path>` (operate on a different repo root, default cwd), `--no-tracking` (skip the tracking-JSON migrator even when `docs/project-tracking.json` exists, useful when the legacy tracker is too out-of-date to be worth migrating).
- References — `source-layouts.md` (catalog of recognised shapes), `mapping-rules.md` (source → target rules), `plan-rewrite-rules.md` (legacy plan → REASONS), `migration-md-template.md` (the log format), `target-layout.md` (the canonical destination layout).
