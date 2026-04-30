---
name: ui-specs
version: 1.0.0
description: Produces a project's design system + UI mockups for a specific version V{N}. Outputs (a) docs/V{N}/specs/DESIGN.md following the Google-Stitch / VoltAgent awesome-design-md 9-section standard (Visual Theme & Atmosphere → Color Palette & Roles → Typography Rules → Component Stylings → Layout Principles → Depth & Elevation → Do's and Don'ts → Responsive Behavior → Agent Prompt Guide), (b) one fully-styled, self-contained HTML mockup per UI screen at docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html (plus mobile variant) showing default/loading/empty/error states stacked as labeled panels, and (c) a per-screen markdown spec at docs/V{N}/specs/UI-F-NNN-screen-slug.md referencing the HTML mockup. Drives the design system through three branches the user picks from — copy a brand DESIGN.md from the VoltAgent awesome-design-md catalog (via `npx getdesign@latest add <brand>`), start from one and tweak it, or build from scratch via realtimecolors.com aesthetic discovery. For each UI feature, proposes 2-3 HTML mockup variants side-by-side (rendered + screenshotted via Playwright MCP for in-terminal review), the user picks one, then iterates to acceptance. Use this skill whenever the user wants to define a design system, write UI specs, generate mockups, pick brand colors/fonts, draw screen layouts, or says "design system", "DESIGN.md", "ui specs", "mockups", "wireframes", "/ui-specs". Auto-invoked by /spec-writing whenever a project has a user-facing interface (web app, dashboard, mobile app); replaces the older Excalidraw-based wireframe flow. Also triggers when the user wants to update an existing design system, swap brand inspiration, redo screen mockups, or add UI for a new feature in an already-specified version.
---

# UI Specs Skill

Produces three complementary outputs — **scoped to a specific version V{N}** — that together define how an application looks and feels:

1. **`docs/V{N}/specs/DESIGN.md`** — The design system, in the standardized **Google-Stitch / VoltAgent** 9-section format. This is the agent-readable single source of truth for visual identity (colors, typography, spacing, components, motion, responsive rules, do's & don'ts, agent prompt guide).
2. **`docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html`** (+ `*-mobile.html`) — One fully-styled, self-contained HTML mockup per UI screen, applying the chosen DESIGN.md tokens directly so the user sees the finished visual feel. Each file stacks the default / loading / empty / error states as labeled panels so a single screenshot covers everything.
3. **`docs/V{N}/specs/UI-F-NNN-screen-slug.md`** — One markdown spec per UI screen — purpose, layout description, component inventory, state behaviors, interactions, accessibility notes — referencing the HTML mockup as the visual reference.

The HTML mockups are pixel-precise enough to act as the implementation target (Claude-Artifact-style fully-rendered preview). The DESIGN.md gives downstream coding agents the design tokens they need to keep new screens consistent.

This skill works in four phases: **Setup** (target version, mode, context gathering), **Phase A: DESIGN.md** (pick a path — copy, tweak, or from-scratch — and produce the file), **Phase B: HTML mockups** (2-3 variants per screen, pick + iterate), **Phase C: Per-screen specs** (markdown). Phase D is a final handoff to `/spec-writing` (if invoked from there) or to the user (standalone).

## When This Skill Runs

- **Auto-invoked by `/spec-writing`** during its UI Discovery step whenever a project has a UI. Spec-writing passes the target version, the project description, and the list of features identified during functional discovery as context.
- **Standalone via `/ui-specs`** when the user wants to define / regenerate / extend the design system or the screen mockups for an already-existing project (with or without prior `SPECS.md`).
- **Auto-trigger on ambient phrasing** like "design system", "DESIGN.md", "draft mockups", "pick a color palette", "swap brand inspiration", "redo the dashboard mockup".

---

## Target Version & Documentation Layout

**All artifacts this skill produces live inside `docs/V{N}/specs/`** — same convention as `/spec-writing`. The relevant subset of the layout:

