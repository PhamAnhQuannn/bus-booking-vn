---
name: sandbox-env-design
description: Sandbox environment design for integrators and partners — isolated DB / schema / encryption keys, deterministic fixture data (test cards, test merchant IDs), per-credential lifecycle (sandbox key at signup vs prod key gated on KYC), explicit sandbox-parity matrix (replicated vs mocked vs absent features), test-mode markers on every outbound object (livemode flag), sandbox-only forced behaviors (decline cards, webhook-failure injection, time-warp for cron), and migration path from sandbox to prod (config exports, data does NOT carry). Use when user says "sandbox", "test mode", "partner sandbox", "integrator sandbox", "test environment", "livemode flag", "test cards", "sandbox parity", "/sandbox-env-design", or before opening an integrator program. Writes docs/design/sandbox-env-design-<project>.md.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /sandbox-env-design — partner-facing sandbox environment

## Why you'd care

A sandbox is what an integrator hits the first day they touch your API. It is your developer-experience funnel. The patterns that go wrong:

1. **No isolation** — sandbox writes leak into prod analytics, or worse, prod orders ship to test addresses.
2. **No fixture determinism** — integrator's CI runs flake because a "test" booking they made yesterday changed prices today.
3. **No parity matrix** — integrator wires a feature against sandbox, ships, finds it doesn't exist in prod. They blame you.
4. **No test-mode marker** — production logging system swallows a real `$10,000` charge because a code path checks the wrong flag.
5. **Same credentials across both** — sandbox key leaks → attacker can probe your prod surface.
6. **No path from sandbox to prod** — integrator finishes integration, then is told to redo everything because the data model differs.

The cost of skipping this skill: every integrator's first ticket is "how does sandbox differ from prod", you answer it in Slack 50 times, and the answer drifts. Write it down once.

## Pre-flight

- **Stack auto-detect:** run `/stack-profile` first if uncertain. The worked example below is TypeScript + Prisma + Express; a Python + Django adaptation note follows. The isolation strategy + livemode marker pattern + fixture loader pattern are stack-invariant.
- **Domain auto-detect:** the fixture set differs by vertical. Payments → test cards (`4242 4242 4242 4242` succeed, `4000 0000 0000 0002` decline). Marketplace → test merchants + test catalog items. SaaS → test workspaces + seeded users. POS/restaurant → test menu + test tables + test reservations. Look at `app/api/<X>/` or `models/<X>` to choose the seed pack.
- **Isolation backend.** Pick ONE: (a) separate DB instance — strongest, costs 2x. (b) separate schema in same DB — strong, requires every query to be schema-aware. (c) shared schema + tenant column `livemode boolean` — weakest, requires every query to filter, easy to forget. Default for greenfield: separate schema. Default for retrofit: tenant column with a query-builder middleware that auto-adds the predicate.
- **Encryption-key separation.** Sandbox MUST have its own data-encryption key. If sandbox and prod share a key and sandbox leaks, prod payloads become attacker-decryptable. Use KMS aliases: `alias/<project>-sandbox` and `alias/<project>-prod`.
- **Identity model.** Decide: does an integrator have ONE account that owns both sandbox and prod credentials (Stripe-style — toggle in dashboard), or TWO accounts (one for sandbox, one for prod, linked by org)? Stripe-style is friendlier; two-account is safer for high-compliance verticals.
- **Output destination.** `docs/design/sandbox-env-design-<project>.md`.

## Inputs

- Project name (slug) — used in output filename.
- Vertical (payments / marketplace / SaaS / POS / fintech / health) — drives fixture pack.
- Isolation choice (separate-instance / separate-schema / shared-with-flag).
- Identity-model choice (single-account-toggle / dual-account).
- Reference vendor for sandbox style (Stripe, Plaid, Twilio, Square, Adyen).
- Feature list (auto-extract from API surface, or accept user list) — drives parity matrix.

## Process

