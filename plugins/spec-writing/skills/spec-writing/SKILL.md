---
name: spec-writing
version: 1.0.0
description: Spec-driven development skill that produces a high-level SPECS.md overview plus executable Cucumber-compatible .feature files (one per feature) with full Gherkin scenarios. Use this skill whenever the user wants to write specs, define features, describe what an app should do, plan a new project's behavior, capture requirements, write acceptance criteria, or says things like "let's spec this out", "what should this app do", "define the features", "write the requirements", "/spec-writing". Also trigger when the user wants to update or refine existing specs, add new features to SPECS.md, or review specification coverage. Even if they don't say "spec" explicitly, trigger this skill if the conversation is about defining what software should do before building it.
---

# Spec Writing Skill

Produce two complementary outputs — **scoped to a specific version V{N}** — that together capture an application's behavior:

1. **SPECS.md** — A high-level specification with the project overview, tech stack, feature summaries (User Stories + Rules), non-functional requirements, glossary, and changelog. This is the human-readable overview document. Lives at `docs/V{N}/specs/SPECS.md`.
2. **`docs/V{N}/specs/features/*.feature` files** — One Gherkin `.feature` file per feature, containing the full scenarios in proper Cucumber syntax. These are the machine-parseable BDD specs that frameworks like cucumber-js, behave, or SpecFlow can execute directly with step definitions.

The goal is a single source of truth that drives development AND testing — SPECS.md gives the big picture, `docs/V{N}/specs/features/*.feature` files give the executable detail.

This skill works in three phases: **Discovery** (understand and clarify), **Generation** (produce the spec + feature files), and **Review** (validate completeness). The discovery phase matters most — a spec is only as good as the understanding behind it.

## Target Version & Documentation Layout

**All artifacts this skill produces live inside `docs/V{N}/specs/`** — where `V{N}` is the specific version being specified (V0, V1, V2, ...). The `docs/` folder layout is:

```
docs/
├── project-tracking.json                 # project-wide source of truth (NOT version-scoped)
├── V0/
│   └── specs/
│       ├── SPECS.md
│       ├── DESIGN.md                     # written by /ui-specs (only if UI)
│       ├── UI-F-NNN-*.md                 # written by /ui-specs (one per UI screen)
│       ├── features/
│       │   └── F-NNN-*.feature
│       └── mockups/                      # written by /ui-specs
│           ├── UI-F-NNN-*.html           # desktop, all states stacked
│           └── UI-F-NNN-*-mobile.html    # mobile reflow
├── V1/
│   └── specs/ ... (same structure)
└── V2/ ...
```

UI artifacts (DESIGN.md, mockups, per-screen specs) are produced by the dedicated **`/ui-specs`** skill. This skill auto-invokes `/ui-specs` whenever a project has a UI; see Phase 1.5 below.

**Version snapshot rule (CRITICAL):** For any V{N} with N ≥ 1, before this skill writes a single file, it MUST ensure `docs/V{N}/` exists by **duplicating `docs/V{N-1}/` verbatim** (entire directory — specs, architecture, plans, everything). V0 is the only version seeded from scratch. The duplication preserves prior versions as frozen historical records. See "Ensuring the Version Directory" below.

**Determining the target version:** If the user didn't specify one (e.g., "spec V1"), read `docs/project-tracking.json` to list versions and use AskUserQuestion to pick one. The chosen version becomes V{N} for the rest of the session.

## How This Skill Fits Into Development

SPECS.md and the feature files sit upstream of code:

```
Conversation → docs/V{N}/specs/SPECS.md + docs/V{N}/specs/features/*.feature → Implementation → Step Definitions → Automated BDD Tests
                        ↑                                                                                      |
                        └──────────────────────── feedback loop ───────────────────────────────────────────────┘
```

Developers and AI agents read `docs/V{N}/specs/SPECS.md` to understand what to build. The `docs/V{N}/specs/features/*.feature` files are wired to step definitions for automated acceptance testing. Product owners validate intent by reading the User Stories in SPECS.md and the scenarios in the `.feature` files.

## Ensuring the Version Directory Exists

Before any spec work, run this check:

