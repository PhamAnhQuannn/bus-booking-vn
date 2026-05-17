---
name: feature-flag-rollout
description: Plan + execute feature-flag rollout (% ramp, segment gate, kill-switch, cleanup-date TODO). Provider-agnostic (LaunchDarkly / Statsig / Unleash / homegrown). Use when user says "feature flag", "gradual rollout", "ramp", "kill switch", "/feature-flag-rollout", or before any L-track release.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /feature-flag-rollout — gradual rollout plan with kill-switch + cleanup

## Why you'd care

Three failure modes hide inside any flag the team forgets to spec:

- **Flag with no ramp** = "behind a flag" but flipped 0→100% on day one = full rollout dressed up as caution. Blast radius identical to no flag.
- **Flag with no cleanup-date** = permanent dead code. Two months later the codebase has 14 dormant branches, nobody remembers which are live, and removing any one is a half-day archaeology dig.
- **Flag with no kill-switch SLA** = panic when broken. On-call is paged, the engineer who knows the flag is asleep, and the team spends 40 minutes finding the toggle while customers see the bug.

One spec captures all three: ramp schedule + guardrails + kill authority + calendar-anchored cleanup. Provider-agnostic — the spec stays valid whether you ship LaunchDarkly, Statsig, Unleash, ConfigCat, or a homegrown DB table.

Invoke as `/feature-flag-rollout`. Pair every flag with a written rollout plan before it ships.

## When This Skill Applies

Triggers (user phrases):
- "feature flag", "gradual rollout", "ramp this", "kill switch"
- "ship behind a flag", "% rollout", "canary by user"
- "what's our flag plan for X", "/feature-flag-rollout"

Auto-invoke:
- Before any **L-track release** (PRD-graded L or larger) — flags are mandatory at L+.
- When `/canary-deploy` is picked but the change is user-perceptible (UX/copy/algorithm change) — canary covers server-segment, this skill covers user-segment.
- After `/feature-flag-wire` lands code wiring with no rollout doc.

## Pre-flight

1. **Flag provider chosen?** LaunchDarkly / Statsig / Unleash / ConfigCat / PostHog / homegrown DB. If undecided, pick before continuing — targeting-rule syntax differs.
2. **Wiring exists?** Cross-ref `/feature-flag-wire` for code-side wiring (SDK init, eval helper, default-off boilerplate). This skill plans the rollout; it does not write the wire.
3. **Metric guardrails defined?** You need at minimum:
   - **Error rate** baseline (per-route or per-feature) — Sentry / Datadog / homegrown.
   - **Conversion / business KPI** specific to the feature (signup completion, checkout rate, search-to-click).
   - **p95 latency** for any new code path.
   If none exist → run `/observability-design` first, otherwise the ramp gates are vibes.
4. **Authority list.** Who has flip-to-0 authority? On-call rotation? Single human? Default: anyone in `#oncall` Slack channel.

## Inputs

- **Feature slug** — kebab-case, matches the flag key (`pricing-v2`, `checkout-stripe-link`, `tier-pro-quota-200`).
- **Ramp targets** — list of percent stops, default `1% → 10% → 50% → 100%`.
- **Eval interval** — soak time at each stop, default `24h` for user-perceptible features, `1h` for backend-only.
- **Kill-switch SLA** — max time from "we decide to kill" to "flag is 0%". Default `5 minutes`.
- **Cleanup date** — calendar date when this flag must be removed, default `ship-date + 60 days`.
- **Cohort overrides** — internal-first? beta-list? geo-restricted? plan-gated?

## Process

1. **Define flag schema.** Capture as YAML so it's provider-portable. Required fields: `key`, `default`, `variations`, `targeting`, `owner`, `created`, `cleanup_by`.

2. **Ramp schedule.** Pick stops + soak windows. The defaults work for most features:

   | Stop | Eval window | Cohort | Default action |
   |---|---:|---|---|
   | 0% | — | none (off) | ship code, verify default-off |
   | internal | 1d | `email LIKE '%@yourco.com'` | smoke test in prod |
   | 1% | 24h | random hash bucket | watch guardrails closely |
   | 10% | 24h | random hash bucket | watch guardrails |
   | 50% | 24h | random hash bucket | confirm no slow-burn regression |
   | 100% | 7d monitor | all | cleanup countdown starts |

   Tighten windows for backend-only or low-risk features (1h soak fine). Loosen for high-risk (UX overhaul → 7d at 10%).

