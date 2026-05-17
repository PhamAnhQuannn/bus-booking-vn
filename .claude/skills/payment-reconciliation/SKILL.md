---
name: payment-reconciliation
description: Payment-processor ledger vs DB ledger diff. Catches missing webhooks, stale payments, refund/dispute mismatches. Daily/weekly job + on-demand audit. Use when user says "reconcile payments", "ledger match", "payment audit", "processor vs DB", "missing webhooks", "/payment-reconciliation", or after webhook outage / before close-of-month / before financial reporting. Writes docs/ops/reconciliation-YYYYMMDD.md + scripts/reconcile.<ext>.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /payment-reconciliation — payment processor ↔ DB ledger drift detector

## Why you'd care

If users paid and the DB doesn't know, you lose money silently. Reconciliation is the only audit gate between the processor's source-of-truth and your billing logic. Missing one webhook for a refund = customer charged twice in their statement.

## Pre-flight

- **Stack auto-detect:** run `/stack-profile` first if uncertain. The script in §Output Format is TypeScript+Prisma+Stripe; adapt to your stack (`python+sqlalchemy+stripe`, `go+sqlx+adyen`, `ruby+activerecord+braintree`, etc.). The diff classification + auto-fix policy stays identical across stacks.
- **Payment vendor auto-detect:** look in `package.json` / `pyproject.toml` / `Gemfile` / `go.mod` for `stripe`, `@adyen/api-library`, `braintree`, `@paypal/checkout-server-sdk`, `square`, `mollie`. The vendor APIs differ; the reconciliation logic does not.
- **Domain auto-detect:** the DB ledger lives in different tables per vertical — `Payment`/`Booking` (services/marketplace), `Invoice`/`Subscription` (SaaS), `Order`/`Charge` (ecommerce), `Transfer`/`Payout` (fintech). List `app/api/<X>/` or `models/<X>` to find the local taxonomy before writing the script.
- **Restricted API key only.** `charges:read`, `payment_intents:read`, `refunds:read`, `disputes:read`. Never the full secret in a recon script.
- **DB requirements.** Ledger row must have a `<vendor>PaymentId` (or equivalent) unique field. If absent → fix that first via `/data-model-design` + migration; reconciliation cannot work without a join key.
- **Output destination.** `docs/ops/reconciliation-YYYYMMDD.md` + optional Slack/PagerDuty hook.

## Inputs

- Time window (default 24h; close-of-month = full month; post-webhook-outage = since-last-clean-run).
- Vendor API key (restricted scope).
- DB connection.
- Ledger table name + join-key column name (auto-detect or ask).

## Process

1. **Decide window.** Default last 24h. Overlap with prior run to avoid gap.
2. **Fetch processor side.** List `payment_intents`/`charges` + `refunds` + `disputes` in window. Paginate exhaustively.
3. **Fetch DB side.** Query ledger rows in window. Filter by `createdAt`.
4. **Match by processor ID.**
5. **Classify diffs into 4 buckets:**
   - **In processor, not DB** → missed webhook (most common). Action: replay webhook OR manually reconcile.
   - **In DB, not processor** → very rare; possible test data or manual insert. Investigate.
   - **Both present, status mismatch** → DB stale (e.g. processor shows `refunded`, DB shows `succeeded`). Action: replay refund webhook.
   - **Both present, amount mismatch** → bug. **P1** — possible currency/cents error or fraud. Investigate immediately.
6. **Output diff.** Markdown table per class.
7. **Auto-fix only safe corrections.** Status update to match processor = OK after review. **Never auto-create DB rows from processor** — too risky (duplicates if webhook arrives late).
8. **Write report** to `docs/ops/reconciliation-YYYYMMDD.md`.
9. **Auto-chain.** Recurring drift → `/incident-runbook` for webhook section + `/postmortem` if P1.

## Output Format — `scripts/reconcile.ts` (Stripe + Prisma worked example)

```typescript
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { format } from "date-fns";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const prisma = new PrismaClient();

interface Diff {
  paymentIntentId: string;
  type: "missing-in-db" | "missing-in-processor" | "status-mismatch" | "amount-mismatch";
  processor?: { amount: number; status: string; created: Date };
  db?: { amount: number; status: string; createdAt: Date };
}

// LEDGER_TABLE + JOIN_KEY are domain-specific. Detect from schema.
// SaaS:        prisma.invoice         / stripeInvoiceId
// Marketplace: prisma.payment         / stripePaymentIntentId
// Ecommerce:   prisma.order           / stripeChargeId
// Fintech:     prisma.transfer        / stripeTransferId
const LEDGER = prisma.payment;
const JOIN_KEY = "stripePaymentIntentId";

async function reconcile(windowHours = 24) {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  const processorMap = new Map<string, Stripe.PaymentIntent>();
  for await (const pi of stripe.paymentIntents.list({
    created: { gte: sinceUnix },
    limit: 100,
  })) {
    processorMap.set(pi.id, pi);
  }

  const dbRows = await LEDGER.findMany({ where: { createdAt: { gte: since } } });
  const dbMap = new Map(dbRows.map((r: any) => [r[JOIN_KEY], r]));

  const diffs: Diff[] = [];

  for (const [id, pi] of processorMap) {
    if (!dbMap.has(id)) {
      diffs.push({
        paymentIntentId: id,
        type: "missing-in-db",
        processor: { amount: pi.amount, status: pi.status, created: new Date(pi.created * 1000) },
      });
    }
  }

  for (const [id, r] of dbMap) {
    if (!processorMap.has(id)) {
      diffs.push({
        paymentIntentId: id,
        type: "missing-in-processor",
        db: { amount: r.amountCents, status: r.status, createdAt: r.createdAt },
      });
    }
  }

  for (const [id, pi] of processorMap) {
    const r = dbMap.get(id);
    if (!r) continue;
    if (statusFromProcessor(pi.status) !== r.status) {
      diffs.push({
        paymentIntentId: id,
        type: "status-mismatch",
        processor: { amount: pi.amount, status: pi.status, created: new Date(pi.created * 1000) },
        db: { amount: r.amountCents, status: r.status, createdAt: r.createdAt },
      });
    }
    if (pi.amount !== r.amountCents) {
      diffs.push({
        paymentIntentId: id,
        type: "amount-mismatch",
        processor: { amount: pi.amount, status: pi.status, created: new Date(pi.created * 1000) },
        db: { amount: r.amountCents, status: r.status, createdAt: r.createdAt },
      });
    }
  }

  return { diffs, processorCount: processorMap.size, dbCount: dbMap.size };
}

function statusFromProcessor(s: Stripe.PaymentIntent.Status): string {
  switch (s) {
    case "succeeded": return "succeeded";
    case "canceled": return "canceled";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "processing":
      return "pending";
    default: return "unknown";
  }
}

reconcile(24)
  .then((r) => {
    const date = format(new Date(), "yyyyMMdd");
    writeFileSync(`docs/ops/reconciliation-${date}.md`, renderMarkdown(r));
  })
  .finally(() => prisma.$disconnect());

function renderMarkdown(r: Awaited<ReturnType<typeof reconcile>>): string {
  // See §Output Format — docs/ops/reconciliation-YYYYMMDD.md
  return "";
}
```

