---
name: smoke-test-ad-buy
description: Run paid Meta/Google/Reddit ads to measure CPC + CTR + intent — proves cold-traffic demand. Outputs to `docs/inception/smoke-ad-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "ad smoke test", "paid traffic test", "FB ad demand check", "/smoke-test-ad-buy", or after `/landing-page-test` if organic weak.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /smoke-test-ad-buy — Paid Cold-Traffic Test

Invoke as `/smoke-test-ad-buy`. Cold traffic = real signal. Friends ≠ market.

## Why you'd care

Organic-traffic landing-page tests confound product appeal with SEO luck. Paid ads strip the SEO variable and measure raw cold-traffic intent — the cleanest pre-build demand signal money can buy.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP unless budget allows
2. Read `docs/inception/landing-test-<project>.md` — landing must exist.
3. Read `docs/inception/buyer-persona-<project>.md` — for targeting.

## Inputs
- Budget: $50–$500 (recommend $200 first).
- Platform: Meta / Google / Reddit / X / LinkedIn.
- Targeting (interests / keywords / lookalike).
- Landing URL.

## Process
1. **Pick platform** match persona — B2C visual = Meta, B2B = LinkedIn, intent = Google search, niche = Reddit/X.
2. **Create 3 ad variants** — 1 image + 1 headline + 1 hook variation.
3. **Set spend cap** — daily $X for N days.
4. **Set conversion event** — landing signup or button click.
5. **Run 3–7 days** — collect impressions / CTR / CPC / conv rate / CAC.
6. **Benchmark**:
   - CTR ≥1% = OK, ≥2% = strong
   - CAC ≤ 1/3 LTV target = sustainable
   - Conv rate ≥5% if landing tight
7. **Kill losers** — pause variants <0.5% CTR.

## Output
Write `docs/inception/smoke-ad-<project>.md`:

```markdown
# Smoke Test Ad Buy — <project>
**Date:** <YYYY-MM-DD> to <YYYY-MM-DD> | **Platform:** <X> | **Spend:** $N

## Targeting
- Audience: <description>
- Interests/keywords: <list>
- Geo: <X>

## Variants
| ID | Headline | Image | Hook |
|---|---|---|---|
| A | <text> | <ref> | curiosity |
| B | <text> | <ref> | fear-of-loss |
| C | <text> | <ref> | benefit |

## Results
| ID | Impr | Clicks | CTR | CPC | Signups | Conv % | CAC |
|---|--:|--:|--:|--:|--:|--:|--:|
| A | 5000 | 80 | 1.6% | $0.40 | 4 | 5.0% | $8 |
| B | 5000 | 30 | 0.6% | $1.10 | 1 | 3.3% | $33 |
| C | 5000 | 110 | 2.2% | $0.30 | 9 | 8.2% | $3.70 |

## Winner
- Variant <X>: CTR Y%, CAC $Z
- Compared to LTV target $W → ratio 1:N

## Benchmark hit?
- CTR ≥1%: ✓/✗
- CAC sustainable: ✓/✗

## Verdict
**PAID-DEMAND-PROVEN / EXPENSIVE-BUT-VIABLE / KILL**

## Next
- PROVEN → scale ads + /mvp-scope build OR /pre-sale-test
- EXPENSIVE → revise targeting/hook + retry once
- KILL → /idea-kill-list (NO_DEMAND)
```

## Verification
- ≥$50 spent (less = noise).
- ≥3 variants (1 variant = no learning).
- CAC compared to *target* LTV (not vanity).
- Benchmarks declared PRE-spend.
