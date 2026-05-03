---
name: spec-writing
version: 2.0.0
description: Story-based spec-writing skill that produces, for one user story at a time, a `STORY.md` (INVEST-shaped User Story + Acceptance Criteria + Rules) plus one or more Cucumber-compatible `.feature` files with full Gherkin scenarios. Runs an INVEST gate (Phase 0) before any spec generation. Output lives at `specs/story-NNN-slug/`. Use this skill whenever the user wants to spec a specific story, define behaviour for a feature, capture acceptance criteria, or says things like "spec story US-001", "/spec-writing US-NNN", "let's spec out the auth story", "write the Gherkin for this feature". Also trigger when the user wants to update or refine an existing story's spec, add new rules, or audit acceptance-criteria coverage.
---

# Spec Writing Skill (story-based)

Produce, for **one story at a time**, the human-readable spec (`STORY.md`) and the executable Gherkin (`.feature` files). The unit of work is **always one story** — the skill takes a `US-NNN` argument (or asks for one) and operates exclusively in that story's directory.

The skill works in four phases: **Phase 0 — INVEST Gate** (interactive, non-skippable), **Phase 1 — Discovery** (understand and clarify), **Phase 2 — Generation** (produce STORY.md + feature files), **Phase 3 — Review** (validate completeness).

There are **no project-wide spec documents owned by this skill**. The project overview (NFRs, glossary, tech stack pointer) lives in `specs/PROJECT.md`, owned by `/high-level-scoping`. The architecture lives in `specs/ARCHITECTURE.md`, owned by `/research-and-architecture`. UI design + per-story screens are owned by `/ui-specs`.

---

## Pre-Flight

Run these checks before any work:

