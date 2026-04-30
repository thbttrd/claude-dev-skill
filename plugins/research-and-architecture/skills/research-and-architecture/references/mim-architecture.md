# MIM AA Reference — Module Infrastructure-Module Application Architecture

## Table of Contents

1. [Core Concept](#core-concept)
2. [Module Types](#module-types)
3. [Module Design Principles](#module-design-principles)
4. [Module Characteristics](#module-characteristics)
5. [Dependency Rules](#dependency-rules)
6. [Project Structure](#project-structure)
7. [Inter-Module Communication](#inter-module-communication)
8. [Data Management](#data-management)
9. [Testing Strategy](#testing-strategy)
10. [Design Heuristics](#design-heuristics)
11. [Compatibility with Other Approaches](#compatibility)

---

## Core Concept

Instead of forcing an application into prescriptive templates (Clean Architecture, Hexagonal, etc.), MIM returns to basics of **Modular Software Design**. Divide the application into independent modules, each containing business logic for a specific process. For modules with complex business logic, extract infrastructure-related code into separate **Infrastructure-Modules**.

## Module Types

Exactly **two** core module types:

### Business-Modules (BM)
- Contain business logic for a specific process
- **No infrastructure code** (no database, HTTP, file system, or network calls)
- Expose a clear public API
- Encapsulate their data

### Infrastructure-Modules (Infra-Modules)
- Belong to **exactly one** Business-Module
- Contain **zero** business logic
- Implement interfaces defined by their Business-Module (Dependency Inversion)
- Handle: HTTP handlers/clients, database connectivity, message bus, file system, all I/O
- Contain bootstrap/dependency injection configuration for their BM
- **NOT layers** — an Infra-Module is used only by its BM
- Shared infrastructure code goes into a standalone module or library

## Module Design Principles

From classic Modular Design:

- **Information Hiding**: Hide implementation behind a simple public API
- **High Cohesion**: Related code stays together; unrelated code goes elsewhere
- **Low Coupling**: Minimize interactions between modules; keep them intentional
- **Deep Modules**: Powerful functionality behind a simple interface (maximize feature-to-interface ratio)
- **Acyclic Dependencies**: No circular references in the module dependency graph
- **Balancing Coupling**: Consider strength, distance, and volatility

## Module Characteristics

Each module must:
- Be **responsible for a process** (owns one or more business processes/features)
- Have an **explicit, public API** (private/internal by default; public only when necessary)
- **Encapsulate its data** (private database/schema, no foreign keys between modules)
- Be **self-contained** (everything required embedded inside)
- Have **minimal communication** (not chatty; low collaborator count)
- Be **replaceable** (clear public API enables swapping)

## Dependency Rules

- Infrastructure-Module depends on (points to) Business-Module — **never the reverse**
- Business-Modules must have **ZERO** compile-time dependencies on Infra-Modules
- Higher-level modules never depend on lower-level modules
- To reverse dependency flow: higher-level module exposes interface, lower-level implements it (DIP)
- Module dependency graph must remain **acyclic**

## Project Structure

### Pattern

```
project/
├── entrypoint/           # Application entry — bootstraps and wires all modules
│
├── modules/
│   ├── feature-a/        # Business-Module: owns the "feature-a" process
│   │   ├── public API
│   │   └── internal logic (no infra code)
│   │
│   ├── feature-a-infra/  # Infrastructure-Module for feature-a
│   │   ├── implements feature-a interfaces
│   │   ├── database, HTTP, messaging code
│   │   └── bootstrap/DI for feature-a
│   │
│   ├── feature-b/        # BM (simple — may not need an Infra-Module)
│   │
│   ├── feature-c/        # BM
│   ├── feature-c-infra/  # Infra-Module for feature-c
│   │
│   └── shared-infra/     # Standalone module for shared infrastructure utilities
│
└── cross-cutting/        # Authorization, observability, logging (in entrypoint)
```

### Entrypoint Module
- Contains `main()` function
- Bootstraps all modules and wires dependencies
- Handles cross-cutting concerns (auth, observability, logging)
- Depends on most modules
- Must NOT become a "God module"

### Bootstrap
Each module has a single "Bootstrap" place. The entrypoint connects modules together.

## Inter-Module Communication

- **Default**: Plain method invocations (direct calls between BMs at the same level)
- Interfaces are optional but helpful for abstraction
- **Avoid**: mediator patterns by default; event-based communication (adds complexity, doesn't actually remove coupling); async communication between same-process modules

## Data Management

- Modules must NOT query other modules' databases directly
- All data access through public API only
- Private schemas acceptable, never shared
- No foreign keys between modules

## Testing Strategy — Adaptive Testing Approach

All three levels are **optional**, chosen based on need:

### 1. Integration Tests
- Test all application modules combined
- Include owned dependencies (database, message bus)
- Substitute external dependencies with test doubles
- Use when at least one Infra-Module exists

### 2. Sociable Unit Tests
- Test Business-Modules as units via their public API
- No class-by-class isolation
- Use hand-written Fakes (not mocks)
- Business-oriented, testing visible behaviors
- Apply when BMs have complex logic

### 3. Overlapping Unit Tests
- Test individual classes or groups of classes
- For complex algorithms or corner cases
- Supplement, don't replace, Sociable Unit Tests

## Design Heuristics

- Avoid fine-grained modules (represent processes/subprocesses, not single actions)
- Make dependencies explicit (in bootstrap code, not hidden via service discovery)
- Design each module as if it might become a microservice
- "Module per Developer" — modules can be split for parallel work

## Compatibility

- **DDD**: Bounded Contexts group one or more Modules
- **CQRS / Event Sourcing**: Mix techniques per module as needed
- **Vertical Slice**: MIM modules are larger than VSA slices, explicitly separate infrastructure
- **Modular Monolith**: MIM prevents "Big Ball of Mud"
- Good module boundaries enable future microservice extraction

## Naming Conventions

- **Avoid** internal namespaces like `Interfaces`, `Helpers`, `Extensions`, `Domain`, `Application`
- **Use** domain language reflecting business capabilities (e.g., `BatteryAlarms`, not `Services`)
- Module names should reflect the process they own — "screaming architecture"
- Access modifiers: private/internal by default; public only when necessary

## Key References

- "A Philosophy of Software Design" by John Ousterhout
- Simon Brown: "Modular Monoliths" (GOTO 2018)
- "Balancing Coupling in Software Design" by Vlad Khononov
