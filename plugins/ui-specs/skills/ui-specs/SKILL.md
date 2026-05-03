---
name: ui-specs
version: 2.0.0
description: Produces a project's design system + per-story UI mockups and screen specs. The design system (`specs/DESIGN.md` — Google-Stitch / VoltAgent 9-section format) is project-wide and re-runnable; the mockups and screen specs are per-story under `specs/story-NNN-slug/{mockups,ui}/`. Drives the design system through three branches the user picks from — copy a brand DESIGN.md from the VoltAgent awesome-design-md catalog (`npx getdesign@latest add <brand>`), start from one and tweak it, or build from scratch via realtimecolors.com aesthetic discovery. For each UI story, proposes 2-3 HTML mockup variants side-by-side (rendered + screenshotted via Playwright MCP), the user picks one, then iterates to acceptance. Use this skill whenever the user wants to define a design system, write UI specs, generate mockups, pick brand colors/fonts, draw screen layouts, or says "design system", "DESIGN.md", "ui specs", "mockups", "wireframes", "/ui-specs". Auto-invoked by `/spec-writing US-NNN` whenever a story has a user-facing screen. Triggers also when the user wants to tweak the project-wide DESIGN.md, swap brand inspiration, or redo the screens for an existing story.
---

# UI Specs Skill (story-based)

Produces three complementary outputs:

1. **`specs/DESIGN.md`** — The project-wide design system, in the standardised Google-Stitch / VoltAgent 9-section format. Created once per project; re-runnable to change brand inspiration or tweak tokens. There is no version-pinned copy.
2. **`specs/story-NNN-slug/mockups/UI-F-NNN-screen-slug.html`** (+ `*-mobile.html`) — One fully-styled, self-contained HTML mockup per UI screen, with default / loading / empty / error states stacked as labeled panels.
3. **`specs/story-NNN-slug/ui/UI-F-NNN-screen-slug.md`** — One markdown spec per UI screen referencing the mockup as visual ground truth.

The HTML mockups are pixel-precise enough to act as the implementation target. The DESIGN.md gives downstream coding agents the design tokens they need to keep new screens consistent.

The skill operates in two modes:

