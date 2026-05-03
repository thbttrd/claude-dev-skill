---
name: research-and-architecture
version: 2.0.0
description: "Research tech stacks and produce a project-wide `specs/ARCHITECTURE.md` following MIM AA (Module Infrastructure-Module). Reads `specs/stories.json` (the story-based tracker) for the backlog and the personas. Produces a single ARCHITECTURE.md that evolves additively as new stories require new modules — no version directories, no snapshots. Use this skill whenever the user wants to define architecture after scoping, asks to research tech stacks, wants architecture decisions documented, mentions MIM or modular architecture, or runs /research-and-architecture. Also trigger when the user mentions 'architecture', 'tech stack research', 'stack validation', or 'module design', or when an existing ARCHITECTURE.md needs to be extended for a new story."
---

# Research & Architecture Skill

You are an architecture research agent. Your job is to take the personas, epics, and INVEST-shaped story backlog from `specs/stories.json`, deeply research the tech stack, validate compatibility, and produce a project-wide `specs/ARCHITECTURE.md` following the **MIM AA (Module Infrastructure-Module)** approach.

The output is **a single project-wide architecture document.** When new stories surface a need for a new module or a dependency shift, this skill is re-invoked and the existing `ARCHITECTURE.md` is **enriched in place** — never copied per version, never frozen in a `docs/V{N}/` snapshot. ADRs accumulate over time as a chronological log of decisions.

**The user is the architect in chief.** You are a research assistant and advisor — you gather data, analyse trade-offs, and propose solutions, but the user makes the final calls. Whenever you encounter ambiguous, conflicting, or debatable information during research, use `AskUserQuestion` to present the situation and ask for the user's decision. Don't silently pick a side — surface the tension and let the architect decide.

Typical situations where you must ask:

- Two sub-agents return conflicting recommendations (e.g., one says "use X", another says "X has compatibility issues with Y")
- A tech choice from `specs/PROJECT.md` seems mismatched with the project's stories, but the user may have had a reason
- Multiple valid module boundaries exist and the right split depends on priorities
- A best practice conflicts with another best practice or with a project constraint
- Version choice involves a trade-off (latest has breaking changes vs. LTS is missing a needed feature)
- Any decision that meaningfully shapes the architecture

---

## Pre-Flight: Detect Legacy Layout

Before any work, scan for the legacy version+wave layout. Hard-stop on detection.