1. If the target is V0:
   - If `docs/V0/` does not exist, create `docs/V0/specs/` (and any needed subdirs) from scratch.
2. If the target is V{N} with N ≥ 1:
   - If `docs/V{N}/` already exists, proceed — the snapshot has already been taken by a prior skill invocation.
   - If `docs/V{N}/` does not exist, **copy `docs/V{N-1}/` to `docs/V{N}/` wholesale**, preserving the full directory tree (specs, architecture, plans, qa-report.md if present). This is the version snapshot. Use `cp -R docs/V{N-1} docs/V{N}` or an equivalent. Commit it as a standalone commit: `chore(V{N}): snapshot V{N-1} docs as starting point for V{N}`.
   - After duplication, every subsequent edit in this session targets `docs/V{N}/` only — do NOT modify `docs/V{N-1}/`.

This ensures the prior version's artifacts are frozen in place and the new version starts from a complete, consistent baseline.

---

## Integration with project-tracking.json

**`project-tracking.json` is the single source of truth** for the project lifecycle. If it exists, this skill reads context from it and writes back into it.

### Reading from project-tracking.json

When starting, check if `docs/project-tracking.json` exists. If a legacy file exists at the repository root instead, offer to move it under `docs/` before continuing. If it does:

- Read `personas`, `epics`, `user_stories`, and `roadmap` from it
- Use this as **pre-existing context** — skip discovery questions that are already answered
- If the user invoked this skill for a **specific version** (e.g., "spec V1"), scope the work to the user stories listed in that version's `user_story_ids`
- Use the persona definitions from the JSON instead of re-discovering them

### Writing back to project-tracking.json

After generating SPECS.md and feature files, **update project-tracking.json** (read-merge-write, never overwrite):

- Add a `spec` field to each user story that was specified:
  ```json
  "spec": {
    "feature_file": "docs/V{N}/specs/features/F-001-feature-name.feature",
    "rules": ["Rule summary 1", "Rule summary 2"],
    "specified_at": "2026-04-10"
  }
  ```
- Add `spec_status` and `specs_completed_at` to the roadmap version if all its stories are now specified
- Update `project.updated_at`
- NEVER delete or overwrite fields owned by other skills

---

## Phase 1: Discovery

The purpose of discovery is to eliminate ambiguity before writing a single line of spec. A vague spec produces vague software.

**If `project-tracking.json` exists and provides sufficient context (personas, epics, user stories with acceptance criteria), you may skip or shorten discovery** — go straight to confirming scope with the user, then move to generation. Only probe areas where the JSON lacks detail.

### CRITICAL: Always Use the AskUserQuestion Tool

**You MUST use the `AskUserQuestion` tool for ALL questions during discovery.** Never ask questions as plain text in your response. Every question must go through the interactive TUI so the user gets a clean, navigable selection interface.

Rules for using AskUserQuestion effectively:

- **Batch related questions**: Group up to 4 related questions per `AskUserQuestion` call. Each question gets its own tab/chip in the TUI.
- **Always provide concrete options**: Even for open-ended topics, propose 2-4 concrete choices. The user can always pick "Other" to type a custom answer.
- **Use `multiSelect: true`** when choices are not mutually exclusive (e.g., "Which features do you want?" or "Which integrations do you need?").
- **Use short `header` labels** (max 12 chars) for the tab chips: e.g., "Auth", "Tech stack", "DB choice", "Error UX".
- **Put your recommended option first** and append "(Recommended)" to its label.
- **Use the `description` field** to explain trade-offs or implications of each option.
- **Use the `preview` field** when showing concrete artifacts like UI mockups, data model sketches, or architecture diagrams that help the user compare options visually.
- **Follow up with more AskUserQuestion calls** based on previous answers — adapt the next batch of questions to what the user chose.

### Starting the Conversation

First, determine the context:

