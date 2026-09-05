# autopilot

> Unattended driver for the story pipeline. /autopilot US-NNN [--until US-MMM] runs spec → plan → per-Operation RED/GREEN → story-end gates → E2E for one story or a DAG-ordered chain, one fresh subagent per stage, never asking a question: warnings become backlog items, hard failures stop the run, every step is journaled. Bundles the invest-assessor, story-verifier, lazy-simplifier and story-reviewer agents. Triggers on "/autopilot", "run the pipeline unattended", "autopilot US-003", "resume autopilot".

**Version:** 0.1.0 · **License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## Install

```
/plugin install autopilot@claude-dev-skill
```

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