| Check                                       | Action                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/project-tracking.json` exists         | Hard-stop. Print: `Legacy layout detected. Run: node scripts/migrate-tracking.mjs --input docs/project-tracking.json --out specs/`. Do not write any files.                                  |
| `docs/V*/` directory exists                 | Hard-stop with the same migration command.                                                                                                                                                   |
| `specs/stories.json` does not exist         | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                                                              |
| Story argument provided (`/spec-writing US-NNN`) | Use it as the target story. Validate the id exists in `specs/stories.json`.                                                                                                              |
| No story argument                            | Use `AskUserQuestion` to list stories whose `phase ∈ { scoped }` and ask which one to spec. Stories already in `specced` or beyond enter **update mode**.                                |

The story id chosen here is the only story this invocation modifies.

---

## Phase 0 — INVEST Gate (mandatory, interactive)

Before any discovery or generation, run the INVEST checklist for the chosen story. The gate is interactive — every check is asked via `AskUserQuestion` so the user is the source of truth, not the model.

For each letter, present the current state, ask the user to confirm or correct, and record the result in both `STORY.md`'s INVEST table and `specs/stories.json`'s `stories[i].invest`.

| Letter | Question to the user                                                                                                                                       | Auto-check                                                                       | Failure handling                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **I**ndependent | "Does this story unavoidably depend on a story that is NOT yet `verified` and NOT in its `depends_on_story_ids`?"                                | Cross-check `depends_on_story_ids` vs. each AC.                                  | Surface the missing dependency and use `AskUserQuestion` to add it or merge stories.                              |
| **N**egotiable  | "Does the story prescribe a UI click sequence, a specific tech, or a specific implementation?"                                                   | Heuristic scan for technical jargon ("click", "POST /…", framework names).        | Suggest rephrasing toward outcomes; ask the user to confirm the new wording.                                      |
| **V**aluable    | "Is the 'So that …' clause a real user benefit, not a filler?"                                                                                   | Required field; not empty; not a tautology.                                       | Block until the user supplies a real benefit.                                                                     |
| **E**stimable   | "Are the AC concrete enough that you could roughly size the work?"                                                                                | ≥ 2 AC; no AC contains "etc." / "and so on" / "various"; each AC is observable.   | Ask for tighter AC.                                                                                               |
| **S**mall       | "Will this fit in a single agent loop (rough thumb: ≤ ~6 operations of work)?"                                                                   | Heuristic on AC count + complexity. The skill estimates and lets the user override. | Offer to split into N stories. If accepted, generate the new story stubs in `specs/stories.json` (advancing the next free `US-NNN` ids) and update the current story's `depends_on_story_ids` to point at the splits where appropriate. |
| **T**estable    | "Can each AC be turned into at least one Gherkin scenario? Want me to draft one for each?"                                                       | Walk AC list; draft a Gherkin skeleton for each.                                  | Block until each AC has a draftable scenario.                                                                     |

If a story fails any letter and the user does not want to fix it now, **stop the skill** with an explanatory note. Do NOT silently bypass INVEST.

When all six checks are `true`, write the result back to `specs/stories.json`:

```json
{
  "id": "US-NNN",
  "invest": { "i": true, "n": true, "v": true, "e": true, "s": true, "t": true, "checked_at": "<today>" }
}
```

---

## Phase 1 — Discovery

Eliminate ambiguity before writing a single line of spec. A vague spec produces vague software.

**If `specs/stories.json` already provides sufficient context** (story description, AC, dependencies, persona), you may shorten discovery — go straight to confirming scope with the user, then move to generation. Only probe areas where the JSON lacks detail.

### Always Use the AskUserQuestion Tool

(Same rules as the legacy skill — batched, concrete options, multiSelect for non-mutually-exclusive, short headers, recommended option first, descriptions explain trade-offs, previews for concrete artifacts.)

### Starting the Conversation

1. Confirm the story you're specifying (id + title) via a quick AskUserQuestion summary.
2. **Update mode** if `specs/story-NNN-slug/STORY.md` already exists: read it completely, summarise what's specified, ask what the user wants to change.
3. **Create mode** otherwise: probe missing details (workflows, error UX, edge cases, data model, business rules) using `references/discovery-checklist.md` as a guide.

### Probing for Clarity

After each batch of AskUserQuestion responses, identify what still needs clarification. Read `references/discovery-checklist.md` for the categories to probe — but adapt to what matters most for this story.

Categories to cover (when relevant):

- Core workflow this story implements
- Business rules and validation
- User roles and permissions (if not already pinned by a prior story)
- Error handling and edge cases
- UI/UX behaviour and states (if there's a UI screen)
- Data model and state changes
- Performance / accessibility / security expectations specific to this story

### When to Stop Discovering

Use `AskUserQuestion`:

- **Header: "Next step"** — "Anything else to clarify, or shall I write the STORY.md + features?"
  - Options: "Write the spec now (Recommended)", "I have more to add", "Let's explore another area", "Summarize what we have"

Loop until the user explicitly chooses to proceed.

---

## Phase 1.5 — UI Specs (delegated to `/ui-specs`)

If this story has a user-facing component (web page, dashboard view, modal, form), invoke `/ui-specs US-NNN` to produce the per-story mockups + screen specs. Skip if the story is API-only / backend-only / CLI.

`/ui-specs` will write:

- `specs/story-NNN-slug/mockups/UI-F-NNN-screen.html` (+ `*-mobile.html`) — fully styled HTML mockups with default/loading/empty/error states stacked
- `specs/story-NNN-slug/ui/UI-F-NNN-screen.md` — per-screen markdown spec referencing the mockup

The project-wide `specs/DESIGN.md` is owned by `/ui-specs` (project-wide mode) and is created the first time it's needed; subsequent stories reuse it.

When `/ui-specs` returns, capture the mockup + screen-spec paths to embed in `STORY.md`'s header. Stories without UI skip this phase entirely.

---

## Phase 2 — Generation

Read `references/story-md-template.md` for `STORY.md` and `references/feature-file-template.md` for `.feature` files. Produce:

1. **`specs/story-NNN-slug/STORY.md`** — the INVEST-shaped story, AC list, Rules summary, INVEST table, links to feature files / mockups / dependencies.
2. **`specs/story-NNN-slug/features/F-NNN-<slug>.feature`** — Gherkin scenarios for each Rule. Most stories own a single feature file; complex stories may split into 2-3 files when one would become unwieldy.

Create `specs/story-NNN-slug/features/` if it doesn't exist.

### Key principles

**Acceptance Criteria are observable.** Each AC is something the user, an API client, or an automated test can verify. Vague AC are rejected by the INVEST `E` check.

**Rules are business constraints.** Each Rule appears in `STORY.md` (as a one-liner with sad-path note) and in the `.feature` file (as a `Rule:` block with full happy-path + sad-path scenarios).

**Scenarios are concrete examples.** Given/When/Then, declarative not imperative:

```gherkin
# Good — declarative, behaviour-focused
Scenario: Expired subscription redirects to upgrade
  Given a user with an expired subscription
  When they navigate to premium content
  Then they should see the upgrade page

# Bad — imperative, UI-click-scripting
Scenario: Expired subscription redirects to upgrade
  Given the user is on the home page
  When they click the "Premium" link in the nav bar
  And the page loads
  And the system checks the subscription status in the database
  Then the system redirects to "/upgrade"
