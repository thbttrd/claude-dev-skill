# Feature File Template & Conventions

Feature files use standard Gherkin syntax that can be parsed and executed by BDD frameworks like cucumber-js, behave (Python), SpecFlow (.NET), or any Cucumber-compatible runner.

---

## File Naming

```
docs/V{N}/specs/features/
├── F-001-study-session.feature
├── F-002-spaced-repetition.feature
├── F-003-topic-organization.feature
└── ...
```

**Convention:** `F-NNN-kebab-case-slug.feature` where `F-NNN` matches the feature ID in SPECS.md. All feature files live in `docs/V{N}/specs/features/`.

---

## Template

```gherkin
@F-001 @domain-tag
Feature: [Feature name in natural language]
  As a [role]
  I want to [action]
  So that [benefit]

  # Optional: shared preconditions for all scenarios in this feature
  Background:
    Given [common precondition shared by most/all scenarios]

  Rule: [Business rule description — same text as in SPECS.md Rules list]

    @happy-path
    Scenario: [Descriptive name for the successful case]
      Given [precondition]
      When [action]
      Then [expected outcome]

    @sad-path
    Scenario: [Descriptive name for the failure/rejection case]
      Given [precondition that leads to failure]
      When [action]
      Then [expected error or rejection behavior]

    @edge-case
    Scenario: [Descriptive name for the boundary case]
      Given [edge-case precondition]
      When [action]
      Then [expected outcome at the boundary]

  Rule: [Another business rule]

    @happy-path
    Scenario: [Scenario name]
      Given [precondition]
      When [action]
      Then [expected outcome]

    @sad-path
    Scenario: [Scenario name]
      Given [precondition]
      When [action]
      Then [expected outcome]
```

---

## Tags

Tags enable selective test execution (`cucumber --tags "@F-001"`) and reporting.

### Required Tags

| Tag      | Where         | Purpose                             |
| -------- | ------------- | ----------------------------------- |
| `@F-NNN` | Feature level | Links to the feature ID in SPECS.md |

### Recommended Tags

| Tag           | Where          | Purpose                                   |
| ------------- | -------------- | ----------------------------------------- |
| `@happy-path` | Scenario level | The expected successful case              |
| `@sad-path`   | Scenario level | Failure, rejection, or error cases        |
| `@edge-case`  | Scenario level | Boundary conditions, empty states, limits |

### Optional Tags

| Tag                                          | Where               | Purpose                                          |
| -------------------------------------------- | ------------------- | ------------------------------------------------ |
| `@wip`                                       | Feature or Scenario | Work in progress — not yet implemented           |
| `@slow`                                      | Scenario level      | Long-running test, may be excluded from fast CI  |
| `@manual`                                    | Scenario level      | Cannot be automated, requires human verification |
| Domain tags (e.g., `@auth`, `@cart`, `@api`) | Feature level       | Group features by domain area                    |

---

## Gherkin Syntax Rules

These rules ensure the `.feature` files are valid and parseable by any Cucumber-compatible framework:

1. **One `Feature:` per file.** Each `.feature` file contains exactly one Feature block.

2. **`Rule:` blocks group related scenarios** under a business rule. Rules appear inside a Feature and contain Scenarios. This is Gherkin 6+ syntax — supported by cucumber-js 7+, Cucumber-JVM 6+, SpecFlow 3.9+.

3. **`Background:` is optional.** Use it when most/all scenarios in the feature share the same Given steps. Background runs before each Scenario. Place it directly under `Feature:` (applies to all scenarios) or under a `Rule:` (applies only to that rule's scenarios).

4. **Steps use keywords:** `Given`, `When`, `Then`, `And`, `But`. Each step is on its own line.

5. **`Scenario Outline:` with `Examples:`** for data-driven scenarios:

   ```gherkin
   Scenario Outline: Rating a card updates the interval
     Given a card with a current interval of <current_interval> days
     When I rate it "<rating>"
     Then the next review date should be set to <new_interval> days from now

     Examples:
       | current_interval | rating    | new_interval |
       | 1                | Know it   | 3            |
       | 3                | Partially | 3            |
       | 7                | Don't know| 1            |
   ```

6. **Doc Strings** for multi-line text (triple quotes):

   ```gherkin
   Scenario: API returns error for invalid card
     When I send a POST request to /api/cards with:
       """json
       { "answer": "Some answer" }
       """
     Then the API should return 400 with a validation error message
   ```

7. **Data Tables** for structured data:

   ```gherkin
   Scenario: Viewing the topic tree
     Given the following main topics exist:
       | Main Topic     | Subtopics                        |
       | AWS Services   | Core Services, Compute           |
       | IAM & Security | IAM Fundamentals, IAM Policies   |
     When I view the topic list
     Then I should see all main topics with their subtopics
   ```

8. **Indentation:** 2 spaces per nesting level. Feature is at root, Rule indented 2 spaces, Scenario indented 4 spaces, steps indented 6 spaces. Tags go on the line above the element they annotate, at the same indentation level.

---

## Writing Style

- **Declarative, not imperative.** Describe behavior, not UI interactions. "Given I have 3 items in my cart" not "Given I clicked Add to Cart 3 times".
- **Concrete, not vague.** "Then I should see error 'Email is required'" not "Then I should see an appropriate error".
- **Third person or first person consistently.** Pick one ("I" or "the user") and stick with it across all feature files.
- **Scenario names should be unique and descriptive.** Someone reading just the scenario names should understand what the feature does.
- **Keep scenarios independent.** Each scenario should be self-contained — don't rely on state from a previous scenario. Use `Background:` for shared setup.

---

## Relationship to SPECS.md

Each `.feature` file corresponds to a feature section in SPECS.md:

| SPECS.md                             | Feature file                                        |
| ------------------------------------ | --------------------------------------------------- |
| Feature ID (F-001)                   | `@F-001` tag                                        |
| User Story (As a / I want / So that) | `Feature:` description (identical text)             |
| Rules bullet list                    | `Rule:` blocks (same text, expanded with scenarios) |
| —                                    | Full `Scenario:` blocks with Given/When/Then        |

The Rules listed in SPECS.md should be kept in sync with the `Rule:` blocks in the feature file. If a Rule is added or removed from either place, update the other.