1. **Check for `docs/project-tracking.json`** — if it exists, read it. Summarize the personas, epics, and stories relevant to the current scope. Use AskUserQuestion to confirm which version/stories to deep-dive.
2. **Check for an existing `docs/V{N}/specs/SPECS.md`** for the target version. If one exists, read it — you're in **update mode** for that version. Summarize what's already specified and then use AskUserQuestion to ask what the user wants to add or change. Only modify files under `docs/V{N}/`; never touch prior versions' directories.
3. **If neither exists**, you're in **create mode**. Ask the user to describe what they're building in a free-form message, then immediately follow up with structured AskUserQuestion calls to clarify.

After the user gives their initial description, start the structured interview using AskUserQuestion. Here's the recommended sequence of question batches:

#### Batch 1 — Big Picture (4 questions)

Use AskUserQuestion with these 4 questions:

1. **Header: "Users"** — "Who is the primary user of this app?"
   - Options: e.g., "Just me (personal tool)", "Small team (2-10 people)", "Public users (anyone can sign up)", "Enterprise (multi-tenant)"
2. **Header: "Auth"** — "How should users authenticate?"
   - Options: e.g., "No auth needed (single user)", "Email/password", "OAuth (Google, GitHub, etc.)", "Magic link"
3. **Header: "Platform"** — "What's the primary platform target?"
   - Options: e.g., "Web app (desktop-first)", "Web app (mobile-first)", "Both equally", "Native mobile app"
4. **Header: "Complexity"** — "How complex is this project?"
   - Options: e.g., "Simple (1-3 features, weekend project)", "Medium (4-8 features)", "Complex (9+ features, multiple user roles)", "Enterprise-grade"

#### Batch 2 — Tech Stack (up to 4 questions)

Use AskUserQuestion with questions tailored to what the user described:

1. **Header: "Frontend"** — "Which frontend framework?"
   - Options based on context: e.g., "Next.js (Recommended)", "Astro", "SvelteKit", "React SPA"
2. **Header: "Database"** — "Which database?"
   - Options: e.g., "SQLite (Recommended for simple apps)", "PostgreSQL", "DynamoDB", "MongoDB"
3. **Header: "Styling"** — "How should the UI be styled?"
   - Options: e.g., "Tailwind CSS (Recommended)", "CSS Modules", "Styled Components", "shadcn/ui + Tailwind"
4. **Header: "Hosting"** — "Where will this be deployed?"
   - Options: e.g., "Vercel (Recommended)", "AWS", "Cloudflare", "Self-hosted"

#### Batch 3+ — Feature-Specific Questions

Continue with AskUserQuestion for each major area from `references/discovery-checklist.md`. Adapt the questions and options based on what the user already told you. Examples:

- **Header: "Data model"** — "How should [entity] relate to [entity]?" with concrete relationship options
- **Header: "Error UX"** — "What happens when [operation] fails?" with options like "Show error toast", "Redirect to error page", "Retry automatically", "Show inline error"
- **Header: "Roles"** — "What user roles do you need?" with `multiSelect: true` and options like "Admin", "Editor", "Viewer", "Owner"
- **Header: "Edge cases"** — "What should happen when [boundary condition]?" with specific behavior options
- **Header: "UI states"** — "How should empty/loading states work?" with options like "Skeleton loaders", "Spinners", "Progressive loading", "Static placeholders"

### Probing for Clarity

After each batch of AskUserQuestion responses, analyze the answers and determine what needs further clarification. Read `references/discovery-checklist.md` for the full checklist of categories to probe — but don't mechanically walk through it. Instead, adapt your AskUserQuestion calls to what matters most based on previous answers.

**How to probe well with AskUserQuestion:**

- When a previous answer was vague or "Other" with unclear text, follow up with a more specific AskUserQuestion
- Use concrete "what happens when..." scenarios as question text, with specific behavior options
- When you need to confirm your understanding, use AskUserQuestion with options like "Yes, exactly", "Close, but needs adjustment", "No, let me explain"
- Use `preview` fields to show the user your interpretation (e.g., a data model sketch, a workflow outline) and let them confirm or correct

**Categories to cover** (see checklist for detailed questions):

- Core workflows and user journeys
- Business rules and validation
- User roles and permissions
- Error handling and edge cases
- UI/UX behavior and states
- API contracts and integrations
- Data model and state management
- Authentication and authorization
- Performance and scalability expectations
- Technology choices and constraints

