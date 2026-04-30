---
name: repo-initialization
version: 1.0.0
description: >
  Scaffolds a new project repository from SPECS.md and ARCHITECTURE.md produced by
  /spec-writing and /research-and-architecture. Creates the full directory tree matching
  the MIM AA module structure, installs dependencies, configures tooling (TypeScript,
  ESLint, Prettier, Tailwind), sets up git commit hooks (conventional commits, type
  checking, linting, formatting via Husky + lint-staged + commitlint), sets up Claude
  Code hooks (same quality gates on every file edit), creates CLAUDE.md with project
  rules, creates README.md, and produces a clean .gitignore. Use this skill whenever
  you need to initialize a new repo from specs, scaffold a project from an architecture
  document, bootstrap a codebase, set up a monorepo structure, or prepare a repo for
  spec-driven development. Also triggers on: "initialize the repo", "scaffold the
  project", "set up the repo", "bootstrap from architecture", "create project
  structure", or any request to turn specs + architecture into a ready-to-code repo.
---

# Repo Initialization

Takes the output of `/spec-writing` (SPECS.md + feature files) and `/research-and-architecture`
(ARCHITECTURE.md) and turns them into a fully configured, empty repository — ready for
implementation.

The goal: after this skill completes, a developer (or the spec-implementation skill) can
immediately start writing tests and code. All tooling, quality gates, directory structure,
and documentation are in place. Nothing is left to figure out.

## Prerequisites

This skill expects these files to already exist:

| File                                     | Produced by                  | Contains                                           |
| ---------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `docs/V{N}/specs/SPECS.md`               | `/spec-writing`              | Features, tech stack, NFRs                         |
| `docs/V{N}/specs/features/*.feature`     | `/spec-writing`              | Gherkin scenarios                                  |
| `docs/V{N}/architecture/ARCHITECTURE.md` | `/research-and-architecture` | Module map, dependency graph, tech stack decisions |

If any of these are missing, stop and tell the user which prerequisite skill to run first.

**Target version:** This skill scaffolds the repository **for a specific version V{N}** (typically V0 for initial repo creation). Determine V{N} from the user or from `docs/project-tracking.json`. All reads target `docs/V{N}/`. The skill does NOT duplicate prior versions — that happens inside `/spec-writing`, `/research-and-architecture`, etc. before this skill runs.

---

## Execution Flow

```
Read inputs → Create branch → Init project → Install deps → Configure tooling
  → Create directory tree → Set up git hooks → Set up Claude hooks
  → Create .gitignore → Create CLAUDE.md → Create README.md → Verify → Commit
```

Each step below is a discrete unit. Complete each one fully before moving to the next.

---

## Step 1: Read Inputs

Read these files completely and extract the information listed:

**From SPECS.md:**

- Project name and description
- Tech stack (runtime, framework, language, database, ORM, styling, test tools)
- Feature list (IDs and names)
- Non-functional requirements

**From ARCHITECTURE.md:**

- Module map: all Business-Modules, Infrastructure-Modules, and Standalone modules
- Internal structure of each module (which files go where)
- Entrypoint structure (app routes, API routes)
- Dependency graph between modules
- Testing strategy (which test runners, how tests are organized)
- Best practices and conventions
- ADRs that affect tooling choices

These extracted details drive every subsequent step. Do not assume defaults — use what
the architecture and specs actually say.

---

## Step 2: Create Working Branch

Before any file creation, create a dedicated implementation branch:

```bash
git checkout -b impl/spec-<YYYY-MM-DD-HHmm>
```

Use the current date and time (24h format, minute precision). All scaffolding work
happens on this branch — never on `main`.

---

## Step 3: Initialize Project

Use the package manager and framework specified in SPECS.md / ARCHITECTURE.md.

**Common patterns (adapt to your stack):**

| Stack             | Init command                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Next.js + Bun     | `bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --skip-install` |
| Next.js + npm     | `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir`                 |
| Vite + React      | `bun create vite . --template react-ts`                                                         |
| Node.js + Express | `bun init` then add express                                                                     |

After init:

- Verify `package.json` exists with the correct project name
- Verify `tsconfig.json` exists with `strict: true`
- Clean up any boilerplate files that don't match the architecture (default pages, etc.)

---

## Step 4: Install Dependencies

Install dependencies in two batches. Read the exact packages and versions from
ARCHITECTURE.md section 2 (Tech Stack).

