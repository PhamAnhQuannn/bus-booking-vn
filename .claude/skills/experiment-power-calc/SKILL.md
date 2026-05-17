---
name: experiment-power-calc
description: Calculate required sample size + experiment duration given baseline rate, MDE (minimum detectable effect), alpha, power. Provider-agnostic formula + tool refs (R `pwr`, Python `statsmodels`, online calculators). Use when "sample size", "power calc", "MDE", "/experiment-power-calc", or after `/ab-test-design` before launch.
output_size:
  XS: skip
  S: 15m
  M: 30m
  L: 30m
  XL: 30m
---

# /experiment-power-calc — Sample Size + Duration

## Why you'd care

Underpowered test = false null. You ship the variant tomorrow because the p-value crossed 0.05, but the lift is noise; you would have needed 6x the sample to detect a real effect. Overpowered test = you burn weeks of user-traffic detecting a 0.1pp lift you would never have shipped. A pre-launch power calc tells you whether the experiment is even feasible at current traffic before you turn the flag on — and if it isn't, forces the conversation about cutting variants or raising MDE while it's still cheap.

## When This Skill Applies

Activate when:
- User says "sample size", "power calc", "MDE", "minimum detectable effect", "how long do I run this", "/experiment-power-calc"
- After `/ab-test-design` produces an experiment spec — power calc is the final pre-launch gate
- Before turning on a feature flag with a measurement intent
- Re-running when baseline drifts (new traffic source, seasonality) or MDE is reframed
- When PM/growth asks "can we even detect this?" and the answer is unknown

Pairs with `/ab-test-design` (consumes its spec doc), `/analytics-spec` (baseline must be measured, not guessed), `/feature-flag-rollout` (the launch mechanism).

## Pre-flight

1. Read `docs/experiments/<exp-id>.md` produced by `/ab-test-design` (or equivalent spec). No spec → run `/ab-test-design` first.
2. Baseline metric **measured**, not guessed. Cross-ref `/analytics-spec` — if the metric isn't instrumented yet, stop and instrument first. Power calc on a guessed baseline is theatre.
3. MDE is business-justified: the smallest effect that would actually change the ship/no-ship decision. "5% lift sounds nice" is not justified; "below 2pp absolute lift the engineering cost exceeds the revenue uplift" is justified.
4. Variant count decided (control + N treatments). Each extra arm raises the multiple-comparisons tax.
5. Daily eligible traffic counted from analytics — the cohort that *qualifies* for the experiment (logged-in, in-region, on the relevant surface), not raw site traffic.

## Inputs

- **Metric type**: proportion (binary — converted yes/no), mean (continuous — revenue per user, time on page), or count (events per user, Poisson-ish).
- **Baseline**: rate (for proportion, e.g. 0.08), or mean + standard deviation (for continuous, e.g. mean=$42, sd=$28).
- **MDE**: absolute (e.g. +0.5pp, taking conversion 8.0% → 8.5%) or relative (e.g. +6.25%, same lift). Always show both; relative-only without the absolute number hides feasibility.
- **Alpha (significance)**: default 0.05 (two-tailed). Tighter (0.01) when false positive is costly (pricing change, irreversible rollout).
- **Power (1 − beta)**: default 0.80. Bump to 0.90 when false negative is costly (kills a real win).
- **Variants**: control + N treatments. N ≥ 2 → apply multiple-comparisons correction (Bonferroni: divide alpha by number of comparisons; FDR/Benjamini-Hochberg: less conservative, prefer when many arms).
- **Tail**: two-tailed default. One-tailed only when a direction-reversing result is uninteresting (and you can defend that to a stats reviewer).
- **Daily eligible traffic**: users/sessions per day in the qualifying cohort.

## Process

1. **Classify metric type.** Proportion (binary) vs mean (continuous) vs count (Poisson). Different formula per type — wrong classification = wrong n by 2–10x. Conversion rate is proportion; revenue per user is continuous; sessions per user is count.

2. **Pull baseline from analytics, not memory.** Same window as the planned experiment (e.g. trailing 28d). If the metric isn't in the analytics catalog (`/analytics-spec`), stop here and instrument first. Hand-wave baselines produce hand-wave sample sizes.

3. **Set MDE in absolute terms.** Convert relative-MDE to absolute and show both. Example: baseline 8% conversion, +5% relative MDE = 8.0% → 8.4% absolute (0.4pp). Show the absolute number even when the conversation is in relative terms — it is what the formula consumes and it reveals whether the lift is plausible at all.

