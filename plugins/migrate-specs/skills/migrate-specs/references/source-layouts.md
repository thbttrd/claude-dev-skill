# Source layouts catalog

A non-exhaustive catalog of shapes `/migrate-specs` recognises. The skill is **open-ended** — it must handle layouts not listed here by classifying files semantically (filename + content sniffing). This catalog exists to make the common cases fast and obvious.

For each source shape, the rule is: identify it, confirm with the user if there's any ambiguity, then map it according to `mapping-rules.md`.

---

## A. Legacy `docs/V*/` layout (the pre-2.0 version of this marketplace)

```
docs/
├── project-tracking.json
├── V0/
│   ├── specs/
│   │   ├── SPECS.md
│   │   ├── DESIGN.md
│   │   ├── features/F-*.feature
│   │   ├── mockups/UI-F-*.html
│   │   └── UI-F-*.md
│   ├── architecture/
│   │   ├── ARCHITECTURE.md
│   │   ├── architecture.png
│   │   └── architecture-detailed.png
│   ├── plans/
│   │   ├── 00-foundation.md
│   │   ├── DAG.md
│   │   ├── W1-*.md
│   │   ├── W2-*.md
│   │   └── implementation-state.json
│   └── qa-report.md
├── V1/   (full duplicate of V0, then mutated)
└── V2/   …
```

**Recognition signals (any of):** `docs/project-tracking.json` exists; `docs/V0/` or `docs/V1/` directory exists; a `docs/V*/plans/W*-*.md` file matches.

**Migration approach (high-confidence path):**

1. Run `scripts/migrate-tracking.mjs` to convert `docs/project-tracking.json` → `specs/stories.json` + `specs/STORIES.md`. This gives us the story IDs, slugs, and phase classifications.
2. Pick the **latest** `V*/` directory as the source of truth for project-wide artifacts. (Ask the user if the latest is not obvious.)
3. Move project-wide artifacts:
   - `docs/V<latest>/architecture/ARCHITECTURE.md` → `specs/ARCHITECTURE.md`
   - `docs/V<latest>/architecture/architecture.png` → `specs/architecture.png`
   - `docs/V<latest>/architecture/architecture-detailed.png` → `specs/architecture-detailed.png`
   - `docs/V<latest>/specs/DESIGN.md` → `specs/DESIGN.md`
   - Project-wide content from `docs/V<latest>/specs/SPECS.md` (NFRs, glossary, tech-stack pointer) → `specs/PROJECT.md`. Per-story content from `SPECS.md` is dropped — the per-story `STORY.md` is the new canonical location.
4. For each story in `stories.json`, walk every `V*/` directory and pick up its artifacts (the latest `V*/` wins for any conflict):
   - `docs/V*/specs/features/F-NNN-*.feature` → `specs/story-NNN-slug/features/`
   - `docs/V*/specs/mockups/UI-F-NNN-*.html` → `specs/story-NNN-slug/mockups/`
   - `docs/V*/specs/UI-F-NNN-*.md` → `specs/story-NNN-slug/ui/`
