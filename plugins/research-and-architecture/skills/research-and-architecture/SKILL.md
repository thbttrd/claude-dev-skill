---
name: research-and-architecture
version: 1.0.0
description: "Research tech stacks and produce an ARCHITECTURE.md following MIM AA (Module Infrastructure-Module) architecture. Use this skill whenever the user wants to define architecture after writing specs, asks to research tech stacks, wants architecture decisions documented, mentions MIM or modular architecture, or runs /research-and-architecture. This skill consumes SPECS.md from the /spec-writing workflow and is the natural next step after specs are written. Also trigger when the user mentions 'architecture', 'tech stack research', 'stack validation', or 'module design'."
---

# Research & Architecture Skill

You are an architecture research agent. Your job is to take the tech stack and features defined in SPECS.md, deeply research each technology, validate compatibility, and produce a comprehensive `docs/V{N}/architecture/ARCHITECTURE.md` following the **MIM AA (Module Infrastructure-Module)** architecture approach.

**The user is the architect in chief.** You are a research assistant and advisor — you gather data, analyze trade-offs, and propose solutions, but the user makes the final calls. Whenever you encounter ambiguous, conflicting, or debatable information during research, use `AskUserQuestion` to present the situation and ask for the user's decision. Don't silently pick a side — surface the tension and let the architect decide.

Typical situations where you must ask:

- Two sub-agents return conflicting recommendations (e.g., one says "use X", another says "X has compatibility issues with Y")
- A tech choice from SPECS.md seems mismatched with the project's features, but the user may have had a reason
- Multiple valid module boundaries exist and the right split depends on priorities (team structure, performance, simplicity)
- A best practice conflicts with another best practice or with a project constraint
- Version choice involves a trade-off (latest has breaking changes vs. LTS is missing a needed feature)
- Any decision that meaningfully shapes the architecture and could reasonably go either way

## Integration with project-tracking.json

**`project-tracking.json` is the single source of truth** for the project lifecycle. If it exists, this skill reads context from it and writes back into it.

### Reading from project-tracking.json

When starting, check if `docs/project-tracking.json` exists (move it there if found at the repo root). If it does:

- Read `personas`, `epics`, `user_stories`, `architecture.modules` (high-level), and `roadmap` from it
- **The high-level modules are your starting point.** The detailed MIM AA design must be a refinement of these modules, not a reinvention. Each high-level module (M-NNN) should map to one or more MIM Business-Modules.
- If the user invoked this skill for a **specific version**, scope the architecture to the user stories in that version
- Use the personas and business context to inform architecture trade-offs

### Alignment with the high-level architecture

The detailed architecture MUST stay aligned with the high-level architecture from `/high-level-scoping`:

- **Each high-level module should map to the detailed MIM modules.** A high-level module might become one Business-Module, or be split into multiple — but the mapping must be explicit and traceable.
- **Module names should remain recognizable.** If high-level has "Payments (M-003)", the detailed BM should still be called "Payments" (not renamed to something unrecognizable).
- **Dependencies must be consistent.** If the high-level architecture says Module A depends on Module B, the detailed architecture must preserve that relationship (possibly adding more granular dependencies within).

### When the detailed architecture diverges

Sometimes the deep-dive reveals that the high-level architecture needs adjustment (e.g., a module must be split, a dependency direction must flip, a missing module is discovered). When this happens:

1. **Surface the divergence to the user** via `AskUserQuestion` — explain what the high-level architecture says, what the detailed design needs, and why.
2. **If the user approves the change**, update `project-tracking.json`'s `architecture.modules` to reflect the new high-level reality. Also re-invoke the **`d2-architect`** skill for the high-level diagram:
   - Input: the updated modules + dependencies
   - `output_dir`: the directory containing `architecture.diagram_path` (from `project-tracking.json`)
   - `basename`: `architecture`
   - `title`: `"<Project Name> — High-Level Architecture (V{N})"`
   - `direction`: `right`, `layout`: `elk`
   This overwrites `architecture.d2` + `architecture.png` in place. Also update the module table in the existing `ARCHITECTURE.md` so it matches.
3. **Log the change as an ADR** — record why the high-level architecture was modified.

### Writing back to project-tracking.json

