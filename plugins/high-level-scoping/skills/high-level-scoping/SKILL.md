---
name: high-level-scoping
version: 1.0.0
description: Agile project scoping skill that produces personas, epics, prioritized user stories, a high-level architecture diagram (via the d2-architect skill), and a versioned roadmap starting from a V0 walking skeleton. Outputs a structured JSON file for project tracking and a lightweight ARCHITECTURE.md with the diagram embedded (later enriched by /research-and-architecture). Use this skill when the user wants to scope a new project, define epics and user stories, plan a product roadmap, do agile discovery, create a product backlog, or says things like "let's scope this out", "plan this project", "what should we build first", "create a backlog", "/high-level-scoping". Also trigger when the user mentions Kanban, Scrum, sprints, epics, user stories in the context of starting a new project.
---

# High-Level Scoping Skill

Produce a lean, agile-friendly project scope that is **just enough to start building** without over-specifying upfront. The philosophy: discover broadly, structure into actionable chunks, plan vertical slices that deliver value early.

This skill creates the initial **`docs/project-tracking.json`** — the single source of truth for the entire project lifecycle. The file always lives at `docs/project-tracking.json` (**not** at the repository root). Other skills (`/spec-writing`, `/research-and-architecture`, etc.) read from and enrich this same file as the project progresses through sprints. Each skill adds its own fields when the time comes.

**Documentation layout (important — all downstream skills follow this):**

```
docs/
├── project-tracking.json                  # single, evolving project-wide source of truth
├── V0/                                    # everything specific to version V0
│   ├── specs/                             # SPECS.md, UI-SPECS.md, UI-F-*.md, features/, wireframes/
│   ├── architecture/                      # ARCHITECTURE.md, architecture.png, architecture-detailed.png
│   ├── plans/                             # 00-foundation.md, DAG.md, W*-*.md, implementation-state.json
│   └── qa-report.md                       # V0's verification report
├── V1/                                    # V1 begins as a full copy of V0, then is modified
│   └── ... (same structure)
└── V2/ ...
```

**Version snapshot rule (applies to V1 and beyond):** before the first skill starts working on a new version V{N} where N ≥ 1, `docs/V{N}/` is created by duplicating `docs/V{N-1}/` wholesale. This preserves the prior version's docs frozen-in-time as a historical record and lets the new version evolve independently. V0 is the only version created from scratch (by this skill for the diagram, then by the downstream skills for the rest).

The initial structure contains:

1. **Personas** — Who uses the product and what drives them
2. **Epics** — Big chunks of value, each with a description
3. **User Stories** — Concrete stories attached to epics, prioritized by business impact (MoSCoW)
4. **High-Level Architecture** — Big functional modules and their relationships (diagram generated via the `d2-architect` skill, compiled to PNG, and embedded in a lightweight `ARCHITECTURE.md`)
5. **Roadmap** — V0 walking skeleton + subsequent versions as vertical slices of a working end-to-end app

**No heavy specs. No detailed software architecture patterns. No Gherkin. Just enough structure to fill a backlog and start sprinting.**

---

## Phase 1: Discovery

The purpose of discovery is to understand the problem space, the people, and the value before structuring anything. Same interactive methodology as spec-writing — adapted for agile scoping.

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

1. **Check for an existing `docs/project-tracking.json`** (and, for backward compatibility, `project-tracking.json` at the repository root — if found there, offer to move it to `docs/project-tracking.json` before continuing). If one exists, read it — you're in **update mode**. Summarize what's already scoped and use AskUserQuestion to ask what the user wants to add or change.
2. **If no `project-tracking.json` exists**, you're in **create mode**. Ask the user to describe what they're building, then immediately follow up with structured AskUserQuestion calls.

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

Based on the user answer about who uses the product, dig into each persona:

1. **Header: "Persona 1"** — "What's the primary persona's main goal?"
   - Options based on context, always concrete
2. **Header: "Pain points"** — "What frustrates this persona today?"
   - `multiSelect: true` with specific frustrations inferred from the problem description
3. **Header: "Persona 2?"** — "Is there a second distinct type of user?"
   - Options: "Yes — [inferred role]", "Yes — different role", "No, just one type of user", "There are 3+ types"
4. If multiple personas, follow up with their goals and pain points

### Batch 3 — Core Workflows (2-4 questions)

Now understand what people actually DO:

1. **Header: "Core flow"** — "What's the single most important thing a user does in this app?"
   - Options: concrete workflows inferred from the problem
2. **Header: "Workflows"** — "What other major workflows exist?"
   - `multiSelect: true` with inferred workflows
3. **Header: "MVP flow"** — "Which workflow is the absolute minimum for a useful product?"
   - Options from the workflows already identified
4. **Header: "Dependencies"** — "Do any workflows depend on others? (e.g., must sign up before ordering)"
   - Options: "Yes — [describe dependency chain]", "They're mostly independent", "Not sure"

### Batch 4+ — Feature-Specific & Business Rules

Continue with AskUserQuestion for each major area from `references/discovery-checklist.md`. Adapt to what matters based on previous answers:

- Business rules and constraints
- Integrations and external dependencies
- Platform and distribution
- Scale and constraints

**Don't over-discover.** Match depth to project complexity. A weekend project needs 2-3 batches. An enterprise product needs 5-6.

### Probing for Clarity

After each batch, analyze answers and determine what needs clarification:

- Vague answers get follow-up AskUserQuestion calls with more specific options
- Use "what happens when..." scenarios to surface edge cases worth capturing
- Use `preview` fields to show your understanding (persona cards, workflow sketches) and let the user confirm

### When to Stop Discovering

**CRITICAL: NEVER transition to structuring on your own.** Use AskUserQuestion:

- **Header: "Next step"** — "Ready to structure this into epics and user stories, or is there more to explore?"
  - Options:
    - "Structure it now (Recommended)" — description: "I have enough to produce personas, epics, stories, and a roadmap"
    - "I have more to add" — description: "I'll ask about the area you want to explore"
    - "Explore more areas" — description: "I'll cover remaining discovery categories"
    - "Summarize what we have" — description: "I'll recap everything before moving on"

Loop back into discovery if the user wants more exploration.

---

## Phase 2: Structuring — Personas, Epics & User Stories

Transform discovery insights into structured, prioritized backlog items.

### Step 1: Confirm Personas

Present the personas you've identified using AskUserQuestion with `preview` fields showing persona cards:

- **Header: "Personas"** — "Here are the personas I've identified. Look right?"
  - Option per persona with preview showing:
    ```
    P-001: Busy Parent
    Role: Working parent managing family logistics
    Goals:
      - Save time on meal planning
      - Reduce grocery waste
    Pain points:
      - No time to plan meals weekly
      - Forgets what's in the fridge
    Tech: Medium
    Primary: Yes
    ```
  - Option: "Adjust these" — description: "I'll modify based on your feedback"
  - Option: "Add another persona"

### Step 2: Propose Epics

Group the discovered workflows and features into epics. Present them:

- **Header: "Epics"** — "Here are the epics I've grouped. Does this breakdown make sense?"
  - Preview showing the epic list with descriptions
  - Options: "Looks good (Recommended)", "Merge some epics", "Split an epic", "Reorder priorities"

### Step 3: Break Down into User Stories

For each epic, propose user stories in "As a / I want / So that" format with acceptance criteria. Present them in batches per epic using AskUserQuestion:

- **Header: "[Epic]"** — "Here are the user stories for [Epic title]. Anything to add or change?"
  - Preview showing the stories with priorities
  - Options: "Looks good", "Add more stories", "Change priorities", "Remove some"

### Step 4: Prioritize

Present the full prioritized backlog for final validation:

- **Header: "Priorities"** — "Here's the full backlog sorted by priority. Agree with the ordering?"
  - Preview showing all stories grouped by MoSCoW priority (must-have, should-have, could-have, wont-have) with business impact
  - Options: "Approve (Recommended)", "Adjust priorities", "Move stories between epics"

Read `references/json-schema.md` for the exact ID conventions and priority system.

---

## Phase 3: High-Level Architecture

Draw the big functional modules and how they relate. **This is NOT software architecture** — no hexagonal, no MIM AA, no layers. Think product modules: "Auth", "Dashboard", "Notifications", "Payments", etc.

### Step 1: Identify Modules

From the epics and user stories, identify the big functional blocks. Present them:

- **Header: "Modules"** — "Here are the major modules I see. Missing anything?"
  - Preview showing modules with responsibilities and dependencies
  - Options: "Looks right (Recommended)", "Add a module", "Merge modules", "Adjust dependencies"

### Step 2: Generate the Architecture Diagram (via `d2-architect`)