```
docs/V{N}/specs/
├── DESIGN.md                                  # design system (9-section standard)
├── UI-F-NNN-screen-slug.md                    # one per UI screen
└── mockups/
    ├── UI-F-NNN-screen-slug.html              # desktop, all states stacked
    ├── UI-F-NNN-screen-slug-mobile.html       # mobile reflow
    └── UI-F-NNN-screen-slug-A.html …          # variant scratch files (deleted after pick)
```

**Version snapshot rule (CRITICAL):** For any V{N} with N ≥ 1, before this skill writes a single file, ensure `docs/V{N}/` exists by **duplicating `docs/V{N-1}/` verbatim** (entire directory). V0 is the only version seeded from scratch. Same rule as `/spec-writing` — do not reinvent.

**Determining the target version:**

- If invoked from `/spec-writing`, the caller passes the version explicitly.
- If invoked standalone with an arg (e.g., `/ui-specs V1`), parse it.
- Otherwise read `docs/project-tracking.json` to list versions and use `AskUserQuestion` to pick one.

---

## Setup: Mode Detection & Context

Before any UI work, determine three things:

1. **Mode** — create vs. update:
   - If `docs/V{N}/specs/DESIGN.md` already exists, you're in **update mode**. Read it, summarize it, and use `AskUserQuestion` to ask what to change (swap brand inspiration, adjust tokens, add a new screen, redo a mockup, …).
   - Otherwise you're in **create mode**.

2. **Feature scope** — which features have a UI screen:
   - If invoked from `/spec-writing`, the caller passes a list of UI feature IDs/names.
   - Otherwise read `docs/V{N}/specs/SPECS.md` (and `features/*.feature`) to enumerate features. Use `AskUserQuestion` (multiSelect) to confirm which are UI features.
   - If no `SPECS.md` exists yet, ask the user to describe UI screens free-form, then confirm a list with `AskUserQuestion`.

3. **Existing brand constraints** — colors / fonts / logo already locked in:
   - `AskUserQuestion`: "Are there existing brand colors, fonts, or a logo we must respect?"
   - Options: "Yes — I'll provide them" / "No — greenfield, you choose" / "Some — I'll mention them as we go"
   - If yes, capture the constraints before Phase A so they steer the catalog filter / scratch flow.

### Always Use `AskUserQuestion`

Every interactive question goes through `AskUserQuestion` — never plain text. Same rules as `/spec-writing`:

- Up to 4 questions per call, batched.
- Concrete options always (2-4); the TUI auto-adds "Other".
- `multiSelect: true` for non-mutually-exclusive choices (e.g., "Which screens have UI?").
- Short `header` (max 12 chars).
- Recommended option first, suffixed with "(Recommended)".
- `description` explains trade-offs.
- `preview` carries concrete artifacts (color swatches, layout sketches, brand snapshots).

---

## Phase A: DESIGN.md

The user picks one of four paths. Each produces `docs/V{N}/specs/DESIGN.md` in the standardized 9-section format. Read `references/design-md-template.md` for the exact structure to write.

### A.0 — Source Decision

`AskUserQuestion`:

- **Header: "Design source"** — "How do you want to source the visual design system?"
  - "Copy a brand DESIGN.md from the catalog (Recommended)" — description: "Pick from 69+ curated DESIGN.md files (Linear, Stripe, Vercel, Notion, …) installed via `npx getdesign add <brand>`."
  - "Start from a brand DESIGN.md and tweak" — description: "Pick a starting point and adjust colors, fonts, or component styles to fit."
  - "Build from scratch" — description: "Aesthetic discovery from zero — palette via realtimecolors.com, font pairings, component patterns."
  - "I already have a DESIGN.md" — description: "I'll provide the path; we'll copy it in and skip to mockups."

### A.1 — Copy Path

