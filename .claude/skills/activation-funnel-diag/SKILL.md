---
name: activation-funnel-diag
description: Diagnose where sign-ups drop off before "aha" so you fix the leak, not the bucket. Outputs to `docs/product/activation-funnel.md`. Reads `/project-classify` to skip XS. Use when user says "activation funnel", "drop-off", "where do users quit", "funnel analysis", "/activation-funnel-diag", or when sign-up-to-paid conversion is below benchmark.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 8h
---

# /activation-funnel-diag — Funnel Leak Hunt

## Why you'd care

Buying more traffic when the leak is at step three just multiplies your CAC for the same shipped revenue. Find the drop-off step first; every dollar of growth spend after that converts harder.

Invoke as `/activation-funnel-diag`. Most products don't have an acquisition problem; they have an activation problem. Find the leak step before spending on more traffic.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Event tracking exists (analytics-spec done).
3. "Activated" defined (e.g., completed first key action within N days).

## Inputs
- Funnel definition (signup → step1 → step2 → ... → activated)
- Time window (last 30d / per-cohort)
- Segment splits to compare (channel / plan / persona / device)
- Baseline conversion at each step (if known)

## Process

1. **Funnel skeleton** — write the steps before pulling data:

   | Step | Definition | Event |
   |---|---|---|
   | 1. Land | hit signup page | `pageview signup` |
   | 2. Signup | account created | `user.signup` |
   | 3. Onboard | finished onboarding wizard | `onboarding.complete` |
   | 4. First action | first meaningful create / use | `<feature>.first_use` |
   | 5. Repeat use | second session with key action | `key_action` (n>=2) |
   | 6. Activated | "aha" reached | composite definition |

   Activation = the moment the user gets the value promised. Define narrowly.

2. **Pull the data** — table of conversions:

   | Step → Step | Rate | Median time |
   |---|---|---|
   | Land → Signup | 35% | 45s |
   | Signup → Onboard | 60% | 3min |
   | Onboard → First action | 40% | 8min |
   | First action → Repeat | 25% | 1d |
   | Repeat → Activated | 70% | 3d |
   | **Land → Activated** | **2.1%** | — |

   Smallest rate = the leak. Don't average; find the worst step.

3. **Segment cut** — same funnel by:

   | Segment | Land→Signup | Sign→Onb | Onb→1st | 1st→Repeat | →Activ |
   |---|---|---|---|---|---|
   | Organic search | 40% | 65% | 50% | 30% | 75% |
   | Paid ads | 25% | 50% | 25% | 15% | 60% |
   | Referral | 50% | 70% | 60% | 40% | 80% |

   Big gaps between segments suggest the leak is segment-specific (e.g., paid traffic mismatches intent).

4. **Time-to-step distribution** — fast vs slow funnel completers:
   - 50th percentile time per step
   - 90th percentile (the patient ones; tells you the long tail)
   - Activated users vs non-activated: where do their times diverge?

5. **Drop-off interview list** — qualitative on top of quant:
   - 5 users who dropped at the leak step → 15-min interview ("what stopped you?")
   - 5 users who completed → "what almost stopped you?"
   - Tag verbatims: confusion / friction / no-value / wrong-fit
   - Themes from 10 interviews = better than 1000 survey responses

6. **Hypothesis on the leak**:

   | Symptom | Likely cause |
   |---|---|
   | Big drop at signup form | too many fields / SSO missing / unclear value prop |
   | Drop at email verification | email deliverability / opaque link |
   | Drop at onboarding wizard | too long / asks for things user doesn't have |
   | Drop at first action | empty state intimidating / unclear next step / friction |
   | Drop before repeat | no callback hook / no notification / no habit loop |

   Pick the top hypothesis, design the BML loop to test (see `/build-measure-learn-loop`).

7. **Fix priority** — biggest absolute impact:
   - Multiply each step's leak by upstream volume → "fixing this step recovers X users/month"
   - A 5% bump at high-volume early step usually beats 30% bump at low-volume late step
   - Don't chase the worst rate; chase the biggest absolute recovery

8. **Re-baseline after fix** — same funnel, week-over-week:
   - Did the targeted step's rate improve?
   - Did downstream rates hold (didn't push bad-fit users deeper)?
   - Did activated/M change?
   - If yes: lock the win, move to next leak. If no: revisit hypothesis.

9. **Anti-patterns**:
   - Tracking only "signups" — no funnel = no leak diagnosis
   - "Activation" = signed up — too shallow; doesn't predict retention
   - Same funnel across segments — hides paid-channel mismatch
   - Optimizing the latest step (closest to revenue) before earliest big leak
   - Survey-only analysis — biased toward articulate users
   - One-time analysis — funnel rates drift; re-run quarterly

## Output

Write `docs/product/activation-funnel.md`:

```markdown
# Activation Funnel — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/growth>

## Activation definition
"<concrete event sequence in T time>" — e.g., "user creates 3 items + invites 1 teammate within 7d of signup"

## Funnel
| Step | Event | Rate | Median time |
|---|---|---|---|
| Land | pageview signup | 100% | — |
| Signup | user.signup | 35% | 45s |
| Onboard | onboarding.complete | 21% | 3m |
| First action | feature.first_use | 8.4% | 8m |
| Repeat use | key_action n>=2 | 2.1% | 1d |
| Activated | <composite> | 1.5% | 3d |

## Leak rank (by absolute recovery potential)
1. Land → Signup (largest volume × largest gap)
2. First action → Repeat (biggest rate drop)
3. Onboard → First action

## Segment cut
| Segment | Land→Activated | Notes |
|---|---|---|
| Organic | 5% | high intent |
| Paid | 0.8% | intent mismatch |
| Referral | 6% | warmest |

## Qualitative themes (10 interviews)
- Confused by empty state (4/10)
- Sign-up asked too much info (3/10)
- Couldn't find first action (2/10)

## Top hypothesis
"<step>: <cause>. Fix by <intervention>. Expected lift +<X>%."

## Test plan
- Behind flag <name>
- BML loop in `/build-measure-learn-loop`
- Decision date <YYYY-MM-DD>

## Anti-patterns avoided
- [ ] Funnel rates broken by segment
- [ ] Activation defined as value-event not signup
- [ ] Priority by absolute recovery, not rate gap
```

## Verification
- Activation defined as a value-event, not signup.
- Funnel has at least 4 steps; conversion rate per step measured.
- Segment cuts surface paid/organic/referral differences.
- Qualitative interviews supplement quant.
- Top leak identified by absolute recovery, not rate alone.
- Test plan handed off to `/build-measure-learn-loop`.