Invoke the **`d2-architect`** skill to produce the diagram. Create `docs/V0/architecture/` first if it doesn't exist; this is V0's frozen architecture snapshot (later versions will get their own copies via the version snapshot rule).

Call `d2-architect` with:

- **Modules**: every confirmed module from Step 1 — each with `id` (M-NNN), `name`, optional `description`, optional `icon_key` (from `d2-architect/references/icons.md`, e.g. `aws/rds`, `dev/react`) when the module maps unambiguously to a named AWS service or dev tool, and optional `shape` hint (e.g. `cloud` for a 3rd-party integration, `person` for a user persona) when no icon applies.
- **Dependencies**: every dependency between modules, each with `from`, `to`, and an optional `label` describing the relationship in user-facing terms ("reads from", "notifies", "authenticates via"). No protocol names.
- **output_dir**: `docs/V0/architecture/`
- **basename**: `architecture`
- **title**: `"<Project Name> — High-Level Architecture (V0)"`
- **direction**: `right`
- **layout**: `elk`

**Design principles for the high-level view:**

- One level of nesting max (typically an `external` group for 3rd-party services)
- No databases, caches, or infrastructure internals — those belong in `/research-and-architecture`'s detailed diagram
- Arrow labels use user-facing verbs, not technology names
- Use `shape: person` for personas, `shape: cloud` + dashed stroke for external services — `d2-architect`'s Pattern 1 already codifies this

`d2-architect` returns:

- `docs/V0/architecture/architecture.d2` — editable d2 source
- `docs/V0/architecture/architecture.png` — the compiled diagram
- A markdown embed snippet to paste in Step 3

### Step 3: Write the Initial ARCHITECTURE.md

Write `docs/V0/architecture/ARCHITECTURE.md` as a **lightweight overview** that `/research-and-architecture` will later enrich with MIM AA detail. Use this template:

```markdown
# Architecture — V0

_High-level view generated by `/high-level-scoping` on <YYYY-MM-DD>. The `/research-and-architecture` skill expands this document with detailed MIM AA design._

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

- Diagram source: `architecture.d2` — regenerate the PNG with `~/.claude/skills/d2-architect/scripts/compile.sh architecture.d2 architecture.png`
- This document is the starting point. `/research-and-architecture` will append tech stack, ADRs, detailed module map, data architecture, testing strategy, etc.
```

The embed snippet returned by `d2-architect` (`![High-Level Architecture](architecture.png)`) goes under the `## High-Level Architecture` heading. The relative path resolves because `ARCHITECTURE.md` sits in the same directory as the PNG.

### Step 4: Validate with User

Show the user the rendered PNG (and/or open `docs/V0/architecture/ARCHITECTURE.md`):

- **Header: "Architecture"** — "Here's the high-level architecture. Any changes?"
  - Options: "Looks good (Recommended)", "Add a module", "Change relationships", "Redraw it"

If changes are requested, update the module list / dependencies and re-invoke `d2-architect` with the revised input. The `.d2` source is hand-editable too, but re-invoking the skill is simpler when the structure changes.

---

## Phase 4: Roadmap — Vertical Slices

Plan the delivery as a series of **vertical slices**, each being a **complete, working, end-to-end app** — not a horizontal layer.

### What Makes a Good Vertical Slice

A vertical slice:

- Delivers **user-visible value** (not "set up the database" or "create the API layer")
- Is **deployable and testable** on its own
- Touches all necessary layers (UI, logic, data) but only for the stories in that slice
- Each version **builds on the previous one** — V1 includes everything in V0 plus more

### Step 1: Define V0 — Walking Skeleton

V0 is the thinnest possible end-to-end slice that proves the architecture works. It should:

- Include the single most critical user story from the highest-priority epic
- Touch all major modules minimally (e.g., basic auth, one core workflow, simple UI)
- Be ugly but functional — no polish, no edge cases, just the golden path

Present V0:

- **Header: "V0"** — "Here's the walking skeleton. Is this the right starting point?"
  - Preview showing V0 stories and what the user can do end-to-end
  - Options: "Perfect (Recommended)", "Too thin — add more", "Too much — simplify", "Wrong stories"

### Step 2: Define V1, V2, ...

Each subsequent version adds a coherent chunk of value:

- **V1**: Core features — the must-haves that make the product actually useful
- **V2**: Should-haves — polish, secondary workflows, better UX
- **V3+**: Could-haves — nice-to-haves, optimizations, edge cases

