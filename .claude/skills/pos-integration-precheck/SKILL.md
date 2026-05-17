---
name: pos-integration-precheck
description: Vertical-specific (restaurant / retail / hospitality). POS-integration decision tree for restaurants, retail, cafés, hotels. Square / Toast / Clover / Lightspeed / Shopify POS / Stripe Terminal. Decide sync direction, parallel-ledger reconciliation, defer-vs-now, escape hatch. Outputs `docs/inception/pos-integration-<project>.md`. Use when product has both an online channel and an in-store register (or might soon). Triggers on "POS", "Square", "Toast", "Clover", "Lightspeed", "Stripe Terminal", "register sync", "/pos-integration-precheck". XS skip; S+ fires when in-store POS exists or is being considered within 12mo.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 6h
  XL: 10h
---

# /pos-integration-precheck — POS Integration Pre-decision

Invoke as `/pos-integration-precheck`. Use early — POS choice locks in webhook reliability, reconciliation strategy, inventory truth, and refund flow. Wrong call at year-1 means rewriting payments at year-2.

## Why you'd care

Restaurants and retail run on the POS, not on your shiny new app. Skip this and you'll watch your launch get blocked by reconciliation drift the first time a manual ring-up doesn't match your ledger.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no POS at XS).
2. Read `docs/inception/build-vs-buy-<project>.md` (POS is a build-vs-buy decision).
3. Read `docs/design/payment-reconciliation-<project>.md` if exists.

## Inputs
- Does the business have a POS today? (Yes / No / Considering.)
- Current/intended POS vendor.
- Online channel exists? (Web order, app order, marketplace.)
- Per-order revenue mix (online vs in-store today + 12mo projection).
- Inventory: shared SKUs across channels? Real-time stock concern?
- Refund flow source-of-truth (web app vs POS).

## Process
1. **First decision — defer or not**:
   - **No POS today + no plans within 12mo** → DEFER. Don't build integration. Design schema so future POS can sync later. Note in roadmap.
   - **POS exists but online channel is <10% revenue** → DEFER unless inventory is shared SKUs and stockouts hurt.
   - **Online channel ≥10% revenue + shared SKUs + stockouts hurting** → BUILD.
   - **POS picked as part of this project** (greenfield) → pick POS + integration together; see step 4.
2. **Direction of truth**:
   - **POS is truth, web syncs from POS**: most common for restaurant/retail. Menu/inventory edits in POS; webapp reflects. Refund initiated in POS or web both create POS-side record.
   - **Web is truth, POS syncs from web**: rare; only when web is primary order source and POS is essentially a card-reader.
   - **Bidirectional**: avoid. Two sources of truth = drift. If forced (legacy POS + new web), make web the system-of-record for online orders, POS the record for in-store, with a parallel-ledger reconciliation joining them.
3. **Vendor capability scan** (current as of 2026):
   - **Square**: solid API, free-tier reasonable, webhooks reliable, OAuth. Good for cafés/small retail. Inventory API workable. Catalogs API has gotchas with modifiers.
   - **Toast** (restaurants): expensive partner program, longer onboarding, but full restaurant ops. Webhooks via partner API. Required for many full-service restaurants.
   - **Clover**: variable depending on merchant's bank; APIs differ across rails. Verify before committing.
   - **Lightspeed Restaurant/Retail**: solid in EU; Restaurant K-series API and Retail X-series API differ. Pick the right product line.
   - **Shopify POS**: ties to Shopify ecommerce; if business is already Shopify, this is the cheapest path.
   - **Stripe Terminal**: not a full POS — it's a card-reader controlled by your app. Right when *you* are the POS (your app is the register UI).
   - **Aloha / Micros / NCR** (legacy enterprise): assume no clean API; file-export integration.
4. **If picking POS as part of project**: weight by (a) vendor API quality (b) BAA/PCI posture if needed (c) hardware lock-in (d) per-tx fees (e) escape cost.
5. **Webhook reliability requirements**:
   - Signature verification (HMAC-SHA256 typical).
   - Idempotency-key on receive (POS may double-send).
   - Sequence/version numbers so out-of-order receives are detectable.
   - Retry policy with exponential backoff.
   - Parallel-ledger reconciliation hourly (not just real-time; catches missed webhooks).
6. **Refund flow source-of-truth**: pick ONE side; the other reflects.
   - Online order → refund initiated in web app → call POS API to mirror.
   - In-store → refund in POS → POS webhook → web app marks order refunded.
   - Never refund on both sides independently (double-refund risk).
7. **Inventory model**:
   - Shared SKU table (POS is master): web reads availability from cached POS snapshot updated on POS webhook + hourly reconcile.
   - Track delta to know when web ordered a now-sold-out item (race between order and POS sale). Pattern: oversell-then-apologize (web order created, POS sale catches up, customer apology + refund) or hold-and-verify (web order pending, async verify with POS, then confirm).
