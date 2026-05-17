---
name: ab-test-design
description: Design A/B test before launch — hypothesis, primary/secondary metric, randomization unit, sample-size, guardrail metrics, stop criteria. Use when "A/B test", "experiment design", "split test", "/ab-test-design", or before any growth/UX experiment touches users.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 2h
---

# /ab-test-design — pre-registered experiment spec

## Why you'd care

Three failure modes hide inside every "let's just A/B test it":

- **Peeking.** Engineer refreshes the dashboard daily, "calls it" the first time p < 0.05 flickers green. With weekly peeks the false-positive rate is ~25%, not 5%. The team ships a coin-flip and believes it was data-driven.
- **Metric-fishing.** No pre-registered primary metric. Post-hoc, the team picks whichever of nine measurements crossed the threshold. Multiple-comparison correction was never applied. Business decision made on noise.
- **Silent harm.** Primary metric moves +3%, ship it. Two weeks later support tickets are +40%, error rate is +60ms p95, revenue is flat — but nobody pre-registered guardrails so nobody looked.

Pre-registered design forces honest interpretation. One primary metric, written before traffic flows. Sample-size computed up front so the team knows when to stop. Guardrails written in red ink — breach = auto-stop, no debate. Vendor-agnostic — the spec is valid whether you ship in PostHog, Statsig, GrowthBook, LaunchDarkly Experiments, or a homegrown bucket-and-event setup.

Invoke as `/ab-test-design`. Pair every experiment with a written spec before exposure logging starts.

## When This Skill Applies

Triggers (user phrases):
- "A/B test", "split test", "experiment design", "test two variants"
- "design an A/B test for X", "pre-register an experiment"
- "should we ship variant B", "/ab-test-design"

Auto-invoke:
- Before any growth experiment touches users (landing page test, signup-flow change, email subject test).
- Before pricing tests — wrong design wastes a quarter of pricing-page traffic on undecidable noise.
- Before onboarding-flow changes — activation funnel is high-leverage, easy to mis-measure.
- Before checkout tweaks — revenue impact, mandatory guardrails, no exceptions.
- When `/feature-flag-rollout` is picked AND the user-facing change is hypothesis-driven (not just risk-managed exposure).

## Pre-flight

1. **Baseline metric instrumented?** The primary metric must already be tracked in the analytics stack. Cross-ref `/analytics-spec` — event must exist, be named, be flowing, be QA'd in the live-events view. No primary-metric event = no experiment.
2. **Traffic volume sufficient?** Cross-ref `/experiment-power-calc` for sizing. If daily traffic to the surface × baseline conversion rate × MDE-implied sample-size exceeds a reasonable duration (4-6 weeks max), the experiment is undersized — pick a bigger MDE, a higher-conversion surface, or skip.
3. **Exposure instrumentation deployed?** A `$exposure` event (variant assigned + user-id + timestamp) must fire the moment a user is bucketed, regardless of whether they see the variant. Without it, analysis is garbage (sample-ratio mismatch, dilution).
4. **Owner assigned.** One human accountable for the call. "The growth team" is not an owner.

## Inputs

- **Hypothesis** — `if <change>, then <metric moves direction>, because <mechanism>`. All three clauses required.
- **Primary metric** — exactly one. Past-tense event from `/analytics-spec` (e.g. `signup_completed`, `checkout_submitted`, `reservation_confirmed`).
- **Minimum detectable effect (MDE)** — relative, e.g. `+5%`. Smaller MDE = more traffic. Below 1% is usually unmeasurable in practice.
- **Baseline rate** — current conversion / rate of the primary metric on the surface.
- **Randomization unit** — `user` (most common, requires login or stable anonymous-id cookie), `session`, `account` (B2B, multi-seat), `device`. Pick once; mixing is invalid.
- **Traffic split** — default `50/50`. Use `90/10` only when you suspect harm and want to limit blast radius (then power drops; recompute sample-size).
- **Segments to exclude** — bots, internal employees, users on the opted-out list, users in another running experiment that conflicts, pre-existing users (if change only sensible for new).
- **Guardrail metrics** — minimum three: revenue/conversion-of-record, error/crash rate, latency p95. Plus domain-specific (support ticket rate, refund rate, abuse-report rate).

## Process