### When to Stop Discovering

**CRITICAL: NEVER transition to spec generation on your own.** Even if you believe all topics are covered, you MUST explicitly ask the user for permission to move on. Use AskUserQuestion:

- **Header: "Next step"** — "Is there anything else you want to add, or any other area or workflow you want to explore before I write the spec?"
  - Options:
    - "Yes, I have more to add" — description: "I'll ask you about the area you want to explore"
    - "Let's explore more areas" — description: "I'll go through remaining discovery categories I haven't covered yet"
    - "Write the spec now (Recommended)" — description: "I have enough to produce a complete SPECS.md"
    - "Let me review what we discussed first" — description: "I'll summarize everything before proceeding"

If the user picks "Yes, I have more to add" or "Let's explore more areas", **loop back into discovery** — ask what area they want to dig into (using AskUserQuestion), then probe that area, then ask this same gate question again. Repeat until the user explicitly chooses to proceed to spec generation.

Don't over-discover. If the user is building a simple todo app, you don't need to probe about distributed systems. Match the depth of discovery to the complexity of the project. Fewer batches for simple projects, more for complex ones.

### Discovery for Updates

When updating an existing SPECS.md:

- Read the existing file completely
- Summarize what's already specified
- Use AskUserQuestion to ask what the user wants to change:
  - **Header: "Update"** — "What would you like to change in the spec?"
    - Options: "Add new feature", "Modify existing feature", "Remove a feature", "Update tech stack"
- Cross-reference new features against existing ones — flag potential conflicts or overlaps
- Probe the new features with the same rigor as new specs using AskUserQuestion, but skip areas already well-covered

---

## Phase 1.5: UI Specs (Delegated to `/ui-specs`)

**This phase triggers when the project involves any user-facing interface** (web app, dashboard, mobile app, etc.). Skip entirely for CLI tools, APIs, libraries, or backend-only services.

All UI design work — design system selection, mockup generation, per-screen specs — is owned by the dedicated **`/ui-specs`** skill. This skill **invokes** `/ui-specs` rather than reproducing the workflow.

### Detecting UI Involvement

After Phase 1 discovery, check: does the project have a frontend, web pages, dashboards, or any visual interface? If the user mentioned a framework like React, Next.js, Astro, Vue, or a styling choice like Tailwind — UI is involved. If unsure, ask with `AskUserQuestion`:

- **Header: "Has UI?"** — "Does this project include a user-facing interface (web pages, dashboard, mobile app)?"
  - Options: "Yes, it's primarily a UI app", "Yes, it has some UI", "No, it's backend/CLI only"

If the answer is no, skip to Phase 2. Otherwise, hand off to `/ui-specs`.

### Handoff to `/ui-specs`

Invoke the `ui-specs` skill via the `Skill` tool. Pass the context that's already been established here so `/ui-specs` doesn't re-ask questions you've already answered:

- **Target version** (V{N}) — already chosen at the top of this skill.
- **Project description** — the free-form one-paragraph summary the user gave during Phase 1.
- **UI feature list** — every feature surfaced during Phase 1 that has a user-facing component (pages, views, dashboards, modals, forms). It's fine if this is a partial list — `/ui-specs` will confirm with the user via `AskUserQuestion`.
- **Existing brand constraints** — any colors, fonts, logos, or aesthetic mandates the user mentioned during Phase 1 discovery.
- **Tech stack signals** — frontend framework, styling choice (Tailwind / CSS Modules / shadcn / etc.), so `/ui-specs` can apply design tokens in the right idiom.

`/ui-specs` will produce:

- `docs/V{N}/specs/DESIGN.md` — the design system in Google-Stitch / VoltAgent 9-section format
- `docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html` (+ `*-mobile.html`) — fully styled HTML mockups, one per UI screen, with default/loading/empty/error states stacked as labeled panels
- `docs/V{N}/specs/UI-F-NNN-screen-slug.md` — per-screen markdown specs (purpose, layout, component inventory, interactions, accessibility, responsive breakpoints) referencing the HTML mockups

When `/ui-specs` returns, it provides:

- The path to `DESIGN.md`
- The list of feature IDs that got mockups + screen specs
- Any features the user deferred (UI-flagged but no mockup yet)

Take that summary into Phase 2 — features without UI specs still appear in `SPECS.md` with their User Story and Rules; their `.feature` files don't reference mockups.

### What This Skill No Longer Does

The legacy Phase 1.5 workflow (Excalidraw wireframes, `UI-SPECS.md`, realtimecolors.com palette discovery as a built-in step, per-feature wireframe drawing) is entirely retired. `/ui-specs` owns all of it now, with a different shape: brand DESIGN.md catalog → fully-styled HTML mockups → per-screen markdown. Don't reproduce any of the old steps here.

---

## Phase 2: Spec Generation

Once discovery is complete, generate two outputs:

1. **SPECS.md** at `docs/V{N}/specs/SPECS.md` — the high-level overview for the target version. Read `references/specs-template.md` for the exact template.
2. **`docs/V{N}/specs/features/*.feature` files** — one per feature, with full Gherkin scenarios. Read `references/feature-file-template.md` for the format and conventions.

### Key Principles

**Each feature gets a unique ID** (F-001, F-002, ...). When updating, continue from the highest existing ID.

**User Stories express the WHY.** They're the 10,000-foot view:

```
As a [role]
I want to [action]
So that [benefit]
```

**Rules express the business constraints.** They're the 1,000-foot view — the conditions that govern behavior. Rules appear in BOTH SPECS.md (as a summary list) and the `.feature` file (as Gherkin `Rule:` blocks with full scenarios).

**Scenarios express the HOW through concrete examples.** They're ground level — specific inputs producing specific outputs. Scenarios live ONLY in the `docs/V{N}/specs/features/*.feature` files:

```gherkin
Given [precondition]
When [action]
Then [expected outcome]
```

**Write declarative, not imperative scenarios.** Describe _what_ happens, not _how_ the user clicks through the UI:

```gherkin
# Good — declarative, behavior-focused
Scenario: User with expired subscription cannot access premium content
  Given a user with an expired subscription
  When they navigate to premium content
  Then they should see the upgrade page

# Bad — imperative, UI-click-scripting
Scenario: User with expired subscription cannot access premium content
  Given the user is on the home page
  When they click the "Premium" link in the nav bar
  And the page loads
  And the system checks the subscription status in the database
  Then the system redirects to "/upgrade"
  And the page shows a yellow banner
```

**Cover the happy path AND the sad paths.** For each Rule, include at least:

- One scenario for the expected/successful case
- One scenario for the primary failure/rejection case
- Additional scenarios for important edge cases

### Generating the Outputs

1. Read `references/specs-template.md` for the SPECS.md structure
2. Read `references/feature-file-template.md` for the `.feature` file conventions
3. Create the `docs/V{N}/specs/features/` directory if it doesn't exist
4. For each feature (F-001, F-002, ...):
   a. Write the feature summary (User Story + Rules list) into SPECS.md
   b. Write the full `.feature` file with all Rules, Scenarios, and tags into `docs/V{N}/specs/features/`
5. Complete the remaining SPECS.md sections (NFRs, Glossary, Changelog)
6. Present the draft to the user **section by section** for complex projects (5+ features), or **as a whole** for simpler ones
7. Proceed to **Phase 3: Post-Generation Review**

### Feature File Naming Convention

Feature files are named using the feature ID and a kebab-case slug:

```
docs/V{N}/specs/features/
├── F-001-study-session.feature
├── F-002-spaced-repetition.feature
├── F-003-topic-organization.feature
└── ...
```

### Updating Existing Specs

When updating:

- Read the existing SPECS.md and all existing `docs/V{N}/specs/features/*.feature` files completely
- Preserve all existing content that isn't being modified
- Add new features with the next available ID — create both the SPECS.md entry AND the `.feature` file
- If modifying an existing feature, update it in place in both files
- Update the Table of Contents in SPECS.md
- Add any new glossary terms
- Note changes in the changelog section at the bottom
- After writing the updated files, proceed to **Phase 3: Post-Generation Review**

