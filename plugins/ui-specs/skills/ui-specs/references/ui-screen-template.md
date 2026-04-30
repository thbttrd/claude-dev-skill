# UI Screen Specification Template

Use this template for each feature that has a user-facing screen. One file per screen, saved at `docs/V{N}/specs/UI-F-NNN-screen-slug.md`. Replace bracketed text with project-specific content.

The HTML mockup at `docs/V{N}/specs/mockups/UI-F-NNN-screen-slug.html` is the **visual ground truth**. This markdown spec carries the rationale, the per-component token map, the interaction table, and the accessibility / responsive notes that the HTML alone can't express compactly.

---

```markdown
# UI-F-NNN: [Screen Name]

> Screen specification for **F-NNN: [Feature Name]**
>
> - Design system: [`DESIGN.md`](DESIGN.md)
> - Feature spec: [`SPECS.md`](SPECS.md#f-nnn-feature-name)
> - Feature file: [`features/F-NNN-feature-slug.feature`](features/F-NNN-feature-slug.feature)
> - Desktop mockup: [`mockups/UI-F-NNN-screen-slug.html`](mockups/UI-F-NNN-screen-slug.html)
> - Mobile mockup: [`mockups/UI-F-NNN-screen-slug-mobile.html`](mockups/UI-F-NNN-screen-slug-mobile.html)

**Last updated:** [YYYY-MM-DD]

---

## Screen Purpose

[1-2 sentences: What does the user accomplish on this screen? Which user story / persona does it serve? Anchor to the feature ID and the Gherkin scenarios it backs.]

---

## Layout — Desktop (≥ 1024px)

Open the desktop mockup: [`mockups/UI-F-NNN-screen-slug.html`](mockups/UI-F-NNN-screen-slug.html). The HTML stacks the **Default**, **Loading**, **Empty**, and **Error** states as labeled panels — each panel is the same screen in that state.

**Layout description:**

- [Spatial arrangement: e.g. "240px sidebar nav (left) + main content (right) with a 32px gutter. Main content is a 12-col grid."]
- [Key zones, top to bottom: e.g. "Page header with title + primary action; filter bar; results grid (3 columns); pagination footer."]
- [Design-token application: e.g. "`--bg` for page bg, `--bg-elevated` for cards, `--primary` only on the New Project CTA, `--accent` on the live status badge."]
- [Notable composition decisions: e.g. "The filter bar is sticky at the top of the scroll container. Results virtualize after 50 items."]

## Layout — Mobile (≤ 640px)

Open the mobile mockup: [`mockups/UI-F-NNN-screen-slug-mobile.html`](mockups/UI-F-NNN-screen-slug-mobile.html).

**Responsive changes:**

- [How the layout reflows: e.g. "Sidebar collapses to a top hamburger menu; results grid becomes a single column."]
- [Navigation transformation: e.g. "Bottom tab bar replaces the sidebar — Home / Search / Profile."]
- [What gets hidden or collapsed: e.g. "Filter bar collapses behind a 'Filter' button; meta info on cards is hidden until tap-to-expand."]
- [Touch-target adjustments: e.g. "All action buttons grow to 48px minimum; row tap area extends across the full card."]

---

## Component Inventory

Every component on this screen and how DESIGN.md tokens are applied. Use the role tokens from DESIGN.md section 2, never raw hex.

| Component | Tokens & treatments |
| --- | --- |
| [e.g. Page header] | `--bg`, `--text`, H1 typography, 32px top padding |
| [e.g. Project card] | `--bg-elevated`, `--shadow-sm`, `--radius-md`, body typography, 20px padding; hover → `--shadow-md`, translate-y -1px |
| [e.g. New Project button] | Primary button variant from DESIGN.md §4 |
| [e.g. Active status badge] | `--accent` bg, `--text-inverse`, UI-label typography, `--radius-full`, 4px 10px padding |
| [e.g. Filter chip] | `--bg-sunken` bg, `--text-muted`, UI-label, `--radius-full`; active → `--primary` bg, `--text-inverse` |
| [e.g. Empty state illustration] | Centered, 200px wide, monochrome with `--text-muted` strokes |

---

## Screen States

The HTML mockup shows all four states stacked. Document below what changes between them and any state-specific behavior the HTML can't express on its own.

### Default (populated)

[1-2 sentences confirming the populated view is the default and noting any data-driven variations: e.g. "Cards render the project name, last-updated timestamp, owner avatar, and open task count. The 'Active' badge appears only when the project has activity within the last 7 days."]

### Loading

[How loading is presented: e.g. "Skeleton card replicas matching the populated card shape; pulse animation; sidebar nav remains fully interactive. Loading state appears for ≥ 100ms — flicker-prevention threshold."]

### Empty

[Empty-state copy + CTA: e.g. "Centered illustration, heading 'No projects yet', body 'Create your first project to start tracking tasks.', primary CTA '+ Create Project'. The CTA opens the create-project modal (UI-F-005)."]

### Error

[Error-state behavior: e.g. "Inline alert banner at the top of the main content area: warning icon, 'We couldn't load your projects', 'Retry' button. The rest of the layout is hidden until retry succeeds. Error category-specific messaging — 401 → redirect to /login; 5xx → 'Try again in a moment'."]

[Add additional state sections (`### Onboarding overlay`, `### Permission denied`, `### Rate limited`, `### Conflict`) only if they exist on this screen.]