3. **Eval-fail criteria** per guardrail. Each metric gets a number, not "watch the dashboard":
   - Error rate: `errors_in_flag_on / requests_in_flag_on` exceeds `baseline × 1.5` for 10 min → halt ramp.
   - Conversion: `conversion(flag_on) < conversion(flag_off) × 0.95` (5% relative drop) for 1 eval window → halt.
   - p95 latency: `p95(flag_on) > p95(flag_off) + 100ms` → halt.
   - Custom: any SEV-1 incident tagged with the flag key → auto-kill to 0%.

4. **Kill-switch SLA.** Spell out:
   - **Who** can flip — list of humans / role / Slack channel.
   - **How** — exact UI/CLI step (`ld flag set pricing-v2 --off`, or "edit row in `flags` table SET enabled=false").
   - **Within** — clock SLA from decision to 0% serving (default 5 min including SDK cache TTL).
   - **After kill** — log the kill in `docs/incidents/`, fire `/post-mortem` if customer-visible.

5. **Cleanup-date TODO.** Three-part trigger:
   - **Calendar entry** in shared cal: "Remove flag `<key>` — <date>".
   - **Code TODO** at every flag eval site: `// TODO(flag-cleanup: <key>, <YYYY-MM-DD>): remove after 100% ramp.`
   - **Auto-PR** at cleanup date: `/feature-flag-rollout --cleanup <key>` generates a removal PR that deletes flag evals, keeps the winning branch, drops the other.

6. **Post-ramp removal PR template.** Generated content:
   - Delete the flag SDK call sites.
   - Inline the winning variation.
   - Drop the dead branch.
   - Remove the flag from provider dashboard.
   - Update release notes: "Pricing v2 fully rolled out; flag removed."

## Output Format

Write `docs/release/flag-<feature>.md`:

```markdown
# Flag rollout — <feature-slug>

**Owner:** <name> | **Provider:** <LaunchDarkly/Statsig/Unleash/homegrown>
**Created:** <YYYY-MM-DD> | **Cleanup by:** <YYYY-MM-DD>

## Schema

\`\`\`yaml
key: pricing-v2
default: false
variations:
  - { value: false, name: "control" }
  - { value: true,  name: "pricing-v2" }
targeting:
  - rule: "email endsWith '@yourco.com'"
    serve: true
  - rule: "user.id hash bucket < ${rolloutPct}"
    serve: true
  - default: false
owner: anh@yourco.com
created: 2026-05-14
cleanup_by: 2026-07-14
\`\`\`

## Ramp table

| Date       | Stop      | Cohort           | Guardrail snapshot | Decision    | Notes |
|------------|-----------|------------------|--------------------|-------------|-------|
| 2026-05-14 | 0%        | none             | n/a                | ship code   | default-off verified |
| 2026-05-15 | internal  | @yourco.com      | error 0.1%, conv +2% | proceed   | 8 internal users |
| 2026-05-16 | 1%        | hash bucket 0-1  | error 0.12%, conv -1% | proceed  | within tolerance |
| 2026-05-17 | 10%       | hash bucket 0-10 | error 0.11%, conv +0.5% | proceed |  |
| 2026-05-18 | 50%       | hash bucket 0-50 | error 0.10%, conv +0.8% | proceed |  |
| 2026-05-19 | 100%      | all              | error 0.10%, conv +0.7% | hold 7d  | cleanup PR queued |
| 2026-05-26 | cleanup   | n/a              | n/a                | remove flag | PR #1234 |

## Guardrails (exact thresholds)

- **Error rate**: Sentry query `event.tags.flag.pricing-v2 = on` — halt ramp if rate > `baseline × 1.5` for 10 min.
- **Conversion**: PostHog funnel `pricing_view → checkout_start` — halt if `flag_on / flag_off < 0.95` per eval window.
- **p95 latency**: Datadog query on `/api/pricing` — halt if `flag_on - flag_off > 100ms`.
- **Custom**: any SEV-1 tagged `flag:pricing-v2` → auto-kill to 0%.

## Kill-switch procedure

- **Authority:** anyone in `#oncall`. Single-human override: <on-call lead>.
- **Command:** `ld flag set pricing-v2 --off` (or provider UI: `Flags → pricing-v2 → Kill switch`).
- **SLA:** 5 min from decision to 0% serving (LD SDK cache TTL = 30s, browser flush ≤ 4 min).
- **Post-kill:** Slack `#incidents`, file `docs/incidents/<date>-pricing-v2.md`, page `/post-mortem` if customer-visible.

## Cleanup checklist