Present each version:

- **Header: "V[N]"** — "Here's version [N]. Does this grouping make sense?"
  - Preview showing the stories in this version and what's new
  - Options: "Approve (Recommended)", "Move stories between versions", "Add another version", "Done with roadmap"

### Step 3: Validate Full Roadmap

Present the complete roadmap overview:

- **Header: "Roadmap"** — "Here's the full roadmap. Ready to generate?"
  - Preview showing all versions with their stories
  - Options: "Generate the scoping JSON (Recommended)", "Adjust versions", "Go back to stories"

---

## Phase 5: Generate Output

### Step 1: Generate `docs/project-tracking.json`

Read `references/json-schema.md` for the exact schema and write the JSON file.

**File location:** `docs/project-tracking.json`. Create the `docs/` directory if it does not exist. Do NOT write it to the repository root — the file always lives under `docs/`. If a legacy `project-tracking.json` exists at the repository root, move it into `docs/` first (and tell the user what you moved).

**Rules:**

- Every ID must follow the conventions in `references/json-schema.md`
- Every user story must have at least 2 acceptance criteria
- Every epic must be linked to at least one persona
- V0 must contain at least one story from the highest-priority epic
- The `architecture.diagram_path` must point to the exported PNG from Phase 3 (which lives at `docs/V0/architecture/architecture.png`)

### Step 2: Post-Generation Gate

Use AskUserQuestion:

- **Header: "Done"** — "The scoping JSON has been generated. What's next?"
  - Options:
    - "Launch review agent (Recommended)" — description: "A separate agent will review the scoping for completeness and coherence"
    - "Accept as-is" — description: "The scoping is final"
    - "Adjust something" — description: "I'll tell you what to change"
    - "Start a sprint" — description: "Pick user stories for the first sprint and start building"

### If the user picks "Launch review agent"

Spawn a **separate Claude agent** (using the Agent tool with `model: "opus"`) to review `docs/project-tracking.json`. The agent must check:

1. **Structural integrity** — Valid JSON, all required fields present, IDs are sequential and unique
2. **Completeness** — Every epic has stories, every story has acceptance criteria, all personas are referenced
3. **Coherence** — No contradictions between stories, dependencies make sense, roadmap versions are true vertical slices
4. **Roadmap sanity** — V0 is genuinely a walking skeleton (not too fat), versions build on each other, no story appears in multiple versions
5. **Priority consistency** — Must-haves appear in V0/V1, wont-haves don't appear in any version

The agent returns a verdict (PASS / MINOR / MAJOR) with findings. Present results and let the user decide what to fix.

### If the user picks "Start a sprint"

Use AskUserQuestion to let the user pick which stories to tackle first, then hand off to implementation (the user can use other skills like `/plan-writing` or start coding directly).

---

## Updating an Existing Scoping

When `docs/project-tracking.json` already exists:

- Read it completely
- Summarize what's there
- Ask what the user wants to change (add epic, reprioritize, adjust roadmap, add persona)
- Make targeted changes — don't regenerate everything
- Increment the `updated_at` field
- If the architecture changed, re-invoke `d2-architect` to regenerate the diagram (updates both `architecture.d2` and `architecture.png`), and update the module table in `docs/V0/architecture/ARCHITECTURE.md` accordingly

---

## Quality Checklist

Before finalizing, verify:

- [ ] Every persona has a unique ID (P-NNN) and at least one goal
- [ ] Every epic has a unique ID (E-NNN), a description, and is linked to personas
- [ ] Every user story has a unique global ID (US-NNN), follows "As a / I want / So that", has priority + business_impact + at least 2 acceptance criteria
- [ ] Architecture modules have unique IDs (M-NNN) and clear responsibilities
- [ ] Architecture diagram has been generated via `d2-architect` (`docs/V0/architecture/architecture.d2` and `.png` both exist)
- [ ] `docs/V0/architecture/ARCHITECTURE.md` exists, embeds the PNG, and lists all modules
- [ ] V0 is a genuine walking skeleton — thinnest possible end-to-end slice
- [ ] Each roadmap version is a vertical slice (working app, not a layer)
- [ ] No user story appears in multiple versions
- [ ] All must-have stories are in V0 or V1
- [ ] All wont-have stories are NOT in any version
- [ ] The JSON is valid and follows the schema in `references/json-schema.md`
