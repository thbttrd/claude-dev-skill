# Agile Discovery Checklist

Use this as a reference during discovery. Don't walk through it mechanically — follow the conversation naturally and use this to ensure you haven't missed critical areas.

Categories are ordered by priority for agile scoping: start with who and why, then what and how.

---

## 1. Vision & Problem Space

The "why" behind the project. Get this crystal clear before anything else.

- What problem does this project solve? Who feels the pain today?
- What does success look like in 3 months? In 6 months?
- Is there an existing solution (competitor, manual process, spreadsheet)? What's wrong with it?
- What's the single most important thing this app must do well?
- Is there a deadline, event, or external constraint driving the timeline?

## 2. Personas & User Segments

Who uses the product and what drives them. These become your Persona cards.

- Who are the distinct types of users? (not just "admin vs user" — think about goals and contexts)
- For each persona: What's their primary goal when using the app?
- For each persona: What frustrates them about the current situation?
- For each persona: How tech-savvy are they? What's their context of use? (desk, mobile, on-the-go)
- Which persona is the most important? Who do you build for first?
- Are there non-user stakeholders who care about the system? (managers, compliance, ops)

## 3. Core Workflows & Value Propositions

The main things people do. These become your Epics.

- What are the 3-5 big things users do in this app?
- For each workflow: walk me through the steps end to end
- What's the "golden path" — the most common successful journey?
- What's the minimum a user needs to do to get value from the app?
- Are there workflows that depend on other workflows? (e.g., must create account before placing order)

## 4. Business Rules & Priorities

What governs behavior and what matters most. These shape User Story priorities.

- What constraints exist? (limits, thresholds, quotas, deadlines)
- Which features are non-negotiable for launch? Which are nice-to-have?
- Are there regulatory or compliance requirements?
- What are the biggest risks if something goes wrong?
- How do you measure if a feature is successful? (metrics, KPIs)

## 5. Integrations & External Dependencies

What the system talks to. These affect architecture modules.

- Does this integrate with any external services? (payment, email, auth providers, APIs)
- Is there existing data that needs to be imported or migrated?
- Are there other internal systems this must connect to?
- Are there third-party constraints? (rate limits, SLAs, cost per call)

## 6. Scale & Constraints

How big and how fast. These inform architecture and roadmap pacing.

- How many users at launch? In 6 months?
- Is there expected spiky traffic? (events, campaigns, seasonal)
- Are there budget constraints? (hosting costs, paid APIs, team size)
- Is this a solo developer project or a team effort?
- What's the team's tech stack comfort zone?

## 7. Platform & Distribution

Where and how users access the product.

- Web, mobile, desktop, or multi-platform?
- Does it need to work offline?
- Is there a preferred tech stack or is it open?
- Where will it be hosted/deployed?
- Is there a CI/CD preference?

---

## How to Use This Checklist

1. **Start with categories 1-2** — understand the problem and the people before talking features.
2. **Category 3 naturally follows** — once you know who and why, the what emerges.
3. **Skip what's not relevant.** A personal tool doesn't need deep persona work.
4. **Ask 2-4 questions at a time** via AskUserQuestion. Let the user respond, then follow up.
5. **When you get a vague answer, push for specifics.** "It should be fast" -> "What's an acceptable page load time for your users?"
6. **Summarize your understanding** after covering 2-3 categories.
7. **The user sets the pace.** If they say "enough detail", respect that and move to structuring.