**Batch 1: Production dependencies**
Install framework, ORM, UI libraries, runtime utilities as listed in the architecture.

**Batch 2: Dev dependencies**
Install test runners, linters, formatters, commit tooling:

- Type checking: TypeScript (version from ARCHITECTURE.md)
- Linting: ESLint + framework-specific plugins
- Formatting: Prettier
- Commit hooks: `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`
- Unit tests: test runner from architecture (Vitest, Jest, etc.)
- E2E tests: E2E runner from architecture (Playwright, Cypress, etc.)
- BDD: BDD plugin if specified (playwright-bdd, etc.)

Pin versions for core dependencies (framework, ORM, TypeScript) to exact versions from
ARCHITECTURE.md. Use caret ranges for utilities.

---

## Step 5: Configure Tooling

Create configuration files based on the stack. Read `references/scaffolding-checklist.md`
for detailed config templates. Key configs:

### TypeScript (`tsconfig.json`)

- `strict: true`
- Path aliases matching the module structure (`@/modules/*`, `@/components/*`, etc.)
- Target and module settings per ARCHITECTURE.md ADRs

### ESLint

- Extend framework-recommended config (e.g., `next/core-web-vitals`)
- TypeScript parser and plugin
- Rules: `no-unused-vars: warn`, `no-console: warn`

### Prettier (`.prettierrc`)

- Semi, single quotes, tab width, trailing commas — consistent defaults

### Commitlint (`commitlint.config.js`)

- Extend `@commitlint/config-conventional`
- Allowed types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `style`, `ci`

### Test Runner

- Configure as specified in ARCHITECTURE.md section 8 (Testing Strategy)
- Set up test paths matching the directory structure

### ORM / Database

- Configure connection, schema paths, migration output directory
- Match the database and driver from ARCHITECTURE.md

### Styling

- Configure CSS framework as specified (Tailwind, etc.)
- Set up theme/design system tokens if UI-SPECS.md exists

### Package Scripts

Add these scripts to `package.json` (adapt commands to your stack):

```json
{
  "scripts": {
    "dev": "<framework dev command>",
    "build": "<framework build command>",
    "start": "<framework start command>",
    "lint": "<linter command>",
    "lint:fix": "<linter fix command>",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "<type checker command>",
    "test": "<test runner command>",
    "test:watch": "<test runner watch command>",
    "bdd": "<bdd runner command>",
    "prepare": "husky"
  }
}
```

---

## Step 6: Create Directory Tree from ARCHITECTURE.md

This is the critical step that distinguishes this skill from generic scaffolding.
The directory structure must mirror ARCHITECTURE.md exactly — not a generic template.

### 6.1 Parse the Architecture

From ARCHITECTURE.md sections 3 (Module Map) and 5 (Entrypoint & Bootstrap), extract:

1. **Business-Modules**: names and internal file structure
2. **Infrastructure-Modules**: names and internal file structure
3. **Standalone modules**: names and structure
4. **Entrypoint**: app routes, API routes, page structure
5. **Shared directories**: components, hooks, lib, etc.
6. **Test directories**: unit, integration, E2E, steps

### 6.2 Create Module Directories

For each module listed in ARCHITECTURE.md, create the directory with placeholder files.
Every module gets an `index.ts` that re-exports its public API (empty for now):

```
src/modules/<module-name>/
├── index.ts              # Public API barrel — empty export for now
├── types.ts              # Module-specific types — empty for now
└── (other files listed in architecture's "Internal structure" section)
```

For **Business-Modules**, also create:

- `<module-name>.service.ts` — empty service class/function skeleton
- Any pure algorithm files listed in the architecture

For **Infrastructure-Modules**, also create:

- Repository files listed in the architecture (empty classes implementing BM interfaces)
- Schema file for the ORM
- Bootstrap `index.ts` with the `get<ServiceName>Service()` factory pattern

For **Standalone modules** (shared-kernel, shared-infra), create the files listed in
ARCHITECTURE.md with minimal placeholder content.

### 6.3 Create Entrypoint Structure

Create the app routes / pages structure from ARCHITECTURE.md section 5:

- Page files with minimal placeholder content ("Page not implemented yet")
- API route files with minimal placeholder handlers
- Layout files with basic structure
- Route groups if specified

### 6.4 Create Test Directories