5. For each story, find the matching legacy plan file (`docs/V*/plans/W*-*.md` containing the story's ID, or `docs/V<latest>/plans/00-foundation.md` for `US-000`) and rewrite it into `specs/story-NNN-slug/PLAN.md` per `plan-rewrite-rules.md`.
6. Move `docs/V<latest>/qa-report.md` to per-story QA reports if its content references the story IDs; otherwise preserve as `specs/legacy/qa-report.md`.
7. After the user confirms the migration is complete and verified, suggest `rm -rf docs/`.

---

## B. Ad-hoc top-level docs

```
docs/
├── architecture.md      OR  ARCHITECTURE.md       at repo root
├── design.md            OR  DESIGN.md
├── requirements.md
├── stories.md           OR  BACKLOG.md            at repo root
├── features/*.feature                              (sometimes)
└── …
```

Or any subset thereof.

**Recognition signals:** files matching the names above, none of the V*/ markers, no `project-tracking.json`.

**Migration approach (medium-confidence — confirm everything):**

1. Read each candidate file. Classify by content:
   - Architecture → moves to `specs/ARCHITECTURE.md`. If the existing file follows MIM AA structure, keep verbatim. If not, preserve content under a `## Original (pre-migration)` section and stub out the canonical sections above it with `<!-- TODO -->` markers so `/research-and-architecture` can fill them in.
   - Design system / style guide → `specs/DESIGN.md`. Same pattern.
   - Requirements / functional spec → split. Project-level concerns (NFRs, glossary, scope) go to `specs/PROJECT.md`. Per-story / per-feature concerns become candidate stories to add to `specs/stories.json` (in `phase: backlog`).
   - Backlog / stories list → parse rows into `stories.json` skeleton. One entry per row, `phase: backlog`, empty `acceptance_criteria`, `is_foundation: false`. Ask the user which one (if any) is the Foundation Story.
2. Move any `*.feature` files into per-story `features/` directories if a story ID can be inferred from the filename (e.g. `F-001-*.feature` → `specs/story-001-*/features/`); otherwise stash under `specs/legacy/features/` and prompt the user to assign them.
3. Emit a `specs/MIGRATION.md` with a "Next steps" section: run `/high-level-scoping` (update mode) to flesh out the personas/epics/AC, then `/spec-writing US-NNN` per backlog entry to produce real STORY.md files.

---

## C. Partial / non-canonical `specs/` directory

```
specs/
├── v1/spec.md
├── stories/US-001.md         (not in story-NNN-slug shape)
├── architecture.md
└── …
```

**Recognition signals:** `specs/` exists but doesn't match the canonical layout — e.g. has `specs/v*/`, files at the top level that aren't the canonical project-wide set, story directories not following `story-NNN-slug/` naming.

**Migration approach:** treat `specs/` as if it were `docs/` — the same rules apply. Move things into the canonical shape. **Do not destructively overwrite** — when in doubt, archive the original to `specs/legacy/` and recreate from a stub.

---

## D. README-only project

```
README.md   (contains a "Features" or "Roadmap" section listing what's planned)
```

**Recognition signals:** no `docs/`, no `specs/`, but `README.md` has a section header matching `(?i)^##?\s+(features|roadmap|backlog|todo|stories)`.

**Migration approach (low-confidence — always confirm):**

1. Show the candidate section to the user. Ask: "Should each line become a backlog story?"
2. If yes, generate a `specs/stories.json` skeleton with each line as a story in `phase: backlog`, empty AC, no INVEST flags, no Foundation Story marker.
3. Suggest running `/high-level-scoping` next to add personas, epics, and the Foundation Story.

---

## E. Empty / no specs at all

**Recognition signals:** no `docs/`, no `specs/`, no spec-shaped Markdown anywhere.

**Migration approach:** hard-stop with: `No specs to migrate. Run /high-level-scoping to scope the project from scratch.`

---

## Open-ended fallback

If the repo doesn't fit A–E, the skill:

1. Runs `audit.mjs` to enumerate every Markdown file under `docs/`, `specs/`, `specifications/`, `documentation/`, `design/`, plus root-level `*.md` (excluding `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`).
2. For each file, classifies semantically by reading its head (~80 lines) and matching against signal patterns:
   - **Architecture** — mentions "module", "service", "ADR", "tech stack", "dependency graph", contains a system diagram (mermaid `graph`/`flowchart` or ASCII), references multiple modules.
   - **Spec / requirement** — contains "as a ... I want ... so that", or "Given/When/Then" blocks, or AC-style bulleted lists with checkboxes.
   - **Plan** — contains "RED-A", "GREEN", "REFACTOR", "wave", numbered task lists, REASONS section headers.
   - **Design system** — contains color palette, typography, spacing, component listings.
   - **Mockup** — `.html` file under `mockups/`, `wireframes/`, `design/`, etc.
   - **Tracking** — JSON file with `stories[]`, `epics[]`, `personas[]`, `roadmap[]` keys. Or Markdown with kanban columns / status emojis (✅ 🟢 🔴).
3. Asks the user to confirm or correct each classification before any move.

The skill prefers **preservation over rewriting** — when content can't be confidently mapped to a target slot, it lands under `specs/legacy/` with a clear pointer in `MIGRATION.md` so the human can finish the job.
