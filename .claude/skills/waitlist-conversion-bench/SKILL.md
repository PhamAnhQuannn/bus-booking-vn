---
name: waitlist-conversion-bench
description: Measure waitlist→activated→paid conversion vs industry benchmarks — separate vanity-signups from real demand. Outputs to `docs/inception/waitlist-bench-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "waitlist conversion", "are signups real", "/waitlist-conversion-bench", or after `/landing-page-test` or `/betalist-ph-pre-launch`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /waitlist-conversion-bench — Waitlist Reality Check

Invoke as `/waitlist-conversion-bench`. Big waitlist ≠ big launch.

## Why you'd care

Waitlist signups are the easiest vanity metric to inflate; they convert to paid at rates between 1% and 30% depending on quality. Benchmarking the conversion is the only way to know whether the list represents demand or curiosity.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/landing-test-<project>.md` or `betalist-ph-<project>.md`.

## Inputs
- Waitlist size + source breakdown.
- Time on waitlist (avg days).
- Engagement events: opens / clicks / replies / referrals.

## Process
1. **Source split** — organic vs paid vs viral vs maker community.
2. **Per-cohort cleanliness check** — bot/test/duplicate emails.
3. **Engagement scoring** — score 0–3 per signup:
   - 0: no opens
   - 1: opened ≥1 update
   - 2: clicked link
   - 3: replied / referred / asked for early access
4. **Apply benchmarks** (industry-typical):
   - Waitlist → email open: 30–50% (lower = stale list)
   - Waitlist → activation on launch: 5–15% (Superhuman 30%+, most: 8%)
   - Waitlist → paid: 1–5%
5. **Project realistic launch numbers** = waitlist × likely conv.
6. **Decide**: build for projected real users, not raw waitlist count.

## Output
Write `docs/inception/waitlist-bench-<project>.md`:

```markdown
# Waitlist Conversion Bench — <project>
**Date:** <YYYY-MM-DD> | **Waitlist:** N

## Source breakdown
| Source | Signups | Bots removed | Net |
|---|--:|--:|--:|
| Organic landing | 200 | 5 | 195 |
| Paid ads | 300 | 30 | 270 |
| BetaList | 100 | 2 | 98 |
| Referral | 50 | 0 | 50 |

## Engagement scoring
| Score | N | % | Behavior |
|--:|--:|--:|---|
| 0 | 200 | 33% | Never opened |
| 1 | 250 | 42% | Opened ≥1 |
| 2 | 100 | 17% | Clicked |
| 3 | 50 | 8% | Replied/referred |

**Engaged (≥1) = 67% | High-intent (≥2) = 25% | Hot (=3) = 8%**

## Industry benchmark check
| Metric | Yours | Bench | Verdict |
|---|--:|--:|---|
| Open rate | 67% | 30–50% | ABOVE |
| Click rate | 25% | 5–15% | ABOVE |
| Hot lead % | 8% | 5% | ABOVE |

## Realistic launch projection
- Waitlist: 600
- Likely activate (15%): 90
- Likely pay (5%): 30
- Build capacity for: 30 paying, 90 trying

## Verdict
**HIGH-QUALITY-LIST / AVERAGE / VANITY-LIST**

## Next
- HIGH → build for 90 launch users; sequence drip campaign
- AVERAGE → re-engage with sneak peek, prune dead emails
- VANITY → repeat /landing-page-test with sharper hook
```

## Verification
- Bot/dup emails removed before scoring (raw size lies).
- ≥3 engagement levels segmented (binary opened/not = blunt).
- Compared to public benchmarks (not gut feel).
- Realistic projection given to build planning.