1. **State hypothesis in if/then/because form.** Reject if any clause missing. "Because" forces the team to articulate the causal mechanism — without it the experiment is fishing.
2. **Pick exactly one primary metric.** Not two. Not "primary metric is X and Y". A single number that, when it moves, decides the call. Secondary metrics are observational only — they do not gate the ship decision.
3. **Pick randomization unit.** Default `user`. Use `account` for B2B where users within an org influence each other. Use `session` only when within-user contamination is impossible (e.g. anonymous landing-page test, no login). Mixing units within one experiment = invalid.
4. **List exclusions.** Bots (UA filter + known crawler IPs), internal employees (email-domain filter), opted-out users (DNT, account setting), users already in another conflicting experiment (the experiment-platform handles this if you registered conflicts).
5. **Sample-size via `/experiment-power-calc`.** Inputs: baseline rate, MDE, two-sided α = 0.05, power = 0.80, split. Output: required sample per arm + minimum duration given traffic. Round duration up to whole-week multiples (capture weekday/weekend cycles).
6. **Guardrail metrics — minimum three, with thresholds.** Each guardrail gets a number, not "watch the dashboard":
   - **Revenue/conversion-of-record:** halt if variant arm < control × 0.95 (5% relative drop).
   - **Error rate:** halt if variant arm error-rate > control × 1.5 sustained 1h.
   - **Latency p95:** halt if variant arm p95 > control + 100ms sustained 1h.
   - **Domain-specific:** support tickets tagged with the surface, refund rate, abuse reports, churn signals.
7. **Stop criteria — written before launch.**
   - **Max duration:** computed from sample-size + traffic. Hard cap. Stop at duration even if not significant — "we couldn't tell" is a valid result.
   - **Guardrail breach:** auto-stop on any guardrail crossing threshold. No debate.
   - **No early-stop on primary metric.** Looking at the primary metric mid-flight and stopping early inflates false-positive rate. The only mid-flight stop is guardrail-driven.
   - **Sequential testing exception:** if using a sequential-test framework (mSPRT, group-sequential), pre-register the boundary function. Otherwise no peeking.
8. **Analysis plan — pre-registered.** Which test (two-proportion z, t-test, Mann-Whitney, CUPED-adjusted), how missing data is handled, multiple-comparisons correction for secondary metrics (Bonferroni / Benjamini-Hochberg), CI level (95%), what counts as "ship variant" vs "ship control" vs "inconclusive".
9. **Exposure logging.** `$exposure` event fires the instant a user is bucketed. Props: `experiment_id`, `variant`, `user_id`, `timestamp`, `randomization_unit`. Without this, sample-ratio mismatch is invisible and dilution corrupts results.
10. **Results-when-done template included in spec.** Pre-written results section with placeholders — when the experiment concludes, fill in numbers. Removes the post-hoc temptation to re-frame.

## Output Format

Write `docs/experiments/<exp-id>.md`:

```markdown
---
exp-id: exp-2026-05-pricing-page-v2
owner: anh@yourco.com
status: draft        # draft | running | concluded | abandoned
started: null        # YYYY-MM-DD when status=running
ended: null          # YYYY-MM-DD when status=concluded
randomization_unit: user
platform: posthog    # posthog | statsig | growthbook | launchdarkly | homegrown
---

# Experiment: <human-readable title>

## Hypothesis

**If** we replace the three-tier pricing page with a single "contact us" CTA above the fold,
**then** `pricing_contact_submitted` per visitor will increase by at least 8% relative,
**because** decision fatigue on the current page causes drop-off before any CTA is reached.

## Metric stack

| Role | Metric | Source event | Baseline | Threshold |
|------|--------|--------------|----------|-----------|
| Primary | `pricing_contact_submitted` per visitor | `/analytics-spec` event | 2.4% | MDE +8% rel → variant rate > 2.59% to ship |
| Secondary | `signup_completed` within 7d | same | 1.1% | observational only |
| Secondary | time-on-page | client-side | 42s | observational only |
| Guardrail | revenue-per-visitor (7d) | server event | $0.31 | halt if variant < $0.295 (5% rel drop) |
| Guardrail | client error rate | Sentry | 0.4% | halt if variant > 0.6% sustained 1h |
| Guardrail | p95 page-load | RUM | 1.4s | halt if variant > 1.5s sustained 1h |
| Guardrail | support tickets tagged "pricing" | Zendesk | 3/day | halt if variant arm > 6/day |

## Randomization

- Unit: `user` (stable anonymous-id cookie pre-login, user-id post-login; sticky merge on login).
- Hash: `sha256(user_id + experiment_id)`, bucket on first 8 hex.
- Split: 50/50.
- Sticky: yes — a user bucketed on day 1 stays in the same arm for the experiment's lifetime.

## Sample-size + duration

- Baseline 2.4%, MDE +8% rel, α=0.05 two-sided, power=0.80, 50/50.
- Required: ~52,400 visitors per arm (via `/experiment-power-calc`).
- Surface traffic: ~3,500 visitors/day.
- Duration: 30 days. Hard cap: 30 days. Whole-week multiple respected.

## Exclusions

- Bots (UA contains `bot|crawler|spider`, plus known datacenter IP ranges).
- Internal: email domain `@yourco.com`, plus IPs in office CIDR.
- Opted-out: users with `analytics_opt_out=true`.
- Existing customers (any active subscription) — change is hypothesized for prospects only.
- Users in conflicting experiment `exp-2026-04-nav-redesign` (it also touches header on pricing page).

## Variants

| Arm | Slug | Description |
|-----|------|-------------|
| Control | `pricing-v1` | Current three-tier table, "Choose plan" CTAs. |
| Variant | `pricing-v2` | Single "Contact us" CTA above fold, tiers below fold. |

## Stop criteria

- **Max duration:** 30 days from start. Stop at day 30 regardless of significance.
- **Guardrail breach:** any guardrail row above crosses threshold → auto-stop, ship control.
- **No early-stop on primary metric.** No daily peeking-and-shipping. Mid-flight reviews are guardrails-only.
- **Sample-ratio mismatch:** if observed split deviates from 50/50 by more than ±2 percentage points after 7d, stop and debug exposure logging — results invalid until SRM resolved.

## Analysis plan

- **Test:** two-proportion z-test for primary, one-sided H1: variant > control by ≥ MDE.
- **CI:** 95%, two-sided.
- **Missing data:** users with no exposure event excluded (shouldn't happen — exposure fires on bucket).
- **Multiple comparisons:** secondary metrics reported with Benjamini-Hochberg correction at FDR 0.10. Secondary results never gate ship decision.
- **Segment cuts:** mobile vs desktop, new vs returning. Reported observationally; HTE claims require pre-registered subgroup hypothesis.
- **Decision rule:**
  - Variant rate ≥ control × 1.08 AND p < 0.05 AND no guardrail breach → **ship variant**
  - Variant rate < control OR any guardrail breach → **ship control**
  - Inconclusive (CI straddles MDE) → **ship control, log learnings**

## Exposure logging

- Event: `$exposure`
- Props: `{ experiment_id, variant, user_id, randomization_unit, timestamp, surface }`
- Fires: client-side, on first render of bucketed variant. Server-side mirror for SSR.
- QA: live-events view shows balanced 50/50 within 1h of first traffic.

## Results (fill at conclusion)

- **Concluded:** YYYY-MM-DD
- **Final n per arm:** _control _ / _variant _
- **Primary metric:** control _%_, variant _%_, lift _% rel_, p = _, 95% CI [_,_]
- **Guardrails:** all within threshold? Y/N (list breaches)
- **Decision:** ship variant | ship control | inconclusive
- **Learnings:** (1-paragraph narrative; what changed our prior, what to test next)
```

### Worked example — SaaS onboarding step removal

```yaml
exp-id: exp-2026-05-onboard-skip-team
hypothesis: |
  If we remove the "invite teammates" step from solo-signup onboarding,
  then activation rate (first-task-completed within 24h) increases by ≥ 5% rel,
  because solo users abandon at the team-invite step they don't need.
primary: first_task_completed_24h         # baseline 38%
randomization_unit: user
guardrails: [d7_retention, paid_conversion_30d, support_tickets_onboarding]
mde: +5% rel
duration: 21 days
```

Stop criteria: paid-conversion guardrail tight (this is revenue surface) — halt if variant 30d-paid < control × 0.97. Secondary metrics observational.

### Worked example — ecommerce checkout button color

```yaml
exp-id: exp-2026-05-checkout-cta-color
hypothesis: |
  If we change the primary checkout CTA from gray to high-contrast orange,
  then checkout_submitted per cart_viewed increases by ≥ 3% rel,
  because the current gray CTA fails WCAG contrast and is hard to find on mobile.
primary: checkout_submitted_per_cart_view  # baseline 14%
randomization_unit: session                # one-shot purchase, no login required
guardrails: [revenue_per_session, refund_rate_7d, payment_error_rate]
mde: +3% rel
duration: 14 days
```