```
tests/ or __tests__/     # As specified in architecture
├── unit/
├── integration/
└── fixtures/

e2e/ or features/
├── features/            # Symlink or copy of docs/V{N}/specs/features/
├── steps/               # Empty step definition directory
└── pages/               # Page Object Model directory (if E2E)
```

### 6.5 Create Support Directories

- `docs/V{N}/plans/` — for future implementation plans for the target version (created on demand by `/plan-writing`; the repo-initialization skill only ensures `docs/V{N}/` exists as the version directory)
- `docs/V{N}/specs/wireframes/` — for UI wireframes (created by /spec-writing if UI is involved)
- `data/` — for database files (gitignored)
- `public/uploads/` — for user uploads (if applicable, gitignored)

### 6.6 Commit the Directory Structure

This is a standalone commit capturing just the tree:

```
chore: create project directory structure following ARCHITECTURE.md
```

This commit is separate from tooling config — it captures the architectural intent
before any code.

---

## Step 7: Set Up Git Commit Hooks

Git hooks enforce quality on every commit. They are the first line of defense.

### 7.1 Initialize Husky

```bash
npx husky init  # or: bunx husky init
```

### 7.2 Pre-commit Hook (`.husky/pre-commit`)

The pre-commit hook runs lint-staged, which applies linting and formatting only to
staged files (fast, focused):

```bash
#!/bin/sh
npx lint-staged
```

### 7.3 Lint-staged Configuration

Add to `package.json` or `.lintstagedrc.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix --max-warnings 0", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### 7.4 Commit-msg Hook (`.husky/commit-msg`)

Enforces conventional commit format:

```bash
#!/bin/sh
npx commitlint --edit "$1"
```

### 7.5 Pre-push Hook (`.husky/pre-push`)

Full quality gate before pushing — catches issues that lint-staged doesn't cover:

```bash
#!/bin/sh
npm run typecheck && npm run test -- --run
```

Adapt `npm run` to `bun run` or the project's package manager.

### 7.6 Verify Hooks Work

Test each hook:

1. Stage a file and commit with a bad message (e.g., "bad commit") — commitlint should reject
2. Stage a file with lint errors — pre-commit should fix or reject
3. Commit with a valid message — should succeed

---

## Step 8: Set Up Claude Code Hooks

Claude hooks apply the same quality gates during AI-assisted development. When Claude
edits a file, these hooks run automatically — keeping code clean without manual intervention.

### 8.1 Create Hook Script

Create `.claude/hooks/quality-gate.sh`:

```bash
#!/bin/bash
# Quality gate hook — runs after Claude edits a file
# Receives hook context as JSON on stdin

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path or file doesn't exist
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only process TypeScript/JavaScript files for linting
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # Auto-fix lint issues
  npx eslint --fix "$FILE_PATH" 2>/dev/null

  # Auto-format
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