### Stack-adaptation notes

- **Python+SQLAlchemy:** swap `prisma.payment.findMany` for `session.query(Payment).filter(Payment.created_at >= since)`. Stripe SDK is identical (`stripe.PaymentIntent.list`).
- **Go+sqlx:** raw SQL `SELECT * FROM payments WHERE created_at >= $1`. Stripe Go SDK pattern `stripe.PaymentIntents.List(...)`.
- **Adyen/Braintree/PayPal:** the loop shape is identical; only the SDK call + status enum mapping changes. `statusFromProcessor()` is the one function that must be re-keyed per vendor.

## Output Format — `docs/ops/reconciliation-YYYYMMDD.md`

```markdown
---
date: 2026-05-09
window: last 24h
processor-count: 142
db-count: 141
diff-count: 3
status: clean | drift-detected | resolved
---

# Payment Reconciliation — 2026-05-09

## Summary

- **Processor (Stripe) charges (window):** 142
- **DB ledger rows (window):** 141
- **Diffs:** 3 (1 missing-in-db, 2 status-mismatch, 0 amount-mismatch)

## Missing in DB (1)

Processor charged customer, but no DB row. Indicates **missed webhook**.

| Processor ID | Amount | Status | Created | Action |
|--------------|--------|--------|---------|--------|
| pi_3ABC123 | $42.00 | succeeded | 2026-05-09 14:22 | Replay via processor CLI |

**Root cause hypothesis:** webhook endpoint 503 at 14:22 — check `/api/<vendor>/webhook` logs.

## Missing in Processor (0)

None.

## Status Mismatch (2)

DB stale relative to processor.

| Processor ID | Processor | DB | Action |
|--------------|-----------|----|--------|
| pi_3DEF456 | refunded | succeeded | Manual refund in dashboard. Replay refund webhook. |
| pi_3GHI789 | canceled | pending | Webhook delivery failing. Replay. |

## Amount Mismatch (0)

None. **P1 if any.**

## Remediations

1. Replay webhooks for the 3 IDs above.
2. Re-run reconcile in 1h, expect 0 diffs.
3. Still drifting → escalate via `/incident-runbook` webhook section.

## Trend

| Date | Diffs | Notes |
|------|-------|-------|
| 2026-05-08 | 0 | clean |
| 2026-05-09 | 3 | webhook 503 spike at 14:22 |
```

## Boundaries

- **Processor is source of truth for money.** Never overwrite processor state from DB. Only fix DB.
- **Never auto-create DB rows from processor.** Reconcile flags; human reviews.
- **Auto-fix only safe corrections.** Status update to match processor = OK after review. Creating new ledger row = NOT OK.
- **Amount mismatch = always P1.** Currency/cents error or fraud.
- **Idempotency relies on the join key being unique.** If schema lacks unique index on `<vendor>PaymentId`, fix that first.
- **Window must overlap with prior run.** 24h reconcile ran daily = 24h window. Gap → widen to catch.

## Re-run Behavior

- New dated file each run — `reconciliation-YYYYMMDD.md`. Never overwrite history.
- Diffs > 0 → surface remediation list at top.
- Track trend across last 7 days at end of file.

## Auto-chain

- Drift detected → `/log-search` or equivalent for webhook errors in window
- Recurring missed webhooks → `/incident-runbook` webhook section + retry-policy review
- Amount mismatch → `/incident-runbook` P1 + `/post-mortem`
- Processor API errors during reconcile → `/risk-register` (reconcile is now itself unreliable)
- Schema gap (no unique join key) → `/data-model-design` + `/migration-safety`

## Verification

After running:

1. `docs/ops/reconciliation-YYYYMMDD.md` exists with diff-count.
2. Frontmatter `status: clean` ⇔ diff-count = 0.
3. If diff-count > 0, every diff has an action line.
4. Re-run in 1h after remediation → diff-count drops to 0.

## Example Trigger

User: "run reconcile, accountant says March numbers don't match the processor"
→ Run `scripts/reconcile.ts` (or adapted equivalent) for March window, write `docs/ops/reconciliation-202603.md`, classify diffs, list remediation per class, flag root cause.