8. **Reconciliation** — parallel ledger:
   - `OrderLedger` table: rows from web (`source='web'`) + rows from POS (`source='pos'`).
   - Reconciliation cron joins on `external_id` + amount + timestamp window.
   - `drift_count` metric: rows with no match within 24h.
   - Alert: drift_count > 0 (any drift is a leak).
9. **Escape hatch**: abstract POS calls behind `lib/pos/<vendor>.ts` interface; one adapter per vendor; swappable. Avoid scattered raw API calls.
10. **Defer-OK criteria** (when to revisit a defer):
   - In-store + online both >25% of revenue.
   - Shared SKU stockouts > 1/wk.
   - Reconciliation by hand >2h/wk for owner.

## Output
Write `docs/inception/pos-integration-<project>.md`:

```markdown
# POS integration pre-check — <project>
**Date:** <YYYY-MM-DD>

## Current state
- POS today: <None / Square / Toast / Clover / Lightspeed / other>
- Online channel: <% of revenue today / projected 12mo>
- Shared SKUs: <Y/N>
- Inventory pain: <stockouts / no / unknown>

## Decision
- [ ] **DEFER to year-2** (no POS + no urgent need)
- [ ] **DEFER conditional** (revisit at <trigger>)
- [ ] **BUILD now** — direction: <POS-is-truth / web-is-truth / bidirectional-parallel-ledger>
- [ ] **PICK POS + BUILD** — candidates: <list>

## Rationale
- Online revenue mix: X%
- Shared SKU: Y/N
- Operator capacity: <can the owner manage two systems?>
- Cost of being wrong: <missed orders / customer dispute / inventory>

## Vendor pick (if BUILD)
- **Vendor:** <Square>
- **API quality (1–5):** 4
- **BAA/PCI posture:** SAQ-A acceptable
- **Hardware lock-in:** medium (Square hardware)
- **Per-tx fee:** 2.6% + 10¢ in-person
- **Escape cost:** 30h to swap (with adapter layer ~10h)

## Direction of truth
- **POS is truth** for: menu, inventory, in-store orders, in-store refunds.
- **Web is truth** for: web orders (until synced), customer profiles, reservations.
- **Both sources reconciled** via `OrderLedger`.

## Webhook contract
- Endpoint: `POST /api/webhooks/pos/<vendor>`.
- Signature: HMAC-SHA256 via `X-Square-Signature` (or vendor equivalent).
- Idempotency: store `event_id` → response 24h; replays return cached.
- Sequence: read vendor's `version` or `sequence_number`; reject out-of-order older-than-current.
- Retry: vendor's built-in (Square = 3 retries 0/30/300s).

## Refund flow
- Online order → web app `Refund` button → POST to POS API → POS confirms → web marks refunded.
- In-store → POS refund → POS webhook → web marks refunded.
- Concurrency guard: refunds idempotent via `refund_external_id`.

## Inventory model
- Master: POS.
- Cache: `inventory_snapshot` table updated on POS webhook + hourly cron.
- Web checkout reads from cache.
- Conflict on race (web ordered now-sold-out): pattern = oversell-then-apologize (refund + comp).

## Parallel-ledger reconciliation
- `order_ledger` table: rows from web + rows from POS (source column).
- Cron hourly: join by `(external_id, amount, ±60s window)`.
- Metric `drift_count` = unjoined rows >24h old.
- Alert: drift_count > 0 → page owner + investigate.

## Escape hatch
- Adapter at `lib/pos/<vendor>.ts` exposes `getMenu`, `updateInventory`, `recordSale`, `processRefund`.
- Swap to other vendor = implement same interface; ~10h.

## Defer revisit triggers (if DEFER chosen)
- In-store + online both >25% rev → revisit.
- Stockouts >1/wk → revisit.
- Owner manual reconcile >2h/wk → revisit.

## Test plan
- Webhook signature verification unit test.
- Idempotency replay test (send same event 3× → 1 row).
- Out-of-order test (v3, v1, v2 → final state matches v3).
- Refund double-fire test (initiate from web + POS simultaneously → exactly one refund).
- Drift detection test (drop a POS webhook → reconcile catches within 1h).
- Vendor outage test (POS API 5xx for 10 min → web queues + retries; no data loss).

## Risk if skip
- Inventory drift → oversell → refund pile-up → reputation hit.
- Double-refund → financial loss + dispute.
- Manual reconciliation eating owner time.
- Year-2 retrofit costs 3× building in year-1.
```

## Verification
- Defer vs build decision stated with rationale.
- If build: direction-of-truth picked (single, not "depends").
- Vendor scored on capability matrix.
- Webhook contract specifies signature + idempotency + sequence + retry.
- Refund flow has single source-of-truth.
- Inventory race pattern chosen.
- Reconciliation cron + drift_count metric defined.
- Adapter escape hatch designed.
- Defer-revisit triggers written (if defer chosen).
