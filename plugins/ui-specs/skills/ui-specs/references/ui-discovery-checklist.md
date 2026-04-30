# UI Discovery Checklist

Use this as a reference when working through Phase A (DESIGN.md) and Phase B (mockups). It's the catalog of questions that should be answered (sometimes implicitly via the chosen brand DESIGN.md, sometimes explicitly via `AskUserQuestion`) before the design system + mockups are locked in. Don't walk through it mechanically — let the conversation lead and use this to make sure you haven't skipped anything important.

---

## 1. Aesthetic & Mood

- What is the overall visual archetype? (editorial, cockpit, storefront, brutalist, playful, premium)
- What mood should the interface convey? (professional, friendly, energetic, calm, premium, bold)
- Are there existing brand guidelines, logos, or colors to respect?
- Any reference sites or apps whose look is aspirational? (drives the catalog filter)
- Light mode, dark mode, or both with a toggle?

## 2. Color Palette

- Are there mandated brand colors or is this greenfield?
- What emotion should the primary color evoke? (trust = blue, energy = red/orange, growth = green, luxury = black/gold, technical = monochrome)
- How saturated should the palette be? (muted neutrals, vibrant accents, bold throughout)
- Accessibility floor: WCAG AA (default) or AAA?
- Are there brand-restricted colors (must use, must not use)?

## 3. Typography

- Is there a mandated font, an existing brand font, or a free choice?
- Serif (classic / editorial), sans-serif (modern / clean), or monospace (technical / developer-first)?
- Is a paid foundry font ok or restricted to free options (Google Fonts)?
- Display font and body font — same family or pairing?
- Special use cases — code blocks, IDs, currency values needing a mono family?

## 4. Layout & Density

- Sidebar nav, top nav, bottom tabs — which suits the primary device?
- Information density: dashboard-dense or editorial-spacious?
- Card-based, list-based, or table-based content presentation as the dominant pattern?
- How many levels of navigation hierarchy?
- Hero / marketing surfaces full-bleed, or always max-width?

## 5. Component Patterns

- Forms: single-page or multi-step wizard?
- Tables with sorting, filtering, pagination, virtualization?
- Modals vs. slide-over panels vs. inline expansion for secondary flows?
- Charts or visualizations (line, bar, pie, sparkline)? Custom-rendered or chart library?
- Toast positioning + duration?
- Empty states: illustration + CTA, or text only?

## 6. Motion & Personality

- How animated should the interface feel? (none / subtle / lively)
- Does the brand have a motion personality? (snap & precise, smooth & calm, expressive & elastic)
- Reduced motion support: required (default) or extended?
- Hover lift / scale / glow on interactive elements?

## 7. Responsive Targets

- Primary device: desktop, mobile, both equally?
- Mobile-first or desktop-first build?
- Tablet treatment: distinct layout or just "large mobile"?
- Wide screens (>1440px): max-width or full-bleed content?

## 8. UI Feature Inventory

- Which features from `SPECS.md` have a UI screen? (multiSelect — every feature gets a yes/no UI flag)
- Are there shared layout shells (e.g. "all logged-in screens use the same sidebar nav")?
- Are there feature-specific UI patterns not covered by the standard component set? (data viz, calendar, map, drag-and-drop, rich text editor)
- Modals / drawers / overlays that span multiple features?

## 9. Edge Cases & States

- Loading: skeleton, spinner, progressive, blocking overlay?
- Empty: first-use, no-results, archived?
- Error: inline alert, full-page, modal — by category?
- Permission denied / 401 / 403: redirect or in-place message?
- Rate limited / 429: surface to the user or retry transparently?
- Concurrent edit conflict: last-write-wins, merge UI, lock UI?
- Offline / disconnected: degraded mode, queue, blocking?
- First-time-user onboarding overlay: required, dismissable, repeatable?

## 10. Accessibility

- Keyboard navigation: required end-to-end?
- Screen reader support: required, scope?
- Reduced motion: required (default yes)?
- Reduced data / high-contrast modes: required?
- Internationalization: RTL support, character set, font subsetting?

---

## How to Use This Checklist

1. **Most of this is answered by the source path.** The Copy path inherits answers from the brand DESIGN.md for sections 1-7. The Tweak path layers the user's adjustments on top. The From-Scratch path requires explicit answers for sections 1-7.
2. **Sections 8-10 are always asked**, regardless of source path — they're project-specific, not brand-derived.
3. **Skip what's not relevant.** A pure CLI-with-tiny-config-UI doesn't need section 5 (Charts/visualizations).
4. **Batch related questions** — sections 1-2 are one batch ("Aesthetic & Color"), sections 3-4 are another ("Typography & Layout"), sections 5-6 are another ("Components & Motion"). Section 8 is its own batch (multiSelect on UI feature inventory). Sections 9-10 fold into per-screen discovery during Phase B.
5. **When the user gives a vague answer, push for specifics.** "Make it modern" → "Modern as in Linear (ultra-minimal, geometric sans, dark) or modern as in Stripe (gradient purples, generous whitespace, weight-300 elegance)?"
6. **The brand DESIGN.md catalog is the fastest disambiguator** — when an aesthetic question is hard to answer in the abstract, jump to the catalog and let the user pick a starting point.