```

**Cover happy AND sad paths** for each Rule. At minimum: one happy-path scenario, one sad-path scenario, plus edge cases as warranted.

### Generating the outputs

1. Write `STORY.md` from the template, filling in INVEST table (with Phase 0 results), AC, Rules, and Feature file map.
2. Write each `.feature` file from `references/feature-file-template.md`. Tag every file at the feature level with `@US-NNN` and `@F-NNN` so test runners can filter by story.
3. Update `specs/stories.json` (read-merge-write):
   - Set `stories[i].artifacts.story_doc = "specs/story-NNN-slug/STORY.md"`
   - Set `stories[i].artifacts.feature_files = [...]`
   - Set `stories[i].spec = { rules: [...], specified_at: "<today>" }`
   - Append history entry: `{ phase: "specced", at: "<today>" }`
   - Set `stories[i].phase = "specced"`
   - Update `project.updated_at`
4. Regenerate `specs/STORIES.md` from the updated `stories.json` (use `references/stories-md-template.md` shape — most skills delegate this to a small inline routine).

### Updating an existing story

When `STORY.md` already exists for the chosen story:

- Read everything completely.
- Identify what the user wants to change.
- Update STORY.md and feature files in place.
- Re-run the INVEST gate if the change touches AC, dependencies, or scope.
- Bump `stories[i].spec.specified_at` and append a history note.

---

## Phase 3 — Post-Generation Review

After writing the spec, ask the user what to do next:

- **Header: "Next step"** — "The spec for US-NNN has been written. What would you like to do?"
  - Options:
    - "Launch spec review agent (Recommended)" — A separate Opus agent reviews STORY.md + .feature files for completeness, coherence, and quality.
    - "Accept as-is" — Spec is final.
    - "Add or rework parts" — User describes changes; loop back into Phase 2.
    - "Move to /plan-writing" — Run `/plan-writing US-NNN` next.

### If the user picks "Launch spec review agent"

Spawn a fresh Claude Opus agent (Agent tool with `model: "opus"`) to perform an end-to-end review of the story's spec. The agent's prompt instructs it to:

1. **Template compliance** — STORY.md follows `references/story-md-template.md`; feature files follow `references/feature-file-template.md`. Every required field is present.
2. **Completeness** — Every Rule has happy + sad-path scenarios; every AC has at least one scenario; edge cases covered.
3. **Coherence** — Rules in STORY.md match `Rule:` blocks in `.feature`; AC don't contradict; glossary terms used consistently with `specs/PROJECT.md`.

The agent returns PASS / MINOR / MAJOR with specific findings + proposed fixes (in actual Gherkin or markdown).

After the agent completes, present findings via `AskUserQuestion`: apply all, pick which, ignore, or re-run after edits.

### If the user picks "Move to /plan-writing"

Hand off to `/plan-writing US-NNN`.

---

## Writing Quality Checklist

Before declaring the story specced:

**STORY.md:**

- [ ] Header includes phase, foundation flag, dependencies, mockup links (if UI), specification date
- [ ] User Story has all three parts (As a / I want / So that), all concrete
- [ ] INVEST table is fully filled in with `✅` or `❌` + a note per letter; matches `stories[i].invest` in `stories.json`
- [ ] Acceptance Criteria has at least 2 entries, each observable
- [ ] Rules has at least one Rule, each with a sad-path note
- [ ] Feature file map lists every `.feature` file in `./features/`
- [ ] "Out of scope" is non-empty (or explicitly states "—" with rationale)

**Feature files (`./features/F-NNN-*.feature`):**

- [ ] One file per Feature ID, named `F-NNN-slug.feature`
- [ ] Valid Gherkin parseable by Cucumber
- [ ] Feature-level tags: `@US-NNN @F-NNN`
- [ ] Every Rule has happy-path AND sad-path scenarios
- [ ] Scenarios use declarative language
- [ ] Given/When/Then are concrete — no vague words ("appropriate", "properly", "correctly")
- [ ] No duplicate or contradicting scenarios across files

**`specs/stories.json` integration:**

- [ ] `stories[i].invest` matches the STORY.md table
- [ ] `stories[i].artifacts.story_doc` points at STORY.md
- [ ] `stories[i].artifacts.feature_files` lists every `.feature` file
- [ ] `stories[i].spec.specified_at` is set to today
- [ ] `stories[i].phase` is `specced`
- [ ] `stories[i].history` has a new `{ phase: "specced", at: "<today>" }` row
- [ ] `project.updated_at` was bumped

**`specs/STORIES.md`:**

- [ ] Regenerated from the updated `stories.json` so the kanban reflects the new phase
