# dev-ledger

The audit trail of the story-based pipeline. Two tracker files, one CLI, no dependencies.

Write-once decisions, actions and gates to `specs/journal.jsonl`; file un-applied findings as numbered backlog items in `specs/backlog.json`. Every skill and verifier routes its outcomes here instead of chat prose, so the pipeline's decisions are auditable and un-applied improvements are retrievable by ID.

## Tracker Files

| File                  | Written by                       | Shape                                   |
| --------------------- | -------------------------------- | --------------------------------------- |
| `specs/journal.jsonl` | `ledger log`, `ledger backlog *` | one JSON object per line, append-only   |
| `specs/backlog.json`  | `ledger backlog *`               | `{ next_id, items[] }` — see `/backlog` |

### Journal — `specs/journal.jsonl`

Append-only, one JSON object per line, never edited, committed with the work it describes.

```json
{
  "ts": "2026-08-30T15:04:11Z",
  "run_id": "run-…",
  "story": "US-008",
  "op": "Op-2",
  "stage": "test-setup",
  "kind": "decision",
  "agent": "agent-7f3a",
  "summary": "RED-B skipped: PLAN.md lists no unit row for Op-2",
  "refs": ["specs/story-008-staging-deployment/PLAN.md#operation-2"],
  "sha": null
}
```

Fields:

- `kind ∈ {stage_start, stage_end, decision, action, gate, finding, commit, stop}`
- `gate` entries carry `{"gate":"self-review|simplify|code-review|verify|invest|spec-verification|plan-verification|red-audit|green-audit|v-and-v","verdict":"PASS|PASS_WITH_WARNINGS|FAIL","report":"path"}`
- `finding` entries carry the `BL-NNN` id they produced
- `commit` entries are written by a `post-commit` git hook installed by `/repo-initialization`

### Backlog — `specs/backlog.json`

```json
{
  "next_id": 13,
  "items": [
    {
      "id": "BL-012",
      "title": "Extract podman helper shared by deploy.steps and e2e",
      "detail": "…",
      "source": {
        "stage": "spec-implementation",
        "gate": "code-review",
        "story": "US-008",
        "op": "Op-1",
        "report": "specs/story-008-staging-deployment/verification/green-audit-Op-1.md"
      },
      "severity": "warning",
      "kind": "simplification",
      "files": ["tests/bdd/steps/deploy.steps.ts"],
      "status": "open",
      "created_at": "2026-08-30",
      "resolved_at": null,
      "resolved_sha": null,
      "resolution": null
    }
  ]
}
```

Fields:

- `severity ∈ {info, warning, error}`
- `kind ∈ {bug, simplification, refactor, test-gap, spec-gap, doc, perf, security}`
- `status ∈ {open, in-progress, done, wontfix}`

## CLI

```bash
LEDGER="$(find "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
node "$LEDGER" log      --kind decision|action|gate|finding|commit|stage_start|stage_end|stop --summary "…" [--story US-NNN] [--op Op-X] [--stage s] [--ref p]… [--sha h] [--gate g --verdict PASS|PASS_WITH_WARNINGS|FAIL --report p]
node "$LEDGER" journal  [--story US-NNN] [--op Op-X] [--kind k] [--since YYYY-MM-DD] [--json] [--no-git]
node "$LEDGER" backlog  add --title "…" --severity info|warning|error --kind bug|simplification|refactor|test-gap|spec-gap|doc|perf|security [--file p]… [--report p] [--detail "…"]
node "$LEDGER" backlog  list [--status open|in-progress|done|wontfix] [--story US-NNN] [--severity s] [--json]
node "$LEDGER" backlog  resolve BL-NNN --sha <sha> --resolution "…"
node "$LEDGER" backlog  wontfix BL-NNN --reason "…"
node "$LEDGER" failures --runner vitest|cucumber|lines [--report-file p]      # stdin → sorted failing test ids
node "$LEDGER" regress  --base <sha> --cmd "<shell>" --runner vitest|cucumber|lines [--report-file p] [--json]   # exit 1 on regressions
```

`--specs <dir>` (or `LEDGER_SPECS`) overrides the `specs/` lookup, which otherwise walks up from the cwd to the directory holding `specs/stories.json`.

## Tests

```
node --test skills/dev-ledger/scripts/ledger.test.mjs
```

**Version:** 0.1.0 · **License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
