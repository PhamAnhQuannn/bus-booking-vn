---
name: webhook-design-pattern
description: Outbound webhook system design — HMAC-SHA256 signing (or Stripe-style detached signature), replay defense (timestamp window + nonce store), exponential-backoff retry with dead-letter queue, receiver-side idempotency, event versioning, and customer-facing endpoint management. Also covers inbound receiver hygiene (verify-before-parse, 2xx-within-5s, async-ack). Use when user says "webhook", "outbound webhook", "webhook signing", "HMAC signature", "webhook retry", "webhook replay", "Stripe-style signature", "X-Hub-Signature-256", "event delivery", "/webhook-design-pattern", or before exposing any event-notification surface to integrators. Writes docs/design/webhook-design-pattern-<project>.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /webhook-design-pattern — outbound event delivery + receiver hygiene

## Why you'd care

Webhooks are the public-facing edge of your event system. They run on customers' servers, on their network, with their secrets — so every property you skip becomes their incident, then yours. The five failure modes that bite every team that ships webhooks naively:

1. **Unsigned payloads** → attacker replays a webhook from a packet capture and triggers refunds.
2. **No timestamp window** → leaked old signature stays valid forever; nonce-less means infinite replay.
3. **No retry policy** → customer endpoint returns one 503 and the event vanishes silently.
4. **No receiver idempotency contract** → your retry causes their double-charge.
5. **Synchronous handlers** → customer's slow DB makes your delivery worker queue back up across all tenants.

This skill encodes the Stripe/GitHub/Twilio convergent pattern and forces a written contract so customers' integration engineers can build against it without a support ticket.

## Pre-flight

- **Stack auto-detect:** run `/stack-profile` first if uncertain. The worked example below is TypeScript + Express + Redis; a Python + FastAPI adaptation note follows. The signing algorithm, replay window, and retry policy are stack-invariant.
- **Domain auto-detect:** the event taxonomy differs by vertical. Payments → `charge.succeeded`, `refund.created`, `dispute.opened`. Marketplace → `booking.confirmed`, `booking.cancelled`. SaaS → `subscription.updated`, `invoice.paid`. Look in `app/api/<X>/` or `models/<X>` to seed the event list before writing the doc.
- **Vendor inspiration anchor.** Pick ONE reference: Stripe (detached `t=,v1=` header), GitHub (`X-Hub-Signature-256` raw HMAC), Twilio (HMAC over URL + sorted params). Mixing styles confuses integrators. Default to Stripe if greenfield.
- **Secret-storage backend.** Each customer endpoint gets a unique signing secret. Where do you store it? — env var = no (multi-tenant), DB column = yes if encrypted-at-rest with a KMS-wrapped column key. Document this before writing the doc.
- **Delivery worker substrate.** Outbound webhooks must not run on the request thread. Confirm a queue exists (BullMQ / Sidekiq / Celery / SQS / Cloud Tasks). If absent → flag as a P1 blocker; this skill assumes one.
- **Output destination.** `docs/design/webhook-design-pattern-<project>.md`.

## Inputs

- Project name (slug) — used in output filename.
- Event taxonomy (list of `<resource>.<verb>` strings). Auto-extract from existing models or accept user list.
- Reference vendor for signature style (Stripe / GitHub / Twilio / custom).
- Replay-window length (default 5 minutes).
- Max retry duration (default 24h, ~24 attempts on 2^n backoff capped at 6h).
- Whether ordering must be strict (rare) or best-effort + `event_id` + monotonic `event_ts` (default).

## Process