1. Fetch the live catalog from `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/README.md` via `WebFetch`. Parse the categorized brand list (AI & LLM Platforms, Developer Tools & IDEs, Backend / DB / DevOps, Productivity & SaaS, Design & Creative, Fintech & Crypto, E-commerce & Retail, Media & Consumer, Automotive). The README has the canonical descriptors — keep them attached to each brand for the option labels.
2. **Filter by aesthetic** — first ask the user the "aesthetic feel" they're after using `AskUserQuestion` (Clean & minimal / Bold & dark / Editorial / Playful / Brutalist / Other). Use the answer to pre-rank suggestions inside categories. The descriptors in the README ("ultra-minimal, precise, purple accent" — Linear, "premium dark UI, keyboard-first" — Superhuman, etc.) make this trivial.
3. **Category pick** — `AskUserQuestion` with up to 4 categories at a time, paginating through all 9. The categories themselves get short labels.
4. **Brand pick** — within the chosen category, present brands 4 at a time, each option's `description` carrying the README descriptor (e.g., "Linear — ultra-minimal, precise, purple accent"). Where useful, set `preview` to a fenced markdown block with that brand's signature palette colors and aesthetic notes.
5. **Preview** — once a brand is selected, navigate to `https://getdesign.md/<brand>/design-md` via Playwright MCP (`browser_navigate`), take a screenshot (`browser_take_screenshot`), and confirm with `AskUserQuestion`: "This is the inspiration. Lock it in?" — Yes (Recommended) / Tweak it / Try a different brand.
6. **Install** — run `npx getdesign@latest add <brand-slug>` in the project root via `Bash`. The CLI creates `DESIGN.md` at the working directory. **Move it** to `docs/V{N}/specs/DESIGN.md`. Validate the 9 sections are present (do a quick `grep` for each section heading); if any are missing or the file looks malformed, fall back to fetching from `https://getdesign.md/<brand>/design-md.md` via `WebFetch`. If both fail, drop into the Tweak path with the user.
7. **Customize project metadata** — open the freshly copied DESIGN.md and edit only the project-name / description header so it identifies the user's project, not the brand. Leave all visual decisions intact.

### A.2 — Tweak Path

Same as A.1 steps 1-6. After installation, run a tweak loop:

- `AskUserQuestion`: "What do you want to change in the base DESIGN.md?" — multiSelect — "Primary color", "Secondary/accent color", "Body font", "Heading font", "Border radius / sharpness", "Shadows / elevation", "Component density", "Tone of voice (Do's & Don'ts)", "Other".
- For each picked dimension, run a focused micro-flow (e.g., for primary color → propose 3 alternatives via `realtimecolors.com` screenshots → pick → patch the DESIGN.md token).
- After all changes, re-render the agent prompt guide section to reflect the new identity.
- Update `Last updated`, append a Changelog entry.

### A.3 — From Scratch Path

Run aesthetic discovery from zero. This is the only path that uses the `realtimecolors.com` flow.

1. **Aesthetic & mood** — `AskUserQuestion` batch (Aesthetic / Mood / Inspiration / Light or Dark) — same questions as the legacy `/spec-writing` Phase 1.5 step 1.
2. **Palette discovery** — propose 2-3 palettes, build URLs of the form `https://www.realtimecolors.com/?colors=TEXT-BG-PRIMARY-SECONDARY-ACCENT&fonts=Heading-Body`, navigate via Playwright MCP, screenshot each, and present with `AskUserQuestion` (`preview` field carrying hex values). Verify WCAG AA contrast against the realtimecolors indicators.
3. **Font pairing** — propose 2-3 pairings appropriate to the aesthetic. Re-screenshot realtimecolors.com with chosen fonts.
4. **Tokens** — synthesize spacing scale (4px base recommended), border radii, shadow tokens. Confirm the full token set with one final `AskUserQuestion` showing the consolidated `preview`.
5. **Components & layout** — short `AskUserQuestion` batch covering navigation type, button style, input style, card style, table density, modal vs. drawer.
6. **Write `DESIGN.md`** — assemble the 9 sections from the discovered values using `references/design-md-template.md`. Render the `Agent Prompt Guide` section so a coding agent has a one-paragraph "how to keep the UI consistent" briefing.

