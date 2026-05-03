# Mapping rules — source → target

This is the deterministic part of the migration. Given a classified source file, where does it go and how is it transformed?

The rules below are **closed** for known shapes (legacy `docs/V*/`, ad-hoc top-level docs) and **open** otherwise — when a file doesn't match a closed rule, the skill asks the user to confirm the mapping before proceeding.

---

## 1. Project-wide artifacts

| Source                                                 | Target                          | Transform                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/V*/architecture/ARCHITECTURE.md`                 | `specs/ARCHITECTURE.md`         | Pick latest `V*/`. Drop `V{N}` segments inside the doc body. Prepend `> Migrated from <path> on <date> by /migrate-specs.` Replace any `docs/V*/specs/SPECS.md` reference with `specs/PROJECT.md`. |
| Root-level `ARCHITECTURE.md` or `architecture.md` or `docs/architecture.md` | `specs/ARCHITECTURE.md`         | Same path rewrites. If the doc is short/skeletal, keep verbatim under `## Original (pre-migration)` and stub the MIM AA template above it.            |
| `docs/V*/architecture/architecture.png`                | `specs/architecture.png`        | Latest wins. Move (not copy).                                                                                                                          |
| `docs/V*/architecture/architecture-detailed.png`       | `specs/architecture-detailed.png` | Latest wins. Move.                                                                                                                                    |
| `docs/V*/specs/DESIGN.md` or root `DESIGN.md` or `docs/design.md` | `specs/DESIGN.md`               | Latest `V*/` wins. Path rewrites.                                                                                                                       |
| `docs/V*/specs/SPECS.md`                               | split → `specs/PROJECT.md` (project-level only) | Extract NFRs, glossary, tech-stack pointer, scope statements into `PROJECT.md`. Per-feature content is dropped here — it's recreated as per-story `STORY.md` later. |
| Root `requirements.md`, `docs/requirements.md`         | `specs/PROJECT.md`              | If `PROJECT.md` already exists, append under `## Original requirements (pre-migration)`. Otherwise create from a stub template + the original content. |
| `docs/V*/qa-report.md`                                 | per-story `verification/qa-report.md` if scoped to a story; else `specs/legacy/qa-report.md` | Heuristic: if the file references one story ID, route there; if it covers multiple, leave under `legacy/` and prompt the user to split. |
| `docs/project-tracking.json`                           | `specs/stories.json` + `specs/STORIES.md` + `specs/MIGRATION.md` | Run `scripts/migrate-tracking.mjs`.                                                                                                                    |
| Root `BACKLOG.md` / `STORIES.md` / `docs/backlog.md` (no `project-tracking.json`) | `specs/stories.json` skeleton + `specs/STORIES.md` | Parse rows of any markdown table or bullet list. One detected entry → one story in `phase: backlog` with empty AC/INVEST. The original file is preserved at `specs/legacy/<original-path>` so the user can cross-reference. |

---

## 2. Per-story artifacts

For each story in `stories.json`, find matching artifacts in the source tree and route them.

**Story id resolution.** A file is associated with a story when:

- Its filename contains the story ID (`US-NNN`, `F-NNN`, `UI-F-NNN`).
- Its path contains the story slug (e.g. `…/user-auth-golden-path/…`).
- Its content's first heading contains the story title.

When none of these match, the file is **not** routed to a story directory. It goes to `specs/legacy/` and is flagged in `MIGRATION.md`.

| Source                                                  | Target                                         | Transform                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `docs/V*/specs/features/F-NNN-*.feature`                | `specs/story-NNN-slug/features/F-NNN-*.feature` | Move. Latest `V*/` wins on conflict. Drop `V{N}` from any `Background:` step paths.                              |
| `docs/V*/specs/mockups/UI-F-NNN-*.html`                 | `specs/story-NNN-slug/mockups/UI-F-NNN-*.html` | Move. Latest `V*/` wins.                                                                                         |
| `docs/V*/specs/UI-F-NNN-*.md`                           | `specs/story-NNN-slug/ui/UI-F-NNN-*.md`        | Move. Path rewrites inside the doc body.                                                                         |
| `docs/V*/plans/W*-*.md` matching a story                | `specs/story-NNN-slug/PLAN.md`                 | Best-effort REASONS-canvas rewrite (see `plan-rewrite-rules.md`).                                                |
| `docs/V*/plans/00-foundation.md`                        | `specs/story-000-foundation/PLAN.md`           | Same.                                                                                                            |
| Per-story spec body (extracted from `SPECS.md` "Feature X" section) | `specs/story-NNN-slug/STORY.md`                | Best-effort: pull title, AC, rules into the `STORY.md` template. Mark INVEST flags as `❌ — not yet checked`. Mark phase as `scoped`. |