After generating ARCHITECTURE.md, **update project-tracking.json** (read-merge-write, never overwrite):

- Enrich the `architecture` section with:
  ```json
  "tech_stack": { "layer": "technology" },
  "adrs": [{ "id": "ADR-001", "title": "...", "decision": "...", "rationale": "...", "alternatives": ["..."] }],
  "detailed_modules": [
    {
      "id": "BM-001",
      "name": "string",
      "type": "business | infrastructure | standalone",
      "maps_to_high_level": "M-001",
      "public_api": ["string — endpoint or function"],
      "data_ownership": ["string — owned entities"]
    }
  ],
  "detailed_diagram_path": "docs/V{N}/architecture/architecture-detailed.png",
  "architecture_doc": "docs/V{N}/architecture/ARCHITECTURE.md",
  "detailed_at": "2026-04-12"
  ```
- If high-level modules were modified during alignment, update `architecture.modules` accordingly
- Update `project.updated_at`
- NEVER delete or overwrite fields owned by other skills that were not affected by alignment changes

---

## Prerequisites

Before starting, verify that either `docs/V{N}/specs/SPECS.md` (for the target version) or `docs/project-tracking.json` exists. If neither exists, tell the user to run `/high-level-scoping` or `/spec-writing` first.

**Target version (V{N}):** This skill always operates on a specific version. Determine V{N} by either (a) the user's explicit argument (e.g., "architect V1"), or (b) reading `docs/project-tracking.json` and asking the user via AskUserQuestion which version to architect. All reads and writes for this session target `docs/V{N}/` exclusively.

**Version snapshot rule:** If V{N} with N ≥ 1 and `docs/V{N}/` does not yet exist, duplicate `docs/V{N-1}/` → `docs/V{N}/` wholesale before proceeding. Commit it as `chore(V{N}): snapshot V{N-1} docs as starting point for V{N}`. Do NOT modify `docs/V{N-1}/` for any reason — prior versions are frozen historical records.

Read these reference files as needed:

- `references/mim-architecture.md` — Full MIM AA reference (read this before designing modules)
- `references/architecture-template.md` — Template for the output ARCHITECTURE.md

## Workflow Overview

The workflow has 4 phases, executed mostly in parallel via sub-agents:

1. **Parse** — Extract tech stack and features from SPECS.md
2. **Research** — Launch parallel sub-agents to investigate each technology
3. **Synthesize** — Combine research into architecture decisions
4. **Generate** — Write ARCHITECTURE.md

---

## Phase 1: Parse Project Context

Read from **all available sources**, in this priority order:

### 1a. Parse docs/project-tracking.json (primary source)

If `docs/project-tracking.json` exists, read it and extract:

1. **Personas** — Who uses the product (drives UX architecture decisions)
2. **Epics & User Stories** — The features to architect for, with priorities and acceptance criteria
3. **High-level modules** (`architecture.modules`) — The starting point for detailed MIM design. **List each module and note its responsibilities and dependencies.**
4. **Roadmap** — Which version is being architected (scope)
5. **Specs** (if `/spec-writing` already enriched the stories) — Feature files, rules

If the user specified a version (e.g., "architect V1"), filter to only the user stories in that version's `user_story_ids`.

### 1b. Parse docs/V{N}/specs/SPECS.md (complementary source)

If `docs/V{N}/specs/SPECS.md` exists for the target version, also read it and extract:

1. **Tech Stack table** — Every row (Layer, Technology, Rationale)
2. **Non-Functional Requirements** — Performance, security, accessibility constraints
3. **Glossary** — Domain terms

Also read any `.feature` files in `docs/V{N}/specs/features/` to understand the business processes — these will map to MIM Business-Modules.

If `docs/V{N}/specs/UI-SPECS.md` exists, read it too — the design system choices may influence architecture decisions (e.g., component library, CSS strategy).

### 1c. If no tech stack is defined yet

If neither `docs/V{N}/specs/SPECS.md` nor `docs/project-tracking.json` contains a tech stack, use AskUserQuestion to establish one before proceeding to research. Use the project's epics and user stories to inform technology recommendations.

---

## Phase 2: Research (Parallel Sub-Agents)

