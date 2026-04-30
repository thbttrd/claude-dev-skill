---
name: repo-initialization-verification
version: 1.0.0
description: >
  Verifies the output of /repo-initialization for completeness and correctness. Spawns
  a fresh agent to audit the scaffolded repository against ARCHITECTURE.md — checking
  directory structure matches the module map, all tooling configs exist and work, git
  hooks enforce quality gates, Claude hooks are configured, CLAUDE.md and README.md
  are present and complete, and the full quality gate suite passes. Produces a structured
  compliance report with pass/fail verdicts and actionable recommendations (fix or
  proceed to implementation). Use this skill after running /repo-initialization, before
  starting implementation or /spec-implementation. Also triggers on: "verify the scaffold",
  "check repo setup", "audit the project structure", "is the repo ready", "validate
  repo before implementation", or any request to review scaffolding quality.
---

# Repo Initialization Verification

Audits the scaffolded repository produced by `/repo-initialization` and produces a
compliance report. This is a **quality gate** between scaffolding and implementation.

The verification runs in a **fresh agent** so the review has no context bias from the
scaffolding session. The auditor inspects the actual file system, runs the actual
quality commands, and compares everything against ARCHITECTURE.md.

## When to Run

```
/spec-writing → ... → /research-and-architecture → ... → /repo-initialization → /repo-initialization-verification → /plan-writing
```

## What Gets Verified

| Artifact          | What's Checked                                                 |
| ----------------- | -------------------------------------------------------------- |
| Directory tree    | Matches ARCHITECTURE.md module map exactly                     |
| package.json      | All deps installed, scripts defined, engine constraints        |
| TypeScript config | Strict mode, path aliases, correct target                      |
| ESLint config     | Exists, extends framework config, prettier compat              |
| Prettier config   | Exists with consistent settings                                |
| Commitlint config | Exists, extends conventional commits                           |
| Husky hooks       | pre-commit, commit-msg, pre-push all exist and work            |
| Claude hooks      | .claude/settings.json with PostToolUse hooks configured        |
| .gitignore        | Covers deps, build output, database, env files, IDE files      |
| CLAUDE.md         | Present with architecture rules, quality commands, conventions |
| README.md         | Present with all required onboarding sections                  |
| Quality commands  | tsc, eslint, prettier, test runner all pass on empty scaffold  |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. The agent needs Bash access
to run verification commands.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

````
You are a repository scaffolding auditor. Your job is to verify that the scaffolded
repo matches ARCHITECTURE.md and that all quality infrastructure is correctly set up.

You have access to the file system and Bash. Use them to inspect files AND run commands.

## Step 1: Read the Architecture

Read docs/V{N}/architecture/ARCHITECTURE.md completely. Extract:
1. The module map (all BMs, Infra-Modules, Standalone modules)
2. The internal structure of each module (which files should exist)
3. The entrypoint structure (app routes, API routes, pages)
4. The tech stack (which tools, which versions)
5. The testing strategy (which test runners, which directories)

## Step 2: Read SPECS.md

Read the project's SPECS.md for tech stack cross-reference.

## Verification Checklist

### A. Directory Structure Compliance

Compare the actual file tree against ARCHITECTURE.md sections 3 (Module Map) and 5
(Entrypoint & Bootstrap).

**A1. Module Directories:**
For each module listed in ARCHITECTURE.md:
- [ ] Directory exists at the correct path (src/modules/<name>/)
- [ ] index.ts exists (public API barrel)
- [ ] types.ts exists (module types)

For each Business-Module:
- [ ] Service file exists (<name>.service.ts or equivalent)
- [ ] Pure algorithm files exist if listed in architecture

For each Infrastructure-Module:
- [ ] Repository files exist as listed in architecture
- [ ] Schema file exists (if ORM-based)
- [ ] Bootstrap function exists in index.ts

For each Standalone module:
- [ ] Files listed in architecture exist

Run: `find src/modules -type f | sort` and compare against architecture.

**A2. Entrypoint Structure:**
- [ ] App routes/pages exist as listed in ARCHITECTURE.md section 5
- [ ] API routes exist at the correct paths
- [ ] Layout files exist
- [ ] Route groups exist (if specified)

Run: `find src/app -type f | sort` (or equivalent for the framework)

**A3. Test Directories:**
- [ ] Unit test directory exists
- [ ] Integration test directory exists
- [ ] E2E/BDD directory exists
- [ ] Step definitions directory exists
- [ ] Feature files are accessible (symlinked or copied from docs/V{N}/specs/features/)

**A4. Support Directories:**
- [ ] docs/V{N}/plans/ exists
- [ ] data/ directory exists (or will be created at runtime)
- [ ] public/uploads/ exists (if architecture specifies image uploads)

### B. Dependency Installation