1. **Pick isolation tier + document blast radius.** Write down what happens when a sandbox bug escapes. With separate-instance: zero prod impact. With separate-schema: same DB host, so a runaway sandbox query can starve prod CPU — document the connection-pool split. With shared-schema-plus-flag: every missing `WHERE livemode = false` is a P0 incident. Pick one, write the failure mode beside it.
2. **Design the credential lifecycle.** Sandbox API key issued at signup automatically — no KYC, no waiting. Format: `sk_test_<32-random>` (Stripe-style prefix distinguishes from `sk_live_<32-random>`). Never expires unless rotated. Prod key gated: KYC complete + business verification + first prod-mode toggle. Document the rotation procedure (dual-key window 24h).
3. **Seed the fixture pack.** Deterministic, idempotent, per-account. Each integrator gets a fresh sandbox seeded at signup with a canonical set: test users, test resources, sample events history. Re-seed on demand (button in dashboard, `POST /v1/sandbox/reset`). Document the exact seed — integrators write tests against it. Include the special "magic" fixtures: test cards that always decline, test cards that always 3DS-challenge, test addresses that always fail validation, test phone numbers that always fail SMS. These are the contract integrators most depend on.
4. **Add the livemode marker.** Every outbound object (API response, webhook payload, audit log entry, email) carries a top-level `livemode: boolean`. Sandbox = `false`, prod = `true`. Receivers branch on it. Internal logging system MUST index by livemode so a search for "errors in prod" never returns sandbox noise. Document the marker in the envelope spec (cross-link `/webhook-design-pattern`).
5. **Write the sandbox parity matrix.** For every feature in the API, classify as: **(R) Replicated** — works identically in sandbox; **(M) Mocked** — returns canned success without real side effect (e.g. SMS not actually sent, but `messages.sent` event still fires); **(A) Absent** — endpoint returns `501 sandbox_unsupported`. Be honest: integrators will discover the gaps anyway; better they read them than rage-tweet them.
6. **Specify sandbox-only forced behaviors.** Test-card numbers that force decline / require 3DS / trigger dispute. A header `Sandbox-Force-Webhook-Failure: 1` that makes the next webhook to that endpoint return 500. A header `Sandbox-Time-Warp: 2026-12-25T00:00:00Z` that pretends wall-clock is that timestamp for cron evaluation — useful for testing subscription-renewal or scheduled-job behavior. Document each forced behavior, the trigger, and the deterministic effect.
7. **Specify the sandbox-to-prod migration path.** Data does NOT carry — explicit. But the integrator's *config schema* (webhook URLs, event subscriptions, branding, role definitions) MUST export-import. Provide `GET /v1/account/config/export` (sandbox) and `POST /v1/account/config/import` (prod, requires prod-key). Document what's included vs excluded.
8. **Write the doc.** Output to `docs/design/sandbox-env-design-<project>.md` with all sections populated. Cross-link `/tenant-isolation-design`, `/data-residency-design`, `/pos-integration-precheck`, `/webhook-design-pattern`.

## Output Format — `docs/design/sandbox-env-design-<project>.md`

