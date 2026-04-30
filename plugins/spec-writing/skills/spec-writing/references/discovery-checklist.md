# Discovery Checklist

Use this as a reference during the discovery phase. Don't walk through it mechanically — follow the conversation naturally and use this to make sure you haven't missed critical areas.

The categories are ordered roughly by importance: start with the core workflows and business rules, then expand outward.

---

## 1. Core Workflows & User Journeys

These questions define the skeleton of the application. Get these right first.

- What are the 2-3 main things a user does in this app? Walk me through each step by step.
- What does the user see first when they open the app?
- What's the "golden path" — the most common successful journey?
- Are there different types of users who do different things? (e.g., admin vs. regular user)
- What's the user's goal at the end of each workflow? How do they know they succeeded?

## 2. Business Rules & Validation

These are the rules that govern when things can or can't happen. They directly become Gherkin Rules.

- What constraints exist? (limits, thresholds, quotas, deadlines)
- What inputs does the user provide, and what makes them valid or invalid?
- Are there conditional behaviors? ("If X, then Y; otherwise Z")
- Are there time-based rules? (expiration, scheduling, cooldown periods)
- What calculations or formulas does the system apply?
- Are there any regulatory or compliance requirements?

## 3. Error Handling & Edge Cases

Where things go wrong. These become the sad-path scenarios.

- What happens when the user enters invalid data?
- What happens when an external service (payment, email, API) is down?
- What happens with concurrent actions? (two users editing the same thing)
- What happens at boundary values? (zero items, maximum items, empty states)
- Can actions be undone? Is there a cancel/undo flow?
- What happens if the user navigates away mid-workflow?

## 4. User Roles & Permissions

Who can do what.

- How many types of users are there?
- What can each role see and do?
- How are roles assigned? Can they change?
- Are there admin/superadmin capabilities?
- Is there an onboarding flow for new users?

## 5. Authentication & Authorization

How users prove who they are and what they're allowed to do.

- How do users sign up and log in? (email/password, OAuth, magic link, etc.)
- Is there multi-factor authentication?
- How are sessions managed? (token expiry, remember me, concurrent sessions)
- What happens when a session expires mid-action?
- Are there public (unauthenticated) pages?

## 6. UI/UX Behavior & States

What the user sees and interacts with.

- What are the main pages/views/screens?
- What loading states exist? (skeleton, spinner, progressive loading)
- What empty states exist? (no items, no results, first-time use)
- Are there modals, drawers, or multi-step forms?
- Is the UI responsive? What's the primary device target? (mobile-first? desktop-first?)
- Are there notifications, toasts, or alerts? When do they appear?
- Is there real-time behavior? (live updates, WebSockets, polling)

> **Design system, color palette, typography, layout patterns, component patterns** are owned by the dedicated `/ui-specs` skill, which is auto-invoked from Phase 1.5 of this skill whenever the project has a UI. Don't probe those areas here — let `/ui-specs` run its own discovery batches.

## 7. API & Integrations

How the system talks to the outside world and to itself.

- Is this a full-stack app or does it consume an external API?
- What third-party services does it integrate with? (payment, email, storage, analytics)
- What does the API contract look like? (REST, GraphQL, tRPC)
- Are there webhooks or event-driven integrations?
- How is API versioning handled?
- What are the rate limits?

## 8. Data Model & State

What the system remembers and how.

- What are the main entities? (User, Product, Order, etc.)
- How do they relate to each other? (one-to-many, many-to-many)
- What data is required vs. optional?
- Is there soft delete or hard delete?
- Is there data that changes over time that needs history/audit? (price changes, status transitions)
- What's the expected data volume? (10 users? 10 million?)

## 9. Performance & Scalability

How fast and how big.

- What's the expected number of users? (now and in 6-12 months)
- Are there operations that could be slow? (search, reports, file processing)
- Is there content that should be cached?
- Are there background jobs? (email sending, data processing, cleanup)
- What's the target page load time?

## 10. Technology Choices & Constraints

What's already decided and what's flexible.

- Is there an existing codebase or is this greenfield?
- Are there technology preferences or mandates? (must use React, must deploy to AWS, etc.)
- Are there budget constraints that affect choices? (no paid services, serverless to minimize costs)
- What does the team know? (play to strengths vs. learning something new)
- Is there a CI/CD pipeline preference?
- What's the hosting/deployment target?

---

## How to Use This Checklist

1. **Start at category 1** and work through the core workflows in depth before moving on.
2. **Skip what's not relevant.** A simple static site generator doesn't need category 5 (auth). Don't waste the user's time.
3. **Ask 2-3 questions at a time**, not a wall of 10. Let the user respond, then follow up.
4. **When you get a vague answer, push for specifics.** "It should validate the input" → "What counts as valid? What error message does the user see for each type of invalid input?"
5. **Summarize your understanding** after covering 2-3 categories: "Here's what I have so far — does this match your vision?"
6. **The user sets the pace.** If they say "that's enough detail for now", respect that and move to generation.
