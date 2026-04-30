# Plan Template

Plans are dry — they contain zero code. They describe _what_ to build and _what to test_,
referencing Gherkin scenarios as the behavioral specification. The implementing agent
reads the plan and the .feature file to write the actual code.

## File Location

Plans are organized inside each version's own directory under `docs/V{N}/plans/`:

```
docs/
├── project-tracking.json
├── V0/
│   ├── specs/                      # V0 specs (separate skill)
│   ├── architecture/               # V0 architecture (separate skill)
│   └── plans/                      # <-- this skill writes here
│       ├── 00-foundation.md
│       ├── DAG.md
│       ├── implementation-state.json
│       ├── W1-auth-golden-path.md
│       ├── W2-dashboard-and-stats.md
│       └── W3-settings-and-edge-cases.md
├── V1/
│   └── plans/
│       ├── 00-foundation.md
│       ├── DAG.md
│       ├── W1-...
│       └── ...
```

V{N+1}'s `plans/` directory is **not** automatically created — it is populated fresh when `/plan-writing` is next invoked for V{N+1}. The prior version's plans are preserved frozen in `docs/V{N}/plans/` as a historical record.

## Wave Plan Template

```markdown
# Wave N: [Vertical Slice Name]

**Version:** VN
**Wave:** N of M
**User stories:** US-001, US-003, US-007
**Architecture modules:** [BM + Infra-Modules involved]
**UI screen specs:** `docs/V{N}/specs/UI-F-NNN-slug.md`, wireframes in `docs/V{N}/specs/wireframes/`
**Depends on:** Wave N-1 (all tasks must be complete)
**Estimated tasks:** N
**What becomes testable:** [1-2 sentences: after this wave, the user can do X end-to-end]

---

## Context

[What this wave delivers. Which user stories it implements. Why this grouping makes
sense as a vertical slice. What end-to-end flows the user can exercise after this wave.]

## Architecture Notes

[Which modules this wave touches. Key constraints from ARCHITECTURE.md. How this wave's
code fits into the existing structure from previous waves.]

## Prerequisites

[What must be in place from previous waves. List specific APIs/services/types that
this wave's tasks will call from Wave 0..N-1.]

---

## Tasks

### Task 1: [Short descriptive name]

**Story:** US-NNN — [story title]
**Module:** [Module from ARCHITECTURE.md]
**What:** [One sentence deliverable]

**Scenarios covered:**

- "[Scenario name from .feature file]"
- "[Another scenario name]"

**UI spec:** [Reference to wireframe PNG + UI-F-*.md section, or "N/A"]

**RED-A — BDD Step Definitions (write first):**

- Create/update step file: `e2e/steps/<feature>.steps.ts`
- Bind these Given/When/Then patterns:
  - `Given [pattern]` → [describe what the binding does]
  - `When [pattern]` → [describe the action call]
  - `Then [pattern]` → [describe the assertion]
- Run BDD tests → expect FAILURE (implementation doesn't exist yet)
- Commit: `test(<scope>): add BDD steps for [scenario]`

**RED-B — Unit/Integration Tests (write second):**

- Create test file: `src/modules/<module>/<file>.test.ts`
- Test type: [sociable unit with fakes | integration with real DB | overlapping unit]
- Assert these behaviors:
  - [behavior 1 from scenario Given/When/Then]
  - [behavior 2]
- Fakes needed: [list which interfaces need fake implementations]
- Run tests → expect FAILURE
- Commit: `test(<scope>): add failing test for [scenario]`

**GREEN — Implementation (write third):**

- Create/modify: `src/modules/<module>/<file>.ts`
- This [component/service/route] does: [description]
- Connects to: [which existing APIs/services it calls]
- UI: [reference wireframe + design tokens, or N/A]
- Run full test suite → ALL must pass (including BDD + unit)
- Commit: `feat(<scope>): implement [what]`

**REFACTOR (if needed):**

- [What to clean up, or "None expected"]
- Commit: `refactor(<scope>): [what]`

**Verify:** `[exact test command]`

---

### Task 2: [Short descriptive name]

[Same structure]

---

## Parallel Execution Within This Wave

[Which tasks/stories are independent and can be dispatched to separate agents]

| Agent   | Tasks     | Stories |
| ------- | --------- | ------- |
| Agent A | Tasks 1-3 | US-001  |
| Agent B | Tasks 4-5 | US-003  |

---

## Wave N Verification

After all tasks in this wave are complete:

1. Run full test suite: `[command]`
2. Start the app: `[command]`
3. Manually verify these end-to-end flows:
   - [ ] [Describe flow from US-NNN: user does X → sees Y → does Z → sees W]
   - [ ] [Describe flow from US-NNN: ...]
4. Run BDD suite for this wave's scenarios: `[command]`

The app should be fully functional for all Wave 0..N stories after this wave.

---

## Completion Criteria

- [ ] All tasks completed in RED-A → RED-B → GREEN → REFACTOR order
- [ ] All BDD step definitions created for this wave's scenarios
- [ ] All unit/integration tests passing
- [ ] BDD scenarios passing for this wave's stories
- [ ] No lint errors, no type errors
- [ ] Code placed in correct architecture modules
- [ ] UI follows wireframes and design tokens (if applicable)
- [ ] No regressions in full test suite (including previous waves)
- [ ] Wave verification checklist passes (app is testable end-to-end)
```

## Foundation Plan Template

The foundation plan uses the same structure but with these differences:

- **Wave:** Always 0
- **User stories:** "N/A — shared infrastructure"
- **What becomes testable:** "Dev environment is functional, all service interfaces exist, test infrastructure is ready"

### Typical Foundation Tasks (scoped to version)

1. **Database schema** — only entities needed by this version's stories.
   Target: each Infra-Module's schema. Group related tables per module.

2. **Shared types and constants** — only what this version needs.
   Target: `shared-kernel` module.

3. **Database connection and utilities** — ORM setup, connection factory.
   Target: `shared-infra` module.

4. **BM service skeletons with DI interfaces** — only for Business-Modules
   involved in this version. Service class + dependency interfaces.
   Critical: Wave 1 needs these to write tests against.

5. **Test infrastructure** — fixtures, factories, fakes for this version's modules.

### Foundation TDD

Even foundation follows RED-GREEN-REFACTOR:

- Unit tests for shared utilities
- Integration tests for repository CRUD against real DB
- Sociable unit tests for BM services with fakes

### Foundation Verification

```markdown
## Wave 0 Verification

1. Run full test suite: `[command]`
2. Verify all service interfaces are defined and importable
3. Verify database migrations run cleanly
4. Verify test fixtures and fakes work
5. The app doesn't need to start yet — but the dev environment must be functional
```
