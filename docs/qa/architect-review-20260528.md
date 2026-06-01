ARCHITECT REVIEW — repo-wide (local mode) — 2026-05-28
─────────────────────────────
Scanned: 332 source files (app/lib/components), import graph + invariants.

PRIORITY 1 — Block push: **none**
- No UI→DB layer violations: the 8 client components that reference `@/lib/db/*` or `@prisma/client` do so via **`import type` only** (erased at build) — none call `prisma.*`. Data reaches clients via API routes / server-component props.
- No payment-crypto scatter: HMAC/signature verify is centralized in the `lib/payment/` service layer (`processWebhook.ts`, `momo.ts`, `stub.ts`) and consumed by the `/api/payments/*/webhook` route handlers — not duplicated across routes.
- No DDL in app code (`$executeRaw` CREATE/ALTER/DROP) — schema changes live only in `prisma/migrations/`.
- No secrets leaking to client bundles (`process.env.*SECRET/KEY/TOKEN` absent from `'use client'` files).

PRIORITY 2 — Fix before next release:
  [ADR MISSING] No `docs/adr/` directory. Architecturally-significant choices lack formal ADRs:
    Prisma + Postgres · custom JWT auth (jose, operator + customer) · MoMo/ZaloPay/card payment adapters + local stub · Upstash rate-limiter · funnel-event analytics.
    Note: decisions ARE captured informally in `AGENTS.md` (Mistake Log) + `docs/design/*`. Fix: `/adr-writer` for the load-bearing ones (auth model, payment-adapter strategy, stub gateway) if you want decision provenance.

PRIORITY 3 — Track on roadmap:
  - `lib/db/client` has high fan-in (135/332 ≈ 41% of files) but that's the Prisma client — expected hub, below the 70% god-module threshold. Not actionable.

SUMMARY: 0 P1, 1 P2, 0 P3
Verdict: **architecture sound** — layered (UI → API/server-action → lib service → prisma), concurrency-correct (extensive `SELECT … FOR UPDATE` guards), no cycles or boundary breaches surfaced. Graph-snapshot baseline not persisted this run (deferred).

RECOMMENDED NEXT STEPS:
  → Optional `/adr-writer` for auth / payment-adapter / stub-gateway decisions.
  → Scalability levers tracked in `/perf-audit` (companion run).