---

## Phase 3: Post-Generation Review

**CRITICAL: After writing SPECS.md, you MUST ask the user what they want to do next.** Never consider the job done after writing the file. Use AskUserQuestion:

- **Header: "Next step"** — "The spec has been written. What would you like to do?"
  - Options:
    - "Launch spec review agent (Recommended)" — description: "A separate Claude Opus agent will review the entire SPECS.md for completeness, coherence, and quality — and propose fixes"
    - "Accept the spec as-is" — description: "The spec is final, no further review needed"
    - "I want to add or rework parts" — description: "I'll tell you what to change, then we can review again"
    - "Start over with discovery" — description: "Go back to the interview phase from scratch"

### If the user picks "Launch spec review agent"

Spawn a **separate Claude Opus agent** (using the Agent tool with `model: "opus"`) to perform an end-to-end review of SPECS.md. The agent's prompt must instruct it to:

1. **Template compliance** — Verify both SPECS.md and `docs/V{N}/specs/features/*.feature` files follow their respective templates:
   - SPECS.md: All required sections present (Tech Stack, Features, NFRs, Glossary, Changelog)
   - SPECS.md: Feature IDs are sequential and unique (F-001, F-002, ...)
   - SPECS.md: Every feature has a complete User Story (As a / I want / So that)
   - SPECS.md: Each feature lists its Rules as a summary and references its `.feature` file
   - SPECS.md: Table of contents matches actual sections
   - SPECS.md: Non-functional requirements have measurable targets
   - `docs/V{N}/specs/features/*.feature` files: Valid Gherkin syntax parseable by Cucumber (Feature > Rule > Scenario > Given/When/Then)
   - `docs/V{N}/specs/features/*.feature` files: Proper tags (@F-001, @happy-path, @sad-path, etc.)
   - `docs/V{N}/specs/features/*.feature` files: Every feature in SPECS.md has a corresponding `.feature` file and vice versa
   - `docs/V{N}/specs/features/*.feature` files: File naming follows the convention (F-001-feature-slug.feature)

2. **Completeness** — Check for missed behaviors, incomplete workflows, and blind spots:
   - Every Rule has at least one happy-path AND one sad-path Scenario in its `.feature` file
   - Edge cases are covered (empty states, boundary values, concurrent access, error states)
   - All user workflows are complete from start to finish — no steps are skipped
   - Error handling is specified for every operation that can fail
   - Given/When/Then steps are concrete — no vague words like "appropriate", "properly", "correctly"
   - Rules listed in SPECS.md match the Rules in the corresponding `.feature` file
   - **If gaps are found**: the agent must propose specific new Scenarios or Rules to add, written in full Gherkin

