# ARCHITECTURE.md Template

Use this template to produce the final `specs/ARCHITECTURE.md`. Adapt sections as needed — not every project requires every section. Remove sections that don't apply. The document is project-wide and additive: when new stories require new modules, the file is enriched in place rather than duplicated per version.

---

```markdown
# [Project Name] — Architecture

> [One-sentence architecture summary]

**Last updated:** [date]
**Based on:** `specs/PROJECT.md` and `specs/stories.json` (last updated [date])
**Architecture approach:** MIM AA (Module Infrastructure-Module)

## Table of Contents

## 1. Architecture Overview

### 1.1 High-Level Diagram

[ASCII or Mermaid diagram showing modules, their relationships, and external systems]

### 1.2 Architecture Approach

Brief explanation of why MIM AA was chosen for this project and how it maps to the story backlog defined in `specs/stories.json`.

### 1.3 Key Architecture Decisions

| #       | Decision   | Rationale | Alternatives Considered    |
| ------- | ---------- | --------- | -------------------------- |
| ADR-001 | [decision] | [why]     | [what else was considered] |
| ADR-002 | [decision] | [why]     | [what else was considered] |

## 2. Tech Stack

### 2.1 Final Stack

| Layer   | Technology | Version   | Rationale                     |
| ------- | ---------- | --------- | ----------------------------- |
| [layer] | [tech]     | [version] | [why — refined from `specs/PROJECT.md`'s tech-stack pointer] |

### 2.2 Stack Compatibility Notes

[Notes on how the chosen technologies work together, any known friction points, and mitigations]

### 2.3 Version Pinning Strategy

[How versions are managed — lockfiles, ranges, pinning policy]

## 3. Module Map

### 3.1 Business-Modules

| Module        | Process Owned         | Public API Surface      | Stories (from `specs/stories.json`) |
| ------------- | --------------------- | ----------------------- | ----------------------------------- |
| [module-name] | [process description] | [key methods/endpoints] | US-001, US-003                      |

### 3.2 Infrastructure-Modules

| Infra-Module        | Parent BM   | Responsibilities        |
| ------------------- | ----------- | ----------------------- |
| [module-name]-infra | [parent BM] | [what infra it handles] |

### 3.3 Standalone / Shared Modules

| Module        | Purpose                       |
| ------------- | ----------------------------- |
| [module-name] | [shared concern it addresses] |

### 3.4 Module Dependency Graph

[ASCII or Mermaid diagram showing module dependencies — must be acyclic]

## 4. Module Details

### 4.1 [Module Name]

**Type:** Business-Module
**Process:** [what business process this owns]
**Stories:** US-001, US-002 (and any future stories that touch this module)
**Public API:**

- `[method/endpoint signature]` — [what it does]

**Internal structure:**
```

module-name/
├── [key files/directories]
└── ...

```

**Data ownership:** [what data/schema this module owns]
**Dependencies:** [which other modules it depends on, and why]

[Repeat 4.x for each module]

## 5. Entrypoint & Bootstrap

### 5.1 Application Entrypoint

[How the app starts, what the entrypoint module does]

### 5.2 Dependency Wiring

[How modules are bootstrapped and wired together — DI container, manual wiring, etc.]

### 5.3 Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| Authentication | [how] |
| Authorization | [how] |
| Logging | [how] |
| Error handling | [how] |
| Observability | [how] |

## 6. Data Architecture

### 6.1 Data Ownership Map

| Module | Data Store | Schema/Collection | Access Pattern |
|--------|-----------|-------------------|----------------|
| [module] | [store type] | [schema name] | [read-heavy, write-heavy, etc.] |

### 6.2 Data Flow

[How data moves between modules — always through public APIs, never direct DB access]

### 6.3 Data Contracts

[Key data structures exchanged between modules at their API boundaries]

## 7. Communication Patterns

### 7.1 Synchronous

[Which modules call each other directly, and the contract shape]

### 7.2 Asynchronous (if applicable)

[Message bus, event system — only if truly needed]

### 7.3 External Integrations

| External System | Module Responsible | Protocol | Notes |
|----------------|-------------------|----------|-------|
| [system] | [module] | [REST/gRPC/etc.] | [details] |

## 8. Testing Strategy

### 8.1 Test Approach per Module

| Module | Integration Tests | Sociable Unit Tests | Overlapping Unit Tests |
|--------|------------------|--------------------|-----------------------|
| [module] | [yes/no — why] | [yes/no — why] | [yes/no — why] |

### 8.2 Test Infrastructure

[Test runners, frameworks, fixtures, test database strategy]

### 8.3 Mapping to Gherkin Features

[How the `.feature` files from `specs/story-NNN-slug/features/` map to actual test implementations across modules. Each story owns its feature files; the architecture only documents the test-strategy patterns each module uses.]

## 9. Deployment & Infrastructure

### 9.1 Deployment Strategy

[How the app is deployed — single artifact, per-module, etc.]

### 9.2 Environment Configuration

[How configuration varies across environments]

## 10. Best Practices & Conventions

### 10.1 Code Organization Rules

[Specific rules for this project derived from MIM AA + the chosen stack]

### 10.2 Stack-Specific Best Practices

[Best practices for the specific technologies in the stack]

### 10.3 Security Considerations

[Security practices relevant to the architecture]

## 11. Migration & Evolution Path

### 11.1 Module Extraction Readiness

[Which modules could be extracted to microservices if needed, and what would change]

### 11.2 Known Limitations

[Current architecture limitations and planned evolution]

## Glossary

| Term | Definition |
|------|-----------|
| BM | Business-Module — contains business logic, no infrastructure code |
| Infra-Module | Infrastructure-Module — implements I/O for exactly one BM |
| [domain term] | [definition from `specs/PROJECT.md` glossary] |
```