### A.4 — User-Provided Path

If the user has an existing DESIGN.md, ask for the path, read it, validate it has the 9 sections (or close enough), and copy it to `docs/V{N}/specs/DESIGN.md`. If sections are missing, offer to fill the gaps interactively or accept partial — the user decides.

### Confirm DESIGN.md Before Mockups

`AskUserQuestion` once the file is written:

- **Header: "DESIGN.md ok?"** — "Lock the design system in and move to mockups?"
  - "Yes, on to mockups (Recommended)" / "Show me the file before I commit" / "Make further tweaks first"

Loop on tweaks until the user confirms. Do not start Phase B before they do.

---

## Phase B: HTML Mockups

For each UI feature identified in Setup, produce 2-3 mockup variants, pick one, iterate to acceptance, then add a mobile variant. Read `references/mockup-html-template.md` for the HTML / CSS conventions.

### B.0 — Loop Over Features

Process one feature at a time. The order can be:

- The feature ID order from `SPECS.md` (default).
- Or — if the project has a clear hub screen (dashboard, home) — start there since other screens often link back to it.

### B.1 — Variants

For each feature:

1. **Generate 2-3 distinct layout variants** as separate self-contained HTML files at `docs/V{N}/specs/mockups/UI-F-NNN-screen-slug-A.html`, `-B.html`, `-C.html`. Each file:
   - Has a single `<style>` block at the top with CSS custom properties pulled from `DESIGN.md` (paste the actual hex values, not `var(--…)`-references-to-elsewhere — the file must be self-contained for Playwright to render correctly).
   - Loads the chosen Google Fonts via `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=…">`.
   - Imports the `Agent Prompt Guide` paragraph as an HTML comment at the top (so an agent reading the file later understands the brief).
   - Renders **all four screen states** (Default / Loading / Empty / Error) as labeled panels stacked vertically inside one document, each panel introduced by an `<h2 class="state-label">` so a single screenshot captures them all.
   - Uses real-feeling placeholder content — names, dates, numeric values from a believable domain — never lorem ipsum.
   - Includes the chosen navigation, primary CTAs, and any forms referenced in the feature spec.
   - Variant differences should be **structural** (sidebar vs. top-nav, single column vs. two-column, cards vs. table, etc.), not cosmetic — colors and fonts stay identical so the user is comparing layout.

2. **Render + screenshot each variant** via Playwright MCP:
   - `browser_navigate` to `file:///<absolute-path>` for each `.html`.
   - `browser_resize` to 1440x900 for desktop.
   - `browser_take_screenshot` — save into the conversation so the user sees them.

3. **Present the variants** via `AskUserQuestion`:
   - **Header: "[Feature] UI"** — e.g., "Dashboard UI"
   - One option per variant. Each option's `description` summarizes the structural choice (e.g., "A — Sidebar nav + 2-column card grid + sticky filter bar").
   - Each option's `preview` carries a one-liner cheat sheet of the layout's key dimensions.
   - Final option: "None — describe what you want instead".

### B.2 — Iterate

Once a variant is picked:

1. **Delete the rejected variants** (`UI-F-NNN-screen-slug-A.html` etc., except the chosen one which gets renamed).
2. **Rename the winner** to `docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html`.
3. **Iteration loop** — `AskUserQuestion`:
   - "Does this layout need any adjustments?"
   - "Yes, I'll describe changes" / "Looks good, keep going" / "Show another variant set"
4. If the user describes changes, edit the HTML in place, re-screenshot, re-confirm. Repeat until they say "looks good".
5. If the user picks "Show another variant set", regenerate 2-3 new variants and loop.

### B.3 — Mobile Variant

Once desktop is locked:

1. **Generate `UI-F-NNN-screen-slug-mobile.html`** — same content, same DESIGN.md tokens, reflowed for `<= 640px`:
   - Single column layout.
   - Hamburger menu or bottom-tab navigation as appropriate.
   - Touch targets ≥ 44×44px.
   - States stacked the same way (Default / Loading / Empty / Error).
2. **Render + screenshot** — `browser_resize` to 390x844 (iPhone-ish), screenshot.
3. **Confirm or iterate** with the user.

### B.4 — State Edge Cases

If a screen has states beyond the standard four (e.g., "first-time user onboarding overlay", "permission denied", "rate-limited", "concurrent edit conflict"), add them as additional labeled panels. Do not split into separate files unless the screen has so many states that one document becomes unreadable — in which case create `UI-F-NNN-screen-slug-states.html` for the extras.

---

## Phase C: Per-Screen Markdown Specs

Once mockups are accepted for every UI feature, generate one markdown spec per screen at `docs/V{N}/specs/UI-F-NNN-screen-slug.md`. Read `references/ui-screen-template.md` for the exact structure.

Each file contains:

- **Header** linking to the corresponding `.feature` file, the DESIGN.md, and the HTML mockup.
- **Screen purpose** (1-2 sentences tying it to the user story).
- **Layout (Desktop)** — embed the `.html` mockup link + a written layout description (spatial arrangement, key zones, design-token application).
- **Layout (Mobile)** — same for the mobile variant.
- **Component inventory** — table of components on the screen with their token mapping (e.g., "Project card → `--background-elevated` bg, `--shadow-sm`, `--radius-md`, body font").
- **Screen states** — written summary of each state panel in the HTML mockup; only include a separate visual asset if a state needs a fundamentally different layout.
- **Interactions** — table of element / trigger / behavior.
- **Responsive breakpoints** — table of breakpoint / key changes.
- **Accessibility notes** — keyboard nav, ARIA labels, contrast, motion preferences.
- **Related screens** — outbound nav with feature IDs.

These markdown specs are what implementing agents read alongside the `.feature` file. The HTML mockup is the visual ground truth; the markdown gives the rationale and the per-component token map.

---

## Phase D: Handoff

### When invoked from `/spec-writing`

Return control to the caller with a summary:

- DESIGN.md path
- List of feature IDs that got mockups + per-screen specs
- Any features that were flagged as UI but the user chose to defer (so spec-writing knows to mention them in `SPECS.md` without mockups)

### When invoked standalone

Use `AskUserQuestion`:

- **Header: "Next step"** — "UI specs are in. What now?"
  - "Done — the design system and screens are locked"
  - "Add mockups for another feature"
  - "Tweak the DESIGN.md and re-render mockups"
  - "Run a review pass on DESIGN.md + mockups"

If the user picks the review option, spawn a separate Opus agent (Agent tool, `model: "opus"`) to audit:

- DESIGN.md has all 9 sections, no placeholder text, no contradictions with the chosen brand.
- Every UI feature in `SPECS.md` has matching mockup + screen spec; orphaned mockups (no matching feature) are flagged.
- HTML mockups are valid, self-contained, and apply the DESIGN.md tokens consistently (no off-palette colors, no off-system fonts).
- Per-screen markdown specs reference real `.html` files that exist on disk.
- Mobile variants exist for every desktop mockup.

---

## Integration with `project-tracking.json`

After Phase C, update `docs/project-tracking.json` (read-merge-write, never overwrite):

- Add a `ui` field to each user story whose feature has a UI screen:
  ```json
  "ui": {
    "screen_spec": "docs/V{N}/specs/UI-F-NNN-screen-slug.md",
    "mockup_desktop": "docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html",
    "mockup_mobile": "docs/V{N}/specs/mockups/UI-F-NNN-screen-slug-mobile.html",
    "ui_specified_at": "[date]"
  }
  ```
- Add a `design_system` block to the version's roadmap entry:
  ```json
  "design_system": {
    "design_md": "docs/V{N}/specs/DESIGN.md",
    "source": "copy:linear" | "tweak:stripe" | "scratch" | "user-provided",
    "ui_specified_at": "[date]"
  }
  ```
