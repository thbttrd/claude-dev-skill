# PLAN: US-000 — Foundation

## R — Requirements

Greet visitors; remember them.

## E — Entities

- Visitor { name }

## A — Approach

A single module `greeter`.

## S — Structure

- `src/hello.ts`

## O — Operations

### Operation 1: Greet

Covers scenarios: Greeting a visitor, Greeting by name

RED-A → RED-B → GREEN → REFACTOR

### Operation 2: Persist

Covers scenarios: Remembering a visitor

RED-A → RED-B → GREEN → REFACTOR

## N — Norms

- no default exports

## S — Safeguards

- names are trimmed before use

## Test Plan

| ID | Type | Op | Scenario | File |
|---|---|---|---|---|
| T-01 | BDD | Op-1 | Greeting a visitor | tests/steps/greet.steps.ts |
| T-02 | BDD | Op-2 | Remembering a visitor | tests/steps/greet.steps.ts |
| T-03 | manual | Op-2 | Operator checks the log | specs/story-000-foundation/verification/qa-report.md |
