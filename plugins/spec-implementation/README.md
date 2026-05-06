# spec-implementation

> Per-Operation GREEN-phase executor with story-end wrap-up gates. Implements one Operation at a time (`/spec-implementation US-NNN Op-X`); when every Op is GREEN, runs Simplify + Code Review + Verify and flips the story to `green`.

**Version:** 3.0.0 · **License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## Install

```
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install spec-implementation@claude-dev-skill
```

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