**B1. package.json Verification:**
- [ ] Project name matches SPECS.md
- [ ] All production dependencies from ARCHITECTURE.md section 2 are installed
- [ ] All dev dependencies are installed (test runner, linter, formatter, commit tools)
- [ ] husky, lint-staged, @commitlint/cli, @commitlint/config-conventional are in devDeps
- [ ] Required scripts exist: dev, build, lint, test, typecheck (or equivalent)
- [ ] "prepare" script runs husky

Run: `cat package.json | jq '.dependencies, .devDependencies, .scripts'`

**B2. Lock File:**
- [ ] Lock file exists (bun.lockb, package-lock.json, etc.)
- [ ] node_modules/ exists and is populated

Run: `ls -la bun.lockb 2>/dev/null || ls -la package-lock.json 2>/dev/null`

### C. Tooling Configuration

**C1. TypeScript:**
- [ ] tsconfig.json exists
- [ ] strict: true is set
- [ ] Path aliases configured (e.g., @/* → ./src/*)
- [ ] Target and module settings match architecture ADRs

Run: `cat tsconfig.json | jq '.compilerOptions.strict, .compilerOptions.paths'`

**C2. ESLint:**
- [ ] ESLint config exists (eslint.config.mjs, .eslintrc.json, etc.)
- [ ] Extends framework config (e.g., next/core-web-vitals)
- [ ] TypeScript parser configured
- [ ] Prettier compatibility (eslint-config-prettier or equivalent)

Run: `npx eslint --print-config src/app/page.tsx 2>/dev/null | head -20` (verify config loads)

**C3. Prettier:**
- [ ] .prettierrc (or equivalent) exists
- [ ] Settings are defined (semi, quotes, tab width, trailing comma)

**C4. Commitlint:**
- [ ] commitlint.config.js (or equivalent) exists
- [ ] Extends @commitlint/config-conventional
- [ ] Allowed types include: feat, fix, chore, test, refactor, docs, style, ci

**C5. Test Runner:**
- [ ] Test runner config exists (vitest.config.ts, jest.config.ts, etc.)
- [ ] Test paths match the test directory structure

**C6. ORM/Database:**
- [ ] ORM config exists (drizzle.config.ts, prisma/schema.prisma, etc.)
- [ ] Schema paths point to Infra-Module directories
- [ ] Database location is outside build output and gitignored

### D. Git Hooks

**D1. Husky Setup:**
- [ ] .husky/ directory exists
- [ ] .husky/pre-commit exists and is executable
- [ ] .husky/commit-msg exists and is executable
- [ ] .husky/pre-push exists and is executable (if architecture specifies)

Run: `ls -la .husky/`

**D2. Pre-commit Hook Content:**
- [ ] Runs lint-staged (contains "lint-staged" or "npx lint-staged")

**D3. Commit-msg Hook Content:**
- [ ] Runs commitlint (contains "commitlint")

**D4. Pre-push Hook Content:**
- [ ] Runs type checker (contains "tsc" or "typecheck")
- [ ] Runs tests (contains "test")

**D5. Functional Test — Commit Hook:**
Stage a dummy file and attempt a commit with an invalid message:
```bash
echo "test" > /tmp/hook-test.txt
cp /tmp/hook-test.txt .hook-test.txt
git add .hook-test.txt
git commit -m "bad commit message" 2>&1
````

- [ ] Commit is rejected by commitlint
      Clean up: `git reset HEAD .hook-test.txt && rm .hook-test.txt`

### E. Claude Hooks

**E1. Settings File:**

- [ ] .claude/settings.json exists in the project root
- [ ] Contains "hooks" key
- [ ] Contains "PostToolUse" array

**E2. PostToolUse Configuration:**

- [ ] Has a matcher for "Edit|Write" (or similar)
- [ ] Runs a quality gate command (eslint, prettier, or a hook script)
- [ ] Has a reasonable timeout (10-60 seconds)

**E3. Hook Script (if used):**

- [ ] Script file exists at the referenced path
- [ ] Script is executable (chmod +x)
- [ ] Script reads JSON from stdin (uses jq or equivalent)
- [ ] Script extracts file_path from tool_input
- [ ] Script runs linting and/or formatting on the file
- [ ] Script exits 0 on success

Run: `cat .claude/settings.json | jq '.hooks'`
If script exists: `cat .claude/hooks/*.sh`

### F. .gitignore

- [ ] .gitignore exists
- [ ] Ignores node_modules/
- [ ] Ignores build output (.next/, dist/, out/, build/)
- [ ] Ignores database files (data/, _.db, _.db-journal, \*.db-wal)
- [ ] Ignores environment files (.env, .env.local, .env.\*.local)
- [ ] Ignores IDE files (.vscode/, .idea/)
- [ ] Ignores OS files (.DS_Store)
- [ ] Ignores test artifacts (coverage/, test-results/, playwright-report/)
- [ ] Does NOT ignore source files, config files, or documentation

Run: `cat .gitignore`

### G. CLAUDE.md

- [ ] CLAUDE.md exists in the project root
- [ ] Contains project overview
- [ ] Contains tech stack section
- [ ] Contains quality commands section with actual runnable commands
- [ ] Contains architecture rules (module types, dependency direction, data encapsulation)
- [ ] Contains commit conventions (conventional commits, allowed types)
- [ ] Contains testing rules (TDD, fakes not mocks)
- [ ] Contains module map or module structure reference
- [ ] Contains common mistakes to avoid section

**Quality command verification:**
Extract the quality commands from CLAUDE.md and verify they match actual scripts:

- [ ] Typecheck command matches package.json script
- [ ] Lint command matches package.json script
- [ ] Test command matches package.json script

### H. README.md

- [ ] README.md exists in the project root
- [ ] Contains project name and description
- [ ] Contains tech stack summary
- [ ] Contains prerequisites (required tools and versions)
- [ ] Contains installation instructions (clone, install)
- [ ] Contains "running the app" section with dev command
- [ ] Contains "running tests" section with all test commands
- [ ] Contains project structure overview
- [ ] Contains features list from SPECS.md
- [ ] Contains architecture reference (pointer to ARCHITECTURE.md)
- [ ] Contains contributing section with commit conventions

### I. Quality Gate Execution

Run the actual quality commands and verify they pass on the empty scaffold:

```bash
# Type checker
npx tsc --noEmit 2>&1

# Linter
npm run lint 2>&1

# Formatter check
npx prettier --check . 2>&1

# Test runner (0 tests passing is OK)
npm test 2>&1
```

- [ ] Type checker passes (exit code 0)
- [ ] Linter passes (exit code 0)
- [ ] Prettier passes (exit code 0)
- [ ] Test runner executes without error (0 tests is acceptable)

### J. Placeholder File Validity

Verify that all placeholder files are valid (parseable, importable):

- [ ] All .ts files compile without errors (covered by tsc --noEmit above)
- [ ] All .tsx page files export a default component
- [ ] All API route files export handler functions (GET, POST, etc.)
- [ ] Module index.ts files are valid (even if empty exports)

## Output Format

Produce this exact report structure:

---

# Repo Initialization Verification Report

**Date:** [today]
**Branch:** [current git branch]
**Package manager:** [npm/bun/pnpm/yarn]
**Module directories found:** [count] / [expected from architecture]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = scaffold is complete and all quality gates pass, ready for implementation
PASS WITH WARNINGS = minor gaps that won't block implementation
FAIL = critical gaps that must be fixed before starting implementation

## Summary

| Area                   | Grade | Critical | Warnings |
| ---------------------- | ----- | -------- | -------- |
| A. Directory Structure | [A-F] | [count]  | [count]  |
| B. Dependencies        | [A-F] | [count]  | [count]  |
| C. Tooling Config      | [A-F] | [count]  | [count]  |
| D. Git Hooks           | [A-F] | [count]  | [count]  |
| E. Claude Hooks        | [A-F] | [count]  | [count]  |
| F. .gitignore          | [A-F] | [count]  | [count]  |
| G. CLAUDE.md           | [A-F] | [count]  | [count]  |
| H. README.md           | [A-F] | [count]  | [count]  |
| I. Quality Gates       | [A-F] | [count]  | [count]  |
| J. Placeholder Files   | [A-F] | [count]  | [count]  |

## Quality Gate Results

| Command          | Exit Code | Result      |
| ---------------- | --------- | ----------- |
| tsc --noEmit     | [0/1]     | [PASS/FAIL] |
| eslint           | [0/1]     | [PASS/FAIL] |
| prettier --check | [0/1]     | [PASS/FAIL] |
| test runner      | [0/1]     | [PASS/FAIL] |

## Missing Modules (if any)

| Expected Module | Type                  | Status          |
| --------------- | --------------------- | --------------- |
| [module-name]   | [BM/Infra/Standalone] | [FOUND/MISSING] |

## Critical Issues (Must Fix)

[For each:]

- **ID:** [V-XX]
- **Area:** [which checklist area]
- **Location:** [file path]
- **Issue:** [what's wrong]
- **Fix:** [specific action to take]

## Warnings (Should Fix)

[Same format]

## Recommendations

[Any suggestions beyond strict compliance]

## Next Step

[Either "Ready for /plan-writing" or "Fix [N] critical issues first, then re-run /repo-initialization-verification"]

---

```

### After the Agent Returns

1. Present the report to the user
2. If **FAIL**: list critical issues, ask if they want to fix them
3. If **PASS WITH WARNINGS**: show warnings, ask if they want to address or proceed
4. If **PASS**: confirm readiness and suggest starting implementation

## What This Skill Does NOT Do

- It does not scaffold or fix the repo — it only reports issues
- It does not assess code quality (there's no code yet) — it checks infrastructure setup
- It does not run the application — it verifies the tooling works on the empty scaffold
```