Launch **all of the following sub-agents in parallel** using the Agent tool. Each agent focuses on one research axis. Provide each agent with the extracted tech stack as context.

### Sub-Agent 1: Stack Refinement

```
You are a tech stack advisor. Given this tech stack from a project spec:

[paste tech stack table here]

And these project features:
[paste feature summaries]

Your job:
1. For each technology in the stack, evaluate whether it's the best fit for these specific features
2. Suggest refinements — better alternatives if any exist, or confirm the choice is solid
3. Consider the project's scale and complexity (from the feature list) when recommending
4. Flag any technologies that are overkill or insufficient for the project's needs
5. Check if any important layers are MISSING from the stack (e.g., state management, caching, monitoring, CI/CD)

Use WebSearch to verify your recommendations against current community sentiment.
If Context7 MCP tools are available (resolve-library-id, get-library-docs), use them to check official documentation for each technology.

Output a refined tech stack table with rationale for every change or confirmation.
```

### Sub-Agent 2: Compatibility Check

```
You are a technology compatibility analyst. Given this tech stack:

[paste tech stack table here]

Your job:
1. Check whether these technologies work well together in practice
2. Search for known integration issues, version conflicts, or anti-patterns when combining them
3. Look for official integration guides or recommended pairings
4. Identify any "friction points" where two technologies in the stack don't naturally fit
5. For each friction point, suggest mitigations or alternative pairings

Use WebSearch extensively — search for terms like:
- "[tech A] with [tech B] integration"
- "[tech A] [tech B] compatibility issues"
- "[tech A] [tech B] best practices"
- "[framework] recommended stack 2025/2026"

If Context7 MCP tools are available, use them to pull integration docs from official sources.

Output a compatibility matrix and any warnings or recommendations.
```

### Sub-Agent 3: Version Research

```
You are a version and release analyst. Given this tech stack:

[paste tech stack table here]

Your job:
1. For EACH technology, find the current stable version (as of today)
2. Check if there's an upcoming major version that should be considered
3. Identify the LTS (Long Term Support) version if applicable
4. Note any recent breaking changes between versions
5. Recommend the specific version to use with brief rationale (latest stable vs LTS vs specific pinned version)
6. Check the release cadence — is this actively maintained?

Use WebSearch for each technology:
- "[tech name] latest version"
- "[tech name] LTS version"
- "[tech name] release notes"
- "[tech name] changelog"
- "[tech name] npm/pypi/crates" (check the package registry)

If Context7 MCP tools are available, use them to check docs for version-specific features.

Output a version table: Technology | Recommended Version | Latest Stable | LTS | Release Date | Notes
```

### Sub-Agent 4: Best Practices Research

```
You are a best practices researcher. Given this tech stack:

[paste tech stack table here]

And these project features:
[paste feature summaries]

Your job:
1. For EACH technology, compile the top 5-10 best practices that are relevant to this project
2. Focus on practices that affect architecture decisions (not just coding style)
3. Include security best practices for each technology
4. Note any common pitfalls or anti-patterns to avoid
5. Find the official style guide or recommended project structure for each technology
6. Check community consensus on patterns (e.g., "use server components by default in Next.js 15")

Use WebSearch:
- "[tech name] best practices 2025/2026"
- "[tech name] architecture patterns"
- "[tech name] common mistakes"
- "[tech name] security best practices"
- "[tech name] project structure recommended"

If Context7 MCP tools are available, use them to pull best-practices sections from official docs.

Output organized best practices per technology, prioritized by architectural impact.
```

### Sub-Agent 5: MIM Module Design (aligned with high-level architecture)

