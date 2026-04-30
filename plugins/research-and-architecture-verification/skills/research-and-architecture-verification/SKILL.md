---
name: research-and-architecture-verification
version: 1.0.0
description: >
  Verifies the output of /research-and-architecture for MIM AA compliance, template
  completeness, and consistency with SPECS.md. Spawns a fresh agent to audit
  ARCHITECTURE.md against the MIM AA reference, the architecture template, and the
  project's SPECS.md. Produces a structured compliance report with pass/fail verdicts,
  specific violations, and actionable recommendations (fix or proceed to next phase).
  Use this skill after running /research-and-architecture, before running
  /repo-initialization. Also triggers on: "verify the architecture", "check architecture
  quality", "audit ARCHITECTURE.md", "is the architecture ready", "validate architecture
  before scaffolding", "MIM AA compliance check", or any request to review architecture
  quality.
---

# Research & Architecture Verification

Audits `docs/V{N}/architecture/ARCHITECTURE.md` produced by `/research-and-architecture`
and produces a compliance report. This is a **quality gate** between architecture
definition and repo initialization.

The verification runs in a **fresh agent** so the review has no context bias from the
generation session. The auditor reads the artifacts, the MIM AA reference, the template,
and SPECS.md — then checks compliance from scratch.

## When to Run

```
/spec-writing → /spec-writing-verification → /research-and-architecture → /research-and-architecture-verification → /repo-initialization
```

## What Gets Verified

| Artifact        | Expected Location                                                    |
| --------------- | -------------------------------------------------------------------- |
| ARCHITECTURE.md | `docs/V{N}/architecture/ARCHITECTURE.md`                             |
| SPECS.md        | `docs/V{N}/specs/SPECS.md` — for cross-reference                     |
| Feature files   | `docs/V{N}/specs/features/*.feature` — for feature-to-module mapping |

## Reference Documents

The agent must read these to know the rules:

| Reference             | Path                                                                             | Purpose                     |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------- |
| MIM AA Reference      | `~/.claude/skills/research-and-architecture/references/mim-architecture.md`      | The architecture principles |
| Architecture Template | `~/.claude/skills/research-and-architecture/references/architecture-template.md` | Expected document structure |

## Execution

**Spawn a fresh Opus agent** with the audit prompt below.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt:

