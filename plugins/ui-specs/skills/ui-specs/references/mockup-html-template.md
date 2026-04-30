# HTML Mockup Conventions & Skeleton

Mockups produced by `/ui-specs` are **fully styled, self-contained HTML files** the user can open in a browser, screenshot via Playwright, and ship directly into the implementation phase as the visual ground truth. They are not low-fi wireframes — they apply the chosen DESIGN.md tokens (real colors, real fonts, real component styles) so the user agrees on layout AND look in one pass.

This document covers the conventions a generated mockup must follow and provides a starter skeleton.

---

## File location & naming

```
docs/V{N}/specs/mockups/
├── UI-F-NNN-screen-slug.html              # winner — desktop, all states stacked
├── UI-F-NNN-screen-slug-mobile.html       # winner — mobile reflow
├── UI-F-NNN-screen-slug-A.html            # variant scratch (deleted after pick)
├── UI-F-NNN-screen-slug-B.html
└── UI-F-NNN-screen-slug-C.html
```

- `screen-slug` is kebab-case, derived from the feature name (e.g. `project-list`, `create-account`, `settings-billing`).
- Variant suffixes `-A`, `-B`, `-C` exist only between Phase B step 1 and pick. After pick, only `-mobile` survives as a suffix.
- Additional state-overflow files: `UI-F-NNN-screen-slug-states.html` (only when the standard states + the 1-2 extras can't fit comfortably in a single mockup).

---

## Self-containment rules

The HTML must render correctly when opened directly via `file://` — no missing assets, no broken links.

**Rules:**

1. **All CSS inline** in a single `<style>` block in `<head>`. No external stylesheet links except for Google Fonts.
2. **All hex values inlined into CSS custom properties** at the top of the `<style>` block. Reference the DESIGN.md but paste the values — the file must work standalone.
3. **Google Fonts loaded via `<link>` only** (Google Fonts is the only allowed external dependency). Fonts must match the chosen DESIGN.md families.
4. **No external images** unless they're absolute URLs (e.g. `https://images.unsplash.com/…` for placeholder photography). Avoid where possible — use SVG icons inline or CSS-drawn shapes.
5. **No external JavaScript libraries.** Any interactivity (state toggles, modal opens) is plain inline `<script>` or `:hover`/`:focus` CSS.
6. **No build step.** A user double-clicks the file and it works.

---

## Top-of-file metadata

Every mockup starts with an HTML comment briefing a future reader (often a coding agent re-rendering or implementing the screen):

```html
<!--
  UI-F-NNN — [Screen Name]
  Feature: [F-NNN feature name]
  DESIGN.md: docs/V{N}/specs/DESIGN.md (section 9 / Agent Prompt Guide pasted below)

  > [Paste the DESIGN.md Agent Prompt Guide paragraph verbatim. This is the dense
  > one-paragraph briefing — archetype + atmosphere + tokens + motion personality +
  > "if in doubt, do X". A reader should be able to internalize the brand from this
  > comment alone.]

  Variants explored: A (sidebar+grid), B (top-nav+table), C (single-column-feed).
  Picked: A. Rationale: [one sentence].
-->
```

---

## States as stacked panels

A single HTML file shows all four standard states (Default / Loading / Empty / Error) by stacking them as labeled panels inside one document. This way one Playwright screenshot covers the whole picture.

**Pattern:**

```html
<body>
  <main class="mockup-page">
    <section class="state-panel" data-state="default">
      <h2 class="state-label">Default — populated</h2>
      <div class="screen">
        <!-- Full screen with realistic data -->
      </div>
    </section>

    <section class="state-panel" data-state="loading">
      <h2 class="state-label">Loading</h2>
      <div class="screen">
        <!-- Same screen with skeleton placeholders -->
      </div>
    </section>

    <section class="state-panel" data-state="empty">
      <h2 class="state-label">Empty</h2>
      <div class="screen">
        <!-- Same screen with empty-state illustration + CTA -->
      </div>
    </section>

    <section class="state-panel" data-state="error">
      <h2 class="state-label">Error</h2>
      <div class="screen">
        <!-- Same screen with inline alert banner -->
      </div>
    </section>
  </main>
</body>
```

**Conventions:**

- `.state-label` uses the DESIGN.md UI-label typography, sticky to the top of its panel, prefixed with the panel index (e.g., "1 — Default", "2 — Loading"). Helps the user reference panels by number when iterating.
- Each `.screen` is a standalone reproduction of the screen at that state — same width, same chrome, same nav. Don't compress.
- Add a thin `--border` rule between panels and `--sp-7` (48px) of vertical spacing.

---

## Realistic content rules

- **No lorem ipsum.** Use believable placeholder content from a domain that fits the project: real-sounding project names, dates within the last 30 days, plausible user names, currency in the project's likely currency.
- **No "Click here", "Lorem", "Sample", "Placeholder"** in user-facing text. Pretend it's production.
- **Empty state copy is real** — the actual copy that will ship. Same for error messages.
- **Numeric values** should be realistic ranges (e.g. "23 open tasks", not "999"; "$1,247.50", not "$0.00").
- **Avatars** can use initials inside `--bg-sunken` circles, or `https://i.pravatar.cc/100?u=<seed>` placeholders.
- **Photography** (only when needed): `https://images.unsplash.com/photo-<id>?w=800` — but prefer not to depend on it. Replace with CSS-painted gradient blocks where photography is decorative.

---

## Variant differentiation

Variants A / B / C should differ **structurally**, not cosmetically. Same DESIGN.md tokens applied identically — different layouts.

**Example axes for variant generation:**

- Sidebar nav vs. top nav vs. bottom tabs
- Card grid vs. table vs. feed list
- Single column vs. two column vs. three column
- Master-detail (split view) vs. drill-down (separate screens)
- Filters in a sidebar vs. filters in a top bar vs. filters in a modal
- Inline editing vs. modal editing vs. dedicated edit page
- Dense data table vs. spacious card grid for the same dataset

Pick 2-3 axes per screen; each variant adopts a different point on those axes. Don't generate variants that differ only by accent color or font weight — the user is comparing layout, not visuals.

---

## Mobile reflow rules

The mobile variant is a separate file; it is not a media query inside the desktop file. Reasons:

- Screenshots are taken at distinct viewport sizes, easier with separate files.
- The mobile variant often has structurally different navigation (bottom tabs vs. sidebar) — encoding this as a media query bloats the desktop file with unused markup.

**Mobile rules:**

- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Default container: 100vw, no fixed max-width.
- Sidebar / multi-column layouts collapse to single-column.
- Navigation becomes bottom-tab or hamburger.
- Touch targets ≥ 44×44px.
- All four states still stacked the same way as desktop.

---

## Skeleton starter

Below is a minimal skeleton ready to be filled. Replace `[…]` placeholders. Use the actual DESIGN.md token values pasted into `:root`.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UI-F-NNN — [Screen Name] Mockup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=[Display+Family]:wght@400;600;700&family=[Body+Family]:wght@400;500&display=swap">
  <style>
    :root {
      /* Paste from DESIGN.md §2. Values inlined; this file must be self-contained. */
      --bg: [#hex];
      --bg-elevated: [#hex];
      --bg-sunken: [#hex];
      --text: [#hex];
      --text-muted: [#hex];
      --text-inverse: [#hex];
      --border: [#hex];
      --border-strong: [#hex];
      --primary: [#hex];
      --primary-hover: [#hex];
      --secondary: [#hex];
      --accent: [#hex];
      --success: [#hex];
      --warning: [#hex];
      --error: [#hex];
      --info: [#hex];

      --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
      --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 16px;
      --radius-full: 9999px;

      --shadow-sm: 0 1px 2px rgba(0,0,0,.05);
      --shadow-md: 0 4px 8px rgba(0,0,0,.08);
      --shadow-lg: 0 12px 32px rgba(0,0,0,.12);

      --font-display: '[Display Family]', serif;
      --font-body: '[Body Family]', sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    }

    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.5;
    }

    /* Mockup chrome — labels and panel separation */
    .mockup-page { display: flex; flex-direction: column; gap: var(--sp-7); padding: var(--sp-6); }
    .state-panel { display: flex; flex-direction: column; gap: var(--sp-4); }
    .state-label {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin: 0;
      padding-bottom: var(--sp-2);
      border-bottom: 1px solid var(--border);
    }
    .screen {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      /* Real screen content goes inside */
    }

    /* Component styles — pulled from DESIGN.md §4 */
    /* […] */

  </style>
</head>
<body>
  <!--
    UI-F-NNN — [Screen Name]
    Feature: [F-NNN]
    DESIGN.md Agent Prompt Guide:
    > [paste the dense one-paragraph briefing here verbatim]
  -->
  <main class="mockup-page">

    <section class="state-panel" data-state="default">
      <h2 class="state-label">1 — Default (populated)</h2>
      <div class="screen">
        <!-- Full screen, real placeholder content -->
      </div>
    </section>

    <section class="state-panel" data-state="loading">
      <h2 class="state-label">2 — Loading</h2>
      <div class="screen">
        <!-- Same screen, skeleton placeholders -->
      </div>
    </section>

    <section class="state-panel" data-state="empty">
      <h2 class="state-label">3 — Empty</h2>
      <div class="screen">
        <!-- Same screen, empty-state illustration + CTA -->
      </div>
    </section>

    <section class="state-panel" data-state="error">
      <h2 class="state-label">4 — Error</h2>
      <div class="screen">
        <!-- Same screen, inline alert + retry -->
      </div>
    </section>

  </main>
</body>
</html>
```

---

## Playwright rendering

The skill renders mockups via the Playwright MCP. Standard sequence:

1. `browser_navigate` to `file:///<absolute-path-to-mockup>`.
2. `browser_resize` — desktop: `1440x900`, mobile: `390x844`.
3. `browser_take_screenshot` — full-page screenshot (the page is tall because of the stacked panels).

The screenshot lands in the conversation and the user reviews it directly. For variant comparison, render and screenshot all 2-3 variants before calling `AskUserQuestion`.

---

## Common pitfalls

- **Off-palette colors** — agents drift toward stock colors when generating. Always paste the DESIGN.md hex values into `:root`; never type a fresh `#3b82f6`.
- **Off-system fonts** — same drift. Always load the chosen Google Fonts via `<link>`. Don't fall back to system stacks for headings.
- **Lorem ipsum** — banned. Costs the user trust in the mockup.
- **Missing states** — all four panels mandatory. A screen "doesn't have an empty state" is rare; usually it's "first-time use" or "no results".
- **Cosmetic-only variants** — A and B differing by accent shade is not a variant comparison. The user gets confused. Variant axes must be structural.
- **Mobile not actually reflowed** — copy/pasting the desktop layout into the mobile file with no changes is a tell. Single-column, bottom-tab, condensed touch targets are mandatory.
- **External assets that don't load via `file://`** — broken `src` attributes, relative paths to nonexistent images. Test by opening the file directly before screenshotting.
