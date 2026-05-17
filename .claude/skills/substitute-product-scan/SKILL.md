---
name: substitute-product-scan
description: Scan non-obvious substitutes — DIY, status quo, adjacent category, "good enough". Porter's threat-of-substitution. Outputs to `docs/inception/substitutes-<project>.md`. Use when user says "substitutes", "Porter substitution", "what else solves this", "do-nothing alternative", "/substitute-product-scan", or after `/competitor-scan`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /substitute-product-scan — The Competitor You Didn't List

Your biggest competitor is usually not on your competitor list. It's spreadsheet + email, or "do nothing".

## Why you'd care

Your real competitor is usually "do nothing" or "a spreadsheet" — not the well-funded startup in your TechCrunch alert. Porter's substitute scan is what surfaces the threat you're actually losing to.

## Pre-flight
None. Run after `/competitor-scan`. Pairs with `/competitive-moat-analysis`.

## Inputs
- Problem statement.
- Existing competitor list (`/competitor-scan` output).
- 5+ customer interview transcripts (ideal).

## Process
1. **Find the workaround** — for each interview, document what the customer ACTUALLY does today (not what they'd do in an ideal world).
2. **Categorize substitutes** across 5 buckets:
   - **Status quo / do-nothing** — pain tolerated
   - **Manual workaround** — paper, spreadsheet, sticky notes
   - **Generic tool repurposed** — email, WhatsApp, Excel, Notion
   - **Adjacent-category product** — built for X but used for Y
   - **In-house solution** — internal team / contractor built it
3. **Per substitute, capture:**
   - Cost (time + money) to customer
   - Switching friction (why they don't switch)
   - Strength signals (where it actually beats commercial software)
4. **Why-not-switch interview question** — explicitly ask 5 prospects "what would have to be true for you to stop using <substitute>?" That answer is your value-prop bar.
5. **Hidden-feature reveal** — substitutes often have features commercial products miss (offline-first, no-login, group sharing). Note them.
6. **Reframe positioning** — competitive position relative to substitutes, not just direct competitors.

## Output
Write `docs/inception/substitutes-<project>.md`:

```markdown
# Substitute Product Scan — <project>
**Date:** <YYYY-MM-DD>

## What customers actually do today
| Customer | Substitute | Bucket | Cost (time/$) |
|----------|------------|--------|---------------|
| Bistro A | Paper reservation book + staff WhatsApp | Manual workaround | 30 min/day, $0 |
| Bistro B | Resy free tier | Adjacent product | 10 min/day, $0 |
| Bistro C | Owner's Notion table | Generic tool | 20 min/day, $5/mo |
| Bistro D | "We just deal with it" | Status quo | Lost revenue ~$2k/mo |
| Bistro E | Custom Google Sheet | In-house | 15 min/day, $0 |

## Bucket strength assessment
| Bucket | Where it wins | Where it loses |
|--------|---------------|----------------|
| Paper + WhatsApp | Always-on, no training, no login, works offline | No-show alerts, history, reporting |
| Resy free tier | Brand trust, customer-facing widget | Limited to Resy's POS preferences |
| Notion / Sheets | Custom, infinite flex | No alerts, manual entry |
| Status quo | Zero cost / zero risk | Direct revenue loss tolerated |
| In-house | Owner-tailored | Maintenance burden, no roadmap |

## "What would make you switch?" answers
| Customer | Answer |
|----------|--------|
| A | "If it worked offline like the book" |
| B | "If it had better POS integration than Resy" |
| C | "If it auto-imported from Google calendar" |
| D | "If owner saw monthly lost-revenue dashboard" |
| E | "If it handled holiday-staff schedule" |

## Hidden features in substitutes (steal these)
- Paper book: offline + zero-friction add (no login)
- WhatsApp: real-time staff alerts + group chat
- Notion: custom views per user
- Spreadsheet: bulk import / export

## Positioning vs substitutes
**Vs paper / status quo:** "Same speed of paper, with no-show alerts you can't get on paper."
**Vs Resy free:** "Like Resy, but integrates with your POS and your menu, not just bookings."
**Vs spreadsheets:** "All the flexibility of your sheet, with the alerts you'd otherwise build."

## Substitution risks
- LLM-as-tool risk: customer pastes problem to ChatGPT, builds 80% solution → erodes value
- Bundled threat: incumbent POS adds reservations as a free feature
- Hardware shift: voice-only intake by phone, no app needed

## Next
- Combine w/ direct competitors → `/competitive-moat-analysis`
- Verify w/ more interviews → `/mom-test-protocol`
- Steal best features → product roadmap → `/mvp-scope`
```

## Verification
- ≥ 5 interview-derived substitutes documented.
- All 5 buckets considered (mark N/A if truly none).
- "What would make you switch?" answers numeric or specific.
- ≥ 3 hidden features identified.
- Positioning lines differ per substitute.