3. **Coherence** — Check for contradictions and inconsistencies:
   - No contradictory Rules or Scenarios across `docs/V{N}/specs/features/*.feature` files (e.g., one feature says "users can delete their account" while another assumes the account always exists)
   - No duplicate Scenarios covering the same behavior in different `docs/V{N}/specs/features/*.feature` files
   - Business rules are consistent (e.g., permissions, validation rules, state transitions don't conflict)
   - Glossary terms are used consistently throughout SPECS.md and `docs/V{N}/specs/features/*.feature` files
   - SPECS.md feature summaries accurately reflect the detailed scenarios in their `docs/V{N}/specs/features/*.feature` files
   - **If contradictions are found**: the agent must flag each one and propose a resolution

The agent must return a structured review with:

- A **verdict**: PASS (no issues), MINOR (small gaps/suggestions), or MAJOR (significant gaps or contradictions)
- A list of **findings**, each with: location (feature ID + rule/scenario), issue description, and proposed fix (written as actual Gherkin or spec text)

**After the review agent completes**, present its findings to the user and use AskUserQuestion:

- **Header: "Review done"** — "The review agent found [N] issue(s). What would you like to do?"
  - Options:
    - "Apply all suggested fixes (Recommended)" — description: "I'll update SPECS.md with all the proposed changes"
    - "Let me pick which fixes to apply" — description: "I'll walk you through each finding and you decide"
    - "Ignore the review, keep the spec as-is" — description: "No changes will be made"
    - "Run the review again after changes" — description: "Apply fixes first, then re-run the review agent"

If the user picks "Let me pick which fixes to apply", present each finding one at a time using AskUserQuestion with options "Apply this fix", "Skip this one", "Modify this fix" (with preview showing the proposed change).

If the user picks "Run the review again after changes", apply the fixes, then re-launch the review agent. Repeat until the user is satisfied or the review returns PASS.

### If the user picks "I want to add or rework parts"

Ask what they want to change (using AskUserQuestion or free-form), make the changes to SPECS.md, then re-trigger this Phase 3 gate question again. Loop until the user accepts or launches the review agent.

---

## Writing Quality Checklist

Before finalizing the spec, verify:

**SPECS.md:**

- [ ] Every feature has a unique ID and a complete User Story (As a / I want / So that)
- [ ] Every feature lists its Rules as a summary and references the corresponding `.feature` file
- [ ] Tech stack section reflects actual technology choices discussed
- [ ] Non-functional requirements have measurable targets (not "the app should be fast" but "page load under 2s on 3G")
- [ ] Glossary defines every domain-specific term used in the scenarios
- [ ] Table of contents matches the actual sections

**Feature files (`docs/V{N}/specs/features/*.feature`):**

- [ ] One `.feature` file per feature, named `F-NNN-slug.feature`
- [ ] Valid Gherkin syntax — parseable by cucumber-js / Cucumber without modification
- [ ] Feature-level tag matches the feature ID (e.g., `@F-001`)
- [ ] Every Rule has at least one happy-path and one sad-path Scenario
- [ ] Scenarios use declarative language (behavior, not UI clicks)
- [ ] Given/When/Then steps are concrete — no vague words like "appropriate", "properly", "correctly"
- [ ] No duplicate or contradicting scenarios across feature files
- [ ] Scenarios are tagged appropriately (@happy-path, @sad-path, @edge-case)

---

## Example Output

Here's what the dual output looks like for a single feature:

### In SPECS.md — Feature summary (no scenarios):

```markdown
### F-003: Shopping Cart Management

> Feature file: [`docs/V{N}/specs/features/F-003-shopping-cart.feature`](docs/V{N}/specs/features/F-003-shopping-cart.feature)

Feature: Shopping cart management
As an online shopper
I want to manage items in my shopping cart
So that I can review and adjust my order before checkout

**Rules:**

- Items can be added to the cart from the product page
- Cart quantities can be adjusted between 1 and the available stock
- Removing an item clears it from the cart entirely
```

### In `docs/V{N}/specs/features/F-003-shopping-cart.feature` — Full Gherkin scenarios:

```gherkin
@F-003 @cart
Feature: Shopping cart management
  As an online shopper
  I want to manage items in my shopping cart
  So that I can review and adjust my order before checkout

  Rule: Items can be added to the cart from the product page

    @happy-path
    Scenario: Adding an in-stock item
      Given I am viewing a product that is in stock
      When I click "Add to Cart"
      Then the item should appear in my cart
      And the cart item count should increase by 1

    @sad-path
    Scenario: Adding an out-of-stock item
      Given I am viewing a product that is out of stock
      Then the "Add to Cart" button should be disabled
      And I should see "Out of Stock"

  Rule: Cart quantities can be adjusted between 1 and the available stock

    @happy-path
    Scenario: Increasing quantity within stock limits
      Given I have 1 unit of "Widget X" in my cart
      And "Widget X" has 5 units in stock
      When I increase the quantity to 3
      Then my cart should show 3 units of "Widget X"

    @sad-path @edge-case
    Scenario: Attempting to exceed stock
      Given I have 4 units of "Widget X" in my cart
      And "Widget X" has 5 units in stock
      When I try to increase the quantity to 6
      Then the quantity should remain at 5
      And I should see "Maximum available quantity reached"

  Rule: Removing an item clears it from the cart entirely

    @happy-path
    Scenario: Removing the only item in the cart
      Given I have 1 item in my cart
      When I remove that item
      Then the cart should be empty
      And I should see "Your cart is empty"
```
