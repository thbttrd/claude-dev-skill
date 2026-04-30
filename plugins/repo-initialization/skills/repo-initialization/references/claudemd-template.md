# CLAUDE.md Template

Generate CLAUDE.md by filling in the placeholders below with details from SPECS.md
and ARCHITECTURE.md. Remove any sections that don't apply to the project.

---

```markdown
# CLAUDE.md

## Project Overview

[Project name] — [one-line description from SPECS.md]

## Tech Stack

- **Runtime:** [runtime] [version]
- **Package Manager:** [pm] [version]
- **Framework:** [framework] [version]
- **Language:** [language] [version]
- **Database:** [database] via [driver]
- **ORM:** [orm] [version]
- **Styling:** [css framework] [version]
- **UI Components:** [component library]
- **Test Runner:** [unit test tool] [version]
- **E2E / BDD:** [e2e tool] + [bdd plugin]

## Quality Commands

Run these to verify code quality. All must pass before committing.

```bash
# Type checking
[typecheck command]          # e.g., bunx tsc --noEmit

# Linting
[lint command]               # e.g., bun lint

# Formatting
[format check command]       # e.g., prettier --check .

# Unit + integration tests
[test command]               # e.g., bun test

# BDD / E2E tests
[bdd command]                # e.g., bun run bdd

# All quality gates at once
[typecheck] && [lint] && [format check] && [test]
```

## Architecture Rules (MIM AA)

This project follows **MIM AA** (Module Infrastructure-Module Application Architecture).

### Module Types

- **Business-Modules (BM):** Contain business logic only. **Zero** infrastructure code
  (no database, no file system, no HTTP). Located in `src/modules/<name>/`.
- **Infrastructure-Modules (Infra):** Implement I/O for exactly one BM. Located in
  `src/modules/<name>-infra/`. Contain repositories, schema, bootstrap functions.
- **Standalone:** `shared-kernel` (pure types, constants, utils — zero I/O) and
  `shared-infra` (DB connection, middleware, response helpers).

### Dependency Direction

```
Infra-Module → Business-Module → shared-kernel
Infra-Module → shared-infra → shared-kernel
```

**NEVER:** BM imports from Infra-Module. Infra-Module imports from another Infra-Module.

### Data Encapsulation

- Each module owns its database tables. No cross-module foreign keys.
- Cross-module data access goes through public APIs only (method calls on services).
- Never import another module's schema or query another module's tables directly.

### Public API

- Each module's `index.ts` is its public API. Only import from `@/modules/<name>`,
  never from `@/modules/<name>/internal-file`.
- Route handlers import from Infra-Module bootstraps (e.g., `getCardCatalogService()`),
  not directly from BMs.

## Module Map

[List all modules from ARCHITECTURE.md section 3]

| Module | Type | Process |
|--------|------|---------|
| [name] | BM | [what it owns] |
| [name]-infra | Infra | [I/O for parent BM] |
| shared-kernel | Standalone | Pure types, constants, utils |
| shared-infra | Standalone | DB connection, middleware |

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format
```
<type>(<scope>): <short description>
```

### Allowed Types
`feat` | `fix` | `chore` | `test` | `refactor` | `docs` | `style` | `ci`

### Scope
- Feature work: use feature ID (e.g., `feat(F-001): add study session`)
- Non-feature: use descriptive scope (e.g., `chore(deps): update vitest`)

## Testing Rules

1. **Steps-first TDD:** Write BDD step definitions and unit tests BEFORE implementation.
2. **Hand-written fakes, not mocks:** Use in-memory implementations of repository
   interfaces. Never use `vi.mock()` or `jest.mock()`.
3. **Sociable unit tests:** Test services through their public API with fakes injected.
4. **Integration tests:** Test with real database (in-memory SQLite or test DB).
5. **Co-locate tests:** `*.test.ts` files next to the code they test.

## File Naming

- Services: `<module-name>.service.ts`
- Repositories: `<entity>.repository.ts`
- Schema: `schema.ts` (one per Infra-Module)
- Types: `types.ts` (one per module)
- Pure algorithms: descriptive name (e.g., `spaced-repetition.ts`, `streak-calculator.ts`)
- Tests: `<file-name>.test.ts` (co-located)
- Fakes: `__tests__/fakes/fake-<interface-name>.ts`

## Common Mistakes to Avoid

- Putting business logic in route handlers — delegate to services
- Importing from BM internals instead of the module's `index.ts`
- Using mocking frameworks instead of hand-written fakes
- Adding foreign keys between modules in ORM schema
- Querying another module's database tables directly
- Committing without running quality commands
- Creating files outside the module structure defined in ARCHITECTURE.md
```
