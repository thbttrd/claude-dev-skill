---
name: high-level-scoping
version: 2.1.0
description: Agile project scoping skill that produces personas, epics, an INVEST-shaped story backlog, a high-level architecture diagram (via the d2-architect skill), and a story DAG anchored on a Foundation Story (US-000) — the walking skeleton. Outputs `specs/stories.json` (machine-readable tracker), `specs/STORIES.md` (human-readable kanban), `specs/PROJECT.md` (project overview), and `specs/ARCHITECTURE.md` (lightweight, later enriched by /research-and-architecture). Use this skill when the user wants to scope a new project, define epics and user stories, plan a backlog, do agile discovery, or says things like "let's scope this out", "plan this project", "what should we build first", "create a backlog", "/high-level-scoping". Also trigger when the user mentions Kanban, Scrum, sprints, epics, user stories, or a story DAG in the context of starting a new project.
---

# High-Level Scoping Skill

Produce a lean, agile-friendly project scope that is **just enough to start building** without over-specifying upfront. The philosophy: discover broadly, structure into INVEST-shaped stories, and order them as a DAG anchored on a Foundation Story (`US-000`) — the walking skeleton.

This skill creates the project's **`specs/stories.json`** — the single source of truth for the entire project lifecycle. The file always lives at `specs/stories.json`. Other skills (`/spec-writing`, `/research-and-architecture`, `/plan-writing`, …) read from and enrich this same file as each story progresses through its lifecycle. There are **no version directories** — a story's progress is tracked by its `phase` (`backlog → scoped → specced → planned → red → green → verified`).

**Documentation layout (important — all downstream skills follow this):**

```
specs/
├── stories.json                              # single, evolving project-wide source of truth
├── STORIES.md                                # human-readable kanban (regenerated)
├── PROJECT.md                                # project overview, NFRs, glossary, tech-stack pointer
├── ARCHITECTURE.md                           # project-wide architecture (lightweight at scoping time)
├── architecture.png                          # high-level diagram, generated via d2-architect
├── story-000-foundation/                     # Foundation Story directory (created here as a stub; populated later)
└── story-NNN-slug/                           # one directory per story
```

**No `docs/` folder.** No version segments. Stories are not duplicated when new ones are added — their content is frozen by `phase` advancement, not by directory copies.

The initial structure produced by this skill contains:

1. **Personas** — Who uses the product and what drives them
2. **Epics** — Big chunks of value, each with a description
3. **INVEST stories** — Concrete, dependency-aware backlog items, prioritised by business impact (MoSCoW). Each story declares `depends_on_story_ids`.
4. **Foundation Story (US-000)** — The walking skeleton, generated automatically as the root of the DAG.
5. **High-level architecture** — Big functional modules and their relationships (diagram via the `d2-architect` skill, embedded in a lightweight `ARCHITECTURE.md`)
6. **Story DAG** — `depends_on_story_ids` graph that orders the backlog without forcing it into version buckets

**No heavy specs. No detailed software architecture patterns. No Gherkin. Just enough structure to fill a backlog and start sprinting.**

---

## Pre-Flight: Detect Legacy Layout

Before any work, scan for the legacy version+wave layout. If detected, hard-stop with the migration command. The migration script is non-destructive.