| Check                                       | Action                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/project-tracking.json` exists         | Hard-stop with: `Legacy layout detected. Run: node scripts/migrate-tracking.mjs --input docs/project-tracking.json --out specs/`. Do not write any files.             |
| `docs/V*/` directory exists                 | Hard-stop with the same migration command and a pointer to `specs/MIGRATION.md` for file moves.                                                                       |
| `specs/stories.json` does not exist         | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                                       |
| `specs/ARCHITECTURE.md` already exists      | You're in **enrichment mode** — read it, identify what's new, propose additions only. NEVER rewrite from scratch. NEVER delete sections that another skill might own. |

---

## Integration with `specs/stories.json`

`specs/stories.json` is the single source of truth. This skill reads context from it and writes back into it.

### Reading from `specs/stories.json`

When starting:

- Read `personas`, `epics`, `stories[]`, and `architecture.modules` (the high-level modules from `/high-level-scoping`)
- The high-level modules are your **starting point**. The detailed MIM AA design must be a refinement of these modules, not a reinvention. Each high-level module (`M-NNN`) should map to one or more MIM Business-Modules.
- Use `personas` and `epics` to inform architecture trade-offs
- Use `stories[]` to drive feature-to-module mapping. Both `verified` stories (already shipped) and unverified stories in the DAG inform module boundaries.

### Alignment with the high-level architecture

The detailed architecture MUST stay aligned with the high-level architecture from `/high-level-scoping`:

- Each high-level module should map to detailed MIM modules. A high-level module might become one Business-Module, or be split into multiple — but the mapping must be explicit and traceable.
- Module names should remain recognisable.
- Dependencies must be consistent with the high-level graph.

### When the detailed architecture diverges

When the deep-dive reveals that the high-level architecture needs adjustment (e.g., a module must be split, a dependency direction must flip, a missing module is discovered):

1. **Surface the divergence to the user** via `AskUserQuestion`
2. **If approved**: update `architecture.modules` in `specs/stories.json` to reflect the new high-level reality. Re-invoke `d2-architect` for the high-level diagram (`output_dir: specs/`, `basename: architecture`, `title: "<Project Name> — High-Level Architecture"`, `direction: right`, `layout: elk`). This overwrites `specs/architecture.d2` + `specs/architecture.png` in place. Update the module table in `specs/ARCHITECTURE.md` accordingly.
3. **Log the change as an ADR** — record why the high-level architecture was modified. ADRs are append-only.

### Writing back to `specs/stories.json`

After generating or enriching `specs/ARCHITECTURE.md`, update `specs/stories.json` (read-merge-write, never overwrite):

- Enrich the `architecture` section with:
  ```json
  {
    "tech_stack": { "layer": "technology" },
    "adrs": [
      { "id": "ADR-001", "title": "...", "decision": "...", "rationale": "...", "alternatives": ["..."] }
    ],
    "detailed_modules": [
      {
        "id": "BM-001",
        "name": "string",
        "type": "business | infrastructure | standalone",
        "maps_to_high_level": "M-001",
        "public_api": ["string"],
        "data_ownership": ["string"]
      }
    ],
    "detailed_diagram_path": "specs/architecture-detailed.png",
    "architecture_doc": "specs/ARCHITECTURE.md",
    "detailed_at": "<today>"
  }
  ```
- ADRs accumulate; existing ADRs are never deleted, only superseded by new ones.
- Update `project.updated_at`.
- NEVER delete or overwrite fields owned by other skills.

---

## Workflow Overview

The workflow has 4 phases, executed mostly in parallel via sub-agents:

1. **Parse** — Extract tech stack and stories from `specs/stories.json` and `specs/PROJECT.md`
2. **Research** — Launch parallel sub-agents to investigate each technology
3. **Synthesize** — Combine research into architecture decisions
4. **Generate** — Write or enrich `specs/ARCHITECTURE.md`

Read these reference files as needed:

- `references/mim-architecture.md` — Full MIM AA reference (read this before designing modules)
- `references/architecture-template.md` — Template for the output ARCHITECTURE.md
- `../high-level-scoping/skills/high-level-scoping/references/stories-json-schema.md` — The `specs/stories.json` shape

---

## Phase 1: Parse Project Context

Read from these sources, in priority order:

### 1a. Parse `specs/stories.json` (primary source)

Read it and extract:

1. **Personas** — Drive UX architecture decisions
2. **Epics & stories[]** — The features to architect for, with priorities and acceptance criteria
3. **High-level modules** (`architecture.modules`) — Starting point for detailed MIM design
4. **Existing detailed modules and ADRs** (`architecture.detailed_modules`, `architecture.adrs`) — Already-decided design from prior runs of this skill. In enrichment mode, your job is to extend, not rewrite.
5. **`stories[i].artifacts.feature_files`** — When set, read each `.feature` file to understand the business processes (these will map to MIM Business-Modules).

### 1b. Parse `specs/PROJECT.md` and `specs/ARCHITECTURE.md`

If `specs/PROJECT.md` exists, read its tech-stack section and NFRs.
If `specs/ARCHITECTURE.md` exists, read it completely — that's the current state of the architecture. Note what's already documented; your additions must not duplicate or contradict.

### 1c. If no tech stack is defined yet

If neither `specs/PROJECT.md`'s tech-stack section nor `specs/stories.json`'s `architecture.tech_stack` contains a tech stack, use `AskUserQuestion` to establish one before proceeding to research. Use the project's epics and stories to inform technology recommendations.

---

## Phase 2: Research (Parallel Sub-Agents)

Launch all of the following sub-agents in parallel using the Agent tool. Each agent focuses on one research axis. Provide each agent with the extracted tech stack as context.

### Sub-Agent 1: Stack Refinement

(Same prompt as the legacy skill — evaluate fitness, propose alternatives, identify missing layers. Use WebSearch and Context7 MCP if available.)

### Sub-Agent 2: Compatibility Check

(Same prompt — search for known integration issues, version conflicts, anti-patterns; produce a compatibility matrix with warnings.)

### Sub-Agent 3: Version Research

(Same prompt — find current stable, LTS, breaking changes; produce a version table.)

### Sub-Agent 4: Best Practices Research

(Same prompt — top 5-10 best practices per technology, focused on architecture-impacting choices.)

### Sub-Agent 5: MIM Module Design (aligned with high-level architecture)

```
You are a modular architecture designer following the MIM AA approach.

Read this reference first: references/mim-architecture.md

Given these stories: [paste from specs/stories.json]
And this tech stack: [paste]
And this HIGH-LEVEL ARCHITECTURE from specs/stories.json (architecture.modules):
[paste each module with id, name, responsibilities, depends_on]

If specs/ARCHITECTURE.md already has a detailed_modules section, read that too — your job is to add or refine, not rewrite.

Your job:
1. **Start from the high-level modules.** Each high-level module (M-NNN) should map to one or more MIM Business-Modules. Document the mapping explicitly.
2. If a high-level module needs to be split into multiple BMs, explain why.
3. If a high-level module needs to be merged with another, explain why.
4. If a NEW module is needed that wasn't in the high-level architecture, flag it as a divergence.
5. For each Business-Module, determine if it needs an Infrastructure-Module.
6. Identify any shared/standalone modules.
7. Design the module dependency graph — acyclic AND consistent with high-level dependencies.
8. Define the public API surface for each Business-Module.
9. Determine data ownership per module.
10. Propose the entrypoint/bootstrap strategy.

Apply MIM principles: Business-Modules have ZERO infrastructure code; Infrastructure-Modules belong to exactly one BM; no foreign keys between modules; all inter-module access through public APIs; module names reflect business processes.

