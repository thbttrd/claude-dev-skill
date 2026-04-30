# Project Tracking JSON Schema

`project-tracking.json` is the **single source of truth** for the entire project lifecycle. It lives at `docs/project-tracking.json` — **never** at the repository root. If a legacy file is found at the repo root, it must be moved under `docs/` before any skill modifies it.

## Documentation Layout This File References

All version-specific documentation is organized per version under `docs/V{N}/`:

```
docs/
├── project-tracking.json                        # this file — project-wide, not version-scoped
├── V0/
│   ├── specs/
│   │   ├── SPECS.md
│   │   ├── UI-SPECS.md
│   │   ├── UI-F-NNN-*.md
│   │   ├── features/F-NNN-*.feature
│   │   └── wireframes/*.png
│   ├── architecture/
│   │   ├── ARCHITECTURE.md
│   │   ├── architecture.png                     # high-level diagram
│   │   └── architecture-detailed.png            # detailed MIM AA diagram
│   ├── plans/
│   │   ├── 00-foundation.md
│   │   ├── DAG.md
│   │   ├── W*-*.md
│   │   └── implementation-state.json
│   └── qa-report.md
├── V1/ ... (same shape, seeded by copying docs/V0/ before V1 work starts)
└── V2/ ...
```

**Version snapshot rule:** when work on V{N} (N ≥ 1) begins, the first skill invoked for that version must first copy `docs/V{N-1}/ → docs/V{N}/` verbatim, then modify only the V{N} copy. V0 is the only version seeded from scratch (by `/high-level-scoping`, `/spec-writing`, etc.).

**All paths stored inside project-tracking.json that refer to version-specific artifacts must include the version segment** (e.g., `docs/V0/specs/features/F-001-*.feature`, `docs/V0/architecture/ARCHITECTURE.md`, `docs/V0/plans/`). Paths that point to the historical V0 artifacts must keep saying `V0` even after V1 or V2 work has started — the paths stay pinned to the version whose artifacts they describe.

## Shared File — Multi-Skill Ownership

This file is created by `/high-level-scoping` and progressively enriched by other skills:

| Skill                        | Owns these sections                                                                                  | When                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/high-level-scoping`        | `project`, `personas`, `epics` (with `user_stories`), `architecture` (high-level modules), `roadmap` | Project kickoff                                        |
| `/spec-writing`              | Adds fields to `user_stories` and `roadmap.versions` (specs, feature files)                          | When deep-diving a version for sprint implementation   |
| `/research-and-architecture` | Enriches `architecture` (detailed modules, tech stack, ADRs)                                         | When designing the detailed architecture for a version |
| Other skills                 | Add their own top-level keys or enrich existing objects                                              | As needed                                              |

**Rules for all skills:**

- NEVER delete or overwrite fields owned by another skill
- ALWAYS read the existing file first (from `docs/project-tracking.json`), merge your changes, and write back to the same path
- ALWAYS update `project.updated_at` when modifying the file
- New top-level keys are allowed — the schema is open for extension

---

## Base Schema (created by `/high-level-scoping`)

```json
{
  "project": {
    "name": "string — project name",
    "description": "string — one-paragraph elevator pitch",
    "created_at": "string — ISO date (YYYY-MM-DD)",
    "updated_at": "string — ISO date"
  },
  "personas": [
    {
      "id": "P-001",
      "name": "string — short persona name (e.g. 'Busy Parent', 'Store Manager')",
      "role": "string — their role or context",
      "goals": ["string — what they want to achieve"],
      "pain_points": ["string — what frustrates them today"],
      "tech_savviness": "low | medium | high",
      "primary": true
    }
  ],
  "epics": [
    {
      "id": "E-001",
      "title": "string — short epic title",
      "description": "string — 2-3 sentence description of the epic's scope",
      "persona_ids": ["P-001"],
      "priority": "must-have | should-have | could-have | wont-have",
      "business_impact": "high | medium | low",
      "user_stories": [
        {
          "id": "US-001",
          "title": "string — short story title",
          "as_a": "string — persona or role",
          "i_want": "string — the action or capability",
          "so_that": "string — the benefit or goal",
          "priority": "must-have | should-have | could-have | wont-have",
          "business_impact": "high | medium | low",
          "acceptance_criteria": ["string — concrete, testable criterion"]
        }
      ]
    }
  ],
  "architecture": {
    "modules": [
      {
        "id": "M-001",
        "name": "string — module name",
        "description": "string — what this module is responsible for",
        "responsibilities": ["string — key responsibility"],
        "depends_on": ["M-002"]
      }
    ],
    "diagram_path": "docs/V0/architecture/architecture.png"
  },
  "roadmap": {
    "versions": [
      {
        "id": "V0",
        "name": "Walking Skeleton",
        "goal": "string — what this version proves or enables",
        "description": "string — what the user can do end-to-end with this version",
        "user_story_ids": ["US-001", "US-005"],
        "target_sprint": "string — optional sprint or timeframe estimate"
      }
    ]
  }
}
```

## Fields added by `/spec-writing`

When `/spec-writing` deep-dives a version, it enriches the existing objects. All paths it writes back must point inside that version's directory:

```json
// Added to each user_story that gets specified for version VN:
{
  "id": "US-001",
  "...existing fields...": "",
  "spec": {
    "feature_file": "docs/V0/specs/features/F-001-feature-name.feature",
    "rules": ["Rule summary 1", "Rule summary 2"],
    "specified_at": "2026-04-10",
    "specified_in_version": "V0"
  }
}