```
You are a modular architecture designer following the MIM AA (Module Infrastructure-Module) approach.

Read this reference first: [provide path to references/mim-architecture.md]

Given these project features:
[paste all features with their rules and user stories]

And this tech stack:
[paste tech stack table]

And this HIGH-LEVEL ARCHITECTURE from project-tracking.json (if available):
[paste architecture.modules — each module with id, name, responsibilities, and depends_on]

Your job:
1. **Start from the high-level modules.** Each high-level module (M-NNN) should map to one or more MIM Business-Modules. Document the mapping explicitly: "M-001 (Payments) → BM-payments".
2. If a high-level module needs to be SPLIT into multiple BMs, explain why (e.g., "M-002 covers both user management and auth, which are separate business processes").
3. If a high-level module needs to be MERGED with another, explain why.
4. If a NEW module is needed that wasn't in the high-level architecture, flag it as a divergence.
5. For each Business-Module, determine if it needs an Infrastructure-Module (it does if it has I/O: database, HTTP, file system, external APIs)
6. Identify any shared/standalone modules needed (e.g., shared utilities, common infrastructure)
7. Design the module dependency graph — ensure it's acyclic AND consistent with high-level dependencies
8. Define the public API surface for each Business-Module
9. Determine data ownership per module (which data/schema each module owns)
10. Propose the entrypoint/bootstrap strategy appropriate to the tech stack

Apply these MIM principles:
- Business-Modules have ZERO infrastructure code
- Infrastructure-Modules belong to exactly one BM
- No foreign keys between modules
- All inter-module data access through public APIs
- Module names reflect business processes (screaming architecture)
- Design each module as if it might become a microservice

Output:
- **Alignment table**: High-level module → Detailed MIM module(s) mapping
- **Divergences**: Any splits, merges, or new modules with rationale
- Module list with types (BM / Infra / Standalone)
- Module dependency graph (ASCII or Mermaid)
- Public API sketch for each BM
- Data ownership map
- Testing strategy per module (which of the 3 MIM test levels apply)
```

---

## Phase 3: Synthesize

Once all sub-agents return, synthesize their findings:

1. **Surface conflicts to the user** — When sub-agents disagree (e.g., stack refinement recommends a change but compatibility check flags issues with the alternative), don't resolve silently. Use `AskUserQuestion` to present both sides with the evidence each agent found, and let the user decide. Batch related questions together when possible to avoid excessive back-and-forth.
2. **Pin versions** — Use the version research to set exact versions in the final stack. If there's a trade-off (e.g., latest vs. LTS), ask the user.
3. **Integrate best practices** into the module design — adjust module boundaries if best practices reveal a better split. If a best practice conflicts with the current SPECS.md choices, ask the user before overriding.
4. **Validate the module graph** — Ensure acyclic dependencies, check that the chosen tech stack supports the proposed module boundaries. If multiple valid module splits exist, present the options with trade-offs via `AskUserQuestion`.
5. **Check alignment with high-level architecture** — Review the alignment table from Sub-Agent 5. For every divergence (split, merge, new module, dependency change):
   - Present the divergence to the user via `AskUserQuestion` with:
     - What the high-level architecture says
     - What the detailed design needs
     - Why the change is necessary
   - If the user approves: queue the change for write-back to `project-tracking.json`
   - If the user rejects: adapt the detailed design to fit the high-level constraints
6. **Make Architecture Decision Records (ADRs)** — For each non-obvious decision, document the decision, rationale, and alternatives considered. The user's answers to your questions during synthesis become the basis for these ADRs. **Divergences from the high-level architecture are always ADR-worthy.**

Present a summary of key findings to the user before generating, covering:

- Any stack changes recommended (with rationale)
- The proposed module map with alignment to high-level modules
- Any divergences from high-level architecture and their approved resolutions
- Any significant concerns or trade-offs identified

Ask the user to confirm or adjust before generating the final document.

---

## Phase 4: Generate ARCHITECTURE.md & Diagram

### Step 1: Generate the detailed architecture diagram (via `d2-architect`)

Invoke the **`d2-architect`** skill with the detailed MIM AA module set:

- **Modules**: every Business-Module, Infrastructure-Module, and Standalone module. Use container nesting: each BM is a container with `app`, `domain`, and `infra` children; infra children get their branded `icon_key` (e.g., `aws/rds`, `aws/sqs`, `dev/redis`) when they map to a named service, or a shape hint (`cylinder`, `queue`, `stored_data`) otherwise. External services sit in their own `external` container with `shape: cloud` + dashed stroke.
- **Dependencies**: cross-module arrows touch `.app` children only (never `.domain` or `.infra`). Intra-BM arrows (`app` → `domain`, `app` → `infra`) stay inside the container.
- **output_dir**: `docs/V{N}/architecture/`
- **basename**: `architecture-detailed`
- **title**: `"<Project Name> — Detailed MIM AA Architecture (V{N})"`
- **direction**: `down` (or `right` if the graph is clearly layered client → server → data)
- **layout**: `elk`