- [ ] Calendar entry created for cleanup_by date
- [ ] `// TODO(flag-cleanup: pricing-v2, 2026-07-14)` at every eval site
- [ ] Removal PR drafted with: delete eval, inline winning branch, drop dead branch
- [ ] Provider dashboard archived after merge
- [ ] Release notes updated
```

### Worked example — SaaS quota feature

```yaml
key: tier-pro-quota-200
default: false        # legacy 100/mo quota stays for everyone
variations:
  - { value: false, name: "quota-100" }
  - { value: true,  name: "quota-200" }
targeting:
  - rule: "plan == 'pro' AND signup_date > '2026-01-01'"
    serve: true       # new pro accounts get 200 first
  - rule: "user.id hash bucket < ${rolloutPct}"
    serve: true
cleanup_by: 2026-08-01
```

Ramp: internal (1d) → new-pro-signups (3d) → 25% existing-pro (7d) → 100% pro (14d monitor) → cleanup. Guardrails: API error rate on quota-check endpoint, support ticket rate tagged "quota", billing-team revenue dashboard (no surprise drops).

### Worked example — ecommerce checkout variant

```yaml
key: checkout-stripe-link
default: false        # legacy elements-based checkout
variations:
  - { value: false, name: "elements" }
  - { value: true,  name: "stripe-link" }
targeting:
  - rule: "geo.country == 'US'"
    serve: false      # US stays on elements until link is GA
  - rule: "user.id hash bucket < ${rolloutPct}"
    serve: true
cleanup_by: 2026-06-30
```

Ramp: internal → 1% EU → 10% EU → 50% EU → 100% EU → 1% US → 100% US. Guardrails: checkout-completion rate (primary), Stripe webhook error rate, p95 payment-intent latency. Kill SLA tightened to 2 min — payment failures bleed money fast.

### Worked example — fintech account-tier flag

```yaml
key: account-tier-premium-v2
default: false        # current premium UX stays for everyone
variations:
  - { value: false, name: "premium-v1" }
  - { value: true,  name: "premium-v2" }
targeting:
  - rule: "kyc_level >= 2 AND account_age_days > 30"
    serve: true       # only verified, seasoned accounts
  - rule: "user.id hash bucket < ${rolloutPct}"
    serve: true
cleanup_by: 2026-09-01
```

Ramp slower because regulated: internal (1w) → 0.5% (1w) → 5% (2w) → 25% (2w) → 100% (4w monitor). Guardrails: transaction-failure rate, compliance-alert rate, support escalations tagged "premium-v2". Kill authority restricted to on-call + compliance lead (regulator-visible feature).

## Boundaries

- **Provider-agnostic spec only.** This skill writes a plan document. It does not call the LaunchDarkly/Statsig API to actually create the flag — that's `/feature-flag-wire` (code + provider config).
- **Doesn't execute the ramp.** Each ramp step is a human-in-loop gate. The doc tells you what to check and when; a human flips and signs the row.
- **Doesn't replace `/canary-deploy`.** Canary segments by **server / pod / traffic %**. Flags segment by **user / cohort**. A risky release often wants both: canary the deploy, flag the feature.
- **Doesn't replace observability.** Guardrail queries assume metrics already exist. Run `/observability-design` first if not.
- **No flag without a cleanup date.** The skill refuses to emit a doc with a blank `cleanup_by`.

## Re-run Behavior

- Re-run after each ramp step: appends a row to the ramp table with the observed guardrail snapshot and the decision (proceed / hold / kill).
- Re-run at cleanup-date: invokes the auto-removal PR generator (delete eval, inline winner, drop loser).
- Re-run with `--extend` to push cleanup-date out (requires written reason, logged to the doc).
- Re-run mid-ramp with `--rollback` snapshots the kill action and chains to `/rollback-plan`.

## Auto-chain

- **Guardrail breach** during ramp → auto-chain `/rollback-plan` (flag-flip is the primary rollback lever; code-revert is fallback).
- **After `/canary-deploy`** for the same release → this skill picks up the user-segment axis (canary handled server-segment).
- **Before `/release-notes`** → flagged features are surfaced separately ("Available to 50% of Pro users; full rollout 2026-05-26").
- **Cleanup date reached** → auto-fires removal PR; closes the loop into `/dead-code-scan` if any branches were missed.

## Example Trigger

User: "we're launching the new pricing page behind a flag, plan the rollout"

→ Emit `docs/release/flag-pricing-v2.md` with:
- flag schema YAML (default off, internal-first, hash-bucket ramp),
- 4-step ramp table (internal → 1% → 10% → 50% → 100% with 24h soaks),
- guardrails (Sentry error rate, PostHog conversion funnel, Datadog p95),
- kill-switch SLA (5 min, `#oncall` authority, exact LD command),
- cleanup TODO with calendar entry + code comments + auto-removal PR template at ship+60d.
