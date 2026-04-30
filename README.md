# claude-dev-skill

A Claude Code plugin **marketplace** of custom dev skills for spec-driven development. Each skill is published as its own plugin with its own [SemVer](https://semver.org/) version and [Keep-a-Changelog](https://keepachangelog.com/en/1.1.0/) changelog, so you can install only the ones you want and upgrade them independently.

## Install

In any Claude Code session:

```
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install <skill>@claude-dev-skill
```

For example:

```
/plugin install spec-writing@claude-dev-skill
/plugin install d2-architect@claude-dev-skill
```

To install everything at once, see the catalog below and run `/plugin install` for each name.

## Catalog

The skills form a coherent **spec-driven-development pipeline** (top → bottom) plus orthogonal tooling.

### Pipeline

| Stage | Skill | Version | What it does |
|---|---|---|---|
| 1 | `high-level-scoping` | 1.0.0 | Personas, epics, prioritized user stories, V0…Vn roadmap — produces `docs/project-tracking.json` |
| 2 | `spec-writing` | 1.0.0 | `SPECS.md` + Cucumber-compatible `.feature` files for a version |
| 2.5 | `spec-writing-verification` | 1.0.0 | Audits step 2 |
| 2.6 | `ui-specs` | 1.0.0 | `DESIGN.md` + per-screen HTML mockups (auto-invoked by `spec-writing` for UI projects) |
| 3 | `research-and-architecture` | 1.0.0 | `ARCHITECTURE.md` following MIM AA, with embedded diagrams |
| 3.5 | `research-and-architecture-verification` | 1.0.0 | Audits step 3 |
| 4 | `repo-initialization` | 1.0.0 | Scaffolds the repo from SPECS + ARCHITECTURE — tooling, hooks, CLAUDE.md |
| 4.5 | `repo-initialization-verification` | 1.0.0 | Audits step 4 |
| 5 | `plan-writing` | 1.0.0 | Wave-by-wave DAG of implementation plans for a version |
| 5.5 | `plan-writing-verification` | 1.0.0 | Audits step 5 |
| 6 | `test-setup` | 1.0.0 | Writes failing BDD step defs + unit tests + source stubs (RED state) |
| 6.5 | `test-setup-verification` | 1.0.0 | Audits step 6 |
| 7 | `spec-implementation` | 1.0.0 | GREEN-phase autonomous implementation, wave by wave |
| 8 | `verification-and-validation` | 1.0.0 | Final E2E verification of the running app vs. specs |

### Orthogonal tooling

| Skill | Version | What it does |
|---|---|---|
| `d2-architect` | 2.5.0 | Architecture diagrams via TALA + hand-coded HTML/SVG polish + agent-driven readability review |
| `html-architect` | 1.3.0 | Hand-coded HTML/SVG diagrams for layouts where auto-layout struggles |

## Versioning

- **Each plugin** has its own SemVer in `plugins/<name>/.claude-plugin/plugin.json` and a corresponding `plugins/<name>/CHANGELOG.md`.
- **The marketplace itself** has its own SemVer in `.claude-plugin/marketplace.json` and the top-level [`CHANGELOG.md`](./CHANGELOG.md). It tracks marketplace-infra changes only (layout, scripts, CI), **not** individual skill changes.

## Local development

If you're hacking on a skill in this repo and want your edits to flow live into your local Claude Code without re-publishing:

```bash
scripts/install-local.sh <skill>      # symlink one skill
scripts/install-local.sh --all        # symlink everything
scripts/uninstall-local.sh            # restore from backup
```

This symlinks each `plugins/<name>/skills/<name>/` into `~/.claude/skills/<name>/` and any bundled agents into `~/.claude/agents/`. Edits in this repo are reflected immediately on the next Claude Code session.

## Repo layout

```
claude-dev-skill/
├── .claude-plugin/marketplace.json       # marketplace manifest
├── plugins/<skill-name>/                 # one folder per plugin
│   ├── .claude-plugin/plugin.json        # plugin manifest (name, version, description)
│   ├── CHANGELOG.md                      # per-plugin Keep-a-Changelog
│   ├── README.md                         # human-readable overview
│   ├── skills/<skill-name>/SKILL.md      # the actual skill body
│   ├── skills/<skill-name>/references/   # ancillary docs (optional)
│   ├── skills/<skill-name>/scripts/      # ancillary scripts (optional)
│   └── agents/<agent-name>.md            # bundled agents (optional)
├── scripts/                              # migration + dev tooling
└── .github/workflows/ci.yml              # validation guard
```

## License

[MIT](./LICENSE) © thbttrd
