---
name: research-and-architecture-verification
version: 2.0.0
description: >
  Verifies the output of /research-and-architecture for MIM AA compliance, template
  completeness, and consistency with the project's specs/stories.json and
  specs/PROJECT.md. Spawns a fresh agent to audit specs/ARCHITECTURE.md against
  the MIM AA reference, the architecture template, and the story backlog. Produces
  a structured compliance report with pass/fail verdicts, specific violations, and
  actionable recommendations (fix or proceed to next phase). Use this skill after
  running /research-and-architecture, before running /repo-initialization. Also
  triggers on: "verify the architecture", "check architecture quality", "audit
  ARCHITECTURE.md", "is the architecture ready", "validate architecture before
  scaffolding", "MIM AA compliance check", or any request to review architecture
  quality.
---

# Research & Architecture Verification

Audits `specs/ARCHITECTURE.md` produced by `/research-and-architecture` and produces a compliance report. This is a **quality gate** between architecture definition and repo initialisation.

The verification runs in a **fresh agent** so the review has no context bias from the generation session. The auditor reads the artifacts, the MIM AA reference, the template, and the story backlog — then checks compliance from scratch.

## Pre-Flight: Detect Legacy Layout

| Check                                       | Action                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                 | Hard-stop. Print: `Legacy layout detected. Run: node scripts/migrate-tracking.mjs --input docs/project-tracking.json --out specs/`.             |
| `specs/ARCHITECTURE.md` does not exist      | Hard-stop. Print: `No specs/ARCHITECTURE.md found. Run /research-and-architecture first.`                                                       |

## When to Run

```
/spec-writing → /spec-writing-verification → /research-and-architecture → /research-and-architecture-verification → /repo-initialization
```

## What Gets Verified

| Artifact            | Expected Location              |
| ------------------- | ------------------------------ |
| ARCHITECTURE.md     | `specs/ARCHITECTURE.md`        |
| stories.json        | `specs/stories.json`           |
| PROJECT.md          | `specs/PROJECT.md`             |
| Story feature files | `specs/story-NNN-slug/features/*.feature` (cross-reference for module-to-story mapping) |

## Reference Documents

| Reference             | Path                                       | Purpose                     |
| --------------------- | ------------------------------------------ | --------------------------- |
| MIM AA Reference      | `${CLAUDE_PLUGIN_ROOT}/skills/research-and-architecture/references/mim-architecture.md` (or absolute path inside the plugin marketplace install) | The architecture principles |
| Architecture Template | `${CLAUDE_PLUGIN_ROOT}/skills/research-and-architecture/references/architecture-template.md`                                                     | Expected document structure |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are an architecture compliance auditor specializing in MIM AA. Your job is
to verify that specs/ARCHITECTURE.md is complete, follows MIM AA principles,
and is consistent with the project's stories.json + PROJECT.md.

## Step 1: Read the References

1. MIM AA Reference: <path>/research-and-architecture/references/mim-architecture.md
2. Architecture Template: <path>/research-and-architecture/references/architecture-template.md
3. Stories schema: <path>/high-level-scoping/references/stories-json-schema.md

## Step 2: Read the Artifacts

4. specs/ARCHITECTURE.md
5. specs/stories.json
6. specs/PROJECT.md
7. All .feature files in specs/story-NNN-slug/features/ for stories whose phase ∈ {specced, planned, red, green, verified}

## Verification Checklist

### A. Document Structure (Template Compliance)

Check that ARCHITECTURE.md contains ALL required sections from the template:
- [ ] Architecture Overview with both diagrams (high-level + detailed)
- [ ] MIM AA approach explanation
- [ ] Alignment with High-Level Architecture (M-NNN → BM-NNN mapping)
- [ ] Key Architecture Decisions table (ADRs) — append-only log
- [ ] Tech Stack section with version table
- [ ] Stack Compatibility Notes
- [ ] Version Pinning Strategy
- [ ] Module Map: BMs, Infra-Modules, Standalone
- [ ] Module Dependency Graph
- [ ] Module Details: per module (Type, Process, Public API, Internal structure, Data ownership, Dependencies)
- [ ] Entrypoint & Bootstrap section
- [ ] Cross-Cutting Concerns
- [ ] Data Architecture: ownership map, data flow, contracts
- [ ] Communication Patterns
- [ ] Testing Strategy per module
- [ ] Best Practices & Conventions
- [ ] Glossary

