---
name: devtool-pricing-model
description: Devtool/API pricing — usage-based vs seat-based vs hybrid, free-tier sizing, pricing-page comparators, PLG → enterprise expansion path. Outputs pricing model + free-tier math + page wireframe to `docs/inception/devtool-pricing-<product>.md`. Reads `/project-classify` to skip XS. Use when user says "devtool pricing", "API pricing", "usage-based", "metered billing", "free tier", "PLG", "self-serve to enterprise", "pricing comparator", "/devtool-pricing-model", or before publishing a pricing page.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 5h
  XL: 5h
---

# /devtool-pricing-model — Devtool Pricing Architecture

## Why you'd care

Devtools have a unique pricing problem — your buyer is technical, evaluates pricing more rationally than a CMO ever will, and runs the numbers in a spreadsheet before talking to sales. Mispricing leaks 20-40% of potential ACV; over-pricing the free tier prevents the PLG flywheel from spinning at all. Stripe (per-transaction), Twilio (per-API-call), Datadog (per-host), Snowflake (per-compute-credit) all converged on different unit-economic shapes; pick yours deliberately.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Identify the natural unit of value — what does the customer get more of when they grow? (API calls, transactions, GB stored, MAU, seats, hosts, builds, requests, tokens).
3. Pull infra cost-per-unit if possible — pricing must clear COGS by ≥70% gross margin or unit economics break.
4. Identify your ICP at three stages: free user, paid self-serve, enterprise. Each has different willingness-to-pay (WTP).
5. Pair with `/pricing-model` (general) for context but apply devtool-specific patterns below.

## Inputs
- Product surface + natural value-unit.
- COGS per unit (hosting, bandwidth, model inference, third-party API).
- Competitor pricing pages (3-5 from `/competitor-scan`).
- Current sign-up → paid conversion if any.
- Aspirational annual contract value (ACV) — self-serve median, enterprise median.

## Process

1. **Pick the pricing axis** — devtool pricing falls into 5 archetypes. Pick one primary, optionally one secondary:

   | Axis | Best for | Examples | Risks |
   |---|---|---|---|
   | **Usage-based (per unit)** | Variable workloads, API-heavy products | Stripe (per txn), Twilio (per msg/min), AWS (per hr/GB), OpenAI (per token) | bill-shock, predictability concerns, hard to forecast for buyer |
   | **Seat-based (per user)** | Team collaboration tools, products with active human users | Linear, Figma, GitHub | discourages adoption, ratchets at growth, doesn't reflect actual value for asymmetric usage |
   | **Tiered usage** | Predictable workloads, want to land mid-market with simple math | Vercel (Hobby/Pro/Enterprise), Netlify, Sentry | tier-cliff anxiety, customers stuck just-over-tier |
   | **Resource/capacity** | Infra-heavy products | Snowflake (compute credits), Databricks (DBUs), Heroku (dynos) | unit obscurity, accounting headache |
   | **Hybrid** | Mature products with multi-dimensional value | Datadog (per host + per metric + per log GB), Segment (per MTU + per source) | complexity, multi-line invoices, harder to compare |

   Rule of thumb: pick the axis where (a) cost scales with customer success, (b) the customer can easily forecast it, (c) it can't be gamed by trivial workarounds.

2. **Match unit to value moment** — there's usually a single "value moment" where the customer says "this worked." Charge near that moment, not far from it:
   - Payment processor: value moment = transaction succeeds → per-transaction pricing.
   - Communication API: value moment = message delivered → per-message pricing.
   - Observability: value moment = signal ingested → per-GB or per-host pricing.
   - Auth: value moment = user authenticates → per-MAU.
   - Database: value moment = query returns / row written → per-row or per-query (often abstracted to capacity).

   If you charge far from the value moment ("per signup" for an auth product where most signups never come back), customers feel ripped off.

3. **Free-tier sizing — the Goldilocks math** — the free tier must be:
   - **Generous enough** that a serious dev can build something real and hit "first value" — typically 10-100× the typical Hello-World workload.
   - **Bounded tightly enough** that COGS stays under $0.50/month per active free user — or you fund growth from runway, not margin.
   - **Visible at the boundary** — users know they're 60%/80%/100% through, with upgrade CTA before they hit a wall.

   Three free-tier patterns:

   | Pattern | Example | When to use |
   |---|---|---|
   | **Time-limited free trial** | Vercel Pro 14-day | mature products with clear value moment within days |
   | **Forever-free tier with quota** | Vercel Hobby, Cloudflare Workers free, OpenAI free credits | PLG products where adoption > revenue at this stage |
   | **Open-source core + paid cloud** | GitLab, Sentry, PostHog, Plausible | infrastructure products where source is the marketing |

   COGS math for forever-free: if free tier serves 100K users and converts 2% to paid, your COGS for 98K freeloaders must stay under (paid ACV × 2K × gross margin). Run this math before launch.

