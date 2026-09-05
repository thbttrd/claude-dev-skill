# specs-site

> Renders a project's `specs/` directory as a local Astro site — a pure function of `specs/**`, nothing written by an LLM.

**Version:** 1.0.0 · **License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## What it renders

| Route | Content |
| --- | --- |
| `/` | Phase kanban from `stories.json`, per-story Op bars from `state.json`, gate verdict chips from the journal, open backlog by severity, **Now running** from `autopilot.json` + the last 20 journal events, last verified story. |
| `/stories/US-NNN` | Story (STORY.md), Features (Gherkin rendered with each scenario coloured `pending` / `red` / `green` / `manual` from the Test Plan rows), Plan (REASONS canvas), State (Ops, gates, Test Plan rows, decisions, errors, the story's journal), Verification (reports + screenshots), UI (specs + mockups in iframes), Backlog (items sourced from the story). |
| `/architecture` | ARCHITECTURE.md, top-level diagrams, PROJECT.md, MIGRATION.md. |
| `/design` | DESIGN.md with a swatch table for every `--token \| #light \| #dark` row. |
| `/journal` | Every journal line, filterable by story / op / stage / kind / day (+ free text); `/journal#US-002` preselects a story. Malformed lines are shown, not dropped. |
| `/backlog`, `/backlog/BL-NNN` | Filterable by status / severity / kind / story; the item page shows the source report excerpt and the `/backlog BL-NNN` command to copy. |
| `/assets/<path>` | Diagrams, screenshots and mockups under `specs/**`, served verbatim. |

Parse errors (bad JSON, a broken `.feature`, an invalid journal line) render in place; the rest of the site keeps working. In dev, every change under `specs/**` reloads the page.

## Install

```
/plugin install specs-site@claude-dev-skill
```

## Usage

```
/specs-site [--specs DIR] [--build] [--host [ADDR]] [--port N]
```

or the CLI directly:

```
node skills/specs-site/scripts/specs-site.mjs dev   --specs /path/to/project/specs     # http://127.0.0.1:4321/
node skills/specs-site/scripts/specs-site.mjs build --specs /path/to/project/specs     # → /path/to/project/specs/.site/
```

The first run installs the site's dependencies (`npm ci` from the committed lockfile). Node ≥ 22.12.

## Layout

`skills/specs-site/site/` is a plain Astro 7 project: `SPECS_DIR=/abs/path npm run dev` works there too. Trackers are read from disk on every request (`src/lib/specs.mjs`); markdown goes through a `docs` content collection; `.feature` files through `src/lib/gherkin.mjs` (`@cucumber/gherkin`). One stylesheet, no client framework — the only client JS is the filter form on `/journal` and `/backlog`.

## Tests

```
(cd skills/specs-site/site && npm test)                 # readers + Gherkin parser against scripts/fixtures/specs
node --test skills/specs-site/scripts/specs-site.test.mjs   # CLI args, a full build of the fixture, dev-server freshness
```

## What it is not

Not an editor, not a place where the LLM writes summaries, not a replacement for `stories.json`. If a fact isn't in `specs/**`, the site doesn't show it.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