4. **Apply defaults + multiple-comparisons correction.** Alpha = 0.05, power = 0.80 unless a stronger argument is made. If variants > 2, correct alpha:
   - Bonferroni: `alpha_corrected = 0.05 / (k − 1)` where k = total arms. Three variants (1 control + 2 treatments) → 0.025 per comparison.
   - FDR (preferred for ≥4 arms): use Benjamini-Hochberg procedure; less conservative, controls expected false-discovery rate not family-wise error.

5. **Run the formula.**

   **Proportion z-test (two-sample, two-tailed):**

   ```
   n_per_arm = ((z_{alpha/2} + z_{beta})^2 × (p1 × (1 − p1) + p2 × (1 − p2))) / (p2 − p1)^2
   ```

   Where `p1` = baseline rate, `p2` = baseline + MDE, `z_{alpha/2}` = 1.96 for alpha=0.05 two-tailed, `z_{beta}` = 0.84 for power=0.80.

   **Two-sample t-test (continuous, two-tailed):**

   ```
   n_per_arm = 2 × ((z_{alpha/2} + z_{beta})^2 × sigma^2) / (mu2 − mu1)^2
   ```

   Where `mu1` = baseline mean, `mu2` = baseline + MDE, `sigma` = pooled standard deviation, z-values as above.

   **Count / Poisson rates:** use rate-ratio test; for solo-dev work, approximate with the proportion formula on `events/exposure` framed as a rate or hand off to `statsmodels.stats.power`.