Note: session-randomized because anonymous checkout is the norm. Refund-rate guardrail catches "people clicked the bright button by accident" — a real failure mode for color experiments.

### Worked example — fintech savings nudge copy

```yaml
exp-id: exp-2026-05-savings-nudge-copy
hypothesis: |
  If we change the savings-nudge copy from "Save more this month" to "You're $X from your goal",
  then deposit_to_savings within 7d increases by ≥ 6% rel,
  because goal-anchored copy taps loss-aversion stronger than generic prompts.
primary: deposit_to_savings_7d             # baseline 8.2%
randomization_unit: user
guardrails: [withdrawal_rate, support_tickets_tagged_nudge, app_uninstall_7d]
mde: +6% rel
duration: 28 days
```

Note: regulated context — guardrails include `support_tickets_tagged_nudge` (manipulation complaints) and `app_uninstall_7d` (user fled the surface). Slower ramp, longer monitor, conservative thresholds. Compliance review of variant copy required before launch.

## Boundaries

- **Exactly one primary metric.** This skill refuses to emit a spec with zero or two-plus primary metrics. Two primaries = metric-fishing in disguise.
- **No mid-flight metric change.** Once status flips to `running`, the primary metric is frozen. Adding/swapping it post-hoc is fabrication.
- **Pre-register before exposure.** If exposure logging is already live when the spec is written, you have a draft, not a pre-registration. Note honestly in the doc.
- **Guardrails are not optional.** Minimum three (revenue/conversion-of-record, error rate, latency). Domain-specific on top.
- **No HARM guardrails skip.** Refund rate, abuse, support escalation — these never get dropped to "ship faster". They exist because shipping fast on the primary metric is exactly when harm goes unseen.
- **This skill writes the design, not the analysis.** Final numerical results, regression tests, and HTE deep-dives belong to a separate analysis step.
- **Doesn't replace `/feature-flag-rollout`.** Rollout = risk-managed exposure of a known-good change. A/B test = hypothesis-driven measurement of an unknown-direction change. Flag the rollout *after* the test ships variant.

## Re-run Behavior

- **Existing draft found (`status: draft`)** → read first, surface diff against new inputs, bump fields, keep history. Don't silently overwrite.
- **Status `running`** → re-run is blocked except for two narrow operations: appending a guardrail-snapshot row, or executing the auto-stop path on guardrail breach. Primary-metric edits refused.
- **Status `concluded`** → archive, no re-run. New hypothesis = new exp-id.
- **Status `abandoned`** → permitted; logs reason. Doesn't roll forward into a new design.

## Auto-chain

- **Pre-design** → `/analytics-spec` (primary-metric event must exist) and `/experiment-power-calc` (sample-size). Refuses to emit spec if either prerequisite is unmet.
- **Guardrail breach during run** → auto-fires `/feature-flag-rollout` kill-switch path (variant is gated behind a flag; breach → flag to 0%).
- **At conclusion, ship-variant decision** → `/north-star-metric-pick` impact write-up (did this move the north star, by how much, what's the learning).
- **At conclusion, ship-control or inconclusive** → `/post-mortem`-lite: one-paragraph learnings entry; updates `docs/experiments/learnings.md` rolling log.
- **Pre-launch on regulated surface (fintech, health)** → `/threat-model` + compliance review of variant copy/UX before traffic.

## Example Trigger

User: "design an A/B test for the new pricing page"

→ Emit `docs/experiments/exp-2026-05-pricing-page-v2.md` with:
- if/then/because hypothesis,
- one primary metric (`pricing_contact_submitted` per visitor) with MDE +8% rel,
- 50/50 user-randomized split, sticky bucketing,
- exclusions (bots, internal, existing customers, conflicting experiment),
- sample-size computed via `/experiment-power-calc` (52.4k/arm, 30-day duration),
- four guardrails with numeric thresholds (revenue, error rate, p95, support tickets),
- stop criteria (max 30d, guardrail-only mid-flight stops, no peeking),
- pre-registered analysis plan (two-proportion z-test, BH correction on secondaries, decision rule),
- exposure-event spec,
- empty results-when-done template ready to fill at day 30.
