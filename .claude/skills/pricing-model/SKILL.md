---
name: pricing-model
description: Draft an early pricing hypothesis for a product. Picks model archetype (one-time / subscription tier / usage-based / freemium / open-core), names tiers, sets prices anchored to project class, and sanity-checks against `/cost-model` for break-even. Reads `/project-classify` to skip XS (no commerce). Outputs to `docs/inception/pricing-<project>.md`. Use when user says "pricing", "how much to charge", "tiers", "freemium vs paid", "/pricing-model", or after `/lean-canvas` flags weak Revenue Streams box.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /pricing-model — Early Pricing Hypothesis

Invoke as `/pricing-model`. Picks an archetype, sets tier prices, sanity-checks economics. Hypothesis only — re-tune after first 10 paying users.

---

## Why you'd care

Pricing picked by gut is the most expensive decision a founder makes. The wrong archetype (subscription where usage-based wins, or vice versa) caps revenue from day one and is brutally hard to migrate later.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - Class **XS** → **SKIP** ("XS has no commerce. If you want to charge, re-classify first.")
   - Class S → recommend donation / one-time small purchase only.
   - Class M/L/XL → full archetype selection.
2. Read `docs/design/cost.md` if exists. If absent, recommend running `/cost-model` first (else break-even check is fiction). For minimal placeholder run, ask user explicitly for: (a) monthly fixed infra $, (b) per-customer variable $ (esp. SMS / engine compute / per-seat upstream cost — easy to forget).
3. Read `docs/inception/canvas-<project>.md` if exists — pulls Customer Segments + UVP for tier naming.

---

## Pricing archetype decision tree

Pick one. Order = most common to least:

1. **Subscription tier (free / starter / pro / enterprise)**
   - Use when: SaaS, recurring value, multi-user
   - Avoid when: one-time use, no ongoing value
2. **Usage-based (per-call / per-GB / per-seat)**
   - Use when: cost scales with usage (API, storage, compute)
   - Avoid when: usage is unpredictable for buyer (creates anxiety)
3. **Freemium (free forever + paid upgrade)**
   - Use when: viral / network-effect product, low marginal cost
   - Avoid when: high per-user cost, B2B-only, small market
   - **Free-tier calibration:** must be useful enough to share (matches free competitor baseline) but capped on the upgrade hook (the *value driver* of the paid tier — analysis, automation, branding). Over-cap kills virality; under-cap kills conversion.
4. **One-time purchase (lifetime license)**
   - Use when: standalone tool, no ongoing infra
   - Avoid when: ongoing infra costs (will bleed money)
5. **Open-core (OSS + paid hosted/enterprise)**
   - Use when: technical buyer, enterprise upsell, community moat
   - Avoid when: non-technical buyer, no enterprise need

---

## Price-anchor table by class

Starting hypothesis. Adjust based on competitor + willingness-to-pay (`/problem-validation` D-score).

| Class | Anchor                                  | Examples |
|-------|-----------------------------------------|----------|
| **XS**| free / donation only                    | personal CLI tool |
| **S** | $5–20 one-time OR $5/mo                 | hobby blog plugin, indie utility |
| **M** | $20–100/mo subscription                 | indie SaaS, niche tool |
| **L** | $100–1,000/mo OR $0.001–0.10 per usage  | commercial SaaS, API platform |
| **XL**| custom enterprise contract ($10k+/yr)   | regulated / bank / health |

---

## Tier template (subscription model)

| Tier | Price | Target | Limits | Psychological role |
|---|---|---|---|---|
| **Free** | $0 | tire-kickers, viral channel | strict caps (e.g., 100 ops/mo) | acquisition |
| **Starter** | anchor × 1 | solo / hobbyist | reasonable cap | conversion |
| **Pro** | anchor × 3–4 | small team / pro user | high cap | revenue core |
| **Enterprise** | "contact us" | large team / regulated | unlimited + SLA | upsell ceiling |

Rule of thumb: Pro ≈ 3–4× Starter. Enterprise ≈ 10×+ Pro. Free tier must be useful enough to share but limited enough to upgrade.

---

## Break-even sanity check

Read `docs/design/cost.md`. Compute:

```
Monthly fixed cost / (Price - per-unit variable cost) = customers needed to break even
```

If break-even > realistic 6-month customer count → pricing too low OR cost too high. Flag in output.

Example (indie SaaS reservation widget):
- Fixed: $40/mo (Vercel + Twilio + DB)
- Variable: $0.50/customer/mo (SMS)
- Price: $20/mo
- Break-even: $40 / ($20 - $0.50) = **3 customers**. ✓ realistic.

---

## Output template

Write to `docs/inception/pricing-<project-slug>.md`:

```markdown
# Pricing Hypothesis — <project name>

**Date: <YYYY-MM-DD>** | **Class: <from /project-classify>**
**Archetype: <subscription | usage | freemium | one-time | open-core>**

## Why this archetype
<2 bullets — why fits product + customer>

## Tier table

| Tier | Price | Target | Key limits | Notes |
|---|---|---|---|---|
| Free       | $0  | ... | ... | ... |
| Starter    | $X  | ... | ... | ... |
| Pro        | $Y  | ... | ... | ... |
| Enterprise | $$$ | ... | ... | ... |

## Break-even check
- Monthly fixed cost: $X (from `/cost-model`)
- Per-unit variable: $X
- Starter price: $X
- Customers to break even: **N**
- Realistic 6-month customer count: **N**
- Verdict: <SAFE | TIGHT | UNDERPRICED>

## Anchors / comparables
- Competitor A: $X/mo (link)
- Competitor B: $Y/mo (link)
- Our position: <undercut | match | premium>

## Riskiest assumption
<the one number that, if wrong, breaks the model>

## Re-tune triggers
- After 10 paying users
- If churn > 10%/mo in first quarter
- If usage pattern differs from assumption
- After major competitor price change
```

---

## Anti-patterns to flag

- **Penny pricing** ($1, $3) — signals low value, attracts worst customers
- **No free tier** for viral product — kills acquisition
- **Free tier too generous** — never converts (e.g., unlimited use)
- **Round numbers only** ($10, $100) — try psychological ($9, $99) for B2C; round for B2B
- **No annual discount** — leaves 15–20% of revenue on the table
- **Charging by feature** instead of by value — confuses buyer

---

## When to re-run

After first 10 paying users, after pivot, after major cost change (infra migration), or annually.
