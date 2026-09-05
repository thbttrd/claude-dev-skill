---
name: backlog
version: 1.0.4
description: 'Lists open backlog items (BL-NNN) filed by the pipeline''s verifiers and gates, or implements one by id with a minimal RED → GREEN → REFACTOR cycle and resolves it. Triggers on "/backlog", "/backlog BL-012", "implement BL-012", "what''s in the backlog", "close BL-012 as wontfix".'
---

# backlog

Items land here from `*-verification` audits, story-end gates and V&V — findings that were proposed but not applied at the time. Each is retrievable by id, so you can come back later and say `/backlog BL-012`.

Follows `../dev-ledger/references/autopilot-contract.md` (§3 journaling, §4 toolchain, §5 locating the ledger); under autopilot (§1–2) it never asks.

## `/backlog` — list

1. `node "$LEDGER" backlog list --status open` (add `--story US-NNN` if given). Print the table grouped by story, `error` first.
2. For each item print its id, title, severity/kind, source (`stage`/`gate`, story/op) and files. Nothing else.

## `/backlog BL-NNN` — implement one item

1. Read the item (`node "$LEDGER" backlog list --json`, pick the id) and its `source.report` if set. Set `status` to `in-progress` by editing `specs/backlog.json` in place (only that field), journal `--kind action --summary "BL-NNN started"`.
2. **Reproduce first when it is a bug** (`kind = bug`, `test-gap`): write the failing test at the file the item names (or the story's existing test file), run it with the Op filter from §4, confirm it fails at assertion time.
3. **Fix with the ponytail ladder**, stopping at the first rung that holds: delete instead of add → reuse a helper already in the repo → stdlib → native platform feature → an installed dependency → one line → minimum code. No new dependency. No abstraction with one caller.
4. Run the story's suite (`<TEST> -t "@US-NNN"`, `<BDD>` story filter) and `node "$LEDGER" regress --base HEAD …` per §4. Both clean.
5. Commit `fix(US-NNN): BL-NNN — <title>` (or `refactor`/`test`/`docs` by `kind`), journal `--kind commit`.
6. `node "$LEDGER" backlog resolve BL-NNN --sha $(git rev-parse --short HEAD) --resolution "<one line>"`.
7. If the item cannot be done without an architecture change, stop: set it back to `open`, journal a decision saying why, and (outside autopilot) tell the user to run `/research-and-architecture` for an ADR.

## `/backlog BL-NNN --wontfix "reason"`

`node "$LEDGER" backlog wontfix BL-NNN --reason "…"`. Nothing else.

## Self-review (mandatory, print as a checked list)

- [ ] For bugs: a test failed before the fix and passes after
- [ ] The story suite and `ledger regress` are clean
- [ ] Exactly one item changed status; the journal has the `action`, `commit` and resolution entries