4. **Pricing tiers — the 3-tier shape** — almost every successful devtool converges on:

   | Tier | Audience | Price shape | Floor / ceiling |
   |---|---|---|---|
   | **Free / Hobby** | individual devs, side projects, evaluation | $0 with quota | unlimited time, capped usage |
   | **Pro / Team** | startups, growing teams, self-serve | flat $X/mo or $Y/user/mo + metered overage | $20-$200/mo entry, capped at "talk to sales" threshold |
   | **Enterprise** | large companies, SSO/SAML, SLA, support | annual contract, custom pricing | $20K+ ACV floor |

   Optional 4th: **Scale / Business** between Pro and Enterprise for the $1-20K self-serve band. Stripe, Twilio, Datadog all have this.

5. **The "talk to sales" threshold** — define explicitly when self-serve hands off to sales:
   - Volume threshold (e.g., >1M API calls/mo, >50 seats, >100GB/mo).
   - Feature threshold (SSO, SAML, audit logs, custom DPA, SOC 2 report).
   - Annual contract threshold (anything ≥annual commitment).
   - Compliance threshold (HIPAA BAA, PCI, FedRAMP requirements).

   Threshold should be set so 80-90% of revenue comes from above-threshold customers (where AE attention pays off), but 80-90% of customers stay below threshold (self-serve scales without head-count).

6. **Pricing-page comparator structure** — the canonical 6-row comparator that converts:

   | Row | Hobby | Pro | Enterprise |
   |---|---|---|---|
   | **Price** | $0 | $X/mo | Custom |
   | **Best for** | personal projects | startups + growing teams | large companies |
   | **Quota / capacity** | 100K req/mo | 10M req/mo + overage | unlimited |
   | **Team features** | 1 seat | unlimited seats | SSO + SCIM + role-based access |
   | **Support** | community | email, 24h response | dedicated + 1h SLA |
   | **Compliance / contracts** | standard ToS | standard MSA | custom MSA, DPA, BAA, SOC 2 report |

   Plus a **feature checklist** below comparing 10-20 specific capabilities. Most-clicked element on a pricing page is the comparator — design for scannability, not exhaustive accuracy.

7. **PLG → enterprise expansion path** — the path from $0 free user to $50K ACV runs through 5-6 explicit moments:
   - **Sign-up** ($0): one email, one click, real test key in 60s.
   - **First-success** ($0): TTFHW <15 min, instrumented and tracked.
   - **Quota notification** ($0 → $20): friendly "you're at 70% of free quota" with calculator showing what Pro costs at current usage.
   - **Paid self-serve conversion** ($20-$2K): one-click upgrade, credit card, no sales call.
   - **Team adoption** ($2K-$20K): "invite teammate" inside product, team plan upsell.
   - **Enterprise trigger** ($20K+): pricing page flags "need SSO?" → routes to sales.
   - **Expansion** ($20K → $200K+ ACV): land with one team, expand to org-wide via committee deal.

   Measure conversion at each step. Industry rules of thumb for devtools:
   - Free → Paid: 2-5% (good), 5-10% (great), >10% (suspicious — free is probably too restrictive).
   - Paid Self-serve → Enterprise: 5-15% of accounts, but 60-80% of revenue.
   - Net Revenue Retention (NRR) for devtools at scale: 110-130% best-in-class (Datadog, Snowflake hit 130%+).

8. **Bill-shock prevention** — usage-based pricing kills trust the first time a customer is surprised. Required mechanics:
   - **Usage dashboard** — current MTD spend visible in 1 click from any page.
   - **Budgets + alerts** — customer sets a soft cap ($X/mo); alerts at 50/75/100/120% via email + in-app.
   - **Hard cap option** — customer can set a hard cap that pauses service before charge (use sparingly; some say "soft cap only" to avoid outage liability).
   - **Anomaly detection** — if usage spikes 5× baseline in 24h, page the customer + freeze billing pending acknowledgement.
   - **Spend simulator** — public calculator: "if I send N requests at QoS X, my monthly bill is $Y."
   - **Prorate fairness** — invoice mid-cycle changes correctly; don't double-bill at upgrade boundary.

