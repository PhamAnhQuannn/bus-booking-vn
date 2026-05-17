---
name: build-measure-learn-loop
description: One-week build-measure-learn cadence with explicit hypothesis, metric, and kill criterion so features don't ship without an evidence loop. Outputs to `docs/product/bml-<feature>.md`. Reads `/project-classify` to skip XS. Use when user says "build-measure-learn", "BML loop", "lean startup", "hypothesis-driven", "/build-measure-learn-loop", or before starting a new feature.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 4h
  XL: 8h
---

# /build-measure-learn-loop — Hypothesis-Driven Shipping

## Why you'd care

Features without a metric and a kill criterion don't get removed even when nobody uses them — they just accrete and slow the next feature. A weekly BML loop with explicit hypothesis means dead code dies on a known date, not whenever.

Invoke as `/build-measure-learn-loop`. Every feature is a hypothesis. Without a metric and a kill criterion, you ship code that nobody uses and nobody removes.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Analytics in place (event tracking, funnel visualization).
3. Feature flag system exists (gradual rollout possible).

## Inputs
- Feature idea (one sentence)
- Customer evidence motivating it (interviews / support tickets / data)
- Available time budget (1 week / 1 sprint / 1 month)
- Target user segment for the experiment

## Process

1. **Hypothesis statement** — written before code:
   ```
   We believe that <user segment>
   will <action / outcome>
   if we ship <smallest testable thing>
   because <reason from evidence>.
   We will know we're right when <metric> moves by <amount> within <time>.
   We will kill it if <kill criterion>.
   ```
   Example:
   > "We believe small-team admins will reduce ticket volume by 30% if we ship inline error messages on the bulk-import form, because 12 tickets in the last 30 days reference confused error states. We'll know if support tickets tagged `bulk-import` drop ≥30% in 2 weeks. Kill if tickets unchanged after 4 weeks."

2. **Smallest testable thing** — radical narrowing:

   | Big idea | Smallest testable thing |
   |---|---|
   | "AI-assisted onboarding" | Static checklist with manual outreach for first 10 sign-ups |
   | "Mobile app" | Responsive web view test on existing mobile traffic |
   | "Enterprise reporting" | Manual CSV export for one customer, weekly |
   | "Workflow automation" | Zapier integration first, native later |

   The goal is signal, not a feature. Concierge / Wizard-of-Oz / fake-door tests count.

3. **Metric pick** — one primary, two secondary:
   - Primary: directly measures the hypothesis (conversion rate, ticket count, activation %)
   - Secondary: guardrails (don't tank existing metrics; doesn't help if you boost activation but tank retention)
   - Avoid vanity: pageviews, sign-ups, "engagement" without action

4. **Sample size + duration** — pre-commit:
   - Calculate min sample for detectable effect (use power calculator)
   - Set decision date BEFORE launch — no moving goalposts
   - For pre-scale (<1000 users/wk): use qualitative + small-n quant + interviews, not p-values
   - For scale: A/B test with 95% confidence + practical-significance threshold

5. **Build phase** — 1-2 weeks max:
   - Behind feature flag
   - Smallest viable surface; ugly UI fine, broken logic not fine
   - Instrument first (events for primary + secondary metrics)
   - Code that gets thrown away is a feature, not a bug

6. **Measure phase** — duration as pre-committed:
   - Daily dashboard check
   - Don't read tea leaves on day 1; let it run
   - Mid-point: sanity check (events firing? funnel working?)
   - End-point: lock the decision before reviewing data ("if metric < X, we kill")

7. **Learn phase** — written outcome:

   | Outcome | Next action |
   |---|---|
   | Hypothesis confirmed | Invest more: real UI, broader rollout |
   | Inconclusive | Run again with bigger sample OR pivot the hypothesis |
   | Hypothesis disconfirmed | Kill the feature; document why; remove the code |
   | Surprise: different metric moved | New hypothesis; new loop |

   Write a 1-page learning summary regardless of outcome. Tag and search-able. The bank of "what didn't work" prevents repeats.

8. **Cadence** — weekly review:
   - Monday: pick 1-2 hypotheses for the week
   - Friday: report status of running experiments
   - Monthly: review the "learnings log" — patterns?

9. **Anti-patterns**:
   - Build first, measure later — no instrumentation in v1 = no learning
   - "Let's just ship and see" — see what? define what success looks like
   - Moving the kill criterion after seeing data — confirmation bias
   - No kill action — feature lingers in codebase, accruing maintenance debt
   - Vanity metric as primary — "1000 new sign-ups" without activation rate
   - One giant experiment ("redesign onboarding") — too many vars; can't learn

## Output

Write `docs/product/bml-<feature>.md`:

```markdown
# BML Loop — <feature>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/eng>

## Hypothesis
We believe <segment> will <action> if we ship <thing> because <evidence>.
We will know when <metric> moves by <amount> within <time>.
We will kill if <criterion>.

## Smallest testable thing
[concise description; can be manual / wizard-of-oz / fake door]

## Metrics
- Primary: <metric> — target <value>
- Secondary (guardrails): <metric1>, <metric2>
- Decision date: <YYYY-MM-DD>

## Build
- Behind flag: `flag.<name>`
- Surface: <minimal description>
- Instrumentation: events <list>
- Code budget: 1-2 weeks

## Measure
- Dashboard: <URL>
- Duration: <N> days
- Mid-point check: <date>
- Decision: <date>

## Learn
- Result: [pending / confirmed / inconclusive / disconfirmed]
- Notes: <what happened>
- Next: [scale / iterate / kill]
- Code disposition: [kept / removed]

## Anti-patterns avoided
- [ ] Metric chosen before build
- [ ] Kill criterion locked before data
- [ ] Code throwaway-ready (behind flag)
```

## Verification
- Hypothesis written before code, with explicit metric + kill criterion.
- Smallest testable thing chosen (not the full vision).
- Instrumentation shipped with the feature, not after.
- Decision date pre-committed.
- Learning summary written regardless of outcome.
- Killed features get their code removed within 30 days.
