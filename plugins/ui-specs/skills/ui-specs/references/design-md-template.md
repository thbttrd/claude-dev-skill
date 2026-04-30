# DESIGN.md Template

The DESIGN.md format is the **Google-Stitch / VoltAgent awesome-design-md standard**: a plain-text design system document AI agents read to generate consistent UI. It has **9 fixed sections** in this exact order. Markdown signals — headings, bullets, bold, tables — carry the structure; LLMs parse this format more reliably than YAML, JSON, or any custom schema.

Use this file as the canonical structure when writing `docs/V{N}/specs/DESIGN.md`. The contents below are placeholders — replace bracketed text with project-specific values. Keep all 9 section headings intact.

---

```markdown
# [Project Name] — DESIGN.md

> Design system for [Project Name]. Drop this file into the project root or pass it to any AI coding agent (Claude Code, Codex, Cursor, Stitch) and the agent has everything it needs to generate consistent UI matching this visual identity.

**Source:** [Copied from `<brand>` via `npx getdesign add <brand>` | Tweaked from `<brand>` | Built from scratch | Provided by user]
**Last updated:** [YYYY-MM-DD]
**Status:** [Draft | In Review | Approved]

---

## 1. Visual Theme & Atmosphere

[2-4 sentence prose paragraph describing the overall feel of the interface — what mood it evokes, what visual archetype it sits in, what kind of product it suggests. Concrete and specific, not generic.]

**Examples of good atmosphere prose:**
- "Ultra-minimal precision tool. The interface fades away to let work breathe — generous whitespace, subtle dividers instead of hard borders, a single purple accent that appears only on action."
- "Dark cinematic console. Black canvas with low-contrast surfaces, monospace for technical values, neon-green for live data. The product feels alive but in control."

**Archetype:** [e.g., "Editorial — magazine-grade typography, restrained palette, confident hierarchy" / "Cockpit — data-dense, monospace, dark theme, no decoration" / "Storefront — full-bleed photography, large CTAs, warm palette"]

**Mood:** [Professional / Trustworthy / Warm / Playful / Premium / Brutalist / Calm / High-energy — pick 1-2]

---

## 2. Color Palette & Roles

Every color has a **role**. Roles are stable; the underlying hex values can be re-themed.

### Core palette

| Role | Token | Hex | Usage |
| --- | --- | --- | --- |
| Background — base | `--bg` | `#hex` | Page background, default surface |
| Background — elevated | `--bg-elevated` | `#hex` | Cards, modals, popovers |
| Background — sunken | `--bg-sunken` | `#hex` | Form inputs, code blocks, inset panels |
| Text — primary | `--text` | `#hex` | Body copy, headings |
| Text — muted | `--text-muted` | `#hex` | Captions, helper text, placeholders |
| Text — inverse | `--text-inverse` | `#hex` | Text on primary-colored backgrounds |
| Border — default | `--border` | `#hex` | Dividers, default borders |
| Border — strong | `--border-strong` | `#hex` | Emphasized borders, focus rings |
| Primary | `--primary` | `#hex` | CTAs, primary buttons, key accents, active states |
| Primary — hover | `--primary-hover` | `#hex` | Hover state for primary |
| Secondary | `--secondary` | `#hex` | Supporting buttons, info surfaces |
| Accent | `--accent` | `#hex` | Highlights, badges, links, notifications |

### Semantic palette

| Role | Token | Hex | Usage |
| --- | --- | --- | --- |
| Success | `--success` | `#hex` | Success toasts, checkmarks, positive deltas |
| Warning | `--warning` | `#hex` | Warning toasts, caution states |
| Error | `--error` | `#hex` | Errors, destructive actions, validation failures |
| Info | `--info` | `#hex` | Informational notices |

### Contrast verification

| Combination | Ratio | WCAG AA | WCAG AAA |
| --- | --- | --- | --- |
| `--text` on `--bg` | [X:1] | [Pass/Fail] | [Pass/Fail] |
| `--text-inverse` on `--primary` | [X:1] | [Pass/Fail] | [Pass/Fail] |
| `--text-muted` on `--bg` | [X:1] | [Pass/Fail] | [Pass/Fail] |
| `--text` on `--bg-elevated` | [X:1] | [Pass/Fail] | [Pass/Fail] |