```
You are an architecture compliance auditor specializing in MIM AA (Module
Infrastructure-Module Application Architecture). Your job is to verify that
ARCHITECTURE.md is complete, follows MIM AA principles, and is consistent with
the project's SPECS.md.

## Step 1: Read the References

Read these files first — they define what you're checking against:

1. MIM AA Reference: ~/.claude/skills/research-and-architecture/references/mim-architecture.md
2. Architecture Template: ~/.claude/skills/research-and-architecture/references/architecture-template.md

## Step 2: Read the Artifacts

3. ARCHITECTURE.md: docs/V{N}/architecture/ARCHITECTURE.md
4. SPECS.md: docs/V{N}/specs/SPECS.md (where V{N} is the version whose architecture is being audited — determine V{N} from `docs/project-tracking.json`'s most-recent `architecture.detailed_in_version` field, or ask the user)
5. All .feature files in docs/V{N}/specs/features/

## Verification Checklist

### A. Document Structure (Template Compliance)

Check that ARCHITECTURE.md contains ALL required sections from the template:
- [ ] Architecture Overview with high-level diagram (Mermaid or ASCII)
- [ ] Architecture approach explanation (why MIM AA)
- [ ] Key Architecture Decisions table (ADRs) with # | Decision | Rationale | Alternatives
- [ ] Tech Stack section with version table (Layer | Technology | Version | Rationale)
- [ ] Stack Compatibility Notes
- [ ] Version Pinning Strategy
- [ ] Module Map: Business-Modules table
- [ ] Module Map: Infrastructure-Modules table
- [ ] Module Map: Standalone/Shared modules table
- [ ] Module Dependency Graph (Mermaid or ASCII)
- [ ] Module Details: one subsection per module with Type, Process, Public API, Internal
      structure, Data ownership, Dependencies
- [ ] Entrypoint & Bootstrap section
- [ ] Dependency Wiring pattern
- [ ] Cross-Cutting Concerns table
- [ ] Data Architecture: ownership map, data flow, data contracts
- [ ] Communication Patterns
- [ ] Testing Strategy per module
- [ ] Best Practices & Conventions
- [ ] Glossary

### B. MIM AA Principle Compliance

These are the core MIM AA rules. Each MUST be satisfied:

**B1. Module Types:**
- [ ] Only two module types used: Business-Module (BM) and Infrastructure-Module (Infra)
- [ ] Every BM is clearly labeled as "Business-Module" in its detail section
- [ ] Every Infra-Module is clearly labeled as "Infrastructure-Module"
- [ ] No module has an ambiguous type

**B2. BM Purity (Zero Infrastructure):**
- [ ] Every BM's description says it contains NO infrastructure code
- [ ] BM public APIs do not expose infrastructure types (no DB connections, HTTP objects,
      file handles in the API signatures)
- [ ] BM internal structure does NOT list database, HTTP, file system, or I/O files

**B3. Infra-Module Ownership:**
- [ ] Every Infra-Module belongs to exactly ONE BM (listed as "Parent BM")
- [ ] No Infra-Module is shared between multiple BMs
- [ ] Shared infrastructure goes into a standalone module (e.g., shared-infra), not an Infra-Module

**B4. Dependency Direction:**
- [ ] The dependency graph shows Infra → BM (never BM → Infra)
- [ ] No BM lists an Infra-Module in its Dependencies
- [ ] The bootstrap pattern shows Infra creating and wiring the BM (not the reverse)

**B5. Acyclic Dependencies:**
- [ ] The module dependency graph has NO cycles
- [ ] Trace every dependency chain — verify no path leads back to the starting node
- [ ] If the graph uses Mermaid, verify the arrows don't form loops

**B6. Data Encapsulation:**
- [ ] Each module's Data Ownership section lists the tables/schema it owns
- [ ] No table is owned by more than one module
- [ ] The document explicitly states "no foreign keys between modules" or equivalent
- [ ] Data flow section confirms cross-module access goes through public APIs only

**B7. Public API:**
- [ ] Every BM has an explicit Public API section with method signatures
- [ ] API signatures use domain types, not infrastructure types
- [ ] Each BM has an index.ts (or equivalent) listed as the public entry point

**B8. Module Naming:**
- [ ] Module names reflect business processes (e.g., "study", "card-catalog", not
      "data-layer", "service-layer", "helpers")
- [ ] No internal namespaces like "Interfaces", "Helpers", "Domain", "Application"
- [ ] Infra-Modules are named <parent-bm>-infra

**B9. Bootstrap Pattern:**
- [ ] Each Infra-Module describes a bootstrap function (e.g., getXxxService())
- [ ] The entrypoint section shows how modules are wired together
- [ ] Dependencies are explicit (not service locator or auto-discovery)

**B10. Communication:**
- [ ] Inter-module communication uses plain method invocations (not event bus, mediator)
- [ ] Communication patterns section confirms synchronous in-process calls
- [ ] No unnecessary async/event patterns between same-process modules

### C. SPECS.md Consistency

Cross-reference ARCHITECTURE.md against SPECS.md:

**C1. Tech Stack Alignment:**
- [ ] Every technology in SPECS.md appears in ARCHITECTURE.md (possibly refined)
- [ ] If ARCHITECTURE.md changes a technology from SPECS.md, an ADR explains why
- [ ] Version numbers in ARCHITECTURE.md are specific (not vague ranges)

**C2. Feature Coverage:**
- [ ] Every feature (F-NNN) in SPECS.md is mapped to at least one module
- [ ] The Module Map or Module Details lists which features each module owns
- [ ] No feature is unassigned (orphaned)
- [ ] No feature is assigned to more than one BM (unless clearly shared via dependency)

**C3. Module Count Heuristic:**
- [ ] Number of BMs is reasonable for the feature count
      (MIM heuristic: avoid fine-grained modules — processes not actions)
- [ ] If there are more BMs than features, flag as potential over-modularization
- [ ] If there's only 1 BM for 10+ features, flag as potential under-modularization

**C4. NFR Support:**
- [ ] Architecture addresses performance NFRs from SPECS.md (e.g., caching strategy,
      indexing, connection pooling)
- [ ] Architecture addresses security NFRs (e.g., auth middleware, input validation)
- [ ] Testing strategy aligns with test tools in SPECS.md

### D. Technical Quality

**D1. Diagram Validity:**
- [ ] High-level diagram includes all modules
- [ ] Dependency graph includes all modules
- [ ] Arrows in diagrams are consistent with the text descriptions
- [ ] If Mermaid: syntax is valid (graph TD, subgraph, arrow notation)

**D2. API Completeness:**
- [ ] Each BM's public API covers the scenarios in its feature files
- [ ] APIs include both query methods (get, list, find) and command methods (create,
      update, delete) appropriate to the features
- [ ] Return types are specified (not just method names)

**D3. Data Architecture:**
- [ ] Every table/schema listed in data ownership is assignable to one module
- [ ] Cross-module references use opaque IDs (not embedded foreign objects)
- [ ] Orphan handling is addressed (what happens when referenced data is deleted)

**D4. Testing Strategy:**
- [ ] Each module has a testing recommendation (integration, sociable unit, overlapping)
- [ ] Testing follows MIM's adaptive approach (not mandating all 3 for every module)
- [ ] Test infrastructure is specified (test runners, fixtures, test DB strategy)
- [ ] Fakes are mentioned for sociable unit tests (not mocks)

### E. ADR Quality

- [ ] At least 3 ADRs are documented
- [ ] Each ADR has: Decision, Rationale, and Alternatives Considered
- [ ] ADRs cover the most impactful decisions (runtime, framework, database, ORM at minimum)
- [ ] Rationales are specific to this project (not generic "it's popular")
- [ ] Alternatives explain why they were rejected (not just listed)

## Output Format

Produce this exact report structure:

---

# Architecture Verification Report

**Date:** [today]
**ARCHITECTURE.md location:** [path]
**Modules found:** [count BMs] BMs + [count Infra] Infra + [count Standalone] Standalone
**Features mapped:** [count] / [total in SPECS.md]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = all MIM AA rules satisfied, document complete, ready for /repo-initialization
PASS WITH WARNINGS = minor issues that won't block scaffolding, should be fixed
FAIL = MIM AA violations or critical gaps that must be fixed before proceeding

## MIM AA Compliance Score: [0-100]%

## Summary

| Area | Grade | Critical | Warnings |
|------|-------|----------|----------|
| A. Document Structure | [A-F] | [count] | [count] |
| B. MIM AA Principles | [A-F] | [count] | [count] |
| C. SPECS.md Consistency | [A-F] | [count] | [count] |
| D. Technical Quality | [A-F] | [count] | [count] |
| E. ADR Quality | [A-F] | [count] | [count] |

## Critical Issues (Must Fix)

[For each:]
- **ID:** [V-XX]
- **Area:** [which checklist area]
- **Location:** [section/line in ARCHITECTURE.md]
- **MIM AA Rule Violated:** [which principle, if applicable]
- **Issue:** [what's wrong]
- **Fix:** [specific action to take]

## Warnings (Should Fix)

[Same format]

## Recommendations

[Suggestions for improvement beyond strict compliance]

## Next Step

[Either "Ready for /repo-initialization" or "Fix [N] critical issues first, then re-run /research-and-architecture-verification"]

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
