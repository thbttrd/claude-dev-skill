# Changelog — claude-dev-skill marketplace

All notable changes to **the marketplace infrastructure itself** (scripts, layout, CI, install flow) are documented here. This is **separate** from the per-plugin changelogs in `plugins/<name>/CHANGELOG.md` — those track changes to individual skills.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the marketplace follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial marketplace bootstrap (Stage 1).
- `scripts/migrate-tracking.mjs` — best-effort one-shot converter from a legacy `docs/project-tracking.json` (version+wave model) to `specs/stories.json` + `specs/STORIES.md` + `specs/MIGRATION.md` (story-based model). Pure Node.js, no dependencies. Idempotent via `--force`. Step 1 of the story-based-workflow rollout (see `PROPOSAL-story-based-workflow.md`).
- New plugin **`migrate-specs`** (v1.0.0) — full repo-level migration skill. Audits any existing spec/architecture/plan/design layout (legacy `docs/V*/`, ad-hoc `docs/`, partial `specs/`, README-only backlogs, etc.) and migrates everything to the canonical `specs/` tree, including a best-effort REASONS-canvas rewrite of legacy wave plans and a `specs/MIGRATION.md` log of every action and gap.
- **`dev-ledger`** plugin (journal + backlog + regress CLI, `/backlog` skill). `scripts/sync-contract.sh` + validate check for the pipeline contract. Multi-skill plugins supported by `install-local.sh` and `validate.sh`.
- **`autopilot`** plugin (conductor + four bundled agents). `validate.sh` now checks bundled agents' frontmatter and every contract copy on disk; `uninstall-local.sh` unlinks every skill dir of a plugin; CI runs the autopilot tests.

### Changed

- Autopilot hardening from the first live dogfood on finfetch-web (plan 3/3, `.claude/handoffs/dogfood-US-002-report.md`): the pipeline contract resynced across every pipeline plugin (synchronous stages, never-amend, filter fallbacks, baseline lanes, `<E2E>` for UI Ops), `autopilot` 1.1.0, `test-setup` 3.3.0, `spec-implementation` 3.4.0, `spec-implementation-verification` 1.3.0, `dev-ledger` 1.0.3.
- `scripts/migrate-tracking.mjs` is now a thin shim that delegates to the canonical copy bundled inside `plugins/migrate-specs/`. The legacy invocation `node scripts/migrate-tracking.mjs` keeps working from a clone of the repo, but `/plugin install migrate-specs@claude-dev-skill` is now the recommended entry point because it audits the entire repo (not just the tracking JSON) and runs the migration interactively.
- README rewritten for the story-based workflow: catalog rows updated, pipeline ordering clarified, `specs/` layout tree added, install flow now mentions `/migrate-specs` for users with existing repos.