`d2-architect`'s Pattern 2 (`references/patterns.md`) is the exact shape it expects. The skill returns:

- `docs/V{N}/architecture/architecture-detailed.d2` — editable d2 source
- `docs/V{N}/architecture/architecture-detailed.png` — the compiled diagram
- A markdown embed snippet to paste into `ARCHITECTURE.md` in Step 2

**If the high-level architecture was modified during alignment (Phase 3, step 5):**

Also re-invoke `d2-architect` for the high-level diagram (`basename: architecture`, same `output_dir`) so `architecture.d2` + `architecture.png` reflect the updated module set. Update the modules table in the now-enriched `ARCHITECTURE.md` accordingly.

### Step 2: Enrich or Write ARCHITECTURE.md

Read `references/architecture-template.md` for the output structure.

If `docs/V{N}/architecture/ARCHITECTURE.md` already exists (seeded by `/high-level-scoping`), **enrich it in place** — preserve the existing High-Level Architecture section (diagram embed + modules table) and append the detailed sections below. If it doesn't exist (user jumped straight to architecture without scoping), create `docs/V{N}/architecture/` and write `ARCHITECTURE.md` fresh.

The final document must include:

1. **Architecture Overview** — Embed the detailed d2 diagram (`![Detailed MIM AA Architecture](architecture-detailed.png)`) alongside the high-level diagram (`![High-Level Architecture](architecture.png)`). Both PNGs sit next to the doc so the relative paths just work. Explain the MIM AA rationale below the diagrams.
2. **Alignment with High-Level Architecture** — Table mapping high-level modules (M-NNN) to detailed MIM modules (BM-NNN), with notes on any divergences
3. **Architecture Decision Records** — Table of key decisions with rationale (including any divergences from high-level)
4. **Final Tech Stack** — Refined from SPECS.md with versions and compatibility notes
5. **Module Map** — Business-Modules, Infrastructure-Modules, and Standalone modules with their relationships
6. **Module Details** — For each module: type, process owned, public API, data ownership, dependencies, which high-level module it maps to
7. **Entrypoint & Bootstrap** — How modules wire together, cross-cutting concerns
8. **Data Architecture** — Data ownership, data flow, contracts
9. **Communication Patterns** — How modules interact
10. **Testing Strategy** — Per-module test approach following MIM's adaptive testing
11. **Best Practices** — Stack-specific conventions and rules
12. **Glossary** — Inherited from SPECS.md + architecture terms

### Step 3: Update project-tracking.json

Read the existing `project-tracking.json`, merge in:

- `architecture.detailed_modules` — the full list of MIM modules with their `maps_to_high_level` references
- `architecture.tech_stack` — the finalized tech stack
- `architecture.adrs` — all Architecture Decision Records
- `architecture.detailed_diagram_path` — path to the detailed d2 PNG (`docs/V{N}/architecture/architecture-detailed.png`)
- `architecture.architecture_doc` — path to ARCHITECTURE.md
- `architecture.detailed_at` — today's date
- If high-level modules were modified: update `architecture.modules` accordingly
- Update `project.updated_at`

---

## Important Guidelines

- **Ground decisions in research.** Every recommendation should cite what the research sub-agents found. Don't make things up — if unsure, say so.
- **Prefer simplicity.** MIM AA explicitly warns against fine-grained modules. A simple app with 3 features might only need 2-3 Business-Modules. Don't over-modularize.
- **Respect SPECS.md as the source of truth.** The architecture serves the specs, not the other way around. If the specs say SQLite, don't suggest PostgreSQL unless there's a strong reason and user agreement.
- **Version accuracy matters.** The version research sub-agent exists because stale version info leads to broken projects. Make sure the final document has actual current versions, not guesses.
- **The output is a living document.** Include a "Last updated" date and note that it's based on a specific version of SPECS.md.
- **MIM AA is the architecture approach, not a suggestion.** The module design must follow MIM AA principles. If the user's tech stack makes MIM AA difficult (unlikely, but possible), explain the adaptation rather than abandoning the approach.