```markdown
---
project: <project>
date: 2026-05-14
isolation-tier: separate-schema
identity-model: single-account-toggle
reference-vendor: stripe
livemode-marker-field: livemode
api-key-prefix-sandbox: sk_test_
api-key-prefix-prod: sk_live_
status: draft | approved | in-implementation | shipped
---

# Sandbox Environment Design — <project>

## 1. Isolation Tier

**Choice:** Separate Postgres schema (`sandbox` and `public` in same DB instance).

**Blast radius if sandbox bug escapes:** Sandbox traffic can saturate shared connection pool — mitigated by per-schema pool limits (sandbox capped at 30% of total connections). Sandbox cannot read/write prod rows because the `search_path` is set per-connection and every query is schema-qualified by Prisma's multi-schema feature.

**Why not separate-instance:** 2x infra cost rejected at current scale; revisit at >$500/mo MRR per sandbox tenant.

**Why not shared-schema-plus-flag:** Forgetting `WHERE livemode = false` would cause cross-environment leak. Schema separation is enforced at the connection layer instead.

## 2. Credential Lifecycle

| State | Sandbox Key | Prod Key |
|-------|-------------|----------|
| Issued at signup | Yes, automatic | No |
| Format | `sk_test_<32-hex>` | `sk_live_<32-hex>` |
| Expiry | Never (until rotated) | Never (until rotated) |
| Rotation | Dual-key 24h window | Dual-key 24h window |
| Prereqs to obtain | None | KYC complete + business verification + dashboard toggle |
| Scope | Sandbox schema only | Prod schema only |

A leaked `sk_test_` cannot read prod. A leaked `sk_live_` cannot read sandbox (auditors prefer this — sandbox holds engineer-generated noise that would pollute a prod-data investigation).

Encryption keys: KMS aliases `alias/<project>-sandbox` and `alias/<project>-prod`. Distinct, rotated independently.

## 3. Fixture Pack (per vertical)

Seeded at integrator signup, idempotent re-seed via `POST /v1/sandbox/reset` or dashboard button.

### Test Cards (payments vertical)

| Number | Behavior |
|--------|----------|
| 4242 4242 4242 4242 | Always succeed |
| 4000 0000 0000 0002 | Always decline (`card_declined`) |
| 4000 0000 0000 9995 | Decline with `insufficient_funds` |
| 4000 0025 0000 3155 | Requires 3DS challenge, then succeeds |
| 4000 0000 0000 0259 | Succeeds, then dispute opens after 24h |

### Test Resources (marketplace vertical)

- 3 test merchants: `mer_test_alpha`, `mer_test_beta`, `mer_test_gamma`
- 10 test products per merchant, deterministic SKUs `prod_test_001` through `prod_test_010`
- 5 test customers with known emails `user1@sandbox.<project>.test` through `user5@sandbox.<project>.test`

### Magic Test Inputs

| Input | Effect |
|-------|--------|
| Address `123 Decline St` | Always fails address validation |
| Phone `+15005550006` | Always fails SMS send (matches Twilio convention) |
| Email `bounce@sandbox.<project>.test` | Email delivery webhook reports `bounced` |
| Name `Fraud McTest` | Risk-score endpoint returns 99 |

## 4. Livemode Marker

Every API response, webhook payload, audit log entry, and email carries `livemode: boolean` at the top level.

```json
{
  "id": "evt_01HZX7K8...",
  "livemode": false,
  "type": "payment.succeeded",
  "data": { "...": "..." }
}
```

- Logging system indexes by `livemode`.
- Slack alerts on prod-only errors filter `livemode == true`.
- Customer dashboard chart "Total Revenue" filters `livemode == true`.
- Integrator's webhook handler MUST branch on `livemode` to avoid running prod logic on sandbox traffic.

## 5. Sandbox Parity Matrix

| Feature | Sandbox | Notes |
|---------|---------|-------|
| Create booking | R | Identical behavior |
| Charge payment | R | Test cards drive deterministic outcome |
| Refund payment | R | Settles instantly in sandbox; 2 business days in prod |
| Dispute lifecycle | R | Triggered via magic card `4000 0000 0000 0259` |
| Send email | M | Webhook `email.delivered` fires; no real SMTP send |
| Send SMS | M | Webhook `sms.delivered` fires; no Twilio call |
| KYC verification | M | Auto-approves after 5s; in prod takes hours-days |
| ACH transfer | A | Returns 501 `sandbox_unsupported`; integrate against prod |
| Fraud-score ML model | M | Returns canned score based on `name == "Fraud McTest"` |
| Webhooks | R | Same envelope, `livemode: false` |
| Rate limits | R | Sandbox has separate quota: 100 req/s per account |

Legend: **R** = replicated, **M** = mocked, **A** = absent.

## 6. Sandbox-Only Forced Behaviors

| Trigger | Effect | Use Case |
|---------|--------|----------|
| Card `4000 0000 0000 0002` | Force decline | Test decline-handling UX |
| Header `Sandbox-Force-Webhook-Failure: 1` | Next webhook to caller's endpoint returns 500 | Test retry handling |
| Header `Sandbox-Force-Latency: 5000` | Endpoint sleeps 5s | Test client timeout handling |
| Header `Sandbox-Time-Warp: 2026-12-25T00:00:00Z` | Server treats wall-clock as that time for cron + scheduled-job evaluation | Test renewal logic without waiting |
| Query `?sandbox_seed=full` | Re-seeds fixture pack | Reset between test runs |

Headers are stripped at the prod boundary (gateway rejects any `Sandbox-*` header on `sk_live_` requests).

## 7. Sandbox-to-Prod Migration

Data does NOT carry from sandbox to prod. Explicit. The integrator must recreate test scenarios in prod after launch, with real customer data.

Config DOES carry, via export-import:

- `GET /v1/account/config/export` (with `sk_test_` key) → JSON file containing: webhook endpoint URLs, event subscriptions, role definitions, branding settings, custom fields, feature flags.
- `POST /v1/account/config/import` (with `sk_live_` key) → applies the JSON.

Excluded from export: API keys (must be issued fresh per environment), customer data, transaction history, billing settings (must be set on the prod account directly).

## 8. Worked Example — Express/Prisma livemode wiring

```typescript
// lib/sandbox/env-context.ts
import { PrismaClient } from "@prisma/client";