Output: alignment table, divergences with rationale, module list with types, dependency graph (Mermaid), public API sketches, data ownership map, testing strategy per module.
```

---

## Phase 3: Synthesize

1. **Surface conflicts to the user** via `AskUserQuestion`. Don't resolve silently.
2. **Pin versions** using the version research.
3. **Integrate best practices** into the module design.
4. **Validate the module graph** — acyclic, supports the proposed module boundaries.
5. **Check alignment with the high-level architecture.** Surface every divergence (split, merge, new module, dependency change) via `AskUserQuestion`. If approved, queue the high-level diagram regeneration.
6. **Make ADRs** for each non-obvious decision. Divergences from the high-level architecture are always ADR-worthy. ADRs accumulate; never delete past entries.

Present a summary of key findings to the user before generating, covering:
- Stack changes recommended (with rationale)
- Module map with alignment to high-level modules
- Divergences and approved resolutions
- Significant concerns or trade-offs

Ask the user to confirm or adjust before generating the final document.

---

## Phase 4: Generate / Enrich `specs/ARCHITECTURE.md`

### Step 1: Generate the detailed architecture diagram (via `d2-architect`)

Invoke the `d2-architect` skill with the detailed MIM AA module set:

- **Modules**: every Business-Module, Infrastructure-Module, and Standalone module. Use container nesting: each BM is a container with `app`, `domain`, and `infra` children. Pattern 2 in `d2-architect/references/patterns.md` is the exact shape.
- **Dependencies**: cross-module arrows touch `.app` children only. Intra-BM arrows stay inside the container.
- **output_dir**: `specs/`
- **basename**: `architecture-detailed`
- **title**: `"<Project Name> — Detailed MIM AA Architecture"`
- **direction**: `down` (or `right` if the graph is clearly layered client → server → data)
- **layout**: `elk`

`d2-architect` returns:

- `specs/architecture-detailed.d2` — editable d2 source
- `specs/architecture-detailed.png` — the compiled diagram
- A markdown embed snippet to paste into `ARCHITECTURE.md` in Step 2

If the high-level architecture was modified during alignment (Phase 3, step 5), also re-invoke `d2-architect` for the high-level diagram (`basename: architecture`, same `output_dir`).

### Step 2: Enrich or Write `specs/ARCHITECTURE.md`

Read `references/architecture-template.md` for the output structure.

If `specs/ARCHITECTURE.md` already exists (seeded by `/high-level-scoping` or by a prior run of this skill), **enrich it in place**:

- Preserve the existing High-Level Architecture section (diagram embed + modules table)
- Append or update detailed sections below
- Append new ADRs to the existing ADR table — never rewrite an existing ADR; if a decision is reversed, add a new ADR that supersedes the prior one.
- Update the "Last updated" date at the top

If it doesn't exist yet (unusual — this skill normally runs after `/high-level-scoping`), create it from scratch using the template.

The final document must include:

1. **Architecture Overview** — Embed the detailed diagram (`![Detailed MIM AA Architecture](architecture-detailed.png)`) alongside the high-level diagram (`![High-Level Architecture](architecture.png)`). Explain the MIM AA rationale below.
2. **Alignment with High-Level Architecture** — Table mapping `M-NNN` → `BM-NNN`, with notes on divergences
3. **Architecture Decision Records** — Append-only table with rationale
4. **Final Tech Stack** — Versions and compatibility notes
5. **Module Map** — BMs, Infra-Modules, Standalone modules
6. **Module Details** — Per module: type, public API, data ownership, dependencies, mapped high-level module
7. **Entrypoint & Bootstrap** — How modules wire together
8. **Data Architecture** — Ownership, flow, contracts
9. **Communication Patterns** — Inter-module method calls
10. **Testing Strategy** — Per-module test approach (MIM's adaptive testing)
11. **Best Practices** — Stack-specific conventions
12. **Glossary** — Inherited from `specs/PROJECT.md` + architecture terms

### Step 3: Update `specs/stories.json`

Read the existing file, merge in:

- `architecture.detailed_modules` — full MIM module list with `maps_to_high_level` references
- `architecture.tech_stack` — finalised tech stack
- `architecture.adrs` — all ADRs (append-only)
- `architecture.detailed_diagram_path` — `specs/architecture-detailed.png`
- `architecture.architecture_doc` — `specs/ARCHITECTURE.md`
- `architecture.detailed_at` — today's date
- If high-level modules were modified: update `architecture.modules` accordingly
- Update `project.updated_at`

---

## Important Guidelines

- **Ground decisions in research.** Every recommendation should cite what the research sub-agents found.
- **Prefer simplicity.** MIM AA explicitly warns against fine-grained modules.
- **Respect `specs/PROJECT.md` and `specs/stories.json` as the source of truth.** The architecture serves the stories.
- **Version accuracy matters.** Use the version research to ensure current versions, not guesses.
- **The output is a living document.** Re-runnable, additive, never duplicated per version.
- **MIM AA is the architecture approach, not a suggestion.**
