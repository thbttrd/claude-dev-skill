# Pipeline contract: AUTOPILOT, journaling, toolchain

This file is identical in every pipeline plugin (`scripts/sync-contract.sh` keeps it so; CI checks it). Skills reference it instead of restating the rules. Sections 3–5 apply **always**; sections 1–2 apply only while autopilot is active.

## 1. Activation

Autopilot is active when `specs/autopilot.json` exists with `"active": true`, or the environment variable `AUTOPILOT=1` is set. Check this in Pre-Flight, once per invocation.

```json
{ "active": true, "run_id": "run-2026-08-30T15:00:00Z", "target": "US-000", "until": "US-000",
  "stop_policy": "hard-failures+story-end",
  "current": { "story": "US-000", "stage": "spec-implementation", "op": "Op-2", "agent": "agent-7f3a", "started_at": "…" },
  "started_at": "…", "stopped_at": null, "stop_reason": null }
```

## 2. Rules while active

1. **Never call `AskUserQuestion`.** Wherever this skill would ask, take the option marked *(Recommended)*; if none is marked, take the first option. Journal the choice: `ledger log --kind decision --summary "<question> → <option taken>"`.
2. **Warnings never stop the run.** A verifier verdict `PASS_WITH_WARNINGS` → file every warning with `ledger backlog add` (severity `warning`, the verifier's report as `--report`) and continue. Self-review checklist items that fail and are not fixed in place → `ledger backlog add` likewise.
3. **Hard stops.** Write `stop_reason` into `specs/autopilot.json`, journal `--kind stop`, print the reason, and end the invocation with `<promise>AUTOPILOT_STOP_<reason></promise>`:
   - `verifier_fail` — any verifier verdict `FAIL`;
   - `op_blocked` — an Operation still `blocked` after 2 retries;
   - `regression` — `ledger regress` reports a regression in a story already `verified`;
   - `spec_contradiction` — the spec cannot be satisfied as written (V&V "flag only" case; INVEST letter failing in `/spec-writing`);
   - `tooling_not_ready` — `/test-setup`'s toolchain gate fails;
   - `split_required` — a story needs splitting (INVEST `S`, or > 6 Operations).
4. **Sentinels stay.** Emit this skill's existing `<promise>…COMPLETE…</promise>` on success exactly as documented in the skill.
5. **Retries are explicit.** Log every retry (`--kind action --summary "retry N/2: <what>"`).

## 3. Journaling (always, autopilot or not)

`specs/journal.jsonl` is the audit trail. Append with the ledger CLI (§5); never edit the file.

| When | Call |
| --- | --- |
| A choice the plan/spec did not force (a skipped phase, an interpretation, an alternative taken) | `ledger log --kind decision --summary "…" [--ref path]` |
| A self-review checklist result | `ledger log --kind gate --gate self-review --verdict PASS\|PASS_WITH_WARNINGS\|FAIL --summary "N/M checks"` |
| A verifier / story-end gate / V&V verdict | `ledger log --kind gate --gate <invest\|spec-verification\|plan-verification\|red-audit\|green-audit\|simplify\|code-review\|verify\|v-and-v> --verdict … --report <path> --summary "…"` |
| A finding not fixed in place | `ledger backlog add --title "…" --severity info\|warning\|error --kind bug\|simplification\|refactor\|test-gap\|spec-gap\|doc\|perf\|security [--file p]… [--report path] [--detail "…"]` (journals the `finding` itself) |
| A commit made by this skill | `ledger log --kind commit --sha $(git rev-parse --short HEAD) --summary "<subject>"` |
| An Op or stage retried / blocked | `ledger log --kind action --summary "…"` |

`--story`, `--op`, `--stage` default from `specs/autopilot.json.current` when active; pass them explicitly otherwise. Keep `state.json.decisions[]` writes where the skill already makes them — they are the per-story view; the journal is the project view.

## 4. Toolchain resolution (always)

Skills write commands as placeholders. Resolve them once per invocation from the project's `package.json`:

| Placeholder | `package.json` script | Required by |
| --- | --- | --- |
| `<TEST>` | `test` | every skill that runs unit/integration tests |
| `<BDD>` | `bdd` | every skill that runs Gherkin |
| `<LINT>` | `lint` | story-end gates, V&V (skip with a journaled decision if absent) |
| `<TYPES>` | `typecheck` | same |
| `<DEV>` | `dev` | V&V |
| `<E2E>` | `e2e` | V&V (optional) |

Run through the package manager the lockfile implies: `bun.lock`/`bun.lockb` → `bun run <script>`, `pnpm-lock.yaml` → `pnpm <script>`, `yarn.lock` → `yarn <script>`, otherwise `npm run <script> --`. Extra args go after `--` for npm.

**Op filtering.** Never edit `specs/**/*.feature` to add tags.
- BDD: if the story's feature files already carry `@Op-X` tags → `<BDD> --tags "@US-NNN and @Op-X"`. Otherwise select by name from the Operation's `Covers scenarios:` line in PLAN.md: `<BDD> --name "^(<scenario 1>|<scenario 2>)$"` (regex-escape the names).
- Unit/integration: tests are named `@US-NNN @Op-X …` by `/test-setup`, so `<TEST> -t "@US-NNN.*@Op-X"` (Vitest/Jest `-t`); story-wide: `-t "@US-NNN"`.
- `manual` Test Plan rows are never run by `<TEST>`/`<BDD>`; only `/verification-and-validation` walks them.

**Regression baseline.** The unfiltered suite may be permanently red (RED scaffolds of unstarted stories). "No regression" therefore means: no test fails in the working tree that passed at the base commit. Compute it, never eyeball it:

```bash
node "$LEDGER" regress --base <sha> --runner vitest   --cmd "<TEST> --reporter=json --outputFile=/tmp/ledger-vitest.json" --report-file /tmp/ledger-vitest.json
node "$LEDGER" regress --base <sha> --runner cucumber --cmd "<BDD> --format json:/tmp/ledger-bdd.json"                    --report-file /tmp/ledger-bdd.json
```

`<sha>` is `HEAD` before committing an Op's GREEN (working tree vs last commit), or the story's `BASE_SHA` (parent of its first `test(US-NNN):` commit) at story-end. Exit code 1 = regressions; each id is printed.

## 5. Locating the ledger

```bash
LEDGER="$(find "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
node "$LEDGER" <command> …
```

If `LEDGER` is empty, the `dev-ledger` plugin is not installed: print `Install dev-ledger: /plugin install dev-ledger@claude-dev-skill` and, under autopilot, hard-stop with reason `tooling_not_ready`.
