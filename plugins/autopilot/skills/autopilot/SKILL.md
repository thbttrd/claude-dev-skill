---
name: autopilot
version: 1.1.0
description: 'Unattended driver for the story pipeline. /autopilot US-NNN [--until US-MMM] runs spec → plan → per-Operation RED/GREEN → story-end gates → E2E for one story or a DAG-ordered chain, one fresh subagent per stage, never asking a question: warnings become backlog items, hard failures stop the run, every step is journaled. Bundles the invest-assessor, story-verifier, lazy-simplifier and story-reviewer agents. Triggers on "/autopilot", "run the pipeline unattended", "autopilot US-003", "resume autopilot".'
---

# autopilot

You are the conductor, not the pipeline. `scripts/autopilot.mjs` owns every decision — which stage runs next, which sentinel it must return, whether a miss is a retry or a stop. Your job is the loop in §5: ask the script, dispatch one fresh subagent, report the outcome, repeat. Do not reason about the pipeline; the script already did.

## 1. What it drives, what it refuses

`/autopilot US-NNN` takes one story from wherever it stands (`scoped`, `specced`, `planned`, `red`, `green`) to `verified`, dispatching one fresh subagent per stage. `--until US-MMM` chains stories in DAG order: when a story reaches `verified`, the script picks the lowest-numbered eligible story after it whose dependencies are all verified.

It **refuses** to run `/high-level-scoping` and `/research-and-architecture`, and pre-flight fails if their outputs are missing. Those two are the user's decisions — the backlog they validated and the stack they chose — and a run that invented them would be unattended in the one place it must not be. Every user decision autopilot needs happens **before** it (scoping, architecture) or **after** it (`/backlog BL-NNN` for everything the run filed). While the run is on, nothing is asked: warnings become backlog items, hard failures stop the run, every step is journaled.

## 2. Locate the scripts

```bash
AP="$(find -L "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/autopilot/scripts/autopilot.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
LEDGER="$(find -L "$HOME/.claude/skills" "$HOME/.claude/plugins" -path '*/dev-ledger/scripts/ledger.mjs' -not -path '*archive*' 2>/dev/null | head -1)"
```

Either one empty → print the install command (`Install autopilot: /plugin install autopilot@claude-dev-skill` / `Install dev-ledger: /plugin install dev-ledger@claude-dev-skill`), write **no file** — there is no run to stop and nothing to journal — and end with `<promise>AUTOPILOT_STOP_tooling_not_ready</promise>`. `dev-ledger` is not optional: `autopilot.mjs` journals through it and refuses to run without it (contract §5). Run everything from the project root — the one holding `specs/`.

## 3. Usage

```
/autopilot US-NNN [--until US-MMM] [--stop-policy hard-failures|hard-failures+story-end] [--skip-arch-check] [--force] [--stop]
```

| Flag                | Meaning                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `--until US-MMM`    | Keep going through eligible stories up to and including `US-MMM`. Default: the target story alone.  |
| `--stop-policy`     | `hard-failures+story-end` (default) pauses after every story reaches `verified`; `hard-failures` runs the whole chain and stops only on a hard failure. |
| `--skip-arch-check` | Skip the `/research-and-architecture` pre-flight check (migrated repos). Journaled as a decision.   |
| `--force`           | Take over an `autopilot.json` that is still `active` (a killed session).                            |
| `--stop`            | `node "$AP" stop --reason user_stop`, then print `node "$AP" report`, then end with `<promise>AUTOPILOT_STOP_user_stop</promise>`. Nothing else — no pre-flight, no loop. |

## 4. Pre-flight

```bash
node "$AP" start US-NNN [--until US-MMM] [--stop-policy …] [--skip-arch-check] [--force]
```

The script runs the whole check list itself (trackers present, story scoped, dependencies verified, architecture researched, clean tree, no other active run, ledger installed) — this skill does not restate it, so the two can never drift.

- `{"ok": false, "errors": [...]}` (exit 1) → print the errors **verbatim**, change nothing, end with `<promise>AUTOPILOT_STOP_preflight_failed</promise>`. There is nothing to stop and nothing to journal: the run never existed.
- Otherwise `start` prints the new `autopilot.json` (`active: true`, a fresh `run_id`) plus a `warnings` array (`--skip-arch-check`, `--force`, a STORY.md that is still a migrated TODO stub). Print every warning verbatim, then enter the loop.

## 5. The loop

This is the whole conductor. Execute it literally.

