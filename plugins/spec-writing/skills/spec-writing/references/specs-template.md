# SPECS.md Template

Use this exact structure when generating a new SPECS.md. Replace bracketed placeholders with actual content. Remove any sections that don't apply, but preserve the ordering.

This is the **high-level overview document** for a specific version V{N}. It lives at `docs/V{N}/specs/SPECS.md`. Full Gherkin scenarios live in the sibling `docs/V{N}/specs/features/*.feature` files — see `feature-file-template.md` for that format. Each version has its own frozen copy of this file; later versions are seeded by duplicating the prior version's `docs/V{N-1}/` directory.

---

```markdown
# [Project Name] — Specifications

> [One-paragraph description of what this application does, who it's for, and the core problem it solves.]

**Last updated:** [date]
**Status:** [Draft | In Review | Approved]

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
  - [F-001: Feature Name](#f-001-feature-name)
  - [F-002: Feature Name](#f-002-feature-name)
- [Non-Functional Requirements](#non-functional-requirements)
- [Glossary](#glossary)
- [Changelog](#changelog)

---

## Tech Stack

| Layer       | Technology                 | Rationale         |
| ----------- | -------------------------- | ----------------- |
| Frontend    | [e.g. React 19]            | [why this choice] |
| Backend     | [e.g. Node + Express]      | [why this choice] |
| Database    | [e.g. PostgreSQL]          | [why this choice] |
| Auth        | [e.g. Clerk]               | [why this choice] |
| Hosting     | [e.g. Vercel]              | [why this choice] |
| Testing     | [e.g. Vitest + Playwright] | [why this choice] |
| CSS/Styling | [e.g. Tailwind]            | [why this choice] |

[Add or remove rows as needed. Only include layers that are relevant.]

---

## Features

### F-001: [Feature Name]

> Feature file: [`docs/V{N}/specs/features/F-001-feature-slug.feature`](docs/V{N}/specs/features/F-001-feature-slug.feature)

Feature: [Feature name in natural language]
As a [role]
I want to [action]
So that [benefit]

**Rules:**

- [Business rule 1 — brief description]
- [Business rule 2 — brief description]
- [Business rule 3 — brief description]

---

### F-002: [Feature Name]

> Feature file: [`docs/V{N}/specs/features/F-002-feature-slug.feature`](docs/V{N}/specs/features/F-002-feature-slug.feature)

[Same structure as above]

---

## UI & Design System

> **Full design system:** [`docs/V{N}/specs/UI-SPECS.md`](docs/V{N}/specs/UI-SPECS.md)
> **Screen layouts:** `docs/V{N}/specs/UI-F-NNN-*.md` (one per UI feature)

[If this project has a user interface, reference the UI specification documents above. The design system (colors, fonts, spacing, component patterns) is defined in UI-SPECS.md. Individual screen layouts with ASCII mockups are in the per-feature UI files.]

[Remove this entire section if the project has no UI.]

---

## Non-Functional Requirements

### Performance

- [e.g. Page load time under 2s on 3G connections]
- [e.g. API response time under 200ms for 95th percentile]
- [e.g. Support 1000 concurrent users]

### Security

- [e.g. All API endpoints require authentication except /public/*]
- [e.g. User passwords hashed with bcrypt (cost factor 12)]
- [e.g. CSRF protection on all state-changing requests]

### Accessibility

- [e.g. WCAG 2.1 AA compliance]
- [e.g. Full keyboard navigation support]
- [e.g. Screen reader compatible with ARIA labels]

### Reliability

- [e.g. 99.9% uptime target]
- [e.g. Graceful degradation when third-party services are unavailable]

### Data

- [e.g. Daily automated backups with 30-day retention]
- [e.g. GDPR compliance — user data exportable and deletable on request]

### Browser / Device Support

- [e.g. Last 2 versions of Chrome, Firefox, Safari, Edge]
- [e.g. Responsive design: mobile (320px+), tablet (768px+), desktop (1024px+)]

[Remove categories that don't apply. Add project-specific categories as needed.]

---

## Glossary

| Term          | Definition                                          |
| ------------- | --------------------------------------------------- |
| [Domain term] | [Clear, concise definition as used in this project] |
| [Domain term] | [Clear, concise definition as used in this project] |

---

## Changelog

| Date   | Change                | Features Affected |
| ------ | --------------------- | ----------------- |
| [date] | Initial specification | All               |
```

---

## Template Usage Notes

- **Feature IDs** are sequential (F-001, F-002, ...). When updating, always continue from the highest existing ID. Never reuse a deleted feature's ID.
- **Each feature summary includes**: the User Story (As a / I want / So that), a bullet list of Rules, and a link to its `.feature` file.
- **Scenarios do NOT appear in SPECS.md** — they live exclusively in the `.feature` files. This avoids duplication and keeps SPECS.md concise and scannable.
- **The Rules list in SPECS.md** should match the `Rule:` blocks in the corresponding `.feature` file. They serve as a human-readable table of contents for the feature's behavior.
- **Non-functional requirements must be measurable.** "Fast" is not a requirement. "Under 200ms p95" is.
- **The glossary should define terms the way this project uses them**, even if the term has a common meaning.
- **Changelog** tracks specification changes, not code changes.