# Format non-code files too (JSON, MD, CSS)
if [[ "$FILE_PATH" =~ \.(json|md|css)$ ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

exit 0
```

Make it executable:

```bash
chmod +x .claude/hooks/quality-gate.sh
```

### 8.2 Create Claude Settings

Create `.claude/settings.json` in the project root:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/quality-gate.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 8.3 Why Both Git Hooks AND Claude Hooks?

They serve different moments:

- **Claude hooks** catch issues at edit-time — the file is fixed before Claude even commits
- **Git hooks** catch issues at commit-time — the safety net for manual edits and any
  issues Claude hooks didn't cover
- **Pre-push hook** runs the full test suite — the final gate before code leaves the machine

Together, they form three layers of quality assurance.

---

## Step 9: Create .gitignore

Generate a `.gitignore` tailored to the project's stack. Start with the framework's
default ignore patterns, then add:

```gitignore
# Dependencies
node_modules/
.pnp.*

# Build output
.next/
out/
dist/
build/

# Database
data/
*.db
*.db-journal
*.db-wal

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Test artifacts
coverage/
test-results/
playwright-report/
blob-report/

# Uploads (keep directory, ignore contents)
public/uploads/*
!public/uploads/.gitkeep

# Drizzle (or ORM) generated
drizzle/meta/

# Logs
*.log
npm-debug.log*

# Temporary
*.tmp
*.temp
```

Adapt this to the actual tech stack. If the framework's init already created a `.gitignore`,
merge rather than overwrite.

---

## Step 10: Create CLAUDE.md

CLAUDE.md tells Claude Code how to work in this repo. It encodes the architecture rules,
conventions, and quality commands so that every Claude session respects the project's
standards without being told each time.

Read `references/claudemd-template.md` for the template, then generate CLAUDE.md by
filling in details from SPECS.md and ARCHITECTURE.md.

The CLAUDE.md must include:

1. **Project overview** — one-liner from SPECS.md
2. **Tech stack** — from ARCHITECTURE.md section 2
3. **Architecture rules** — module boundaries, dependency direction, data encapsulation
   rules from ARCHITECTURE.md
4. **Quality commands** — the exact commands to run for type checking, linting,
   formatting, tests, BDD tests
5. **Commit conventions** — conventional commits format, allowed types, scope rules
6. **Module structure** — where to put code for each module type
7. **Testing rules** — steps-first TDD, hand-written fakes (not mocks), test co-location
8. **File naming conventions** — from ARCHITECTURE.md section 9
9. **What NOT to do** — common violations to avoid (direct DB access across modules,
   business logic in route handlers, mocks instead of fakes, etc.)

---

## Step 11: Create README.md

The README is the first thing a new developer sees. It must be a complete onboarding
document.

**Required sections:**

1. **Project name and description** — from SPECS.md
2. **Tech stack** — runtime, framework, database, ORM, styling, test tools with versions
3. **Prerequisites** — required tools and minimum versions
4. **Quick start** — clone, install, run in 3 commands
5. **Running the app** — dev server command, default port, health check
6. **Running tests** — all test commands (unit, integration, BDD, lint, typecheck)
7. **Project structure** — directory tree with one-line descriptions matching ARCHITECTURE.md
8. **Features** — list of feature IDs and names from SPECS.md
9. **Architecture** — brief explanation of MIM AA, pointer to ARCHITECTURE.md
10. **Contributing** — branch naming, commit conventions, quality gates

Mark sections that need details from not-yet-implemented features with
`<!-- TODO: update after implementation -->`.

---

## Step 12: Verify Everything

Run each verification and fix any issues before committing:

```bash
# 1. Type checker passes
<typecheck command>  # e.g., bunx tsc --noEmit

# 2. Linter passes
<lint command>       # e.g., bun lint

# 3. Formatter passes
<format check>       # e.g., prettier --check .

# 4. Test runner works (0 tests is OK)
<test command>       # e.g., bun test

# 5. Dev server starts (optional — some scaffolds won't run yet)
<dev command>        # e.g., bun dev (kill after confirming startup)

# 6. Commit hook works
git add -A
git commit -m "chore: initial project scaffolding with quality gates"
```

If the commit succeeds, the hooks are working correctly (commitlint validated the
message, lint-staged processed the files).

---

## Step 13: Final Commit & Summary

If Step 12's commit didn't already capture everything, make a final commit:

```
chore: complete repo initialization from ARCHITECTURE.md

- Project scaffolding with full dependency set
- Directory structure matching MIM AA module map
- Git hooks: conventional commits, lint-staged, type checking
- Claude hooks: auto-format and lint on file edit
- CLAUDE.md with architecture rules and quality commands
- README.md with onboarding guide
- .gitignore for the full tech stack
```

Then report to the user:

- Branch name created
- Number of modules scaffolded
- Quality gates configured (list them)
- What to run next (typically `/spec-implementation` or start coding)

---

## Conventions

### Commit Messages During Scaffolding

| Commit                 | Message                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| Directory structure    | `chore: create project directory structure following ARCHITECTURE.md` |
| Tooling + hooks + docs | `chore: initial project scaffolding with quality gates`               |

Keep it to 1-2 commits. Scaffolding is infrastructure, not features — `chore` type only.

### Placeholder Files

Every created file must be valid (parseable, importable) but minimal:

- `.ts` files: empty exports or type-only exports
- `.tsx` page files: minimal component returning a placeholder
- API route files: minimal handler returning 501 Not Implemented
- Config files: working configuration with no errors

The point is: `tsc --noEmit`, `eslint`, and `prettier --check` must all pass on the
scaffold before any feature code is written.

### When to Skip Steps

- If the project already has a `package.json` → skip Step 3 (init), start at Step 4
- If dependencies are already installed → skip Step 4
- If tooling is already configured → skip Step 5
- Never skip Steps 6-11 — they are the core value of this skill