```
1. N = node "$AP" next                                  # once, at the start of the run
2. Handle N — it is one of three shapes, and R.next in step 6 is the same three:
     N.done → node "$AP" stop --reason <N.reason>
               node "$AP" report                        # prints the human report
               end with <promise>AUTOPILOT_PAUSED_<N.reason></promise>          # story_end | until_reached
     N.stop → node "$AP" stop --reason <N.reason> --summary "<N.detail>"
               node "$AP" report
               end with <promise>AUTOPILOT_STOP_<N.reason></promise>
     a stage → if N.story differs from the previous iteration's story (or this is the first),
               compute SLUG and BASE_SHA for N.story (§6) before dispatching anything for it.
3. node "$AP" stage-start --story <N.story> --stage <N.stage> [--op <N.op>] --agent <N.agent>
4. OUT = dispatch ONE subagent per the §6 table (Agent tool, subagent_type = N.agent), plus NOTE if set.
        Capture its FULL final message as OUT — sentinels are matched against that text and nothing else.
5. Classify OUT (matchSentinel semantics — AUTOPILOT_STOP wins, then the stage's sentinel):
     OUT contains AUTOPILOT_STOP_<reason>   → R = node "$AP" stage-end --outcome stop --reason <reason>
     OUT contains N.sentinel                → R = node "$AP" stage-end --outcome sentinel [--verdict "<verdict>"]
                                               (for the `invest` stage, N.sentinel is a regex, not a literal string: match the
                                               `INVEST_VERDICT:` line and take the text after the colon as the verdict)
     neither                                → R = node "$AP" stage-end --outcome no_sentinel --tail "<last 400 chars of OUT>"
6. R.action == "continue" → N = R.next ; NOTE = "" ; goto 2      # next is already in R — do not call `next` again
   R.action == "retry"    → if the Agent tool returned a task id for attempt 1 and that agent has not reported
                            completion, TaskStop it first — two agents on one working tree commit over each other
                            (dogfood P11b); then NOTE = "Previous attempt ended without its sentinel; its last output was: <last 400 chars of OUT>"
                            goto 3                               # same N, identical stage-start args: the script counts attempt 2
   R.action == "stop"     → node "$AP" report
                            end with <promise>AUTOPILOT_STOP_<R.reason></promise>   # already stopped by the script
```

Before passing the tail or the verdict text to `stage-end`, sanitise it: strip every character outside `[A-Za-z0-9 ._:/,()-]` and truncate to 400 characters — because that text is interpolated into a shell string, and the tail only ever becomes a journal summary anyway.

Two jump targets are load-bearing. `continue` re-enters at **step 2**, not step 3: `R.next` carries the same three shapes as `next`, and under `--stop-policy hard-failures` it can already be the first stage of the *following* story — dispatching it with the previous story's `SLUG` and `BASE_SHA` would write the audit report into the wrong directory. `retry` re-enters at **step 3** with the same `N` and byte-identical `stage-start` arguments: that is how the script knows this is attempt 2 of the same stage rather than a fresh one. Never call `next` for a retry.

The conductor journals nothing by hand. `start`, `stage-start`, `stage-end` and `stop` write every line a run needs, including the `retry N/2` action; a pause you impose yourself (a rate limit, a user interruption) is reported in the final message, not journaled — a second numbering scheme for the same event is worse than none.

`--verdict` is for the `invest` stage only: pass the text after `INVEST_VERDICT: ` exactly as the agent wrote it (`PASS`, `RE-TIER light`, `RE-TIER full`, `SPLIT`, `FAIL S: …`). The script turns it into the `stories.json` write, the re-tier, or the `split_required` / `spec_contradiction` stop. Every other stage omits `--verdict`.

Two invariants make this safe to run for hours:

- **The conductor never reads specs.** Only the JSON these commands print, plus the one `jq` slug lookup in §6. That is what keeps its context flat across a whole chain.
- **The conductor never calls `AskUserQuestion`.** It is the autopilot. A stage that needs an answer stops the run instead.

## 6. Dispatch table

Per-story values, computed once when `N.story` changes:

```bash
STORY=US-NNN
SLUG=$(jq -r --arg s "$STORY" '.stories[]|select(.id==$s).slug' specs/stories.json)
BASE_SHA=$(jq -r --arg s "$STORY" '.base_sha[$s] // empty' specs/autopilot.json)
if [ -z "$BASE_SHA" ]; then   # story first picked up by a run older than autopilot 1.1.0
  FIRST=$(git log --reverse --grep "^test($STORY)" --grep "^feat($STORY)" --grep "^chore($STORY)" --format=%h | head -1)
  BASE_SHA=$( [ -n "$FIRST" ] && git rev-parse "$FIRST^" 2>/dev/null || echo "HEAD~0" )
fi
```

`SLUG` builds the report paths (`specs/story-NNN-$SLUG/verification/…`). `BASE_SHA` is the commit the story's diff starts after: `start` records HEAD into `autopilot.json.base_sha[US-NNN]` the first time a run picks the story up and carries it across resumes, so the simplify and code-review gates diff exactly the run's work. The `git log` fallback is for stories first driven before that field existed; it accepts `chore(US-NNN)` because on a migrated repo the `state.json` rebuild commit is the true start of the story's work. When it still ends at `HEAD~0`, say so in the prompt so the agent files an info item instead of measuring an empty diff. These two lookups are the only tracker reads the conductor makes.

