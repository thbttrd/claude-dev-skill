# autopilot

The unattended driver of the story pipeline. `/autopilot US-NNN` takes one story from wherever it stands to `verified` — spec, plan, per-Operation RED/GREEN, the story-end gates, then the mandatory E2E gate — dispatching one fresh subagent per stage and journaling every step. `--until US-MMM` chains stories in DAG order, picking the next story whose dependencies are all verified.

The design is a conductor and a script. `skills/autopilot/scripts/autopilot.mjs` owns every decision — which stage runs next (resolved from `specs/stories.json` and each story's `state.json`, so a killed session restarts at the right stage), which sentinel that stage must return, whether a missing sentinel is a retry or a stop. The skill is the loop around it: ask, dispatch, report the outcome, repeat. Nothing is ever asked of the user mid-run: a verifier warning becomes a `BL-` backlog item and the run continues; a hard failure stops the run with a reason and a report. The user's decisions happen before the run (scoping, architecture) and after it (`/backlog BL-NNN`).

## Install

```
/plugin marketplace add github:thbttrd/claude-dev-skill
/plugin install autopilot@claude-dev-skill
/plugin install dev-ledger@claude-dev-skill
```

`dev-ledger` is required, not optional: `autopilot.mjs` journals and files backlog items through its `ledger.mjs`, and pre-flight fails when it is not installed.

## Usage

```
/autopilot US-NNN [--until US-MMM] [--stop-policy hard-failures|hard-failures+story-end] [--skip-arch-check] [--force] [--stop]
```

| Flag                | Meaning                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--until US-MMM`    | Keep going through eligible stories up to and including `US-MMM`. Default: the target story alone.                                                     |
| `--stop-policy`     | `hard-failures+story-end` (default) pauses after every story reaches `verified`; `hard-failures` runs the whole chain and stops only on a hard failure. |
| `--skip-arch-check` | Skip the `/research-and-architecture` pre-flight check, for repos onboarded via `/migrate-specs`. Journaled as a decision.                              |
| `--force`           | Take over an `autopilot.json` left `active` by a killed session.                                                                                        |
| `--stop`            | Stop the current run, print the report, exit.                                                                                                          |

Resume by re-running the same command: a new `run_id` opens and the stage machine picks up from the trackers.

**Run state.** `specs/autopilot.json` is per-machine run state: `start` adds it to `.git/info/exclude`, so it never appears in `git status` and is never committed. It also records `base_sha` — HEAD when a run first picked up each story — which the simplify and code-review gates diff against; a resume carries it forward.

## Stage machine

Resolved from `stories.json.phase` + `state.json` on every step — never from a cursor, so an interrupted run resumes exactly where it stopped.

```
invest                                    invest-assessor agent; skipped once stories.json records all six INVEST letters
spec-writing
spec-writing-verification                 story-verifier agent → verification/spec-audit.md
plan-writing
plan-writing-verification                 story-verifier agent → verification/plan-audit.md
repo-initialization                       US-000 only, on a repo with no package.json
for each Op:
  test-setup Op-X
  spec-implementation Op-X                GREEN + REFACTOR
  spec-implementation-verification Op-X   full-rigor stories only, skipped for confirm-only Ops → verification/green-audit-Op-X.md
simplify                                  lazy-simplifier agent
code-review                               story-reviewer agent
spec-implementation                       story-end: flips the story to green
verification-and-validation               the mandatory E2E gate → verified
→ pause (story_end) or the next eligible story (--until)
```

Every stage runs in a fresh subagent that returns a sentinel (`SPEC_COMPLETE_US-NNN`, `RED_COMPLETE_US-NNN_Op-X`, …). A stage that returns neither its sentinel nor `AUTOPILOT_STOP_<reason>` is retried once with its tail output attached; a second miss is `stage_no_sentinel`.

## Bundled agents

| Agent             | Role                                                                                                                                          | Tools                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `invest-assessor` | Scores the six INVEST letters for a story and returns one `INVEST_VERDICT:` line — `PASS`, `RE-TIER light\|full`, `SPLIT`, or `FAIL <letter>`. | Read, Grep, Glob (read-only)      |
| `story-verifier`  | Runs one of the three `*-verification` audits inline, writes the compliance report, files every warning as a backlog item, hard-stops on `FAIL`. | Read, Grep, Glob, Bash, Write, Edit |
| `lazy-simplifier` | Story-end Gate 1: the ponytail ladder over the story's diff, proves the suite and `ledger regress` still clean, commits `refactor(US-NNN)`.    | Read, Grep, Glob, Bash, Edit, Write |
| `story-reviewer`  | Story-end Gate 2: the story diff against PLAN.md Structure / Norms / Safeguards and ARCHITECTURE.md boundaries; fixes criticals, files warnings. | Read, Grep, Glob, Bash, Edit, Write |

## Stop policy and stop reasons

`hard-failures+story-end` (default) pauses at each story's end so the user can look before the chain continues; `hard-failures` only stops when something is wrong. Warnings never stop a run under either policy — they become backlog items.

| Reason               | Ends with                                | Meaning                                                                                    |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `verifier_fail`      | `AUTOPILOT_STOP_verifier_fail`           | A verifier returned verdict `FAIL`.                                                        |
| `op_blocked`         | `AUTOPILOT_STOP_op_blocked`              | An Operation is still `blocked` after 2 retries.                                           |
| `regression`         | `AUTOPILOT_STOP_regression`              | `ledger regress` found a regression in a story already `verified`.                         |
| `spec_contradiction` | `AUTOPILOT_STOP_spec_contradiction`      | The spec cannot be satisfied as written, or a tracker state is impossible.                 |
| `tooling_not_ready`  | `AUTOPILOT_STOP_tooling_not_ready`       | The toolchain gate failed.                                                                 |
| `split_required`     | `AUTOPILOT_STOP_split_required`          | The story needs splitting — that changes the backlog the user validated.                   |
| `stage_no_sentinel`  | `AUTOPILOT_STOP_stage_no_sentinel`       | A stage returned no sentinel twice.                                                        |
| `stage_no_progress`  | `AUTOPILOT_STOP_stage_no_progress`       | A stage ended `ok` but the machine resolved to the same stage again.                       |
| `preflight_failed`   | `AUTOPILOT_STOP_preflight_failed`        | `start` refused; no run was created.                                                       |
| `story_end`          | `AUTOPILOT_PAUSED_story_end`             | The story reached `verified` under `hard-failures+story-end`.                              |
| `until_reached`      | `AUTOPILOT_PAUSED_until_reached`         | `--until` is done, or no eligible story remains.                                           |
| `user_stop`          | `AUTOPILOT_STOP_user_stop`               | `--stop`.                                                                                  |

`AUTOPILOT_PAUSED_*` is a clean finish — re-run the same command to continue. `AUTOPILOT_STOP_*` wants a human first. Either way the run ends with a report: stages run, Ops GREEN, gates and verdicts, backlog ids, commits.

## Tests

```
node --test skills/autopilot/scripts/autopilot.test.mjs
```

**License:** MIT · **Part of:** [`claude-dev-skill`](../../README.md)

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