// Added to each roadmap version that gets specified:
{
  "id": "V1",
  "...existing fields...": "",
  "spec_status": "draft | complete | reviewed",
  "specs_completed_at": "2026-04-10"
}
```

When a later version re-specifies the same story (after duplicating prior version's docs), update the story's `spec.feature_file` to the new version's path and bump `specified_in_version`.

## Fields added by `/research-and-architecture`

When `/research-and-architecture` designs the detailed architecture for a version, all paths point inside that version's directory:

```json
// Enriches the architecture section (paths pinned to the version being architected):
{
  "architecture": {
    "modules": ["...existing..."],
    "diagram_path": "docs/V0/architecture/architecture.png",
    "tech_stack": {
      "layer": "technology",
      "...": "..."
    },
    "adrs": [
      {
        "id": "ADR-001",
        "title": "string",
        "decision": "string",
        "rationale": "string",
        "alternatives": ["string"]
      }
    ],
    "detailed_diagram_path": "docs/V0/architecture/architecture-detailed.png",
    "architecture_doc": "docs/V0/architecture/ARCHITECTURE.md",
    "detailed_at": "2026-04-12",
    "detailed_in_version": "V0"
  }
}
```

## Fields added by `/plan-writing`, `/test-setup`, `/spec-implementation`, `/verification-and-validation`

Each of these skills enriches its version entry in `roadmap.versions`. All paths must point inside `docs/V{N}/`:

```json
{
  "id": "V0",
  "planning": {
    "status": "planned",
    "plan_dir": "docs/V0/plans/",
    "dag_file": "docs/V0/plans/DAG.md",
    "waves_count": 4,
    "total_tasks": 18,
    "planned_at": "2026-04-09"
  },
  "test_setup": {
    "status": "completed",
    "waves_tested": 3,
    "bdd_step_files": 5,
    "unit_test_files": 8,
    "completed_at": "2026-04-10"
  },
  "implementation": {
    "status": "completed",
    "current_wave": 2,
    "waves_completed": 3,
    "started_at": "2026-04-09",
    "completed_at": "2026-04-10"
  },
  "qa": {
    "status": "passed",
    "report": "docs/V0/qa-report.md",
    "tested_at": "2026-04-10"
  }
}
```

---

## ID Conventions

| Entity                       | Prefix | Example | Introduced by              |
| ---------------------------- | ------ | ------- | -------------------------- |
| Persona                      | P-     | P-001   | /high-level-scoping        |
| Epic                         | E-     | E-001   | /high-level-scoping        |
| User Story                   | US-    | US-001  | /high-level-scoping        |
| Module (high-level)          | M-     | M-001   | /high-level-scoping        |
| Module (detailed MIM)        | BM-    | BM-001  | /research-and-architecture |
| Architecture Decision Record | ADR-   | ADR-001 | /research-and-architecture |
| Version                      | V      | V0, V1  | /high-level-scoping        |

- IDs are **sequential within their type** (P-001, P-002, ...).
- User Story IDs are **globally unique** across all epics (US-001, US-002, ...) — not reset per epic.
- Version IDs start at V0 (walking skeleton) and increment (V1, V2, ...).

## Priority System (MoSCoW)

- **must-have**: Non-negotiable for launch. Without this, the product has no value.
- **should-have**: Important but not blocking. The product works without it, but it's painful.
- **could-have**: Nice-to-have. Adds polish or convenience.
- **wont-have**: Explicitly out of scope for now. Documented so it's not forgotten.

## Business Impact

- **high**: Directly tied to the core value proposition or a key metric.
- **medium**: Supports the core value prop but isn't the main draw.
- **low**: Quality-of-life improvement, not tied to key metrics.

## Rules

- Every user story MUST have at least 2 acceptance criteria.
- Every epic MUST be linked to at least one persona.
- Every user story in the roadmap MUST exist in an epic.
- V0 MUST contain at least one user story from the highest-priority epic.
- Each version MUST be a vertical slice — a working end-to-end app, not a horizontal layer.
- Every path stored in this file MUST point under `docs/V{N}/` for version-scoped artifacts, or under `docs/` for project-wide artifacts. Never write paths that omit the `V{N}` segment for version-specific docs.
