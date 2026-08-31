---
name: dev-ledger
version: 1.0.1
description: 'Journal + backlog + regression CLI for story-based projects. `/dev-ledger` prints the project journal (specs/journal.jsonl merged with git log); `/dev-ledger US-008` filters one story. Other pipeline skills call the bundled `scripts/ledger.mjs` to record decisions, gate results and findings, to file backlog items (BL-NNN), and to compute a regression baseline. Triggers on "show the journal", "what happened on US-008", "what did autopilot decide", "/dev-ledger".'
---

# dev-ledger

The audit trail of the story-based pipeline. Two tracker files, one CLI, no dependencies.

| File                  | Written by                       | Shape                                   |
| --------------------- | -------------------------------- | --------------------------------------- |
| `specs/journal.jsonl` | `ledger log`, `ledger backlog *` | one JSON object per line, append-only   |
| `specs/backlog.json`  | `ledger backlog *`               | `{ next_id, items[] }` — see `/backlog` |

The rules for _when_ skills log are in `references/autopilot-contract.md` §3 (canonical copy lives here). The CLI:

```bash
LEDGER="$(find -L "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
node "$LEDGER" log      --kind decision|action|gate|finding|commit|stage_start|stage_end|stop --summary "…" [--story US-NNN] [--op Op-X] [--stage s] [--ref p]… [--sha h] [--gate g --verdict PASS|PASS_WITH_WARNINGS|FAIL --report p] [--backlog-id BL-NNN]
node "$LEDGER" journal  [--story US-NNN] [--op Op-X] [--kind k] [--since YYYY-MM-DD] [--json] [--no-git]
node "$LEDGER" backlog  add --title "…" --severity info|warning|error --kind bug|simplification|refactor|test-gap|spec-gap|doc|perf|security [--file p]… [--report p] [--detail "…"]
node "$LEDGER" backlog  list [--status open|in-progress|done|wontfix] [--story US-NNN] [--severity s] [--json]
node "$LEDGER" backlog  resolve BL-NNN --sha <sha> --resolution "…"
node "$LEDGER" backlog  wontfix BL-NNN --reason "…"
node "$LEDGER" failures --runner vitest|cucumber|lines [--report-file p]      # stdin → sorted failing test ids
node "$LEDGER" regress  --base <sha> --cmd "<shell>" --runner vitest|cucumber|lines [--report-file p] [--json]   # exit 1 on regressions
```

`--specs <dir>` (or `LEDGER_SPECS`) overrides the `specs/` lookup, which otherwise walks up from the cwd to the directory holding `specs/stories.json`.

## `/dev-ledger [US-NNN] [--since date] [--kind k]`

1. Locate the ledger (snippet above). If not found, print the install command and stop.
2. Run `node "$LEDGER" journal` with the given filters and print the table verbatim.
3. Below it, print `node "$LEDGER" backlog list --status open` filtered to the same story (if any).

No files are written by this skill.
