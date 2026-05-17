---
name: personal-runway-check
description: Personal financial runway — savings, burn, side income, dependents. Months you can survive at zero revenue. Outputs to `docs/inception/personal-runway-<project>.md`. Use when user says "personal runway", "how long can I survive", "savings", "burn", "/personal-runway-check", before `/runway-model`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /personal-runway-check — Personal Survival Math

Founder runway ≠ company runway. Check the human one first.

## Why you'd care

The runway model that matters most isn't the company's — it's yours. Founders who don't honestly tally savings + dependents + side income end up taking term sheets out of panic, not strength.

## Pre-flight
None. Cross-checks with `/time-commitment-audit` if exists.

## Inputs
- Savings (cash + liquid).
- Monthly personal burn.
- Side income / spouse income / freelance.
- Dependents.

## Process
1. **Liquid savings** — bank + brokerage you'd actually touch.
2. **Monthly burn** — rent/mortgage, food, utilities, insurance, debt, kids, recurring subs, healthcare. Be honest about lifestyle.
3. **Income offsets** — spouse income, side gigs, dividend/rental income. Sustainable?
4. **Net monthly burn** — burn − offsets.
5. **Runway months** — savings ÷ net burn.
6. **Stress-test** — what if burn rises 20% (medical, repair, kid)?
7. **Survival floor** — minimum acceptable runway before quitting day job (industry rule: 12–18 mo).
8. **Verdict** — QUIT-NOW / MOONLIGHT / WAIT-AND-SAVE.

## Output
Write `docs/inception/personal-runway-<project>.md`:

```markdown
# Personal Runway — <project>
**Date:** <YYYY-MM-DD>

## Cash position
- Liquid savings: $X
- Emergency reserve to keep: $X
- Deployable: $X

## Monthly burn
| Bucket | $/mo |
|---|---|
| Housing | ... |
| Food | ... |
| Utilities | ... |
| Insurance | ... |
| Healthcare | ... |
| Debt service | ... |
| Family/dependents | ... |
| Subscriptions | ... |
| Misc | ... |
| **Total burn** | $X |

## Income offsets
- Spouse: $X
- Side gigs: $X
- Other: $X

## Net burn
$<burn − offsets>/mo

## Runway
$<deployable> ÷ $<net burn> = <N> months

## Stress-test (+20% burn)
<N> months

## Verdict
QUIT-NOW (runway ≥ 18mo) | MOONLIGHT (runway < 12mo) | WAIT-AND-SAVE (< 6mo)

## Next
- If QUIT-NOW → `/runway-model` (company) + commit
- If MOONLIGHT → `/time-commitment-audit`
- If WAIT-AND-SAVE → set savings target + revisit in 6mo
```

## Verification
- Burn rows sum to total.
- Runway math computed.
- Verdict matches threshold.
