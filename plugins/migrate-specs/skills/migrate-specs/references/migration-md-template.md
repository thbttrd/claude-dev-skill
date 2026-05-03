# `specs/MIGRATION.md` — log template

Every run of `/migrate-specs` produces or updates `specs/MIGRATION.md`. It's the durable record of what changed and what still needs a human.

---

## Template

```markdown
# Migration log

> Generated on YYYY-MM-DD by `/migrate-specs`.
> Source: <repo root path or relative cue, e.g. "legacy `docs/V*/` layout + `docs/project-tracking.json`">
> Target: canonical `specs/` layout (see `plugins/migrate-specs/skills/migrate-specs/references/target-layout.md`).

## What was migrated

- **Tracking:** `docs/project-tracking.json` → `specs/stories.json` (N stories, N personas, N epics).
- **Project-wide docs:**
  - `docs/V<latest>/architecture/ARCHITECTURE.md` → `specs/ARCHITECTURE.md`
  - `docs/V<latest>/architecture/architecture.png` → `specs/architecture.png`
  - `docs/V<latest>/specs/DESIGN.md` → `specs/DESIGN.md`
  - …
- **Per-story artifacts:** N feature files, N mockups, N screen specs, N plans rewritten.

## Story-by-story summary

| Story  | Phase set | Sources                                                        | Notes                                              |
| ------ | --------- | -------------------------------------------------------------- | -------------------------------------------------- |
| US-000 | green     | `docs/V0/plans/00-foundation.md` (rewritten)                   | PLAN.md migrated; REASONS sections stubbed (E, N).  |
| US-001 | specced   | `docs/V0/specs/features/F-001-*.feature` (moved)               | No legacy plan found — run `/plan-writing US-001`. |
| US-002 | backlog   | `docs/V0/specs/SPECS.md` (extracted)                           | STORY.md is a stub; AC and rules need filling in.  |

## Files preserved under `specs/legacy/`

The migration could not confidently route these files. Review each one and decide whether to integrate, delete, or leave it.

- `specs/legacy/V1/research/notes.md` — original: `docs/V1/research/notes.md`
- `specs/legacy/V0/qa-report.md` — original: `docs/V0/qa-report.md` (covers multiple stories; needs splitting)
- …

## Files NOT moved

These files matched a "do not move" rule (root-level conventional files, source code, tooling). They were left untouched.

- `README.md`, `CHANGELOG.md`, `LICENSE`, etc.
- `src/`, `tests/`, `e2e/` (source trees).
- `package.json`, `tsconfig.json`, etc.

## Path rewrites applied

Inside migrated Markdown files, the following rewrites were made:

- `docs/V<N>/architecture/ARCHITECTURE.md` → `specs/ARCHITECTURE.md` (X occurrences)
- `docs/V<N>/specs/DESIGN.md` → `specs/DESIGN.md` (X occurrences)
- `docs/V<N>/specs/SPECS.md` → `specs/PROJECT.md` (X occurrences)
- …

Links flagged as ambiguous (left as-is, with a `<!-- MIGRATED: ... -->` comment for the user):

- `specs/story-001-user-auth-golden-path/PLAN.md`: link to `docs/V0/specs/features/F-001-something.feature` could not be auto-resolved.

## What still needs manual attention

1. **Foundation Story.** The migration picked `US-000` because it was first in V0. If a different story is the true walking skeleton, edit `specs/stories.json` and rename the directory.
2. **`depends_on_story_ids`.** Empty for every migrated story. Walk the backlog and fill in the upstream stories each one needs.
3. **INVEST flags.** All set to `false` for migrated stories — `/spec-writing` will run the gate when each story is specced.
4. **Stubbed REASONS sections.** Every migrated PLAN.md has stubs for sections the legacy plan didn't carry. Run `/plan-writing-verification US-NNN` per story to surface the gaps, then `/plan-writing US-NNN` to fill them, OR hand-edit.
5. **Stubbed STORY.md fields.** Stories derived from a backlog table or a `SPECS.md` section have empty AC and rules. Run `/spec-writing US-NNN` per story to write proper STORY.md content.
6. **Files in `specs/legacy/`.** See the list above. Decide per file.
7. **Delete the legacy tree.** Once the moves are verified, run `rm -rf docs/` (or whatever your source tree was). The migration does NOT delete the source — that is your call.

## Suggested next steps

```
# Confirm everything migrated cleanly:
/research-and-architecture-verification        # if ARCHITECTURE.md was migrated
/spec-writing-verification US-NNN              # per story whose phase >= specced
/plan-writing-verification US-NNN              # per story whose phase >= planned

# Fill the gaps the migration couldn't:
/spec-writing US-NNN                           # for stories with stub STORY.md
/plan-writing US-NNN                           # for stories with stubbed REASONS sections
```
```

---

## Rules for the writer (`/migrate-specs`)

- The log is **append-only** during a run. If `specs/MIGRATION.md` already exists from a prior run, prepend a new section dated today rather than overwriting.
- **Never lie about phases.** A story whose `STORY.md` is a stub has `phase: scoped` at most, regardless of how the legacy file was tagged.
- **List every preserved file** in the "Files preserved under `specs/legacy/`" section. Don't summarise as "and N more" — the human needs the full list.
- **Be explicit about ambiguity.** When the migration left a `<!-- MIGRATED: ... -->` comment in a doc, list each occurrence in the log.
- **Suggest verifications.** The "Suggested next steps" section MUST list the right `*-verification` skill commands so the user can confirm migration quality.