| Check                                       | Action on detection                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/project-tracking.json` exists         | Hard-stop. Print: `Legacy layout detected. Run: node scripts/migrate-tracking.mjs --input docs/project-tracking.json --out specs/   then re-run /high-level-scoping.` |
| `docs/V0/`, `docs/V1/`, … directory exists  | Hard-stop. Print the same migration command and a note that file moves are listed in the generated `specs/MIGRATION.md`.                                    |
| `specs/stories.json` already exists         | You're in **update mode** (see "Updating an Existing Scoping" below).                                                                                          |
| Neither legacy nor `specs/stories.json`     | You're in **create mode**. Proceed.                                                                                                                          |

---

## Phase 1: Discovery

The purpose of discovery is to understand the problem space, the people, and the value before structuring anything.

### CRITICAL: Always Use the AskUserQuestion Tool

**You MUST use the `AskUserQuestion` tool for ALL questions during discovery.** Never ask questions as plain text. Every question must go through the interactive TUI.

Rules for using AskUserQuestion:

- **Batch related questions**: Group up to 4 related questions per call.
- **Always provide concrete options**: Even for open-ended topics, propose 2-4 concrete choices. The user can always pick "Other".
- **Use `multiSelect: true`** when choices are not mutually exclusive.
- **Use short `header` labels** (max 12 chars).
- **Put your recommended option first** and append "(Recommended)" to its label.
- **Use the `description` field** to explain trade-offs.
- **Use the `preview` field** for concrete artifacts (workflow sketches, persona cards, etc.).
- **Follow up** based on previous answers — adapt each batch.

### Starting the Conversation

1. Run the **Pre-Flight** check above. Hard-stop on legacy layout.
2. **If `specs/stories.json` exists**, you're in **update mode**. Read it, summarise what's already scoped, and use AskUserQuestion to ask what the user wants to add or change.
3. **If `specs/stories.json` does not exist**, you're in **create mode**. Ask the user to describe what they're building, then immediately follow up with structured AskUserQuestion calls.

### Batch 1 — Vision & Problem (3-4 questions)

1. **Header: "Problem"** — "What problem does this project solve?"
   - Options tailored to the domain, e.g., "Automate a manual process", "Replace an existing tool", "Create something new", "Improve an existing product"
2. **Header: "Success"** — "What does success look like in 3 months?"
   - Options: e.g., "Users actively using it daily", "Revenue generated", "Internal process automated", "Proof of concept validated"
3. **Header: "Users"** — "Who are the main people using this?"
   - Options tailored to context, e.g., "End consumers", "Internal team", "Business clients", "Mixed audience"
4. **Header: "Scale"** — "How big is this project?"
   - Options: "Small (1-3 features, solo dev)", "Medium (4-8 features, small team)", "Large (9+ features, multiple roles)", "Not sure yet"

### Batch 2 — Personas Deep-Dive (2-4 questions)

Based on the user answer about who uses the product, dig into each persona. Same pattern as the legacy skill: persona name, primary goal, pain points, second persona Y/N.

### Batch 3 — Core Workflows (2-4 questions)

Now understand what people actually DO. Same pattern: core flow, secondary workflows, MVP flow, dependencies between workflows.

### Batch 4+ — Feature-Specific & Business Rules

Continue with AskUserQuestion for each major area from `references/discovery-checklist.md`. Adapt to what matters based on previous answers.

**Don't over-discover.** Match depth to project complexity.

### Probing for Clarity

After each batch, analyse answers and determine what needs clarification. Vague answers get follow-up `AskUserQuestion` calls with more specific options.

### When to Stop Discovering

**CRITICAL: NEVER transition to structuring on your own.** Use AskUserQuestion:

- **Header: "Next step"** — "Ready to structure this into epics, stories, and a DAG, or is there more to explore?"
  - Options: "Structure it now (Recommended)", "I have more to add", "Explore more areas", "Summarize what we have"

Loop back into discovery if the user wants more exploration.

---

## Phase 2: Structuring — Personas, Epics & INVEST Stories

Transform discovery insights into structured, prioritised backlog items.

### Step 1: Confirm Personas

Present the personas you've identified using `AskUserQuestion` with `preview` fields showing persona cards. Same shape as the legacy skill.

### Step 2: Propose Epics

Group the discovered workflows and features into epics. Present them via `AskUserQuestion` with previews.

### Step 3: Break Down into INVEST Stories

For each epic, propose stories in "As a / I want / So that" format with **at least 2 acceptance criteria**, plus a lightweight INVEST sanity check:

- **I**ndependent — does this story unavoidably need another not yet scoped? If so, surface it.
- **N**egotiable — does the story prescribe a UI click or a tech choice? Rephrase toward outcomes.
- **V**aluable — is the "So that …" clause a real user benefit, or filler?
- **E**stimable — are AC concrete enough that "I could size this in story points"?
- **S**mall — does it fit in roughly ≤ 6 operations of work? If not, propose a split.
- **T**estable — can each AC be turned into at least one Gherkin scenario later?

The full INVEST gate runs in `/spec-writing` (Phase 0). Here, INVEST is a quick filter to keep the backlog clean. Initialise each story's `invest` flags to `false` (not yet checked) — `/spec-writing` will flip them.

Present stories per epic via `AskUserQuestion` with previews. Read `references/stories-json-schema.md` for the exact ID conventions and field shape.

### Step 4: Prioritise

Present the full prioritised backlog for final validation. Use MoSCoW (`must-have`, `should-have`, `could-have`, `wont-have`) and `business_impact` (`high`, `medium`, `low`).

---

## Phase 3: High-Level Architecture

Draw the big functional modules and how they relate. **This is NOT software architecture** — no hexagonal, no MIM AA, no layers. Think product modules: "Auth", "Dashboard", "Notifications", "Payments", etc. Detailed design is `/research-and-architecture`'s job.

### Step 1: Identify Modules

From the epics and stories, identify the big functional blocks. Confirm them via `AskUserQuestion`.

### Step 2: Generate the Architecture Diagram (via `d2-architect`)

Invoke the **`d2-architect`** skill to produce the diagram. Create `specs/` first if it doesn't exist; this is the project-wide architecture directory (no version segment).

Call `d2-architect` with:

- **Modules**: every confirmed module — each with `id` (`M-NNN`), `name`, optional `description`, optional `icon_key` from `d2-architect/references/icons.md`, and optional `shape` hint when no icon applies.
- **Dependencies**: every dependency between modules, each with `from`, `to`, and an optional `label` describing the relationship in user-facing terms ("reads from", "notifies", "authenticates via"). No protocol names.
- **output_dir**: `specs/`
- **basename**: `architecture`
- **title**: `"<Project Name> — High-Level Architecture"`
- **direction**: `right`
- **layout**: `elk`

**Design principles for the high-level view:**

- One level of nesting max (typically an `external` group for 3rd-party services)
- No databases, caches, or infrastructure internals — those belong in `/research-and-architecture`'s detailed diagram
- Arrow labels use user-facing verbs, not technology names
- Use `shape: person` for personas, `shape: cloud` + dashed stroke for external services

`d2-architect` returns:

- `specs/architecture.d2` — editable d2 source
- `specs/architecture.png` — the compiled diagram
- A markdown embed snippet to paste in Step 3

### Step 3: Write the Initial ARCHITECTURE.md

Write `specs/ARCHITECTURE.md` as a **lightweight overview** that `/research-and-architecture` will later enrich with MIM AA detail. Use this template:

```markdown
# Architecture