### B. MIM AA Principle Compliance

(Same B1-B10 checks as the legacy skill — module types, BM purity, Infra ownership, dependency direction, acyclic dependencies, data encapsulation, public API, naming, bootstrap pattern, communication patterns. See the legacy skill body for the full list — all principles unchanged.)

### C. Story Backlog Consistency

(Replaces the old "C. SPECS.md Consistency" section. Cross-reference ARCHITECTURE.md against specs/stories.json + PROJECT.md.)

**C1. Tech Stack Alignment:**
- [ ] Every technology in PROJECT.md / stories.json `architecture.tech_stack` appears in ARCHITECTURE.md (possibly refined)
- [ ] Tech stack changes are explained by an ADR
- [ ] Versions are specific (not vague ranges)

**C2. Story Coverage:**
- [ ] Every story whose phase ≥ specced has its feature files mapped to at least one module
- [ ] Every story's modules appear in the Module Map
- [ ] No story is unassigned (orphaned)
- [ ] No two BMs claim the same story unless explicitly shared via dependency

**C3. Module Count Heuristic:**
- [ ] Number of BMs is reasonable for the story count (MIM heuristic: avoid fine-grained modules)
- [ ] If there are more BMs than stories, flag as potential over-modularization
- [ ] If there's only 1 BM for 10+ stories, flag as potential under-modularization

**C4. NFR Support:**
- [ ] Architecture addresses performance NFRs from PROJECT.md
- [ ] Architecture addresses security NFRs
- [ ] Testing strategy aligns with story-level Test Strategy expectations

### D. Technical Quality

(Same D1-D4 checks as the legacy skill — diagram validity, API completeness, data architecture, testing strategy.)

### E. ADR Quality

(Same as the legacy skill, plus: append-only log integrity — no past ADR has been deleted or rewritten. New ADRs that supersede past ones reference the prior ADR id.)

## Output Format

Produce this exact report structure:

---

# Architecture Verification Report

**Date:** [today]
**ARCHITECTURE.md location:** specs/ARCHITECTURE.md
**Modules found:** [count BMs] BMs + [count Infra] Infra + [count Standalone] Standalone
**Stories mapped:** [count] / [total stories whose phase ≥ specced]
**ADRs in log:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

## MIM AA Compliance Score: [0-100]%

## Summary

| Area | Grade | Critical | Warnings |
|------|-------|----------|----------|
| A. Document Structure | [A-F] | [count] | [count] |
| B. MIM AA Principles | [A-F] | [count] | [count] |
| C. Story Backlog Consistency | [A-F] | [count] | [count] |
| D. Technical Quality | [A-F] | [count] | [count] |
| E. ADR Quality | [A-F] | [count] | [count] |

## Critical Issues (Must Fix)

[For each: ID, Area, Location, MIM AA rule violated, Issue, Fix]

## Warnings (Should Fix)

## Recommendations

## Next Step

[Either "Ready for /repo-initialization" or "Fix [N] critical issues first, then re-run"]

---
```

### After the Agent Returns

1. Present the report to the user
2. If **FAIL**: list critical issues, ask if they want to fix them
3. If **PASS WITH WARNINGS**: show warnings, ask if they want to address or proceed
4. If **PASS**: confirm readiness and suggest running `/repo-initialization`

## What This Skill Does NOT Do

- It does not redesign the architecture — it checks compliance with MIM AA
- It does not judge whether the module boundaries are optimal — it checks they follow the rules
- It does not fix issues — it reports them with actionable recommendations