6. **Cross-check via a tool.** Hand-rolled formula = one error per implementation. Always verify with one of:
   - **R**: `pwr::pwr.2p.test(h = ES.h(p1, p2), sig.level = 0.05, power = 0.80)` for proportions; `pwr::pwr.t.test()` for continuous.
   - **Python**: `from statsmodels.stats.power import NormalIndPower; NormalIndPower().solve_power(effect_size=..., alpha=0.05, power=0.80)`; or `statsmodels.stats.proportion.samplesize_proportions_2indep_onetail`.
   - **Online**: Evan Miller's calculator (evanmiller.org/ab-testing/sample-size.html) for proportions, sanity-check only.

   If hand-formula and tool disagree by >5%, the formula is wrong — usually a misapplied effect-size transform (Cohen's h vs raw difference).

7. **Compute duration.** `duration_days = total_n_required / daily_eligible_traffic`. Total n = per-arm × number of arms. Round up to whole weeks (experiment windows align to weekly seasonality cycles).

8. **Sanity-check duration vs business clock.** If duration > 4 weeks (or > the next quarterly decision date), the experiment is infeasible at current traffic. Options, in order of preference:
   - Raise MDE (accept detecting only larger effects)
   - Reduce variants (cut the multiple-comparisons tax)
   - Pick a higher-volume surface
   - Wait for organic traffic growth (rarely correct)
   - Accept a lower power (0.70) — only if false negative is cheap

   Do not "just run it longer" past 6 weeks — drift, holiday effects, and cohort contamination erode the experiment's validity.

## Output Format

**Append to `docs/experiments/<exp-id>.md`** (produced by `/ab-test-design`), under a `## Power Calc` section. Do not create a separate file. Format:

```markdown
## Power Calc

**Date:** <YYYY-MM-DD> | **Owner:** <PM/growth/eng>

### Inputs
- Metric: <name> — type: <proportion / mean / count>
- Baseline: <p1 or mu1 + sigma> (source: <analytics query / dashboard link>)
- MDE: <absolute pp / dollars / events> (relative: <%>)
- Alpha: 0.05 (corrected to <X> for <k> arms via <Bonferroni / FDR>)
- Power: 0.80
- Tail: two-tailed
- Daily eligible traffic: <N> users/sessions

### Result
| Variant | Per-arm n | Total n | Daily eligible | Duration |
|---|---|---|---|---|
| Control + Treatment A | <n> | <2n> | <traffic> | <days / weeks> |
| Control + Treatment A + B | <n> | <3n> | <traffic> | <days / weeks> |

### Sensitivity
| Scenario | Per-arm n | Duration |
|---|---|---|
| MDE −20% (harder to detect) | <n> | <days> |
| MDE +20% (easier to detect) | <n> | <days> |
| Power 0.90 | <n> | <days> |

### Cross-check
Formula: <n from hand calc>
Tool (<R pwr / statsmodels / Evan Miller>): <n>
Delta: <%>

### Decision
- [ ] Feasible at current traffic (duration ≤ 4 weeks) → proceed to `/feature-flag-rollout`
- [ ] Infeasible → <reduce variants to N / raise MDE to X / pick higher-volume surface>

### Assumptions
- Baseline is stable (no upstream change planned in window)
- Variants split equally (50/50 or 33/33/33)
- No interaction with concurrent experiments on same surface
- Cohort eligibility static across window
```

### Worked examples (multi-vertical)

**SaaS — signup conversion.** Baseline 8.0%, MDE +0.5pp absolute (8.0% → 8.5%, +6.25% relative), alpha 0.05, power 0.80, two variants (control + 1 treatment), two-tailed.
- Per-arm n ≈ 23,000. Total ≈ 46,000.
- Daily eligible signups landing: 800/day → duration ≈ 58 days ≈ 8 weeks. **Infeasible.** Either raise MDE to +1pp (drops n to ~6,000/arm, ~15 days) or wait.

**Ecommerce — checkout completion.** Baseline 45%, MDE +1pp absolute (45% → 46%, +2.2% relative), alpha 0.05, power 0.80, two variants.
- Per-arm n ≈ 39,000. Total ≈ 78,000.
- Daily eligible checkouts: 3,500/day → duration ≈ 22 days ≈ 3 weeks. **Feasible.**

**Fintech — deposit completion.** Baseline 70%, MDE +1.5pp absolute (70% → 71.5%, +2.1% relative), alpha 0.05, power 0.80, three variants (control + 2 treatments) with Bonferroni correction → alpha_corrected = 0.025.
- Per-arm n ≈ 22,000 (correction raises n ~25% over uncorrected). Total ≈ 66,000.
- Daily eligible deposit attempts: 2,000/day → duration ≈ 33 days ≈ 5 weeks. **Borderline — cut to two variants** (drops to ~3 weeks) or accept the longer window.

## Boundaries

- **No power calc on unknown baseline.** If the metric isn't measured, force `/analytics-spec` first. A guessed baseline produces a guessed n, which produces a guessed duration, which produces a wasted experiment.
- **No relative-MDE without absolute.** "+10% lift" alone hides feasibility; always show the absolute conversion change (e.g. 8.0% → 8.8%). Stakeholders reason about lift relatively but the formula consumes absolutes.
- **No skipping multiple-comparisons correction on >2 variants.** Three arms tested at alpha=0.05 each ≈ 14% false-positive rate family-wise. Bonferroni minimum; FDR preferred for ≥4 arms.
- **No "we'll just get more traffic" handwave.** Compute eligible cohort, not raw traffic. A homepage A/B doesn't get all site visitors — only the qualifying surface segment.
- **No one-tailed without defense.** Two-tailed is the default; one-tailed only when a direction-reversing result is genuinely uninteresting and you can defend that to a stats reviewer.
- **No running past 6 weeks.** Drift + holidays + cohort contamination invalidate long windows. If you can't finish in 6 weeks, the experiment is the wrong shape — change MDE, variants, or surface.
- **No power calc on a vanity metric.** If the metric won't change the ship decision, no n is the right n.

## Re-run Behavior

- Baseline shifts (new traffic source, seasonality, upstream funnel change) → re-run before relying on stale n.
- MDE reframed (business decides 0.3pp is now the threshold, not 0.5pp) → re-run.
- Variant count changes (added a third treatment late) → re-run with corrected alpha.
- Eligible-cohort definition changes (e.g. excluded a segment) → re-run with new daily traffic.
- Post-experiment: if observed effect is far from MDE, log lessons in the spec doc — future MDEs on this surface should anchor to actual variance, not initial guess.

## Auto-chain

- **Consumes** output of `/ab-test-design` — appends the Power Calc section to `docs/experiments/<exp-id>.md`. No separate file.
- **Feeds** `/feature-flag-rollout` — duration + per-arm n feed the rollout plan and stop-condition.
- **Duration > 4 weeks** → suggest cutting variants OR raising MDE OR picking higher-volume surface BEFORE greenlighting the experiment. Do not proceed to launch with an infeasible window.
- **Baseline missing** → reroute to `/analytics-spec`. Power calc cannot run on guessed baselines.
- **Metric is vanity** → reroute to `/north-star-metric-pick` or `/success-metrics-baseline` before running n.

## Example Trigger

User: "how long do I need to run this checkout-button A/B?"
→ Ask: what's current checkout completion rate (baseline), what lift would make you ship the new button (MDE), how many checkout attempts per day (daily eligible traffic), one or two treatments (variants).
→ Compute per-arm n via proportion z-test, cross-check via Evan Miller or `statsmodels`, divide by daily eligible to get duration.
→ Append result + sensitivity (MDE ±20%, power 0.90) to `docs/experiments/<exp-id>.md`.
→ If duration > 4 weeks, flag and propose: raise MDE, drop a variant, or pick a higher-volume surface.