1. **Enumerate events.** Walk the domain model. For each mutation, decide if external systems care. Name as `<resource>.<verb>` (past tense for state changes — `booking.confirmed`, not `confirm.booking`). Version-tag the schema at v1 from day one. Concrete artifact: events table in §Output Format with name + payload schema + when-fired.
2. **Design the envelope.** Every event ships in a common envelope: `id` (UUIDv7 — sortable), `type`, `created` (Unix seconds), `api_version`, `livemode` (true/false — sandbox marker, see `/sandbox-env-design`), `data.object` (resource snapshot), `data.previous_attributes` (for `.updated` events). Document the envelope once; resources slot in.
3. **Pick signing scheme + write the verifier.** Default Stripe-style detached signature: `Webhook-Signature: t=<unix-ts>,v1=<hex-hmac-sha256>` where the HMAC input is `<ts>.<raw-body>`. Document the exact string assembly — receivers WILL get it wrong if you don't. Provide the verifier in two languages (TS + Python) so integrators copy-paste, not invent.
4. **Specify replay defense.** Two layers: (a) timestamp window — reject if `|now - t| > 300s`; (b) optional nonce — store `event_id` in Redis with TTL = 2 × window. Both are required for high-trust events (payments, auth). Document Redis schema: `webhook:nonce:<endpoint_id>:<event_id> = 1` with `EX 600`.
5. **Specify retry policy + dead-letter.** Exponential backoff with jitter: delay = `min(2^attempt * 1000ms + random(0, 1000), 6h)`. Cap at ~24 attempts (~24h total). Persist each attempt to `webhook_delivery_attempt` table. After exhaustion → `webhook_dead_letter` table + alert customer via dashboard + email. Document the table schemas.
6. **Specify receiver-side idempotency contract.** Receivers MUST treat the same `event.id` as the same event. If your retry arrives after their successful processing, they return 200 + skip side effects. Recommend they store processed event IDs for `2 × replay_window`. This is a contract, not enforcement — but writing it down halves integration-support load.
7. **Order vs best-effort.** Default best-effort: receivers reorder using `event_ts` monotonic clock + `event_id` UUIDv7 (lexicographic = temporal). Strict ordering = serial delivery worker per endpoint = scaling cliff at ~100 events/sec per customer. Pick best-effort unless legal mandates otherwise.
8. **Endpoint-management UI requirements.** Customers need to: (a) register URL + select event types subscribed; (b) rotate signing secret (dual-secret window for 24h so old + new both verify); (c) view delivery log per event (status code + response body + attempt count); (d) manually replay a failed delivery; (e) disable temporarily. Write this as a feature checklist for `/ui-wireframe`.
9. **Inbound receiver hygiene (when YOU are the receiver of someone else's webhooks).** Verify signature BEFORE parsing JSON (parse-then-verify allows JSON bombs). Use raw-body middleware. Return 2xx within 5s — push real work to a queue and 200 immediately. Reject non-POST. Log every signature failure (possible attack). Document this as a section in the output so receiver code follows the same playbook your service publishes.
10. **Write the doc.** Output to `docs/design/webhook-design-pattern-<project>.md`. Cross-link to `/idempotency-key-design`, `/retry-backoff-policy`, `/audit-log-design`, `/payment-reconciliation`.

## Output Format — `docs/design/webhook-design-pattern-<project>.md`

```markdown
---
project: <project>
date: 2026-05-14
reference-vendor: stripe
replay-window-seconds: 300
max-retry-hours: 24
signing-algo: hmac-sha256
envelope-version: 1
status: draft | approved | in-implementation | shipped
---

# Webhook Design — <project>

## 1. Event Taxonomy

| Event Type | When Fired | Payload Resource | Notes |
|------------|------------|------------------|-------|
| `booking.confirmed` | Booking transitions `pending → confirmed` | `Booking` | Includes `previous_attributes.status` |
| `booking.cancelled` | Booking transitions to `cancelled` | `Booking` | `reason` field required |
| `payment.succeeded` | Charge captured | `Payment` | High-trust — replay defense mandatory |
| `payment.refunded` | Refund created | `Payment` + `Refund` | Receiver MUST be idempotent |

## 2. Envelope

```json
{
  "id": "evt_01HZX7K8...",
  "type": "booking.confirmed",
  "created": 1747200000,
  "api_version": "2026-05-01",
  "livemode": true,
  "data": {
    "object": { "...resource snapshot..." },
    "previous_attributes": { "status": "pending" }
  }
}
```

- `id`: UUIDv7, prefixed `evt_`. Sortable by time. Receivers use this as the idempotency key.
- `created`: Unix seconds. Receivers compare to wall-clock for replay defense.
- `livemode`: `false` for sandbox traffic — see `/sandbox-env-design`.

## 3. Signing

Header: `Webhook-Signature: t=<unix-ts>,v1=<hex-hmac-sha256>`

Signed payload string: `<t>.<raw-request-body>` (period-separated, NO whitespace, raw bytes of body).

Algorithm: HMAC-SHA256 (RFC 2104). Secret is per-endpoint, 32 random bytes, hex-encoded for transport at registration.

### Verifier (TypeScript + Express)

```typescript
import crypto from "node:crypto";
import express from "express";

const REPLAY_WINDOW_SEC = 300;

// Mount raw-body parser BEFORE json — must verify against raw bytes.
app.post(
  "/webhooks/<project>",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const header = req.header("Webhook-Signature");
    if (!header) return res.status(400).send("missing signature");

    const parts = Object.fromEntries(
      header.split(",").map((kv) => kv.split("=") as [string, string])
    );
    const ts = parseInt(parts.t, 10);
    const sig = parts.v1;
    if (!ts || !sig) return res.status(400).send("malformed signature");

    // Replay defense — timestamp window.
    if (Math.abs(Date.now() / 1000 - ts) > REPLAY_WINDOW_SEC) {
      return res.status(400).send("timestamp out of window");
    }

    const signed = `${ts}.${req.body.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET!)
      .update(signed)
      .digest("hex");

    // Constant-time compare — DO NOT use `===`.
    const ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return res.status(400).send("bad signature");

    const event = JSON.parse(req.body.toString("utf8"));

    // Replay defense — nonce (optional but recommended).
    const seen = await redis.set(
      `wh:nonce:${event.id}`,
      "1",
      "EX",
      REPLAY_WINDOW_SEC * 2,
      "NX"
    );
    if (seen === null) return res.status(200).send("duplicate, skipped");

    // 2xx within 5s — push work to queue, ack now.
    await queue.add("process-webhook", event);
    res.status(200).send("ok");
  }
);
```

### Verifier (Python + FastAPI — adaptation note)

```python
import hmac, hashlib, time
from fastapi import FastAPI, Request, HTTPException

REPLAY_WINDOW_SEC = 300

@app.post("/webhooks/<project>")
async def receive(req: Request):
    raw = await req.body()
    header = req.headers.get("Webhook-Signature", "")
    parts = dict(p.split("=", 1) for p in header.split(","))
    ts, sig = int(parts.get("t", 0)), parts.get("v1", "")
    if abs(time.time() - ts) > REPLAY_WINDOW_SEC:
        raise HTTPException(400, "timestamp out of window")
    signed = f"{ts}.{raw.decode()}".encode()
    expected = hmac.new(SECRET, signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(400, "bad signature")
    # ...nonce check + enqueue + return 200 (same as TS)
```

Key differences: `hmac.compare_digest` replaces `crypto.timingSafeEqual`; raw body comes from `await req.body()` (not `request.json()` — that would lose bytes); FastAPI middleware ordering does not require an explicit raw-body parser.

## 4. Retry Policy

- Backoff: `delay_ms = min(2^attempt * 1000 + jitter(0..1000), 21_600_000)` (cap 6h).
- Max attempts: 24 (~24h total wall-clock).
- Each attempt logged to `webhook_delivery_attempt(id, event_id, endpoint_id, attempt, status_code, response_body_truncated, started_at, duration_ms, error)`.
- After exhaustion → row written to `webhook_dead_letter(event_id, endpoint_id, last_status, exhausted_at)` + email customer at `notification_email` + flag in dashboard.
- Customer dashboard "Replay" action moves event from dead-letter back to queue with `attempt = 0`.

See `/retry-backoff-policy` for the shared retry primitive (this skill consumes it).

## 5. Replay Defense

| Layer | Mechanism | Required For |
|-------|-----------|--------------|
| Timestamp window | Reject if `|now − t| > 300s` | All events |
| Nonce store | Redis `wh:nonce:<event_id>` with TTL = 600s | Payments, auth, admin |
| Secret rotation | Dual-secret window 24h on rotate | All endpoints |

## 6. Endpoint Management (Customer-Facing UI)

- Register webhook URL + select subscribed event types.
- Generate + display signing secret ONCE at creation (then hashed at rest, only prefix shown).
- Rotate secret: old secret valid for 24h post-rotate so customer can update without downtime.
- Delivery log: per event, show status code + response body (truncated 4KB) + attempt count + next-retry-at.
- Manual replay button on any failed delivery.
- Pause endpoint (events still recorded, not delivered).

Hand off to `/ui-wireframe` for the actual screens.

## 7. Inbound Receiver Hygiene (When You Receive Others' Webhooks)

- **Verify before parse.** Raw-body middleware. Parse only after HMAC check.
- **Constant-time compare.** Never `===` on signatures.
- **2xx within 5s.** Push real work to a queue; ack immediately.
- **Idempotent handler.** Same `event.id` = same event. Store processed IDs for 2 × replay window.
- **Reject non-POST.** No GET / HEAD on webhook endpoints.
- **Log signature failures.** Possible attack. Alert on rate > 5/min from one source IP.

## 8. Open Questions

- [ ] Subscribed-events filtering: per-endpoint or all-events-then-receiver-filter? (Default: per-endpoint.)
- [ ] Strict ordering: needed for any event type? (Default: no — receivers use `event_id` UUIDv7 + `created` for reorder.)
- [ ] Sandbox traffic: same endpoint with `livemode: false`, or separate endpoint? (Default: same — receivers branch on `livemode`.)
```

### Stack-adaptation notes

- **Python + FastAPI:** see verifier snippet above. Use `hmac.compare_digest` + `Request.body()` raw bytes. Celery or RQ for the retry queue.
- **Go + chi/echo:** `hmac.Equal` for constant-time compare. Read raw body with `io.ReadAll(r.Body)` before passing to handler. Use temporal.io or river for retries.
- **Ruby + Rails:** `ActiveSupport::SecurityUtils.secure_compare`. Raw body via `request.raw_post`. Sidekiq for retries with `sidekiq_retry_in` for the backoff curve.
- **Signature header name varies by vendor reference.** GitHub uses `X-Hub-Signature-256: sha256=<hex>` (no timestamp — replay defense is the receiver's problem, weaker). Twilio signs URL + sorted params, not body. Stripe-style (`t=,v1=`) is recommended for greenfield because the timestamp is in-band.

## Boundaries

- **This skill writes the contract, not the worker.** Implementation goes into `lib/webhooks/` + `app/api/webhooks/` after the doc is approved.
- **Signing secret is per-endpoint, never per-tenant or global.** Tenant rotates one endpoint's secret without affecting others.
- **No payload encryption.** HMAC = integrity + auth, NOT confidentiality. If payloads are sensitive, customers' endpoints must be HTTPS-only (enforce at registration) and you should still avoid putting raw PII in the payload — link to a fetchable resource ID instead.
- **No webhook-to-webhook chaining.** Customer's endpoint MUST NOT call back into your API synchronously inside the 5s ack window — that's their bug, but document it as a warning.
- **Best-effort delivery is the default.** Strict ordering is a feature you sell, not a default — it caps throughput and complicates retry semantics.
- **Dead-letter is a customer-visible state, not a silent dump.** Always notify.

## Re-run Behavior

- Re-running on the same project overwrites `docs/design/webhook-design-pattern-<project>.md` IF status is `draft`. If `approved` or later, write to `webhook-design-pattern-<project>-vN.md` (increment N) and reference the prior version in frontmatter `supersedes:`.
- Adding new event types after approval → append to §1 + bump `envelope-version` only if shape changes.
- Changing signing algo → forces dual-signing window (emit both `v1=` and `v2=` headers for 30 days, deprecate `v1=` via `/api-versioning`).

## Auto-chain

- **`/idempotency-key-design`** — receivers need an idempotency contract; this skill writes the recommendation but the full key/storage spec lives there.
- **`/retry-backoff-policy`** — the retry curve is the shared primitive; this skill consumes it. If you don't have one, run that first.
- **`/payment-reconciliation`** — missed-webhook scenarios are the #1 source of payment drift; recon catches what delivery misses.
- **`/audit-log-design`** — delivery attempts + signature failures + dead-letter transitions are audit events.
- **`/api-versioning`** — `api_version` field in envelope follows the same versioning policy as your REST API.
- **`/ui-wireframe`** — endpoint-management screens need wireframes.
- **`/threat-model`** — webhook endpoints are attack surface (replay, signature-forge, dead-letter DoS); model before launch.
- **`/sandbox-env-design`** — `livemode: false` events flow through the same envelope; sandbox webhook URLs are separately registered.

## Verification

After running:

1. `docs/design/webhook-design-pattern-<project>.md` exists with frontmatter populated.
2. §1 Event Taxonomy lists ≥ 1 event with payload + when-fired.
3. §3 Signing has both TS verifier AND Python verifier (or at minimum the adaptation note).
4. §4 Retry Policy specifies backoff formula + max attempts + dead-letter table.
5. §5 Replay Defense lists timestamp window + nonce store.
6. §7 Inbound Receiver Hygiene exists (this is the non-obvious section integrators copy).
7. §8 Open Questions has ≥ 1 unresolved item OR explicit "none — all defaults accepted".
8. Cross-references in §Auto-chain resolve to existing skill files in `.claude/skills/`.

## Example Trigger

User: "we're letting partners subscribe to booking events — design the webhook system"
→ Run `/webhook-design-pattern` for the bookings vertical: enumerate `booking.confirmed` / `booking.cancelled` / `booking.rescheduled` events, pick Stripe-style signing because greenfield, write the doc with TS verifier + Python adaptation + retry table + dead-letter flow + dashboard requirements, link out to `/idempotency-key-design` for receiver contract and `/payment-reconciliation` for the missed-webhook recovery story.
