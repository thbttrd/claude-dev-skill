---
name: repo-initialization
version: 2.0.0
description: >
  Scaffolds a new project repository from `specs/ARCHITECTURE.md`,
  `specs/PROJECT.md`, and the Foundation Story
  (`specs/story-000-foundation/STORY.md`). Creates the full directory tree
  matching the MIM AA module structure, installs dependencies, configures
  tooling (TypeScript, ESLint, Prettier, Tailwind), sets up git commit hooks
  (conventional commits, type checking, linting, formatting via Husky +
  lint-staged + commitlint), sets up Claude Code hooks (same quality gates on
  every file edit), creates CLAUDE.md with project rules, creates README.md,
  and produces a clean .gitignore. Use this skill whenever you need to
  initialize a new repo, scaffold a project from architecture, bootstrap a
  codebase, or prepare a repo for story-based development. Also triggers on:
  "initialize the repo", "scaffold the project", "set up the repo", "bootstrap
  from architecture", "create project structure", or any request to turn the
  Foundation Story + architecture into a ready-to-code repo.
---

# Repo Initialization (story-based)

Takes the project's architecture (`specs/ARCHITECTURE.md` + `specs/PROJECT.md`) and the Foundation Story (`specs/story-000-foundation/STORY.md` + its `.feature` files) and turns them into a fully configured, empty repository — ready for the GREEN phase of `US-000`.

The goal: after this skill completes, `/spec-implementation US-000` (or a developer) can immediately start writing implementation code that makes the Foundation Story's tests pass. All tooling, quality gates, directory structure, and documentation are in place.

## Pre-Flight

| Check                                                  | Action                                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                            | Hard-stop with the migration command.                                                                                                           |
| `specs/ARCHITECTURE.md` does not exist                 | Hard-stop. Print: `No specs/ARCHITECTURE.md found. Run /research-and-architecture first.`                                                       |
| `specs/story-000-foundation/STORY.md` does not exist   | Hard-stop. Print: `No Foundation Story found. Run /spec-writing US-000 first.`                                                                  |
| Foundation Story phase is not at least `specced`       | Hard-stop. Print: `Foundation Story (US-000) must be specced before scaffolding. Run /spec-writing US-000 first.`                              |
| `package.json` already exists (project already init'd) | Switch to **incremental mode** — only run steps that are missing (e.g., add Husky to a manually-init'd repo). Confirm via `AskUserQuestion`.    |

## Prerequisites

This skill expects these files to already exist:

| File                                              | Produced by                                            | Contains                                            |
| ------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `specs/PROJECT.md`                                | `/high-level-scoping`                                  | Project overview, NFRs, tech-stack pointer          |
| `specs/ARCHITECTURE.md`                           | `/research-and-architecture`                           | Module map, dependency graph, tech stack, ADRs      |
| `specs/story-000-foundation/STORY.md`             | `/spec-writing`                                        | Foundation Story AC + Rules                         |
| `specs/story-000-foundation/features/F-*.feature` | `/spec-writing`                                        | Walking-skeleton Gherkin scenario(s)                |
| `specs/stories.json`                              | `/high-level-scoping`, enriched by downstream skills   | Story tracker (read for project name, story slugs)   |

If any are missing, hard-stop with the appropriate error message above.

---

## Execution Flow

```
Read inputs → Create branch → Init project → Install deps → Configure tooling
  → Create directory tree → Set up git hooks → Set up Claude hooks
  → Create .gitignore → Create CLAUDE.md → Create README.md → Verify → Commit
```

Each step is discrete — complete each one fully before moving to the next.

---

## Step 1: Read Inputs

Read these files completely and extract the information listed:

**From `specs/PROJECT.md`:**

- Project name and description
- Non-functional requirements

**From `specs/ARCHITECTURE.md`:**

- Tech stack (runtime, framework, language, database, ORM, styling, test tools, exact versions)
- Module map: all Business-Modules, Infrastructure-Modules, and Standalone modules
- Internal structure of each module (which files go where)
- Entrypoint structure (app routes, API routes, pages)
- Dependency graph between modules
- Testing strategy (which test runners, how tests are organised)
- Best practices and conventions
- ADRs that affect tooling choices

**From `specs/story-000-foundation/STORY.md`:**

- Acceptance criteria — these define what "scaffolded and ready" means for this project
- Notes on the smoke endpoint, smoke UI page, and smoke Gherkin scenario

**From `specs/stories.json`:**

- Story slugs, IDs, and the full story DAG (used to populate README and CLAUDE.md story map)

These extracted details drive every subsequent step. Do not assume defaults — use what the architecture and stories actually say.

---

## Step 2: Create Working Branch

Before any file creation, create a dedicated implementation branch named after the Foundation Story:

