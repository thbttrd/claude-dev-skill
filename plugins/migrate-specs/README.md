# migrate-specs

> Audit a repository's existing spec/architecture/plan/design documents — in any shape — and migrate them to the canonical story-based layout used by the rest of this marketplace.

**Version:** 1.0.0 · **License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## Install

```
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install migrate-specs@claude-dev-skill
```

## When to use it

- You have an existing repo with docs scattered across `docs/`, `specifications/`, root-level Markdown, etc., and you want to onboard onto the story-based pipeline.
- You're upgrading from the pre-2.0 version of this marketplace, which used `docs/V*/` directories and `docs/project-tracking.json`.
- Another pipeline skill (e.g. `/spec-writing`, `/plan-writing`) hard-stopped because it detected a legacy layout — this skill is the upgrade path.

## What it produces

A clean `specs/` directory matching the canonical layout, plus a `specs/MIGRATION.md` log listing every action taken and every gap that still needs a human.

```
specs/
├── stories.json
├── STORIES.md
├── PROJECT.md
├── ARCHITECTURE.md
├── DESIGN.md                                # if a design system was found
├── architecture.png                         # if a diagram was found
├── MIGRATION.md                             # the log
├── story-NNN-slug/
│   ├── STORY.md                             # may be a stub if not derivable
│   ├── PLAN.md                              # best-effort REASONS canvas
│   ├── features/F-NNN-*.feature
│   ├── mockups/UI-F-NNN-*.html              # if mockups were found
│   ├── ui/UI-F-NNN-*.md                     # if screen specs were found
│   ├── verification/qa-report.md            # if a QA report was found
│   └── state.json
└── …
```

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