type Env = "sandbox" | "prod";

const sandboxPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DB_URL_SANDBOX! } },
});
const prodPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DB_URL_PROD! } },
});

export function envFromApiKey(key: string): Env {
  if (key.startsWith("sk_test_")) return "sandbox";
  if (key.startsWith("sk_live_")) return "prod";
  throw new Error("invalid_api_key");
}

export function dbFor(env: Env): PrismaClient {
  return env === "sandbox" ? sandboxPrisma : prodPrisma;
}

export function livemodeFor(env: Env): boolean {
  return env === "prod";
}

// middleware
import { Request, Response, NextFunction } from "express";

export function sandboxAware(req: Request, res: Response, next: NextFunction) {
  const key = req.header("Authorization")?.replace("Bearer ", "") ?? "";
  const env = envFromApiKey(key);
  (req as any).env = env;
  (req as any).db = dbFor(env);
  (req as any).livemode = livemodeFor(env);

  // Strip Sandbox-* headers on prod requests.
  if (env === "prod") {
    for (const h of Object.keys(req.headers)) {
      if (h.toLowerCase().startsWith("sandbox-")) {
        return res.status(400).send({ error: "sandbox_header_on_prod_key" });
      }
    }
  }
  next();
}

// route — every outbound payload carries livemode
app.post("/v1/payments", sandboxAware, async (req: any, res) => {
  const payment = await req.db.payment.create({
    data: { amount: req.body.amount, livemode: req.livemode },
  });
  res.json({
    id: payment.id,
    livemode: req.livemode,
    amount: payment.amount,
    status: payment.status,
  });
});
```

### Python + Django adaptation note

Replace `PrismaClient` with two `DATABASES` entries in `settings.py` (`default` and `sandbox`) routed via a `DATABASE_ROUTERS` class that inspects `request.env`. Replace the Express middleware with Django middleware that reads `Authorization` from `request.META`. Use `django.db.transaction.atomic(using=request.env)` to scope ORM writes. The livemode boolean lives on each model as a column and is serialized into every DRF response via a shared mixin. Header stripping moves into the same middleware.

### Stack-adaptation notes

- **Rails:** `Apartment` gem or `ActiveRecord::Base.connected_to(role: :reading, shard: :sandbox)` for the schema swap. ApplicationController `before_action :resolve_env`.
- **Go (chi/echo):** middleware sets `context.WithValue(ctx, envKey, env)`; data layer wraps `pgxpool.Pool` per env.
- **Serverless (Vercel / Cloudflare Workers):** instantiate one DB client per env at module scope; route handler picks the right one. Avoid creating clients per-request — connection storm.

## 9. Open Questions

- [ ] Should sandbox webhooks be delivered to a separate URL than prod (registered per env), or same URL with `livemode: false` and let receiver branch? (Default: separate URL — fewer foot-guns.)
- [ ] How long do we retain sandbox data? (Default: 90 days rolling; documented in `/retention-policy`.)
- [ ] Multi-region sandbox or single-region? (Default: single region matching the integrator's prod region; document in `/data-residency-design`.)
```