- Update `project.updated_at`.
- NEVER delete or overwrite fields owned by other skills.

If `project-tracking.json` doesn't exist, skip silently — the user is operating outside the standard workflow and that's fine.

---

## Tools You'll Use

| Tool | Purpose |
| --- | --- |
| `AskUserQuestion` | Every interactive prompt |
| `WebFetch` | Pull the VoltAgent README catalog; fall back to `getdesign.md/<brand>/design-md.md` if `npx` fails |
| `Bash` | Run `npx getdesign@latest add <brand>` for the copy/tweak paths; move/rename mockup files; copy version dirs (`cp -R`) |
| Playwright MCP (`browser_navigate`, `browser_resize`, `browser_take_screenshot`) | Render HTML mockups + realtimecolors.com previews and surface screenshots into the conversation |
| `Read` / `Write` / `Edit` | All file I/O |
| `Agent` (Opus) | Optional Phase D review pass |

The Excalidraw MCP is **not** used by this skill — the legacy wireframe flow is fully retired.

---

## Quality Checklist

Before declaring the version done:

**DESIGN.md:**
- [ ] All 9 sections present with non-placeholder content
- [ ] Color palette has hex values and clearly labeled roles (background / surface / text / primary / secondary / accent / semantic)
- [ ] Typography defines display / heading / body / mono families with sources (Google Fonts URL or self-hosted note)
- [ ] Contrast verified to WCAG AA at minimum
- [ ] Component stylings cover at least nav, button (primary/secondary/destructive/ghost), input, card, modal, table, toast
- [ ] Layout principles document spacing scale, container widths, grid
- [ ] Depth & elevation tokens specified (shadow scale)
- [ ] Do's and Don'ts populated with project-specific guidance, not generic
- [ ] Responsive behavior breakpoints listed with reflow rules
- [ ] Agent Prompt Guide reads as a tight one-paragraph briefing a coding agent can paste into a prompt

**HTML mockups:**
- [ ] One `.html` per UI feature plus matching `*-mobile.html`
- [ ] Self-contained — opens correctly via `file://` with no missing assets
- [ ] All four states stacked as labeled panels
- [ ] Tokens pulled from DESIGN.md — no off-palette colors, no off-system fonts
- [ ] Believable placeholder content, no lorem ipsum
- [ ] Mobile reflow tested at 390×844 viewport

**Per-screen specs:**
- [ ] One `.md` per UI feature
- [ ] Links to the `.feature` file, DESIGN.md, and `.html` mockup all resolve
- [ ] Component inventory maps each visible component to DESIGN.md tokens
- [ ] All four states described (visual or written)
- [ ] Interactions table populated
- [ ] Accessibility notes specific to the screen, not generic

**`project-tracking.json` (if present):**
- [ ] Per-story `ui` blocks added
- [ ] Version-level `design_system` block added
- [ ] `project.updated_at` bumped

---

## Failure Modes & Escape Hatches

- **`npx getdesign add <brand>` fails** (no Node.js, network issue, brand removed) → fall back to `WebFetch` against `https://getdesign.md/<brand>/design-md.md`. If that 404s too, switch to the Tweak path with the user picking another brand.
- **Playwright MCP unavailable** → still write the HTML files, but skip the screenshot step. Tell the user the file paths and ask them to open them in a browser to compare. Use `AskUserQuestion` to capture their pick.
- **realtimecolors.com unreachable** → propose palettes inline as fenced color blocks in the `AskUserQuestion` `preview` field; skip the URL preview step.
- **User changes their mind about the source path mid-flow** → save the partial state under a clear name (`DESIGN.md.draft-1`, etc.) and start the new path fresh. Don't lose work.
- **Mockups balloon past 1500 lines** — split into `UI-F-NNN-screen-slug-states.html` for non-default states, keep the main file focused on the populated state.