**Story directories not present yet.** Create them as part of the migration. Always include an empty `state.json` skeleton:

```json
{
  "story_id": "US-NNN",
  "phase": "<phase from stories.json>",
  "history": [
    { "phase": "<phase>", "at": "<today>", "note": "migrated from <source path>" }
  ]
}
```

---

## 3. Path rewrites inside migrated docs

Apply these regexes to every migrated Markdown file's body (case-insensitive on the leading segment):

| Pattern                                                       | Replacement                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/V\d+/specs/SPECS\.md(#[^)\s]*)?`                        | `specs/PROJECT.md$1` (or `specs/story-NNN-slug/STORY.md` if the link is clearly story-scoped — context-dependent, ask the user) |
| `docs/V\d+/specs/DESIGN\.md`                                  | `specs/DESIGN.md`                                                 |
| `docs/V\d+/specs/features/`                                   | `specs/story-NNN-slug/features/` — context-dependent, fall back to `specs/<story-dir>/features/` placeholder |
| `docs/V\d+/specs/mockups/`                                    | `specs/<story-dir>/mockups/`                                      |
| `docs/V\d+/architecture/ARCHITECTURE\.md`                     | `specs/ARCHITECTURE.md`                                            |
| `docs/V\d+/architecture/architecture(?:-detailed)?\.png`      | `specs/architecture$1.png` (preserve `-detailed`)                 |
| `docs/V\d+/plans/00-foundation\.md`                           | `specs/story-000-foundation/PLAN.md`                              |
| `docs/V\d+/plans/W\d+-(.+?)\.md`                              | `specs/story-NNN-slug/PLAN.md` — context-dependent, find the matching story |
| `docs/V\d+/qa-report\.md`                                     | `specs/<story-dir>/verification/qa-report.md` — context-dependent |
| `docs/project-tracking\.json`                                 | `specs/stories.json`                                               |

When a context-dependent rewrite cannot be resolved automatically, the migration leaves the original link unchanged AND adds an HTML comment `<!-- MIGRATED: link points to a legacy path; please update manually. -->` immediately after the link.

---

## 4. Files that should not be moved

Some files stay where they are, regardless of layout:

- Root-level `README.md`, `CHANGELOG.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- Anything under `.github/`, `.git/`, `.husky/`, `node_modules/`, `dist/`, `build/`, `.next/`, `out/`, `coverage/`.
- Source code (`src/`, `app/`, `lib/`, `e2e/`, `test/`, `tests/`, `__tests__/`).
- Tooling configs (`*.config.*`, `tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, etc.).

Prompt the user before moving anything matching these globs.

---

## 5. Conflict resolution

When the source has multiple candidates for the same target slot:

- **Same name, different paths** (e.g. `docs/V0/architecture/ARCHITECTURE.md` AND `docs/V2/architecture/ARCHITECTURE.md`): pick the latest `V*/` (highest N). Show the user the diff for confirmation.
- **Same path, different content** (e.g. an existing `specs/ARCHITECTURE.md` in a partial migration): merge by appending the legacy content under `## Original (pre-migration)`. Never silently overwrite.
- **Multiple stories claim the same artifact**: leave the artifact under `specs/legacy/` and ask the user.

---

## 6. Preservation of unmappable content

`specs/legacy/` is the catch-all. Any file the migration cannot confidently route lands there, with its original sub-path preserved (e.g. `docs/V1/research/notes.md` → `specs/legacy/V1/research/notes.md`). Every file in `legacy/` is enumerated in `MIGRATION.md` under "Files needing human review" so the user can decide whether to integrate, delete, or leave them.

`specs/legacy/` is **not** part of the canonical layout — downstream skills will not read it. It exists only as a holding pen for the migration.