```bash
git checkout -b impl/US-000-foundation
```

(Or, if the user is also seeding US-NNN beyond foundation in this same scaffold pass, use `impl/initial-scaffold`.) All scaffolding work happens on this branch — never on `main`.

---

## Step 3: Initialize Project

Use the package manager and framework specified in `specs/ARCHITECTURE.md`. Common patterns:

| Stack             | Init command                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Next.js + Bun     | `bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --skip-install` |
| Next.js + npm     | `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir`                 |
| Vite + React      | `bun create vite . --template react-ts`                                                         |
| Node.js + Express | `bun init` then add express                                                                     |

After init, verify `package.json` exists with the correct project name; verify `tsconfig.json` exists with `strict: true`; clean up any boilerplate files that don't match the architecture.

---

## Step 4: Install Dependencies

Install dependencies in two batches. Read the exact packages and versions from `specs/ARCHITECTURE.md` section 2 (Tech Stack).

**Batch 1: Production dependencies** — framework, ORM, UI libraries, runtime utilities.

**Batch 2: Dev dependencies** — TypeScript, ESLint, Prettier, husky, lint-staged, @commitlint/cli, @commitlint/config-conventional, the test runner from architecture (Vitest/Jest), the E2E runner (Playwright/Cypress), and the BDD plugin (`playwright-bdd` or `@cucumber/cucumber`) if specified.

Pin versions for core dependencies (framework, ORM, TypeScript) to exact versions from ARCHITECTURE.md. Use caret ranges for utilities.

---

## Step 5: Configure Tooling

(Same configuration steps as the legacy skill — `tsconfig.json` with `strict: true` and module-aliased paths, ESLint extending the framework config, Prettier defaults, Commitlint with conventional types, the test runner config aligned with the directory layout, ORM/DB connection, styling. Read `references/scaffolding-checklist.md` for the detailed config templates.)

Add the same `package.json` scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `bdd`, `prepare`.

---

## Step 6: Create Directory Tree from `specs/ARCHITECTURE.md`

The directory structure must mirror `specs/ARCHITECTURE.md` exactly.

### 6.1 Parse the Architecture

From sections 3 (Module Map) and 5 (Entrypoint & Bootstrap), extract:

1. **Business-Modules**: names and internal file structure
2. **Infrastructure-Modules**: names and internal file structure
3. **Standalone modules**: names and structure
4. **Entrypoint**: app routes, API routes, page structure
5. **Shared directories**: components, hooks, lib, etc.
6. **Test directories**: unit, integration, E2E, steps

### 6.2 Create Module Directories

For each module listed in ARCHITECTURE.md, create the directory with placeholder files. Same patterns as the legacy skill — every module gets an `index.ts`, `types.ts`, plus the module-type-specific files (BM service skeleton, Infra repo + schema, Standalone files).

### 6.3 Create Entrypoint Structure

Create the app routes / pages structure from ARCHITECTURE.md section 5 — page files with minimal placeholder content, API route files with minimal placeholder handlers, layout files, route groups.

### 6.4 Create Test Directories

```
tests/ or __tests__/
├── unit/
├── integration/
└── fixtures/

e2e/ or features/
├── steps/                # Empty step definition directory
└── pages/                # Page Object Model directory (if E2E)
```

**Note:** The `.feature` files live under each story directory at `specs/story-NNN-slug/features/`, NOT under `e2e/features/`. The BDD runner is wired (in Step 5) to read from `specs/story-*/features/**/*.feature`. Do **not** symlink or copy `.feature` files into the repo source tree — keep them in `specs/`.

### 6.5 Create Support Directories

- `data/` — for database files (gitignored)
- `public/uploads/` — for user uploads (if applicable, gitignored)

There is **no `docs/`** directory created. Story plans, tests, and verification reports live under `specs/story-NNN-slug/`, owned by the story-based skills.

### 6.6 Commit the Directory Structure

```
chore: create project directory structure following specs/ARCHITECTURE.md
```

This commit is separate from tooling config — it captures the architectural intent before any code.

---

## Step 7: Set Up Git Commit Hooks

(Same as the legacy skill — Husky pre-commit running lint-staged, commit-msg running commitlint, pre-push running typecheck + tests. Verify each hook works.)

---

## Step 8: Set Up Claude Code Hooks

(Same as the legacy skill — `.claude/hooks/quality-gate.sh` runs ESLint + Prettier on edited files; `.claude/settings.json` registers the hook on `Edit|Write` PostToolUse with a 30s timeout.)

---

## Step 9: Create `.gitignore`

Generate a `.gitignore` tailored to the project's stack. Same patterns as the legacy skill — node_modules, build output, database, env, IDE, OS, test artifacts, uploads, ORM-generated, logs, temp.