| `N.agent`         | `subagent_type`   | Prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `general-purpose` | `general-purpose` | "Use the `<N.skill>` skill for `<N.args>`. AUTOPILOT is active: read `specs/autopilot.json` and follow `references/autopilot-contract.md` §1–2 exactly (no questions, warnings → backlog, hard stops → `<promise>AUTOPILOT_STOP_<reason></promise>`). Read only the inputs the skill names. If the Skill tool is unavailable, read the SKILL.md at `$(find -L ~/.claude/skills ~/.claude/plugins -path '*/skills/<N.skill>/SKILL.md' \| head -1)` and follow it. End your reply with the skill's completion sentinel." |
| `invest-assessor` | `invest-assessor` | "Assess `<N.story>`. End with the `INVEST_VERDICT:` line."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `story-verifier`  | `story-verifier`  | "Run the `<N.skill>` audit for `<N.args>`. Write the report to `<report path>`. End with the audit sentinel."                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `lazy-simplifier` | `lazy-simplifier` | "Simplify `<N.story>`. BASE_SHA is `<BASE_SHA>`. End with `SIMPLIFY_COMPLETE_<N.story>`."                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `story-reviewer`  | `story-reviewer`  | "Review `<N.story>`. BASE_SHA is `<BASE_SHA>`. End with `REVIEW_COMPLETE_<N.story>`."                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Report paths for `story-verifier`, by `N.stage`:

| Stage                              | Report path                                              |
| ---------------------------------- | -------------------------------------------------------- |
| `spec-writing-verification`        | `specs/story-NNN-$SLUG/verification/spec-audit.md`        |
| `plan-writing-verification`        | `specs/story-NNN-$SLUG/verification/plan-audit.md`        |
| `spec-implementation-verification` | `specs/story-NNN-$SLUG/verification/green-audit-<N.op>.md` |

Nothing else goes in a prompt. Each agent's own definition carries its method; extra context in the prompt is background it is told to ignore, and it costs the fresh context the stage exists to buy.

## 7. Stop and pause report

`node "$AP" report` prints the run: stages run, Ops GREEN, gates with their verdicts, the `BL-` ids created, the commits. (`stop` prints the same report as JSON, with the text in `.text`; run `report` after it for the human form.) Print it verbatim — it is the handover.

Resume with **the same command**. `start` opens a new `run_id` and `next` picks up from the trackers, so a story that stopped at `code-review` resumes at `code-review`, not at `spec-writing`. Nothing has to be told where it was. `specs/autopilot.json` is local run state: `start` adds it to `.git/info/exclude` on first use, so it never shows in `git status` and is never committed.

## 8. Stop reasons

Contract §2 defines the first six; the rest are the conductor's own.

| Reason               | Ends with | Meaning                                                                       |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| `verifier_fail`      | `STOP`    | A verifier returned verdict `FAIL`.                                           |
| `op_blocked`         | `STOP`    | An Operation is still `blocked` after 2 retries.                              |
| `regression`         | `STOP`    | `ledger regress` found a regression in a story already `verified`.            |
| `spec_contradiction` | `STOP`    | The spec cannot be satisfied as written (also: an INVEST `FAIL`, a `PLAN.md` with no Operations, an impossible tracker state). |
| `tooling_not_ready`  | `STOP`    | The toolchain gate failed — a required script is missing or does not run. Also the conductor's own reason when `AP` or `LEDGER` cannot be located (§2), where nothing is written because no run exists. |
| `split_required`     | `STOP`    | The story needs splitting (INVEST `S`, or > 6 Operations). Splitting changes the backlog the user validated. |
| `stage_no_sentinel`  | `STOP`    | A stage returned neither its sentinel nor a stop sentinel, twice.             |
| `stage_no_progress`  | `STOP`    | A stage ended `ok` but `next` resolved to the same stage again — a loop.      |
| `preflight_failed`   | `STOP`    | `start` refused. No run was created, so no journal entry and no `autopilot.json`. |
| `story_end`          | `PAUSED`  | The story reached `verified` under `hard-failures+story-end`.                 |
| `until_reached`      | `PAUSED`  | `--until` is done, or no eligible story remains.                              |
| `user_stop`          | `STOP`    | `--stop`.                                                                     |

`PAUSED` reasons end the invocation with `<promise>AUTOPILOT_PAUSED_<reason></promise>` and are clean finishes — re-run the same command to continue. `STOP` reasons end with `<promise>AUTOPILOT_STOP_<reason></promise>` and want a human before the next run.

## 9. What this skill does NOT do

- It does not scope (`/high-level-scoping`) or architect (`/research-and-architecture`) — pre-flight refuses instead.
- It does not read or edit specs, plans, tests or code. The subagents do that; the conductor reads trackers.
- It does not implement backlog items. `/backlog BL-NNN` does, after the run.
- It does not merge, rebase, tag or push. Stage agents commit their own work; branches and remotes stay the user's.
- It does not decide anything the script can decide. Every branch above comes out of `next` or `stage-end`.

## 10. Self-review (mandatory)

Before the final sentinel, verify and print as a checked list:

- [ ] every `stage_start` has a matching `stage_end` or the `stop` line
- [ ] no `AskUserQuestion` was called
- [ ] the report lists every BL id created this run
- [ ] `autopilot.json` is inactive (`active: false`) when this invocation ends
- [ ] no stage agent from a retried attempt was left running