---

## Interactions

| Element | Trigger | Behavior |
| --- | --- | --- |
| [e.g. Project card] | Click | Navigate to project detail page (F-004) |
| [e.g. Project card] | Hover | `--shadow-md`, `translateY(-1px)`, cursor pointer, 150ms transition |
| [e.g. Project card] | Keyboard Enter | Same as click — equivalent activation |
| [e.g. + New button] | Click | Open create-project modal (UI-F-005) |
| [e.g. Filter chip] | Click | Toggle filter active state, refresh card list inline |
| [e.g. Avatar dropdown] | Click | Open menu: Profile, Settings, Logout |
| [e.g. Card list] | Scroll near bottom | Load next page (paginated 25 at a time) |
| [e.g. Empty state CTA] | Click | Same as + New button |

---

## Responsive Breakpoints

| Breakpoint | Behavior |
| --- | --- |
| `≥ 1280px` | [e.g. 3-column grid, full sidebar, 32px gutters] |
| `1024-1280px` | [e.g. 2-column grid, full sidebar, 24px gutters] |
| `640-1024px` | [e.g. 2-column grid, sidebar collapses to icon rail] |
| `< 640px` | [e.g. Single column, sidebar replaced by bottom-tab nav, sticky header collapses on scroll] |

---

## Accessibility Notes

- [Keyboard navigation: e.g. "Cards are focusable in DOM order; Enter activates the same path as click."]
- [ARIA: e.g. "Loading skeletons set `aria-busy='true'` on the parent grid; empty state heading is `<h2>` not `<h1>`."]
- [Labels: e.g. "+ New button has `aria-label='Create new project'` since the icon is decorative."]
- [Contrast: e.g. "All combinations on this screen verified against DESIGN.md §2 contrast table — `--text-muted` on `--bg-elevated` passes WCAG AA at 4.7:1."]
- [Motion: e.g. "Hover lift respects `prefers-reduced-motion: reduce` — falls back to instant shadow change with no translate."]
- [Screen reader: e.g. "Status badge has `role='status'` so updates announce automatically."]

---

## Related Screens

Outbound navigation from this screen.

| Destination | Trigger | Feature |
| --- | --- | --- |
| [e.g. Project Detail] | Click on project card | F-004 |
| [e.g. Create Project Modal] | Click + New / empty CTA | F-005 |
| [e.g. Settings] | Avatar → Settings | F-010 |
| [e.g. Login] | 401 error → redirect | F-001 |
```

---

## Template Usage Notes

- **One file per screen / view.** A feature with multiple distinct views (list + detail) gets two files: `UI-F-001-project-list.md` and `UI-F-001-project-detail.md`.
- **The HTML mockup is the visual ground truth** — implementing agents and developers should match what's rendered. This markdown spec carries the rationale and the things HTML can't compactly express (interaction tables, accessibility notes, responsive breakpoint changes, related screens).
- **Component inventory speaks in tokens, not hex.** A reader should be able to swap `DESIGN.md` (e.g., switch brand) and the inventory still parses.
- **All four standard states must be addressed** — default, loading, empty, error. If a state's HTML is just "show the populated layout but with a skeleton / error / empty placeholder", a written description in this spec is fine. Only call out additional state files when the visual layout is fundamentally different.
- **Interactions table is the keyboard / pointer / scroll behavior contract.** Test cases (Gherkin scenarios) reference this when checking UI behavior — keep it accurate.
- **Generated during Phase C** of the `/ui-specs` skill, after HTML mockups are accepted.
