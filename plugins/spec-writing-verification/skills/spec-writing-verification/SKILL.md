---
name: spec-writing-verification
version: 1.0.0
description: >
  Verifies the output of /spec-writing for completeness, coherence, and template
  compliance. Spawns a fresh agent to audit SPECS.md and all docs/V{N}/specs/features/*.feature
  files against the spec-writing skill's rules, templates, and quality checklist.
  Produces a structured compliance report with pass/fail verdicts, specific findings,
  and actionable recommendations (fix or proceed to next phase). Use this skill after
  running /spec-writing, before running /research-and-architecture. Also triggers on:
  "verify the specs", "check the spec quality", "audit SPECS.md", "are the specs ready",
  "validate specs before architecture", or any request to review specification quality.
---

# Spec Writing Verification

Audits the artifacts produced by `/spec-writing` and produces a compliance report.
This is a **quality gate** between spec-writing and research-and-architecture.

The verification runs in a **fresh agent** (via the Agent tool) so the review has no
context bias from the generation session. The auditor only sees the artifacts, the
templates, and the rules — not the conversation that produced them.

## When to Run

```
/spec-writing → /spec-writing-verification → /research-and-architecture
```

Run this after `/spec-writing` completes. The report will either clear the specs for
the next phase or list specific items to fix first.

## What Gets Verified

| Artifact      | Expected Location                          |
| ------------- | ------------------------------------------ |
| SPECS.md      | `docs/V{N}/specs/SPECS.md`                 |
| Feature files | `docs/V{N}/specs/features/F-NNN-*.feature` |

UI artifacts (`DESIGN.md`, `UI-F-NNN-*.md`, `mockups/*.html`) are produced by `/ui-specs` and verified by **`/ui-specs-verification`** (or by `/ui-specs`'s own Phase D review pass) — out of scope for this skill.

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. Do not perform the audit
inline — the fresh context is the point. The agent must read the actual files, the
templates, and produce the report.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt (fill in the paths):

```
You are a specification quality auditor. Your job is to verify that the output of
the spec-writing skill is complete, coherent, and template-compliant.

## Artifacts to Audit

Read these files:
1. SPECS.md at `docs/V{N}/specs/SPECS.md` (where V{N} is the target version being audited — read `docs/project-tracking.json` to determine the latest version with a `spec_status` field)
2. Every .feature file in `docs/V{N}/specs/features/`

Do NOT audit `DESIGN.md`, `UI-F-NNN-*.md`, or anything in `docs/V{N}/specs/mockups/` — those belong to `/ui-specs` and have their own verification path.

## Verification Checklist

### A. SPECS.md Structure (Template Compliance)

Check that SPECS.md contains ALL of these sections in order:
- [ ] Project name and one-paragraph description
- [ ] Last updated date and status
- [ ] Table of Contents that matches actual sections
- [ ] Tech Stack table (Layer | Technology | Rationale) — at least 3 rows
- [ ] Features section with at least one feature
- [ ] Non-Functional Requirements with at least one category
- [ ] Glossary table with at least 3 domain terms
- [ ] Changelog table

For each check, report PASS or FAIL with the specific issue.

### B. Feature Completeness (Per Feature)

For EACH feature F-NNN in SPECS.md, verify:
- [ ] Has a unique sequential ID (F-001, F-002, ... with no gaps or duplicates)
- [ ] Has a complete User Story: "As a [role] / I want to [action] / So that [benefit]"
      — all three parts present, role is specific, action is concrete, benefit is clear
- [ ] Has a Rules bullet list with at least 2 rules
- [ ] Has a link to the corresponding .feature file
- [ ] The linked .feature file actually exists on disk

### C. Feature File Quality (Per .feature File)

For EACH .feature file in docs/V{N}/specs/features/, verify:

**Structural:**
- [ ] File name follows convention: F-NNN-kebab-case-slug.feature
- [ ] Contains exactly one Feature: block
- [ ] Has the @F-NNN tag at feature level matching the file name
- [ ] Feature description matches the User Story in SPECS.md (identical text)
- [ ] Uses Rule: blocks to group scenarios

**Scenario Coverage:**
- [ ] Every Rule: block has at least one @happy-path scenario
- [ ] Every Rule: block has at least one @sad-path scenario
- [ ] Scenarios are tagged (@happy-path, @sad-path, @edge-case)
- [ ] Total scenario count is reasonable (at least 2 per Rule)

**Writing Quality:**
- [ ] Scenarios use declarative language (behavior, not UI click sequences)
- [ ] Given/When/Then steps are concrete — search for vague words:
      "appropriate", "properly", "correctly", "valid", "invalid" without specifics,
      "should work", "as expected". Flag each occurrence.
- [ ] Scenario names are unique across all feature files
- [ ] Scenarios are self-contained (no implicit state from other scenarios)
- [ ] Steps use consistent person (all "I" or all "the user", not mixed)

**Gherkin Syntax:**
- [ ] Valid Gherkin parseable by Cucumber (Feature > Rule > Scenario > Given/When/Then)
- [ ] Proper indentation (2 spaces per level)
- [ ] Scenario Outline uses Examples: table correctly (if used)
- [ ] Data Tables are properly formatted (if used)
- [ ] Doc Strings use triple quotes correctly (if used)

### D. Cross-File Coherence

- [ ] Every feature in SPECS.md has a corresponding .feature file
- [ ] Every .feature file has a corresponding entry in SPECS.md
- [ ] No orphaned .feature files (files without SPECS.md entry)
- [ ] Rules listed in SPECS.md match the Rule: blocks in the .feature file
      (same count, same text — flag any mismatches)
- [ ] No contradictory scenarios across feature files (e.g., one feature assumes
      a capability that another feature restricts)
- [ ] No duplicate scenarios covering the same behavior in different files
- [ ] Glossary terms in SPECS.md are actually used in the feature files
- [ ] Feature files don't use domain terms not defined in the glossary

### E. Non-Functional Requirements Quality

- [ ] Each NFR category has at least one requirement
- [ ] Requirements are measurable (not vague — "fast" is bad, "under 200ms p95" is good)
- [ ] Search for vague NFRs: "fast", "secure", "scalable", "reliable", "good"
      without specific metrics. Flag each.
- [ ] Performance NFRs specify targets with units (ms, seconds, concurrent users, etc.)
- [ ] Security NFRs name specific mechanisms (not just "the app should be secure")

### F. project-tracking.json Integration (if applicable)

If project-tracking.json exists:
- [ ] Every user story that was specified has a `spec` field with:
  - `feature_file`: path to the .feature file (and the file exists)
  - `rules`: non-empty array of rule summaries
  - `specified_at`: valid date
- [ ] If working on a specific version, that version has `spec_status` field
- [ ] `project.updated_at` was updated

### G. Tech Stack Completeness

- [ ] Tech stack table covers at minimum: runtime/language, framework, database, testing
- [ ] Every technology has a rationale (not blank)
- [ ] Rationales are specific to this project (not generic "it's popular")

## Output Format

Produce this exact report structure:

---

# Spec Writing Verification Report

**Date:** [today]
**SPECS.md location:** [path]
**Feature files found:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = all checks pass, ready for /research-and-architecture
PASS WITH WARNINGS = minor issues that won't block architecture, but should be fixed
FAIL = critical issues that must be fixed before proceeding

## Summary

| Area | Grade | Issues |
|------|-------|--------|
| A. SPECS.md Structure | [PASS/FAIL] | [count] |
| B. Feature Completeness | [PASS/FAIL] | [count] |
| C. Feature File Quality | [PASS/FAIL] | [count] |
| D. Cross-File Coherence | [PASS/FAIL] | [count] |
| E. NFR Quality | [PASS/FAIL] | [count] |
| F. project-tracking.json | [PASS/FAIL/N/A] | [count] |
| G. Tech Stack | [PASS/FAIL] | [count] |

## Critical Issues (Must Fix)

[List each critical issue with:]
- **Location:** file path and line/section
- **Issue:** what's wrong
- **Fix:** specific action to take

## Warnings (Should Fix)

[List each warning with same format]

## Recommendations

[Any suggestions for improvement that aren't strict failures]

## Next Step

[Either "Ready for /research-and-architecture" or "Fix [N] critical issues first, then re-run /spec-writing-verification"]

---
```

### After the Agent Returns

1. Present the report to the user
2. If the verdict is **FAIL**: list the critical issues and ask if they want to fix them now
3. If the verdict is **PASS WITH WARNINGS**: show warnings and ask if they want to address them or proceed
4. If the verdict is **PASS**: confirm readiness and suggest running `/research-and-architecture`

## What This Skill Does NOT Do

- It does not rewrite or fix the specs — it only reports issues
- It does not assess whether the features are good ideas — it checks structural quality
- It does not replace human review — it catches mechanical issues the human might miss
