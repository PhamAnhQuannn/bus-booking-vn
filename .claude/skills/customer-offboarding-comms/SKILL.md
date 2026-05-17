---
name: customer-offboarding-comms
description: Graceful customer offboarding emails + flow so cancelling customers stay friendly (and sometimes come back). Outputs to `docs/cs/offboarding-comms.md` + email templates. Reads `/project-classify` to skip XS/S. Use when user says "offboarding", "cancellation flow", "winback", "exit survey", "/customer-offboarding-comms", or after first 100 cancellations.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 4h
---

# /customer-offboarding-comms — Graceful Goodbye

## Why you'd care

The dark-pattern cancellation flow that hides the unsubscribe button behind three "are you sure?" screens earns one extra month of MRR and a viral Twitter thread that costs you a quarter of pipeline — plus a chargeback rate that makes Stripe risk start asking questions. Fast, dignified offboarding with a data export, an exit survey, and a re-open hook is what converts cancelled customers into either winbacks 6 months later or quiet neutral references, instead of public detractors hunting for the comparison-page screenshot.

Invoke as `/customer-offboarding-comms`. Cancelling customer is not a failure; ungraceful cancellation is. Quick, dignified offboarding with data export, exit survey, and re-open hook turns lost revenue into future revenue.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Cancellation flow exists in product OR support handles manually.
3. Email provider wired (Resend / Postmark / SES).

## Inputs
- Cancellation reason categories (price / fit / bug / job-change / competitor / paused)
- Data export availability (see `/data-export`)
- Win-back budget (discount / pause option / downgrade path)
- Comms tone (formal SaaS vs scrappy startup; pick + stay consistent)

## Process

1. **Pre-cancellation moments** — catch before they hit "cancel":

   | Trigger | Intervention |
   |---|---|
   | Login but no key action for 14d | "Need help getting back in?" email |
   | Health score drops to red | CSM outreach |
   | Visits billing/cancel page twice | in-app: "let's talk first" |
   | Failed payment attempt | grace period + recover-flow |

2. **In-product cancellation flow** — frictionful but fair:
   - Step 1: "Why are you leaving?" (multi-select: price / not using / missing feature / found alternative / job change / other)
   - Step 2: tailored offer based on reason:
     - Not using → pause subscription 1-3 months
     - Price → 30% discount for 3 months
     - Missing feature → roadmap link + email when shipped
     - Bug → support escalation
     - Other / job change → straight to confirm
   - Step 3: confirm with clear timeline ("access until <date>")
   - Step 4: data export prompt + email

3. **Exit survey** — small + actionable:
   - 1-2 multiple choice + 1 free text
   - Tied to reason category
   - "If we addressed <X>, would you come back?" yes/no
   - Verbatims aggregated weekly; themes tagged

4. **Email sequence** — fixed cadence:

   | Day | Email |
   |---|---|
   | 0 | "Cancellation confirmed. Access until <date>. Data export: <link>." |
   | 1 | Receipt + final-invoice info; how to re-open |
   | <last day> | "Your access ends today. Last chance to export." |
   | +14 | Soft win-back: "Anything we can do better? <coupon if appropriate>" |
   | +60 | Newsletter opt-in + product update (only if checkbox unchecked at cancel) |
   | +180 | "Things we've shipped since you left" + targeted offer |

   Stop the cadence on unsubscribe. Always.

5. **Data export + deletion**:
   - Auto-prompt export on cancellation confirmation
   - Format: JSON + CSV bundle, delivered via signed URL (7d TTL)
   - Default retention post-cancel: 30d for re-open, then automated delete
   - GDPR right-to-erasure: honor within SLA (typically 30d)
   - Confirmation email when data is deleted

6. **Re-open / win-back path**:
   - Single-click re-open within retention window (no re-signup pain)
   - Data restored; settings preserved
   - Track win-back rate by exit reason
   - 5-10% win-back on price-reason; <1% on wrong-fit; tune offers accordingly

7. **Comms tone** — neutral, brief, dignified:
   - Subject lines: "Your cancellation is confirmed" (NOT "We're sad to see you go!")
   - Body: thank, confirm, give next steps, offer help
   - Avoid: guilt-trip, surveys at every step, capture-recapture loops
   - Sender: founder name for small co; product team for larger

8. **Internal handoff**:
   - Cancellation triggers Slack post in #cs-departures
   - Tag account in CRM (closed-lost + reason)
   - Quarterly: review exit reasons, top 3 themes → roadmap input
   - High-ARR cancellations → CS exec personally calls within 48h

9. **Anti-patterns**:
   - Dark patterns to prevent cancel (hidden buttons, mandatory call) — viral PR risk
   - "Sorry to see you go" + 5 surveys + cross-sells — bad taste
   - Continued marketing emails after cancel — they unsubscribe + tell others
   - No data export — legal + ethical issue
   - Auto-deletion in <14d — users lose receipts/exports they needed
   - Win-back blast to everyone — feels desperate; segment

## Output

Write `docs/cs/offboarding-comms.md`:

```markdown
# Customer Offboarding Comms
**Date:** <YYYY-MM-DD> | **Owner:** <CS/marketing>

## Pre-cancel signals
| Signal | Intervention |
|---|---|
| 14d inactive | re-engage email |
| Red health | CSM call |
| Billing-page visits | in-app pause/contact prompt |

## Cancel flow
1. Why are you leaving (multi-select)
2. Tailored offer per reason
3. Confirm with date
4. Data export prompt

## Exit survey
- 1-2 MCQs + free text
- "Would you come back if X?" yes/no
- Themed weekly

## Email cadence
| Day | Email |
|---|---|
| 0 | Confirm + data export link |
| Last day | "Access ends today" + export |
| +14 | Soft win-back |
| +60 | "What we've shipped" (opt-in) |
| +180 | Anniversary + offer |

## Data
- Export: JSON + CSV signed URL 7d TTL
- Retain post-cancel: 30d
- GDPR delete within 30d

## Re-open
- Single click within retention window
- Track win-back rate by reason

## Tone
- Neutral, brief, dignified
- Subjects: matter-of-fact, no guilt

## Internal
- Slack #cs-departures
- CRM tag closed-lost + reason
- Quarterly exit-reason review
- High-ARR: CS exec call <48h
```

Also write email templates: `lib/email/templates/cancel-*.tsx`.

## Verification
- Cancel reason captured + categorized.
- Tailored offer per reason (not one-size).
- Data export auto-prompted; honored within SLA.
- Win-back emails opt-in only; stop on unsubscribe.
- Dark patterns absent (audit the flow).
- Quarterly review feeds roadmap.
