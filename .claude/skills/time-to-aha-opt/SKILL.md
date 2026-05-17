---
name: time-to-aha-opt
description: Shrink time from signup to first "aha" moment so activation conversion rises. Outputs to `docs/product/time-to-aha.md`. Reads `/project-classify` to skip XS. Use when user says "time to value", "time to aha", "TTV", "TTA", "first wow", "/time-to-aha-opt", or after activation funnel shows long median TTA.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /time-to-aha-opt — Compress the Aha Path

Invoke as `/time-to-aha-opt`. Every minute between signup and value is a chance to lose the user. Measure the time, cut the steps, ship the magic moment as early as possible.

## Why you'd care

Activation is the funnel step with the steepest revenue leverage — every minute trimmed off time-to-aha is a percentage of users who stay. Optimizing it deliberately is higher-ROI than any feature build.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Activation event defined (see `/activation-funnel-diag`).
3. Time-stamped events from signup through first key action.

## Inputs
- "Aha" moment defined (what does the user feel? what happens?)
- Current median + p90 time to aha
- Sub-step durations (signup, onboarding, configure, first use)
- Persona variants (do different segments hit aha at different points?)

## Process

1. **Aha definition** — specific, observable:

   | Product | Aha moment |
   |---|---|
   | Linear | first issue closed via shortcut |
   | Notion | first page shared with someone |
   | Stripe | first test payment succeeded |
   | Loom | first video sent + watched |
   | Slack | first channel posted to by 2+ people |

   "Sign up" is not aha. "Use feature once" is not aha. Aha = value delivered + remembered.

2. **Current TTA baseline** — measure before changing:
   - Pull `aha_ts - signup_ts` per user
   - Median, p75, p90, p99
   - Cut by persona, channel, plan
   - Distribution shape (long tail? bimodal?)

3. **Step decomposition** — where does time go?

   | Step | Median time | % of total | Type |
   |---|---|---|---|
   | Email verify | 2 min | 5% | tooling |
   | Onboarding wizard | 8 min | 20% | guided |
   | First config (workspace, team) | 15 min | 35% | setup |
   | Import / connect data | 12 min | 25% | dependency |
   | First key action | 5 min | 15% | actual product |

   The biggest non-product step is the place to cut.

4. **Cut techniques** — fastest impact:

   | Technique | Saves |
   |---|---|
   | Pre-fill defaults | 5-30s/field |
   | Skip email verify until value delivered | 1-3 min |
   | Sample data preloaded | 2-10 min ("see something before doing something") |
   | Import templates / pre-built workspaces | 5-15 min |
   | Defer team invite until aha hit | unblocks single-player aha |
   | OAuth/SSO instead of password forms | 30-60s |
   | Skip onboarding wizard for power users | 5-8 min |
   | Web-first, defer mobile/app install | huge |

5. **"Magic moment" injection** — show the value early:
   - Pre-built example shows what's possible: "here's a dashboard from sample data"
   - First action triggers a delightful effect (animation, share button, notification)
   - Surface social proof at the aha point ("12 of your peers use this daily")
   - Hold off on "complete your profile / invite team" nags until AFTER aha

6. **Personalized onboarding paths** — branch by intent:
   - "What brings you here?" → 2-3 questions → personalized path
   - Power user → minimal walkthrough + import path
   - Curious → preloaded demo + click-around
   - Buyer evaluating → trial pricing visible + use-case content
   - Don't over-engineer; 2-3 paths max

7. **A/B test the cut** — never assume:
   - Hypothesis: "skipping wizard saves 5min and lifts activation by 10%"
   - Cohort A: keep wizard; B: skip
   - Measure: median TTA, activation rate, day-7 retention
   - Activation up, retention same/up → ship. Activation up, retention down → wizard was filtering bad fits; keep it.

8. **Target curve** — what good looks like:

   | Product type | Target median TTA |
   |---|---|
   | Consumer freemium | < 5 min |
   | B2B prosumer | < 30 min |
   | B2B SaaS (team setup) | < 1 day |
   | Vertical SaaS (data integration) | < 1 week |

   p90 ≤ 3× median is a healthy distribution. p90 = 10× median = long-tail users falling through cracks.

9. **Anti-patterns**:
   - Wizard with 12 steps "for thoroughness" — kills conversion
   - "Verify email before continuing" — pre-aha friction
   - Empty state with no sample data — users freeze
   - "Invite your team" required before first action — kills single-player adoption
   - Asking for company size, role, industry on first screen — defer to after-aha
   - Measuring aha by clicks not by user value — gameable

## Output

Write `docs/product/time-to-aha.md`:

```markdown
# Time-to-Aha — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/growth>

## Aha definition
"<observable, specific moment>"

## Baseline (last 30d)
- Median TTA: X min
- p75: X min
- p90: X min
- By persona: <table>

## Step decomposition
| Step | Median | % of total |
|---|---|---|
| Verify email | 2m | 5% |
| Onboarding wizard | 8m | 20% |
| First config | 15m | 35% |
| Import/connect | 12m | 25% |
| First key action | 5m | 15% |

## Cuts proposed
1. Skip email verify until aha (-2m)
2. Preload sample workspace (-10m)
3. Defer team invite to after aha (single-player path)
4. OAuth/SSO option on signup (-1m)

## Target
- Median ≤ <N> min
- p90 ≤ 3× median

## Experiments
- Test 1: skip wizard for power users (flag, 50/50)
- Test 2: sample workspace pre-loaded (flag, 50/50)
- Decision date: <YYYY-MM-DD>

## Guardrails
- Day-7 retention can't drop > 5%
- Support ticket volume can't spike
- Spam signup rate can't double
```

## Verification
- Aha defined as value-event, not signup.
- Baseline median + p90 measured before changes.
- Step decomposition identifies biggest non-product time.
- At least 2 cut hypotheses with experiment plans.
- Guardrails (retention, support, spam) defined.
- Target TTA + p90 ratio explicit.