_High-level view generated by `/high-level-scoping` on <YYYY-MM-DD>. The `/research-and-architecture` skill expands this document with detailed MIM AA design as the project evolves._

## High-Level Architecture

![High-Level Architecture](architecture.png)

## Modules

| ID | Module | Responsibilities | Depends on |
|---|---|---|---|
| M-001 | <name> | <short description> | — or M-XYZ, … |

## External Services

| Name | Purpose |
|---|---|
| <service> | <why it's used> |

## Notes

- Diagram source: `architecture.d2` — regenerate the PNG via the `d2-architect` skill.
- This document is the starting point. `/research-and-architecture` will append tech stack, ADRs, detailed module map, data architecture, testing strategy, etc.
```

The embed snippet returned by `d2-architect` (`![High-Level Architecture](architecture.png)`) goes under the `## High-Level Architecture` heading. The relative path resolves because `ARCHITECTURE.md` sits in the same directory as the PNG.

### Step 4: Validate with User

Show the user the rendered PNG and ask via `AskUserQuestion` whether to lock it in or revise.

---

## Phase 4: Story DAG (replaces "Roadmap — Vertical Slices")

Order the backlog as a **directed acyclic graph** of stories anchored on the Foundation Story.

### Step 1: Generate the Foundation Story (US-000)

The Foundation Story is created automatically as the first story (`US-000`) of the highest-priority epic. It is the **walking skeleton** — the thinnest possible end-to-end path that proves the architecture works.

Defaults:

- `id`: `US-000`
- `slug`: `foundation`
- `is_foundation`: `true`
- `as_a`: `developer`
- `i_want`: `an end-to-end app skeleton wired through every layer`
- `so_that`: `the architecture is proven and ready for feature work`
- `priority`: `must-have`
- `business_impact`: `high`
- `acceptance_criteria` (defaults — confirm with user via AskUserQuestion):
  - The repo builds, type-check passes, lint passes.
  - One smoke endpoint (e.g., `GET /health`) returns 200 from a real server.
  - One smoke UI page (if the project has UI) renders successfully.
  - One Gherkin scenario walks through that path end-to-end.
- `depends_on_story_ids`: `[]`

Confirm the AC with `AskUserQuestion` before writing.

### Step 2: Set `depends_on_story_ids` for Every Other Story

For every non-foundation story, identify which other stories it depends on. Default: depends on `US-000` only (the foundation). For stories that build on top of others (e.g., a settings story depends on auth), add those.

Use `AskUserQuestion` per epic:

- **Header: "[Epic] deps"** — "For these stories, what do they depend on?"
  - Preview: list of stories in the epic
  - Options:
    - "Foundation only (Recommended)" — depends_on_story_ids = ["US-000"]
    - "Auth + foundation" — depends_on_story_ids = ["US-000", "US-001"]
    - "I'll specify per story"

### Step 3: Validate the Full DAG

Present the DAG via `AskUserQuestion` with a Mermaid `preview` of the dependency graph:

- **Header: "DAG ok?"** — "Here's the story DAG. Ready to generate?"
  - Preview: rendered Mermaid graph from `specs/STORIES.md`'s "Dependency view" section
  - Options: "Generate the tracker (Recommended)", "Adjust dependencies", "Go back to stories"

There is **no concept of versions, releases, or sprints** in this output. Velocity, sprints, and release planning are project-management concerns, not architectural ones — they live in whatever PM tool the team uses, not in `specs/stories.json`.

---

## Phase 5: Generate Output

### Step 1: Generate `specs/stories.json`

Read `references/stories-json-schema.md` for the exact schema and write the JSON file.

**File location:** `specs/stories.json`. Create the `specs/` directory if it does not exist. Do NOT write under `docs/`. If a legacy `docs/project-tracking.json` exists, the Pre-Flight check has already hard-stopped this skill — the user must run the migration script first.

**Rules:**

- Every ID must follow the conventions in `references/stories-json-schema.md`
- Every story must have at least 2 acceptance criteria
- Every epic must be linked to at least one persona
- Every epic must list its stories under `story_ids`
- The Foundation Story (`US-000`) must exist with `is_foundation: true` and `depends_on_story_ids: []`
- Every non-foundation story must have a non-empty `depends_on_story_ids`
- Every story starts in `phase: "scoped"` (not `backlog`) — INVEST has been informally checked at this point
- The `architecture.diagram_path` must point to `specs/architecture.png`
- Initialise each story's `invest` flags to `false` (the rigorous gate runs in `/spec-writing`)

### Step 2: Generate `specs/STORIES.md` (deterministic, via script)

Do **not** hand-write this file. Run the canonical regenerator that ships with the skill:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/regen_stories_md.py specs/stories.json
```

The script reads `specs/stories.json` and writes `specs/STORIES.md` (kanban tables grouped by `phase`, Mermaid DAG, epics table). Pure stdlib Python, no deps. `references/stories-md-template.md` documents what the script produces — it's reference material now, not a hand-rendering instruction.

**Every skill that mutates `phase` MUST re-run this script** so STORIES.md never drifts from stories.json. The same rule lives in `references/stories-json-schema.md` so downstream skills (`/spec-writing`, `/plan-writing`, etc.) inherit it.

### Step 2b: Wire the script into the project repo

Copy the script into the user's repo so they (and CI) can regenerate without invoking Claude:

```bash
mkdir -p scripts
cp ${CLAUDE_PLUGIN_ROOT}/scripts/regen_stories_md.py scripts/regen-stories-md.py
chmod +x scripts/regen-stories-md.py
```

The copy is the project's authoritative version; if the skill ships an updated regenerator, the next `/high-level-scoping` run re-copies it (no manual sync). Document the command in `PROJECT.md` so contributors can find it.

### Step 3: Generate `specs/PROJECT.md`

Write a lightweight project overview at `specs/PROJECT.md`:

```markdown
# Project — <Project Name>