Add one extra entry: ensure `specs/` is **NOT** ignored. The specs/ directory is part of the repo and must be tracked.

---

## Step 10: Create CLAUDE.md

Read `references/claudemd-template.md` for the template. Generate CLAUDE.md by filling in details from `specs/PROJECT.md` and `specs/ARCHITECTURE.md`.

The CLAUDE.md must include:

1. **Project overview** — one-liner from `specs/PROJECT.md`
2. **Tech stack** — from `specs/ARCHITECTURE.md` section 2
3. **Architecture rules** — module boundaries, dependency direction, data encapsulation rules
4. **Quality commands** — exact commands for typecheck, lint, format, tests, BDD
5. **Commit conventions** — conventional commits format, allowed types, scope rules (use `US-NNN` as scope for story work, `foundation` for shared infrastructure)
6. **Module structure** — where to put code for each module type
7. **Story-based workflow rules** — point to `specs/STORIES.md` as the kanban; reinforce that stories progress through `phase` (backlog → scoped → specced → planned → red → green → verified)
8. **Testing rules** — steps-first TDD, hand-written fakes (not mocks), test co-location
9. **File naming conventions**
10. **What NOT to do** — direct DB access across modules, business logic in route handlers, mocks instead of fakes, writing into `docs/V*/` (legacy layout)

---

## Step 11: Create README.md

Read `specs/PROJECT.md` for project description, tech stack, prerequisites. Read `specs/stories.json` for the story list.

**Required sections:**

1. **Project name and description** — from `specs/PROJECT.md`
2. **Tech stack** — runtime, framework, database, ORM, styling, test tools with versions
3. **Prerequisites** — required tools and minimum versions
4. **Quick start** — clone, install, run in 3 commands
5. **Running the app** — dev server command, default port, health check
6. **Running tests** — all test commands
7. **Project structure** — directory tree with one-line descriptions matching ARCHITECTURE.md
8. **Stories** — table from `specs/stories.json` showing IDs, titles, phases (link to `specs/STORIES.md`)
9. **Architecture** — pointer to `specs/ARCHITECTURE.md` and a brief MIM AA explanation
10. **Contributing** — branch naming (`impl/US-NNN-slug`), commit conventions, quality gates

Mark sections that need details from not-yet-implemented stories with `<!-- TODO: update once US-NNN ships -->`.

---

## Step 12: Verify Everything

Run each verification and fix any issues before committing:

```bash
# 1. Type checker passes
bunx tsc --noEmit

# 2. Linter passes
bun lint

# 3. Formatter passes
bunx prettier --check .

# 4. Test runner works (0 tests is OK)
bun test

# 5. Dev server starts (optional — some scaffolds won't run yet)
bun dev   # kill after confirming startup

# 6. Commit hook works
git add -A
git commit -m "chore: initial project scaffolding with quality gates"
```

If the commit succeeds, the hooks are working correctly.

---

## Step 13: Update `specs/stories.json`

After the scaffold is committed, update `specs/stories.json`:

```json
{
  "project": {
    "scaffolded_at": "<today>",
    "repo_branch": "impl/US-000-foundation"
  }
}
```

(Read-merge-write; never overwrite other fields.) Bump `project.updated_at`.

---

## Step 14: Final Commit & Summary

If Step 12's commit didn't already capture everything, make a final commit:

```
chore: complete repo initialization from specs/ARCHITECTURE.md

- Project scaffolding with full dependency set
- Directory structure matching MIM AA module map
- Git hooks: conventional commits, lint-staged, type checking
- Claude hooks: auto-format and lint on file edit
- CLAUDE.md with architecture rules and quality commands
- README.md with onboarding guide and story map
- .gitignore for the full tech stack
- specs/stories.json updated with scaffolded_at + repo_branch
```

Then report to the user:

- Branch name created
- Number of modules scaffolded
- Quality gates configured (list them)
- What to run next: `/test-setup US-000` to enter the RED phase for the Foundation Story.

---

## Conventions

### Commit Messages During Scaffolding

| Commit                 | Message                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| Directory structure    | `chore: create project directory structure following specs/ARCHITECTURE.md`   |
| Tooling + hooks + docs | `chore: initial project scaffolding with quality gates`                       |

Keep it to 1-2 commits. Scaffolding is infrastructure, not features — `chore` type only.

### Placeholder Files

Same rules as the legacy skill — every created file must be valid (parseable, importable) but minimal. `tsc --noEmit`, `eslint`, and `prettier --check` must all pass on the scaffold before any feature code is written.

### When to Skip Steps

- If the project already has a `package.json` → skip Step 3 (init), start at Step 4
- If dependencies are already installed → skip Step 4
- If tooling is already configured → skip Step 5
- Never skip Steps 6-13 — they are the core value of this skill