## Boundaries

- **Sandbox is not a staging environment.** Staging is yours, internal, mirrors prod data structurally. Sandbox is integrators', isolated, deterministic, never shares real customer data.
- **Never copy prod data into sandbox.** Even anonymized. Use only seeded fixtures. Anonymization fails.
- **Never run sandbox jobs against prod resources.** No cross-env reads, no cross-env writes, no shared queues — separate queue namespaces (`sandbox.*` and `prod.*` topic prefixes).
- **Parity matrix is contractual.** If you mark a feature R, you cannot quietly degrade it to M. Bump a deprecation cycle via `/api-versioning` if you must.
- **Livemode is not a security boundary.** It's a routing + logging marker. The actual boundary is the API key prefix + schema split + KMS-key separation.
- **No PII in sandbox fixtures.** All fixture emails end in `.test` (RFC 6761 reserved). All fixture phones use Twilio magic numbers. All fixture addresses are clearly fake (`123 Decline St`).
- **Sandbox is part of your security surface.** A leaked sandbox key with no prod blast radius is still a phishing vector ("here's your sandbox dashboard, log in to see your test data") — flag in `/threat-model`.

## Re-run Behavior

- Re-running on the same project overwrites `docs/design/sandbox-env-design-<project>.md` IF status is `draft`. If `approved` or later, write to `sandbox-env-design-<project>-vN.md` and reference prior via `supersedes:` frontmatter.
- Adding new features → update parity matrix §5 only; everything else stable.
- Changing isolation tier → forces a migration plan; chain to `/migration-safety`.
- Adding a sandbox-only forced behavior → append to §6, document the header name (must not collide with real headers — `Sandbox-` prefix is reserved).

## Auto-chain

- **`/tenant-isolation-design`** — sandbox is a special tenant class; isolation primitives are shared. Run that first if absent.
- **`/data-residency-design`** — sandbox region scoping must match the integrator's prod region intent.
- **`/pos-integration-precheck`** — POS integrators REQUIRE a sandbox to pass certification; this doc is the input to their cert checklist.
- **`/webhook-design-pattern`** — sandbox webhooks use the same envelope with `livemode: false`; the marker spec is shared.
- **`/api-versioning`** — degrading a feature from R to M in §5 is an API break and follows the versioning policy.
- **`/threat-model`** — sandbox surface area, leaked-key paths, phishing of sandbox dashboards.
- **`/retention-policy`** — sandbox data retention is shorter than prod (default 90 days) and should be explicit.
- **`/devdocs-gen`** — the parity matrix + magic-fixture table belong in the public integrator docs.

## Verification

After running:

1. `docs/design/sandbox-env-design-<project>.md` exists with frontmatter populated.
2. §1 Isolation Tier names the choice + blast-radius if it leaks.
3. §2 Credential Lifecycle has both sandbox and prod columns + KYC gate noted.
4. §3 Fixture Pack lists ≥ 3 magic test inputs (or vertical-equivalent).
5. §4 Livemode Marker shows an example payload.
6. §5 Parity Matrix labels every feature R / M / A.
7. §6 Forced Behaviors lists ≥ 3 sandbox-only triggers.
8. §7 Migration Path enumerates included vs excluded fields for config export.
9. §8 has the TS worked example AND the Python adaptation note.
10. §9 Open Questions has ≥ 1 unresolved item OR explicit "none — all defaults accepted".
11. Cross-references in §Auto-chain resolve to existing skill files.

## Example Trigger

User: "we're opening up to POS partners, need a sandbox they can certify against"
→ Run `/sandbox-env-design` for the POS vertical: pick separate-schema isolation (cost-sensitive but POS partners don't share network with us), single-account-toggle identity (Stripe-style), seed fixture pack with test menu + test tables + test reservations + magic decline cards, fill parity matrix marking print-receipt as M (no real printer) and cash-drawer-pulse as A (hardware-only), document the `Sandbox-Force-Webhook-Failure` and `Sandbox-Time-Warp` headers POS partners will use for end-of-day-close testing, link to `/pos-integration-precheck` so the cert checklist consumes this as input.