<one-paragraph description from discovery>

## Personas

(table from `personas[]`)

## Tech Stack

The detailed tech stack is documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md). At scoping time we capture only the gross choices made during discovery (e.g., "TypeScript + Next.js", "Python + FastAPI"). `/research-and-architecture` enriches this later.

## Non-functional Requirements

(captured during discovery — performance, accessibility, security, scale)

## Glossary

(domain terms with definitions — populated by `/spec-writing` per story; this section starts as a stub)

## Changelog

- YYYY-MM-DD — Project scoped. Foundation Story (US-000) defined. <N> stories in backlog.
```

### Step 4: Post-Generation Gate

Use `AskUserQuestion`:

- **Header: "Done"** — "The scoping has been generated. What's next?"
  - Options:
    - "Launch review agent (Recommended)" — description: "A separate agent will review the scoping for completeness and coherence"
    - "Accept as-is" — description: "The scoping is final"
    - "Adjust something" — description: "I'll tell you what to change"
    - "Start with the Foundation Story" — description: "Run /spec-writing US-000 to begin"

### If the user picks "Launch review agent"

Spawn a separate Claude agent (using the Agent tool with `model: "opus"`) to review `specs/stories.json`. The agent must check:

1. **Structural integrity** — Valid JSON, all required fields present, IDs sequential and unique
2. **Completeness** — Every epic has stories, every story has acceptance criteria, all personas are referenced
3. **Foundation sanity** — `US-000` exists with `is_foundation: true` and no upstream dependencies
4. **DAG sanity** — No cycles in `depends_on_story_ids`; every dependency points at an existing story
5. **Coherence** — No contradictions between stories; story dependencies make sense
6. **Priority consistency** — Must-haves don't depend on could-haves; won't-haves are not in the DAG at all

The agent returns a verdict (PASS / MINOR / MAJOR) with findings. Present results and let the user decide what to fix.

### If the user picks "Start with the Foundation Story"

Hand off to `/spec-writing US-000`.

---

## Updating an Existing Scoping

When `specs/stories.json` already exists:

- Read it completely
- Summarise what's there
- Ask what the user wants to change (add story, reprioritise, add epic, adjust DAG, add persona)
- Make targeted changes — don't regenerate everything
- Increment `project.updated_at`
- Re-render `specs/STORIES.md` from the updated JSON
- If the architecture changed, re-invoke `d2-architect` to regenerate the diagram (`specs/architecture.d2` + `.png`), and update the module table in `specs/ARCHITECTURE.md` accordingly

---

## Quality Checklist

Before finalising, verify:

- [ ] Every persona has a unique ID (`P-NNN`) and at least one goal
- [ ] Every epic has a unique ID (`E-NNN`), a description, and is linked to personas
- [ ] Every epic lists its stories under `story_ids`
- [ ] Every story has a unique global ID (`US-NNN`), follows "As a / I want / So that", has priority + business_impact + at least 2 acceptance criteria
- [ ] The Foundation Story (`US-000`) exists with `is_foundation: true` and `depends_on_story_ids: []`
- [ ] Every non-foundation story has a non-empty `depends_on_story_ids`
- [ ] The DAG is acyclic
- [ ] Architecture modules have unique IDs (`M-NNN`) and clear responsibilities
- [ ] Architecture diagram has been generated via `d2-architect` (`specs/architecture.d2` and `.png` both exist)
- [ ] `specs/ARCHITECTURE.md` exists, embeds the PNG, and lists all modules
- [ ] `specs/PROJECT.md` exists with the project overview
- [ ] `specs/STORIES.md` is rendered from `specs/stories.json` and shows the kanban + dependency view
- [ ] No `docs/V*/` directories exist anywhere
- [ ] All `wont-have` stories are NOT in `depends_on_story_ids` of any other story
- [ ] The JSON is valid and follows the schema in `references/stories-json-schema.md`
