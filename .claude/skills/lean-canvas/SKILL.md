---
name: lean-canvas
description: Generate a 1-page Lean Canvas for a product idea. Fills 9 boxes — problem, customer segments, unique value proposition, solution, channels, revenue streams, cost structure, key metrics, unfair advantage. Pairs with `/grill-me` for input gathering and reads `/project-classify` output if present. Outputs to `docs/inception/canvas-<project>.md`. Use when user says "lean canvas", "business model", "1-pager", "canvas this idea", "/lean-canvas", or after `/project-classify` returns class S+ (skips XS).
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /lean-canvas — 1-Page Business Model

## Why you'd care

Skipping the one-page canvas means problem / customer / value-prop / unfair-advantage all live in the founder's head, undefended and untested. The canvas forces the contradictions to the surface in 30 minutes.

Invoke as `/lean-canvas`. Forces a product idea into Ash Maurya's 9-box Lean Canvas in one session. Pairs with `/grill-me` for input extraction, `/project-classify` for skip-gate.

---

## Pre-flight

1. Read `docs/classify/<project>.md` if exists.
   - Class **XS** → **SKIP** (tell user: "XS = throwaway, canvas is overkill. If scope grew (sharing with friends, charging, multi-user) → re-run `/project-classify`; may bump to S+.")
   - Class S/M/L/XL → continue.
2. If user has not provided context, run `/grill-me` first with prompt: "Extract problem, target user, current alternative, and revenue intent for this idea."
3. If `docs/inception/canvas-<project>.md` already exists, ask: refine existing or start fresh?

---

## 9-box template

Output as markdown grid. Each box answered in 1–3 bullets. No paragraphs.

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ PROBLEM     │ SOLUTION    │ UVP         │ UNFAIR      │ CUSTOMER    │
│             │             │             │ ADVANTAGE   │ SEGMENTS    │
│ top 3 pains │ top 3       │ single,     │ what can't  │ who feels   │
│             │ features    │ clear, why  │ be copied   │ pain most   │
│             │             │ different   │             │             │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ EXISTING    │ KEY METRICS │             │ CHANNELS    │ EARLY       │
│ ALTERNATIVES│             │             │             │ ADOPTERS    │
│ what they   │ 3 numbers   │             │ how reach   │ subset of   │
│ use today   │ that prove  │             │ users       │ segment     │
│             │ traction    │             │             │ that buys   │
│             │             │             │             │ first       │
├─────────────┴─────────────┼─────────────┼─────────────┴─────────────┤
│ COST STRUCTURE            │             │ REVENUE STREAMS           │
│                           │             │                           │
│ infra + tools + time      │             │ pricing model + estimate  │
│ (link to /cost-model)     │             │ (link to /pricing-model)  │
└───────────────────────────┴─────────────┴───────────────────────────┘
```

---

## Per-box guidance

| Box | What to write | Example (indie devtool — async-job queue dashboard) |
|---|---|---|
| **Problem** | top 3 pains user has *now* | engineers lose 2hr/wk debugging stuck background jobs; existing observability misses queue lag; competitors cost $200+/mo |
| **Customer Segments** | who feels pain most | seed-to-Series-A SaaS teams, 5-30 devs, Rails/Node, no dedicated SRE |
| **UVP** | single sentence: what we offer + why different | "Drop-in queue dashboard that surfaces stuck jobs in 30 seconds, $20/mo flat" |
| **Solution** | top 3 features that solve top 3 pains | one-line SDK install, real-time stuck-job alerts, retry-from-UI |
| **Channels** | how to reach early adopters | r/rails + r/node, dev podcast sponsorships, cold GitHub-org DM |
| **Revenue Streams** | pricing model + monthly estimate | $20/mo flat, 100 customers = $2k MRR |
| **Cost Structure** | infra + tools + time | $40/mo (Vercel + Redis + DB) + 10hr/wk maintenance |
| **Key Metrics** | 3 numbers proving traction | active installs, alerts triaged/wk, paid conversion rate |
| **Unfair Advantage** | what can't be copied easily | personal RailsConf network, 5 paying pilots locked in |
| **Existing Alternatives** | what they use today (split paid vs free if freemium model) | Datadog ($249/mo), Sidekiq web UI, grep on logs |
| **Early Adopters** | subset that buys first | teams that had a Sidekiq incident last week, posting on /r/rails |

---

## Fill order

Fill UVP **last**. Other 8 boxes inform it. Suggested order: Customer Segments → Problem → Existing Alternatives → Solution → Channels → Revenue → Cost → Metrics → Unfair Advantage → UVP.

---

## Output

Write to `docs/inception/canvas-<project-slug>.md`:

```markdown
# Lean Canvas — <project name>

**Date: <YYYY-MM-DD>** | **Class: <from /project-classify>** | **Iteration: 1**

## Problem
- ...
- ...
- ...

## Customer Segments
- ...

## Existing Alternatives
- ...

## UVP
> <single sentence>

## Solution
- ...

## Unfair Advantage
- ...

## Channels
- ...

## Early Adopters
- ...

## Revenue Streams
- ...

## Cost Structure
- ...

## Key Metrics
1. ...
2. ...
3. ...

## Riskiest assumption
<the one box that, if wrong, kills the product. Feed this to `/problem-validation` next.>
```

---

## After canvas

Recommend next step based on which box is weakest:
- **Problem / Customer Segments weak** → `/problem-validation`
- **Revenue / Cost weak** → `/pricing-model` + `/cost-model`
- **Channels weak** → `/competitor-scan`
- **All boxes confident** → `/write-a-prd`

---

## When to re-canvas

Re-run on every pivot or after 10+ customer interviews. Canvas is hypothesis, not commitment.
