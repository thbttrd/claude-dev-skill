---
name: repo-initialization-verification
version: 2.0.0
description: >
  Verifies the output of /repo-initialization for completeness and correctness.
  Spawns a fresh agent to audit the scaffolded repository against
  specs/ARCHITECTURE.md — checking directory structure matches the module map,
  all tooling configs exist and work, git hooks enforce quality gates, Claude
  hooks are configured, CLAUDE.md and README.md are present and complete, and
  the full quality gate suite passes. Produces a structured compliance report
  with pass/fail verdicts and actionable recommendations (fix or proceed to
  /test-setup US-000). Use this skill after running /repo-initialization, before
  starting /test-setup or /spec-implementation. Also triggers on: "verify the
  scaffold", "check repo setup", "audit the project structure", "is the repo
  ready", "validate repo before implementation", or any request to review
  scaffolding quality.
---

# Repo Initialization Verification (story-based)

Audits the scaffolded repository produced by `/repo-initialization` and produces a compliance report. This is a **quality gate** between scaffolding and the Foundation Story's RED phase (`/test-setup US-000`).

The verification runs in a **fresh agent** so the review has no context bias from the scaffolding session. The auditor inspects the actual file system, runs the actual quality commands, and compares everything against `specs/ARCHITECTURE.md`.

## Pre-Flight

| Check                                       | Action                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                 | Hard-stop with the migration command.                                                                                                           |
| `specs/ARCHITECTURE.md` does not exist      | Hard-stop. Print: `No specs/ARCHITECTURE.md found. Run /research-and-architecture first.`                                                       |
| `package.json` does not exist               | Hard-stop. Print: `Repo not scaffolded yet. Run /repo-initialization first.`                                                                    |

## When to Run

```
/research-and-architecture → /research-and-architecture-verification → /repo-initialization → /repo-initialization-verification → /test-setup US-000
```

## What Gets Verified

| Artifact          | What's Checked                                                 |
| ----------------- | -------------------------------------------------------------- |
| Directory tree    | Matches `specs/ARCHITECTURE.md` module map exactly             |
| package.json      | All deps installed, scripts defined                            |
| TypeScript config | Strict mode, path aliases, correct target                      |
| ESLint config     | Exists, extends framework config, prettier compat              |
| Prettier config   | Exists with consistent settings                                |
| Commitlint config | Exists, extends conventional commits                           |
| Husky hooks       | pre-commit, commit-msg, pre-push all exist and work            |
| Claude hooks      | `.claude/settings.json` with PostToolUse hooks configured      |
| .gitignore        | Covers deps, build output, database, env files; does NOT ignore `specs/` |
| CLAUDE.md         | Present with architecture + story-based-workflow rules          |
| README.md         | Present with all required onboarding sections + story map      |
| Quality commands  | tsc, eslint, prettier, test runner all pass on empty scaffold  |
| BDD wiring        | Runner is configured to read `specs/story-*/features/**/*.feature` |
| stories.json      | `project.scaffolded_at` and `project.repo_branch` are set      |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. The agent needs Bash access to run verification commands.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are a repository scaffolding auditor for a story-based dev pipeline. Your
job is to verify that the scaffolded repo matches specs/ARCHITECTURE.md and
that all quality infrastructure is correctly set up.

You have access to the file system and Bash. Use them to inspect files AND
run commands.

## Step 1: Read the Architecture & Stories Tracker

Read specs/ARCHITECTURE.md completely. Extract:
1. The module map (BMs, Infra, Standalone)
2. The internal structure of each module
3. The entrypoint structure (routes, pages)
4. The tech stack (tools, versions)
5. The testing strategy (runners, directories)

Read specs/PROJECT.md for tech-stack cross-reference.
Read specs/stories.json for project name, story DAG, and the
project.scaffolded_at + project.repo_branch fields.

## Step 2: Run the Verification Checklist

(All sections A-J from the legacy verifier apply unchanged in substance —
directory structure, dependencies, tooling, git hooks, Claude hooks,
.gitignore, CLAUDE.md, README.md, quality gates, placeholder files.)

Replace these legacy checks with the story-based equivalents:

A.3 Test Directories:
- [ ] Unit, integration, E2E/BDD, steps directories exist
- [ ] BDD runner is configured to discover .feature files at
      specs/story-*/features/**/*.feature (NOT at any docs/V*/specs/features/
      path; legacy refs are a verification failure).

A.4 Support Directories:
- [ ] No docs/ directory exists at the repo root (the legacy path is gone).
- [ ] data/ exists (or is documented as runtime-created)
- [ ] public/uploads/ exists if architecture specifies image uploads

F. .gitignore:
- [ ] specs/ is NOT in .gitignore (specs/ must be tracked)
- (rest same as legacy)

G. CLAUDE.md:
- [ ] References specs/STORIES.md as the kanban
- [ ] Documents the phase enum (backlog → scoped → specced → planned → red →
      green → verified)
- [ ] Specifies branch naming convention impl/US-NNN-slug
- [ ] "What NOT to do" includes "do not write into docs/V*/" (legacy layout)
- (rest same as legacy: project overview, tech stack, architecture rules,
  quality commands, commit conventions, module structure, testing rules,
  file naming conventions)

H. README.md:
- [ ] Includes a Stories section (or pointer to specs/STORIES.md) drawn from
      stories.json
- [ ] Branch naming convention matches CLAUDE.md
- (rest same as legacy)

K. specs/stories.json Integration (new section):
- [ ] project.scaffolded_at is a valid date
- [ ] project.repo_branch is the current branch (impl/US-000-foundation or
      similar)
- [ ] project.updated_at was bumped after scaffolding

## Output Format

Produce this exact report structure:

---

# Repo Initialization Verification Report

**Date:** [today]
**Branch:** [current git branch]
**Package manager:** [npm/bun/pnpm/yarn]
**Module directories found:** [count] / [expected from architecture]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = scaffold complete + all quality gates pass; ready for /test-setup US-000
PASS WITH WARNINGS = minor gaps that won't block the Foundation Story's RED phase
FAIL = critical gaps that must be fixed before /test-setup US-000

## Summary

| Area                       | Grade | Critical | Warnings |
| -------------------------- | ----- | -------- | -------- |
| A. Directory Structure     | [A-F] | [count]  | [count]  |
| B. Dependencies            | [A-F] | [count]  | [count]  |
| C. Tooling Config          | [A-F] | [count]  | [count]  |
| D. Git Hooks               | [A-F] | [count]  | [count]  |
| E. Claude Hooks            | [A-F] | [count]  | [count]  |
| F. .gitignore              | [A-F] | [count]  | [count]  |
| G. CLAUDE.md               | [A-F] | [count]  | [count]  |
| H. README.md               | [A-F] | [count]  | [count]  |
| I. Quality Gates           | [A-F] | [count]  | [count]  |
| J. Placeholder Files       | [A-F] | [count]  | [count]  |
| K. stories.json Integration| [A-F] | [count]  | [count]  |

## Quality Gate Results

| Command          | Exit Code | Result      |
| ---------------- | --------- | ----------- |
| tsc --noEmit     | [0/1]     | [PASS/FAIL] |
| eslint           | [0/1]     | [PASS/FAIL] |
| prettier --check | [0/1]     | [PASS/FAIL] |
| test runner      | [0/1]     | [PASS/FAIL] |
| bdd discovery    | [0/1]     | [PASS/FAIL] |

## Critical Issues (Must Fix)

[Each: ID, Area, Location, Issue, Fix]

## Warnings (Should Fix)

## Recommendations

## Next Step

[Either "Ready for /test-setup US-000" or "Fix [N] critical issues, then re-run"]

---
```

### After the Agent Returns

1. Present the report to the user
2. If **FAIL**: list critical issues, ask if they want to fix them
3. If **PASS WITH WARNINGS**: show warnings, ask if they want to address or proceed
4. If **PASS**: confirm readiness and suggest running `/test-setup US-000`

## What This Skill Does NOT Do

- It does not scaffold or fix the repo — it only reports issues
- It does not assess code quality (there's no code yet) — it checks infrastructure setup
- It does not run the application — it verifies the tooling works on the empty scaffold