- **Project-wide mode** (`/ui-specs --design-system`, or auto-detected when `specs/DESIGN.md` doesn't exist): runs Phase A (DESIGN.md) only.
- **Per-story mode** (`/ui-specs US-NNN`): runs Phase B (mockups) + Phase C (per-screen specs) for the chosen story. If `specs/DESIGN.md` doesn't exist yet, runs Phase A first, then proceeds.

---

## Pre-Flight

| Check                                       | Action                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                 | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist         | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| `specs/DESIGN.md` exists + per-story arg    | Skip Phase A; go straight to Phase B for the target story.                                                                                      |
| `specs/DESIGN.md` does not exist            | Run Phase A first regardless of mode.                                                                                                           |

---

## When This Skill Runs

- **Auto-invoked by `/spec-writing US-NNN`** during its UI sub-phase whenever a story has a UI screen. The caller passes `US-NNN` so this skill operates only on that story's directory.
- **Standalone via `/ui-specs US-NNN`** — work on one story's screens.
- **Standalone via `/ui-specs --design-system`** — work on the project-wide DESIGN.md only.
- **Auto-trigger on ambient phrasing** like "design system", "DESIGN.md", "draft mockups", "pick a color palette", "swap brand inspiration", "redo the dashboard mockup".

---

## Setup: Mode Detection & Context

Before any UI work:

1. **Determine target story.**
   - If `--design-system` was passed, no story is targeted; the skill runs Phase A only.
   - If a story id was passed (`/ui-specs US-NNN`), validate it in `specs/stories.json`. If `is_foundation: true`, ask whether the foundation story actually has UI (most don't — health endpoint only). If no UI, exit with an explanation.
   - If neither was passed, ask the user via `AskUserQuestion`: "Project-wide DESIGN.md only" / "Story US-NNN screens" (with options drawn from stories whose `phase ∈ {scoped, specced, planned}`).
2. **Mode: create vs. update.**
   - If `specs/DESIGN.md` exists, the project-wide design system is already in place. Phase A is **update mode** if invoked; otherwise skipped.
   - If `specs/story-NNN-slug/mockups/` already has `UI-F-*.html` files, you're in **per-story update mode** — read the existing mockups, summarise, ask what to change.
3. **Existing brand constraints** — colours, fonts, logo already locked in:
   - `AskUserQuestion`: "Are there existing brand colors, fonts, or a logo we must respect?" (Phase A only.)
4. **Feature scope (per-story mode).** Read the story's `STORY.md` and `.feature` files to enumerate screens. Use `AskUserQuestion` (multiSelect) to confirm which screens to mock.

### Always Use `AskUserQuestion`

Every interactive question goes through `AskUserQuestion` — never plain text. Same rules as the legacy skill: batched, concrete options, multiSelect, short headers, recommended option first, descriptions, previews.

---

## Phase A: Project-Wide `specs/DESIGN.md`

Runs once per project (re-runnable when the user wants to change brand inspiration or tweak tokens). The user picks one of four paths. Each produces `specs/DESIGN.md` in the standardised 9-section format. Read `references/design-md-template.md` for the exact structure.

### A.0 — Source Decision

`AskUserQuestion`:

- **Header: "Design source"** — "How do you want to source the visual design system?"
  - "Copy a brand DESIGN.md from the catalog (Recommended)" — Pick from 69+ curated DESIGN.md files installed via `npx getdesign add <brand>`.
  - "Start from a brand DESIGN.md and tweak"
  - "Build from scratch" — Aesthetic discovery via realtimecolors.com.
  - "I already have a DESIGN.md"

### A.1 — Copy Path

(Same as the legacy skill: fetch the VoltAgent README catalog, ask aesthetic, pick category and brand, screenshot via Playwright MCP, run `npx getdesign@latest add <brand-slug>`, **move the generated file to `specs/DESIGN.md`**, validate the 9 sections. Fall back to `WebFetch` against `https://getdesign.md/<brand>/design-md.md` if `npx` fails.)

After installation, edit only the project-name / description header so the file identifies the user's project, not the brand. Leave all visual decisions intact.

### A.2 — Tweak Path

Same as A.1 steps 1-6. After installation, run a tweak loop via `AskUserQuestion` (primary colour, secondary/accent, body font, heading font, border radius, shadows, component density, tone of voice, …). For each picked dimension, run a focused micro-flow (e.g., for primary colour → propose 3 alternatives via realtimecolors.com screenshots → pick → patch DESIGN.md).

### A.3 — From Scratch Path

Aesthetic discovery from zero. Aesthetic & mood (`AskUserQuestion`) → palette discovery via realtimecolors.com (Playwright MCP screenshots) → font pairing → tokens (spacing, radii, shadows) → components & layout → write `specs/DESIGN.md` from `references/design-md-template.md`. The Agent Prompt Guide (Section 9) is rendered last from the discovered values.

### A.4 — User-Provided Path

Ask for the path, read it, validate it has the 9 sections, copy it to `specs/DESIGN.md`. If sections are missing, offer to fill the gaps interactively or accept partial.

### Confirm `specs/DESIGN.md` Before Mockups

`AskUserQuestion`: "Lock the design system in and move to mockups?" — Yes / Show me the file / Make further tweaks. Loop on tweaks until confirmed.

### Update Mode (re-runs)

When `specs/DESIGN.md` already exists, you're in update mode. Ask whether to:
- Tweak tokens in place (no source change),
- Swap brand inspiration (re-runs A.1 from a new brand),
- Rebuild from scratch (re-runs A.3).

The file is rewritten in place — no version-pinned copy. Append a Changelog entry inside `DESIGN.md` summarising the change.

---

## Phase B: HTML Mockups (per story)

For each UI screen identified in Setup, produce 2-3 mockup variants, pick one, iterate to acceptance, then add a mobile variant. Read `references/mockup-html-template.md` for the HTML / CSS conventions.

### B.0 — Loop Over the Story's Screens

Process one screen at a time. The order can be:
- The order screens appear in the story's `.feature` files.
- Or — if the story has a clear hub screen — start there.

### B.1 — Variants

For each screen:

1. **Generate 2-3 distinct layout variants** as separate self-contained HTML files at `specs/story-NNN-slug/mockups/UI-F-NNN-screen-slug-A.html`, `-B.html`, `-C.html`. Each file follows `references/mockup-html-template.md`:
   - Single `<style>` block with CSS custom properties pulled from `specs/DESIGN.md` (paste the actual hex values — the file must be self-contained for Playwright to render correctly).
   - Google Fonts loaded via `<link>`.
   - The DESIGN.md Agent Prompt Guide pasted at the top as an HTML comment.
   - All four states (Default / Loading / Empty / Error) as labeled panels stacked vertically.
   - Real-feeling placeholder content (no lorem ipsum).
   - Variants differ structurally (sidebar vs. top-nav, single column vs. two-column, cards vs. table) — colours and fonts stay identical.

2. **Render + screenshot each variant** via Playwright MCP: navigate to `file:///<absolute-path>`, resize to 1440x900, take a screenshot.

3. **Present the variants** via `AskUserQuestion` with one option per variant + "None — describe what you want instead".

### B.2 — Iterate

Once a variant is picked: delete the rejected variants, rename the winner to `specs/story-NNN-slug/mockups/UI-F-NNN-screen-slug.html`. Loop on adjustments via `AskUserQuestion` until the user says "looks good".

### B.3 — Mobile Variant

Generate `UI-F-NNN-screen-slug-mobile.html` — same content, same DESIGN.md tokens, reflowed for `<= 640px`. Render at 390x844, screenshot, confirm/iterate.

### B.4 — State Edge Cases

If a screen has states beyond the standard four, add them as additional labeled panels. Split into `UI-F-NNN-screen-slug-states.html` only if a single document becomes unreadable.

---

## Phase C: Per-Screen Markdown Specs (per story)

Once mockups are accepted for every UI screen of the story, generate one markdown spec per screen at `specs/story-NNN-slug/ui/UI-F-NNN-screen-slug.md`. Read `references/ui-screen-template.md` for the exact structure.

Each file contains:

- Header linking to the corresponding `.feature` file, the project-wide `specs/DESIGN.md`, and the HTML mockup
- Screen purpose (1-2 sentences tying to the User Story)
- Layout (Desktop) — embed the HTML mockup link + written layout description
- Layout (Mobile) — same for the mobile variant
- Component inventory — table of components on the screen with their token mapping
- Screen states — written summary of each state panel
- Interactions — table of element / trigger / behavior
- Responsive breakpoints — table of breakpoint / key changes
- Accessibility notes — keyboard nav, ARIA labels, contrast, motion preferences
- Related screens — outbound nav with story / feature ids

These markdown specs are what implementing agents read alongside the `.feature` file.

---

## Phase D: Handoff

### When invoked from `/spec-writing`

Return control to the caller with a summary:

- DESIGN.md path (if Phase A ran)
- List of screen ids that got mockups + per-screen specs
- Any screens the user deferred (UI-flagged but no mockup yet)

### When invoked standalone

`AskUserQuestion`:

- **Header: "Next step"** — "UI specs are in. What now?"
  - "Done — the design system and screens are locked"
  - "Add mockups for another story"
  - "Tweak the DESIGN.md and re-render mockups"
  - "Run a review pass on DESIGN.md + mockups"

If the user picks the review option, spawn a separate Opus agent to audit:

- DESIGN.md has all 9 sections, no placeholder text, no contradictions
- Every UI screen referenced in stories has matching mockup + screen spec; orphaned mockups (no matching story) are flagged
- HTML mockups are valid, self-contained, and apply DESIGN.md tokens consistently
- Per-screen markdown specs reference real `.html` files that exist on disk
- Mobile variants exist for every desktop mockup

---

## Integration with `specs/stories.json`

After Phase C, update `specs/stories.json` (read-merge-write, never overwrite):

- Add a `ui` block to the target story:

  ```json
  "ui": {
    "screen_specs": ["specs/story-NNN-slug/ui/UI-F-NNN-screen.md"],
    "mockups_desktop": ["specs/story-NNN-slug/mockups/UI-F-NNN-screen.html"],
    "mockups_mobile": ["specs/story-NNN-slug/mockups/UI-F-NNN-screen-mobile.html"],
    "specified_at": "<today>"
  }
  ```

- Mirror the paths in `stories[i].artifacts.mockups[]` and `stories[i].artifacts.ui_specs[]`.
- After Phase A (project-wide DESIGN.md), add a project-level `design_system` block:

  ```json
  "design_system": {
    "design_md": "specs/DESIGN.md",
    "source": "copy:linear" | "tweak:stripe" | "scratch" | "user-provided",
    "specified_at": "<today>"
  }
  ```

- Update `project.updated_at`.
- NEVER delete or overwrite fields owned by other skills.

---

## Tools You'll Use

| Tool | Purpose |
| --- | --- |
| `AskUserQuestion` | Every interactive prompt |
| `WebFetch` | Pull the VoltAgent README catalog; fall back to `getdesign.md/<brand>/design-md.md` |
| `Bash` | Run `npx getdesign@latest add <brand>`; move/rename mockup files |
| Playwright MCP (`browser_navigate`, `browser_resize`, `browser_take_screenshot`) | Render HTML mockups + realtimecolors.com previews |
| `Read` / `Write` / `Edit` | All file I/O |
| `Agent` (Opus) | Optional Phase D review pass |

---

## Quality Checklist

Before declaring the skill done:

**`specs/DESIGN.md` (project-wide):**
- [ ] All 9 sections present with non-placeholder content
- [ ] Color palette has hex values and clearly labeled roles
- [ ] Typography defines display / heading / body / mono families with sources
- [ ] Contrast verified to WCAG AA at minimum
- [ ] Component stylings cover at least nav, button, input, card, modal, table, toast
- [ ] Layout principles document spacing scale, container widths, grid
- [ ] Depth & elevation tokens specified
- [ ] Do's and Don'ts populated with project-specific guidance
- [ ] Responsive behavior breakpoints listed
- [ ] Agent Prompt Guide reads as a tight one-paragraph briefing

**HTML mockups (per story):**
- [ ] One `.html` per UI screen plus matching `*-mobile.html`
- [ ] Self-contained — opens correctly via `file://`
- [ ] All four states stacked as labeled panels
- [ ] Tokens pulled from `specs/DESIGN.md` — no off-palette colors, no off-system fonts
- [ ] Believable placeholder content, no lorem ipsum
- [ ] Mobile reflow tested at 390×844 viewport

**Per-screen specs (per story):**
- [ ] One `.md` per UI screen
- [ ] Links to the `.feature` file, `specs/DESIGN.md`, and `.html` mockup all resolve
- [ ] Component inventory maps each component to DESIGN.md tokens
- [ ] All four states described
- [ ] Interactions table populated
- [ ] Accessibility notes specific to the screen, not generic

**`specs/stories.json`:**
- [ ] Per-story `ui` block added
- [ ] `design_system` project-level block added (Phase A)
- [ ] `project.updated_at` bumped

---

## Failure Modes & Escape Hatches

- **`npx getdesign add <brand>` fails** → fall back to `WebFetch` against `https://getdesign.md/<brand>/design-md.md`. If 404s, switch to the Tweak path.
- **Playwright MCP unavailable** → still write the HTML files, skip screenshots. Tell the user the file paths and ask them to open them manually.
- **realtimecolors.com unreachable** → propose palettes inline as fenced color blocks in the AskUserQuestion `preview`; skip the URL preview step.
- **User changes their mind about the source path mid-flow** → save the partial state (`DESIGN.md.draft-1`, etc.) and start the new path fresh. Don't lose work.
- **Mockups balloon past 1500 lines** — split into `UI-F-NNN-screen-slug-states.html`.
