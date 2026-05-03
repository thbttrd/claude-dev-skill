---
name: spec-writing-verification
version: 2.0.0
description: >
  Per-story verification of the output of /spec-writing for completeness, coherence,
  INVEST compliance, and template fidelity. Spawns a fresh agent to audit
  specs/story-NNN-slug/STORY.md + specs/story-NNN-slug/features/*.feature against
  the spec-writing skill's templates and rules. Produces a structured compliance
  report with pass/fail verdicts, specific findings, and actionable recommendations
  (fix or proceed to /plan-writing). Use this skill after running /spec-writing for
  a specific story, before running /plan-writing for that same story. Also triggers
  on: "verify the spec for US-NNN", "audit the story spec", "check INVEST compliance",
  "are the specs ready", "validate spec before planning".
---

# Spec Writing Verification (per story)

Audits the artifacts produced by `/spec-writing` for **one story at a time** and produces a compliance report. This is a **quality gate** between spec-writing and plan-writing for that story.

The verification runs in a **fresh agent** (via the Agent tool) so the review has no context bias from the generation session.

## Pre-Flight

| Check                                       | Action                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/V*/` directory exists                 | Hard-stop with the migration command.                                                                                                           |
| `specs/stories.json` does not exist         | Hard-stop. Print: `No specs/stories.json found. Run /high-level-scoping first.`                                                                |
| Target story id missing                     | Ask the user which story to verify (default: stories whose `phase = specced`).                                                                  |
| `specs/story-NNN-slug/STORY.md` not found   | Hard-stop. Print: `Story US-NNN has no STORY.md yet. Run /spec-writing US-NNN first.`                                                          |

## When to Run

```
/spec-writing US-NNN → /spec-writing-verification US-NNN → /plan-writing US-NNN
```

## What Gets Verified

| Artifact      | Expected Location                                              |
| ------------- | -------------------------------------------------------------- |
| STORY.md      | `specs/story-NNN-slug/STORY.md`                                |
| Feature files | `specs/story-NNN-slug/features/F-NNN-*.feature`                |
| stories.json  | `specs/stories.json` — for cross-checking the INVEST flags and `phase` |

UI artifacts (`specs/DESIGN.md`, `specs/story-NNN-slug/ui/UI-F-NNN-*.md`, `specs/story-NNN-slug/mockups/*.html`) are produced by `/ui-specs` and verified by its own review pass — out of scope here.

## Execution

**Spawn a fresh Opus agent** with the audit prompt below. Do not perform the audit inline — the fresh context is the point.

### Agent Prompt

Use the Agent tool with `model: "opus"` and the following prompt (fill in the story id and paths):

```
You are a specification quality auditor for the story-based workflow. Your job
is to verify that the output of /spec-writing for story US-NNN is complete,
coherent, and template-compliant.

## Artifacts to Audit

Read these files:
1. specs/story-NNN-slug/STORY.md
2. Every .feature file in specs/story-NNN-slug/features/
3. specs/stories.json — find the entry where id = "US-NNN" and use it for cross-checks

Do NOT audit specs/DESIGN.md or specs/story-NNN-slug/{mockups,ui}/ — those belong
to /ui-specs.

## Reference Documents

- specs/<plugin>/spec-writing/references/story-md-template.md
- specs/<plugin>/spec-writing/references/feature-file-template.md

## Verification Checklist

### A. STORY.md Structure (Template Compliance)

Check that STORY.md contains ALL of these:
- [ ] Header line with epic, priority, business impact
- [ ] Header line with phase, foundation flag, depends_on, mockup links (if UI), specification date
- [ ] User Story section with As a / I want / So that — all three parts
- [ ] INVEST Check table with all six letters and a note for each
- [ ] Acceptance Criteria list with ≥ 2 entries, each as a checkbox
- [ ] Rules list with ≥ 1 entry, each with a sad-path note
- [ ] Feature files mapping table
- [ ] Out-of-scope section (or explicit "—" with rationale)
- [ ] Notes section (may be empty)

### B. INVEST Compliance

- [ ] Every INVEST letter is `✅` (the gate ran and passed)
- [ ] STORY.md INVEST table matches `specs/stories.json#stories[i].invest`
- [ ] `invest.checked_at` is set to a valid date
- [ ] If any letter is `❌`, the agent flags it as a critical failure and the verdict is FAIL

### C. Feature File Quality (Per .feature File)

For EACH .feature file in specs/story-NNN-slug/features/, verify:

**Structural:**
- [ ] File name follows convention: F-NNN-kebab-case-slug.feature
- [ ] Contains exactly one Feature: block
- [ ] Has both @US-NNN and @F-NNN tags at feature level
- [ ] Feature description ties back to the User Story in STORY.md
- [ ] Uses Rule: blocks to group scenarios; Rule: titles match the Rules list in STORY.md

**Scenario Coverage:**
- [ ] Every Rule: block has at least one @happy-path scenario
- [ ] Every Rule: block has at least one @sad-path scenario
- [ ] Every Acceptance Criterion in STORY.md is covered by at least one scenario
- [ ] Scenarios are tagged (@happy-path, @sad-path, @edge-case)

**Writing Quality:**
- [ ] Scenarios use declarative language (behaviour, not UI clicks)
- [ ] Given/When/Then steps are concrete — flag every occurrence of vague words:
      "appropriate", "properly", "correctly", "valid", "invalid" without specifics,
      "should work", "as expected"
- [ ] Scenario names are unique within the story
- [ ] Steps use consistent person (all "I" or all "the user", not mixed)

**Gherkin Syntax:**
- [ ] Valid Gherkin parseable by Cucumber
- [ ] Proper indentation (2 spaces per level)
- [ ] Scenario Outline uses Examples: table correctly (if used)
- [ ] Data Tables and Doc Strings well-formed (if used)

### D. Cross-File Coherence

- [ ] Every Feature ID in STORY.md's mapping table has a matching .feature file on disk
- [ ] Every .feature file in features/ appears in STORY.md's mapping table (no orphans)
- [ ] Rules in STORY.md and Rule: blocks in .feature files match (count + text)
- [ ] No contradictory scenarios across feature files
- [ ] Glossary terms used in scenarios are defined in specs/PROJECT.md
- [ ] Tags are consistent: every scenario tagged with at least @happy-path | @sad-path | @edge-case

### E. specs/stories.json Integration

- [ ] `stories[i].artifacts.story_doc` points at STORY.md and the file exists
- [ ] `stories[i].artifacts.feature_files` lists every .feature file present
- [ ] `stories[i].spec.specified_at` is a valid date
- [ ] `stories[i].phase` is `specced` (or beyond — verified is also acceptable for a re-audit)
- [ ] `stories[i].history` has at least one `{phase: "specced", at: ...}` entry
- [ ] `project.updated_at` was bumped recently

### F. Dependencies & DAG Sanity

- [ ] `stories[i].depends_on_story_ids` is non-empty (unless `is_foundation: true`)
- [ ] Every depended-on story exists in stories.json
- [ ] Every depended-on story is `is_foundation: true` OR has `phase: "verified"` (the dependency is satisfied)
- [ ] No cycle introduced (the new spec doesn't add a dependency that creates a cycle)

## Output Format

Produce this exact report structure:

---

# Spec Writing Verification Report — US-NNN

**Date:** [today]
**Story:** US-NNN — <title>
**STORY.md:** specs/story-NNN-slug/STORY.md
**Feature files:** [count]

## Overall Verdict: [PASS | PASS WITH WARNINGS | FAIL]

PASS = ready for /plan-writing US-NNN
PASS WITH WARNINGS = minor issues; consider fixing
FAIL = critical issues that must be fixed before /plan-writing

## Summary

| Area | Grade | Issues |
|------|-------|--------|
| A. STORY.md Structure | [PASS/FAIL] | [count] |
| B. INVEST Compliance | [PASS/FAIL] | [count] |
| C. Feature File Quality | [PASS/FAIL] | [count] |
| D. Cross-File Coherence | [PASS/FAIL] | [count] |
| E. stories.json Integration | [PASS/FAIL] | [count] |
| F. Dependencies & DAG | [PASS/FAIL] | [count] |

## Critical Issues (Must Fix)

[Each issue: location (file path + section/line), what's wrong, specific fix]

## Warnings (Should Fix)

## Recommendations

## Next Step

[Either "Ready for /plan-writing US-NNN" or "Fix [N] critical issues, then re-run /spec-writing-verification US-NNN"]

---
```

### After the Agent Returns

1. Present the report to the user.
2. If **FAIL**: list critical issues; ask if they want to fix now (loops back into `/spec-writing US-NNN` update mode).
3. If **PASS WITH WARNINGS**: show warnings; ask whether to address or proceed.
4. If **PASS**: confirm readiness and suggest running `/plan-writing US-NNN`.

## What This Skill Does NOT Do

- It does not rewrite or fix the spec — it reports issues.
- It does not assess whether the story is a good idea — it checks structural quality.
- It does not replace human review — it catches mechanical issues a human might miss.