9. **Margin discipline + COGS-aware pricing** — devtools, especially AI APIs and infra primitives, can have COGS pressure that compresses margin if pricing isn't aligned:
   - Per-unit price must clear COGS by ≥3× for SaaS-acceptable 70%+ gross margin.
   - For AI APIs, COGS is ~30-50% of price (token-passthrough margin is thin); reserve margin via volume tiers + caching credits.
   - Tier transitions must preserve margin (don't accidentally make Enterprise pricing per-unit cheaper at scale than Pro per-unit — happens often, kills margin).
   - Annual contract discount: cap at 15-20%; you're trading cash up-front for revenue predictability, not giving margin away.

10. **Pricing change discipline** — once you have customers, pricing changes are political:
    - **Grandfathering policy**: existing customers stay on old pricing for ≥12 months on price increases. Document this publicly to build trust.
    - **Notice period**: 90 days minimum for price increases.
    - **Migration tools**: customer can see "new pricing would cost me $X" before they have to opt in.
    - **Public changelog**: every pricing change documented at `/pricing/changelog`.
    - **No back-door fees**: any new charge category gets a launch post; never appear silently on invoices.

11. **Competitive comparator + win/loss math** — for each top-3 competitor, build a "your cost at our customer's typical workload" table:
    - At 10K req/mo: ours $X, competitor A $Y, competitor B $Z
    - At 1M req/mo: ours $X, competitor A $Y, competitor B $Z
    - At 100M req/mo: ours $X, competitor A $Y, competitor B $Z

    Where competitor is cheaper, name why your value justifies the gap (latency, reliability, dev experience, ecosystem). If you can't, your pricing is wrong.

12. **Pricing experimentation cadence** — once live, treat pricing as a product surface, not a fixed prop:
    - Quarterly: review tier conversion rates, NRR by cohort, ARR per usage tier.
    - 2x/year: A/B test pricing-page comparator copy/order (small impacts compound).
    - Annually: full pricing review — re-survey WTP (`/willingness-to-pay-test`, Van Westendorp), benchmark against competitors, surface upgrade-path friction.
    - Pricing decision-doc: every change documented as ADR-style in `docs/decisions/`.

## Output

Write `docs/inception/devtool-pricing-<product>.md`:

```markdown
# Devtool Pricing Model — <Product>
**Date:** | **Owner:** | **Re-review:** quarterly

## Value unit + pricing axis
- Natural value unit: <per API call / per MAU / per GB / per host / per seat>
- Primary axis: <usage-based / seat-based / tiered / capacity / hybrid>
- Secondary axis (if hybrid):
- Value moment: <description>
- COGS per unit: $
- Target gross margin: __%
- Per-unit price required for margin: $

## Free tier
- Pattern: <forever-free / 14-day trial / open-source-core>
- Quota: <e.g., 100K req/mo, 5K MAU, 1GB>
- COGS for 1 free user: $/mo
- Expected free→paid conversion: __%
- Quota visibility design (50/80/100% thresholds): <description>

## Tier structure
| Tier | Price | Audience | Quota | Key features | Support |
|---|---|---|---|---|---|
| Hobby / Free | $0 | | | | community |
| Pro / Team | $X/mo | | | | email 24h |
| Scale / Business | $Y/mo | | | | email 4h |
| Enterprise | custom | | | | dedicated 1h |

## "Talk to sales" threshold
- Volume trigger:
- Feature trigger: <SSO / SAML / audit logs / custom DPA / BAA>
- Annual contract trigger:
- Compliance trigger:

## Pricing-page comparator (6-row)
| Row | Free | Pro | Enterprise |
|---|---|---|---|
| Price | $0 | $X/mo | Custom |
| Best for | | | |
| Quota / capacity | | | |
| Team features | | | |
| Support | | | |
| Compliance | | | |

## PLG → enterprise expansion path
| Stage | Target conversion | Current |
|---|---:|---:|
| Sign-up | | |
| First success | | |
| Free → Paid self-serve | 2-5% | |
| Paid self-serve → Team | 30-50% | |
| Team → Enterprise | 5-15% (60-80% of $) | |
| NRR (year 2+ cohort) | 110-130% | |

## Bill-shock prevention checklist
- [ ] Usage dashboard 1-click visible
- [ ] Soft budget alerts (50/75/100/120%)
- [ ] Hard cap option (if applicable)
- [ ] Anomaly detection (5× baseline)
- [ ] Public spend simulator
- [ ] Mid-cycle proration correct

## Competitive comparator
| Workload | Ours | Competitor A | Competitor B | Notes |
|---|---|---|---|---|
| 10K/mo | | | | |
| 1M/mo | | | | |
| 100M/mo | | | | |

## Pricing change policy
- Grandfathering window: 12 months
- Notice period: 90 days
- Migration tool: <yes/no, link>
- Changelog URL:

## Open questions / experiments queued
- [ ] Van Westendorp survey for next price tier
- [ ] A/B test on pricing-page order
- [ ] Re-survey WTP every 12 months
```

## Verification
- One primary pricing axis named (not "we'll figure it out").
- Free-tier COGS calculated, not estimated.
- 3-tier pricing-page comparator drafted with concrete numbers.
- "Talk to sales" threshold has 4 explicit triggers.
- Bill-shock prevention has all 5 mechanics or documented why omitted.
- Competitive comparator at 3 workload scales drawn.
- Grandfathering + notice policy committed to publicly.
