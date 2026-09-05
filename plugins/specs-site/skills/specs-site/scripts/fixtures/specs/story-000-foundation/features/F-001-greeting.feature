@US-000 @F-001
Feature: Greeting
  Visitors get a hello.

  Background:
    Given the app is running

  Rule: Visitors are greeted

    @happy-path
    Scenario: Greeting a visitor
      Given a visitor
      When they arrive
      Then they see:
        | text  |
        | Hello |

    Scenario Outline: Greeting by name
      Given a visitor named "<name>"
      Then they see "Hello <name>"
      Examples:
        | name |
        | Ada  |
        | Bob  |

  Scenario: Remembering a visitor
    Given a visitor who came yesterday
    When they arrive
    Then they see "Welcome back"

  @manual
  Scenario: Operator checks the log
    Given the operator opens the log
    Then yesterday's visit is listed