[Verified via realtimecolors.com / coolors.co / a contrast checker. Note any combinations that fail and the project's stance on AA vs AAA.]

---

## 3. Typography Rules

| Role | Family | Weight | Size | Line height | Letter spacing | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| Display | [e.g. Playfair Display] | 700 | 56-72px | 1.05 | -0.02em | Hero headlines |
| H1 | [family] | 600 | 36-48px | 1.1 | -0.01em | Page titles |
| H2 | [family] | 600 | 28-32px | 1.15 | 0 | Section headings |
| H3 | [family] | 500 | 22-24px | 1.2 | 0 | Subsections, card titles |
| Body | [e.g. Cormorant Garamond] | 400 | 16-17px | 1.55 | 0 | Paragraphs |
| Body — small | [family] | 400 | 14px | 1.5 | 0 | Captions, helper text |
| UI label | [family] | 500 | 13-14px | 1.3 | 0.02em | Buttons, form labels, nav |
| Mono | [e.g. JetBrains Mono] | 400 | 14px | 1.5 | 0 | Code, technical values, IDs |

**Font sources:** [Google Fonts URL | self-hosted | system stack]
**Loading strategy:** `font-display: swap` recommended unless explicitly otherwise.

**Typographic personality:** [1-2 sentences. e.g., "Confident editorial — Playfair Display gives headlines weight and presence; Cormorant Garamond keeps body copy elegant and readable. Mono is reserved for IDs and timestamps where alignment matters."]

**Rules:**
- Never default to Arial / Helvetica / Roboto / Inter unless explicitly requested.
- Pair max 2 type families (display + body), optionally a third for monospace.
- All UI labels use the same family; weight + casing carry the hierarchy.

---

## 4. Component Stylings

### Buttons

| Variant | Background | Text | Border | Radius | Padding | Hover |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | `--primary` | `--text-inverse` | none | `--radius-md` | 12px 20px | `--primary-hover` |
| Secondary | transparent | `--primary` | 1px `--primary` | `--radius-md` | 12px 20px | bg `--primary` 8% |
| Ghost | transparent | `--text` | none | `--radius-md` | 8px 12px | bg `--bg-elevated` |
| Destructive | `--error` | `--text-inverse` | none | `--radius-md` | 12px 20px | filter darken 8% |
| Icon-only | transparent | `--text-muted` | none | `--radius-full` | 8px | bg `--bg-elevated`, color `--text` |

**Disabled state:** opacity 0.4, cursor not-allowed, no hover transform.
**Focus state:** 2px outline of `--primary` at 60% opacity, offset 2px.

### Inputs

- **Style:** [Filled with `--bg-sunken` | Outlined with `--border` | Underline only]
- **Radius:** `--radius-md`
- **Padding:** 12px 14px
- **Label position:** [Above input | Floating label | Inline]
- **Validation:** Inline error text below field in `--error`, red border on the input, optional icon prefix.
- **Focus:** Border becomes `--primary`, faint `--primary` glow at 20% opacity.

### Cards

- **Style:** `--bg-elevated` background, `--shadow-sm`, `--radius-md`, 16-24px internal padding.
- **Hover:** `--shadow-md`, `translateY(-1px)`, transition 150ms ease.
- **Header pattern:** [Icon + title left, action button right | Title + meta stacked | Cover image top + content below]

### Navigation

- **Type:** [Sidebar (left, 240px) | Top bar (sticky) | Bottom tabs (mobile-only) | Hybrid]
- **Active indicator:** [Left accent border | Underline | Filled background pill]
- **Items:** UI-label type, `--text-muted` default, `--text` on hover, `--primary` on active.

### Tables

- **Density:** [Compact 36px | Comfortable 48px | Spacious 56px row height]
- **Style:** [Striped | Bordered | Borderless with hover row highlight]
- **Headers:** UI-label type, uppercase, `--text-muted`, sticky on scroll.

### Modals & overlays

- **Modal:** centered, max-width 560px, `--bg-elevated`, `--radius-lg`, `--shadow-lg`, backdrop `rgba(0,0,0,0.5)` with optional blur.
- **Drawer:** slide from [right | bottom on mobile], width 420px desktop / 100% mobile.
- **Toast:** [bottom-right | top-center], `--bg-elevated`, colored left border per severity, auto-dismiss 5s.

### Feedback

- **Inline alert banners:** colored left border + tinted background per severity.
- **Loading:** [Skeleton blocks matching content shape | Spinner only for short waits | Progress bar for known-duration ops]
- **Empty state:** centered illustration + heading + body + primary CTA.

[Add or remove component patterns to fit the project. The list above is a baseline.]

---

## 5. Layout Principles

### Spacing scale

`--sp-1: 4px`, `--sp-2: 8px`, `--sp-3: 12px`, `--sp-4: 16px`, `--sp-5: 24px`, `--sp-6: 32px`, `--sp-7: 48px`, `--sp-8: 64px`, `--sp-9: 96px`

[A 4px or 8px base scale is recommended — pick one and stay consistent.]

### Containers & grid

- **Max content width:** [e.g. 1280px]
- **Side gutter (desktop):** [e.g. 32px]
- **Side gutter (mobile):** [e.g. 16px]
- **Grid:** [12 columns, 24px gutter | CSS grid with named areas | Flexbox stacks]

### Density

- **Information density:** [Spacious / Comfortable / Dense] — `[1-2 sentences explaining when each density is used and why.]`

### Composition rules

- [e.g. Cards align to a 12-col grid; pull-quotes break out into the gutter.]
- [e.g. Sidebars are 240px on desktop, collapse to a top hamburger menu under 1024px.]
- [e.g. Hero sections always full-bleed; content sections respect the 1280px max width.]

---

## 6. Depth & Elevation

| Token | Value | Usage |
| --- | --- | --- |
| `--shadow-none` | `none` | Flat surfaces — base background |
| `--shadow-sm` | `[0 1px 2px rgba(0,0,0,0.05)]` | Cards at rest, subtle lift |
| `--shadow-md` | `[0 4px 8px rgba(0,0,0,0.08)]` | Hovered cards, dropdowns, popovers |
| `--shadow-lg` | `[0 12px 32px rgba(0,0,0,0.12)]` | Modals, dialogs, drawers |
| `--shadow-glow` | `[0 0 0 4px rgba(<primary>,0.15)]` | Focus rings, active emphasis |

### Border radius

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-none` | 0 | Sharp / brutalist surfaces |
| `--radius-sm` | 4px | Chips, tags, badges |
| `--radius-md` | 8px | Buttons, inputs, cards |
| `--radius-lg` | 16px | Modals, large containers |
| `--radius-full` | 9999px | Avatars, pills, icon buttons |

**Elevation rules:**
- [e.g. Shadows never exceed `--shadow-lg`. No drop shadows on dark theme — use bordered surfaces and contrast instead.]
- [e.g. Hover lift = `translateY(-1px)` plus shadow step up. Always animate.]

---

## 7. Do's and Don'ts

### Do

- [e.g. Use whitespace generously — let content breathe before reaching for another card / divider.]
- [e.g. Apply `--primary` only to the primary action of a screen. Multiple primaries dilute meaning.]
- [e.g. Animate state changes with 150-200ms ease-out. Snap, don't drift.]
- [e.g. Use the mono family for IDs, timestamps, and data values where alignment matters.]

### Don't

- [e.g. Don't introduce new colors. Use the palette tokens or extend the palette explicitly.]
- [e.g. Don't use gradients or glow effects unless the brand explicitly calls for them.]
- [e.g. Don't mix more than two type families across a screen.]
- [e.g. Don't use rounded corners larger than `--radius-md` on small interactive elements — keep buttons feeling crisp.]
- [e.g. Don't use stock icon sets for destructive actions — use the brand-aligned set.]

---

## 8. Responsive Behavior

| Breakpoint | Width | Behavior |
| --- | --- | --- |
| Mobile | `< 640px` | Single column, hamburger or bottom-tab nav, stacked cards, touch targets ≥ 44×44px |
| Tablet | `640-1024px` | Two-column grids where space allows, collapsible sidebar, side gutter 24px |
| Desktop | `1024-1440px` | Full sidebar visible, multi-column content, side gutter 32px |
| Wide | `> 1440px` | Content max-width holds at 1280px (or chosen value); extra space becomes margin |

**Approach:** [Mobile-first | Desktop-first]
**Touch targets:** ≥ 44×44px on mobile.
**Reduced motion:** Respect `prefers-reduced-motion`. Animations fall back to instant transitions.
**Reduced data:** [Optional — describe lazy-loading / image-quality strategy.]

---

## 9. Agent Prompt Guide

> **Paste this paragraph into a coding agent prompt to brief it on the visual identity in one shot.**

[1 dense paragraph (4-8 sentences) covering: archetype + atmosphere, primary color and what it's used for, type pairing, signature shape language (rounded vs sharp, dense vs spacious), motion personality, the 1-2 things that define the brand visually, and a one-line "if in doubt, do X". Example:]

> "Linear-inspired ultra-minimal precision tool. Background `#0d0e10` with elevated surfaces at `#16181c`; the only chromatic accent is purple `#5e6ad2`, used exclusively on primary CTAs and active nav items. Type is Inter for everything, with weight + casing carrying hierarchy. Surfaces are sharp at `--radius-sm` (6px); shadows are minimal — depth comes from contrast, not blur. Motion is fast (120-180ms) and uses `cubic-bezier(0.2, 0, 0, 1)`. The interface should feel quiet at rest and instantly responsive on interaction. If in doubt, remove an element rather than add one."

---

## Changelog

| Date | Change | Sections affected |
| --- | --- | --- |
| [YYYY-MM-DD] | [Initial design system / swapped accent color / migrated from `<brand>` to `<other-brand>` / etc.] | [Section #s] |
```

---

## Template Usage Notes

- **All 9 section headings are mandatory** and must appear in this exact order. The names match the Google-Stitch / VoltAgent contract — agents look for them by heading.
- **Roles are stable, hex values are theme-able.** Always express component stylings in terms of `--primary`, `--bg-elevated`, etc., never raw hex inside the component sections — the palette in section 2 is the single source of hex truth.
- **Contrast verification is required.** Run `--text` on `--bg`, `--text-inverse` on `--primary`, and any other combination used on actual screens. WCAG AA minimum (4.5:1 normal text, 3:1 large text) is the floor.
- **The Agent Prompt Guide is the most-read section.** Make it dense and concrete. A coding agent that reads only this paragraph should still produce on-brand UI.
- **Don't over-customize the template.** Sticking to the standard structure is more valuable than tailoring the section list — that's the entire point of the format.
- **When copying from a brand DESIGN.md** (via `npx getdesign add <brand>`), preserve all 9 sections verbatim and only edit the project name + the Changelog. Token swaps come later in the Tweak path.
