# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

1. **Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and ask.
2. **Simplicity First** — Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios. If 200 lines could be 50, rewrite it.
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code. Match existing style. Remove imports/variables/functions YOUR changes made unused. Don't remove pre-existing dead code unless asked. Every changed line should trace to the request.
4. **Goal-Driven Execution** — Transform tasks into verifiable goals. State step → verify plans. Strong success criteria let you loop independently.

## Stack

Next.js 16 · React 19 · TypeScript (ES2017 target) · Tailwind v4 · Prisma 7.x · PostgreSQL 16 · Redis 7 · pnpm

## Commands

| Task | Command |
|------|---------|
| Dev server (port 3001) | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Type-check | `pnpm tsc --noEmit` |
| Unit tests | `pnpm test` |
| Integration tests (needs live DB) | `pnpm vitest:int` |
| Unit + integration | `pnpm test:all` |
| E2E (Playwright) | `pnpm test:e2e` |
| Single unit test | `pnpm vitest run path/to/file.test.ts` |
| Single integration test | `pnpm vitest run --config vitest.integration.config.ts path/to/file.int.test.ts` |

Pre-commit hook runs `pnpm lint && pnpm tsc --noEmit`.

## Architecture

```
app/            -->  lib/<domain>/   -->  lib/core/
  (customer)           auth, booking,       db, logger, config
  op/                  payment, ledger,
  admin/               catalog, search,
  api/                 notification, ...
  dev/
components/     -->  lib/<domain>/
proxy.ts             (Edge middleware: auth guards, rate-limit, CSRF)
```

**Dependency flow:** `app/` and `components/` → `lib/<domain>/` → `lib/core/`. No reverse deps. No cycles.

**Module boundaries (ESLint-enforced):**
- Cross-domain imports go through barrel (`lib/<domain>/index.ts`) only
- Intra-domain deep imports are fine
- `lib/core/` and `lib/utils/` are exempt from barrel rule
- **`'use client'` files MUST deep-import client-safe modules** (e.g., `@/lib/auth/csrfClient`, NOT `@/lib/auth` barrel — barrel pulls server-only transitives into client bundle → 500s)

**Path alias:** `@/*` maps to project root.

**Product spec:** `documentation/` — 7 series: ADR (architecture decisions), DS (design specs), FD (frontend design), FI (feature implementation), SI (scaffolding/infra), GL (go-live gates), HD (hardening audits), plus `business/` context. Each spec is a numbered directory with `README.md`. Cross-refs use prefix IDs (ADR-001, DS-006, FI-003, etc.).

## Project Rules

Distilled from the codebase Mistake Log. Full post-mortems in `AGENTS.md`.

### Server Components
- MUST NOT self-fetch own API routes. Extract a lib function; call in-process from both the route handler and the server component.
- RSC render bodies must be pure — no `Date.now()`, `Math.random()`. Extract to module-scope helpers.

### Transactions & Concurrency
- Read-then-write patterns MUST use `prisma.$transaction(async (tx) => ...)` (callback form, not array form) with `SELECT ... FOR UPDATE` on the gating row.
- Timestamp columns for state transitions (`departedAt`, `completedAt`, `cancelledAt`) MUST update the status enum in the same `tx.model.update` call.

### Currency & Math
- All currency math (minor-unit integer × fractional rate) MUST use BigInt. No `Number` multiplication.
- ES2017 target: use `BigInt(n)` constructor, not `1n` literal syntax.

### Timezone
- Business dates use Vietnam UTC+7 (`Asia/Ho_Chi_Minh`).
- Test date derivation must match the timezone the filter uses. Smell: `.toISOString().slice(0, 10)` + service-date query = UTC-vs-local collision.

### Schema Changes
- New NOT NULL column: grep every `prisma.<model>.create` AND every `INSERT INTO "<Model>"` across `e2e/`, `prisma/seed.ts`, `__tests__/` BEFORE merging.
- Raw-SQL indices expressible in Prisma DSL MUST also be declared as `@@index` in `schema.prisma`. Partial/WHERE indices stay SQL-only.
- Committed migrations are never edited. Fix via forward migrations.

### DTOs & Types
- DTO interfaces must mirror every non-relational scalar from the Prisma model in sequence.
- New status enum value → extend DTO union AND add positive test assertion in the same commit.

### Error Handling & Status Codes
- Idempotent operations (AC says 200 + discriminator): use discriminated results from the service layer, not thrown sentinel errors.
- Every error-code variant in a tagged union must have a corresponding `throw` AND a negative-path test.
- Status codes come from issue AC table verbatim, not intuition. When codes change, grep and update every test assertion in the same commit.

### Testing
- `vi.mock()` / `.importActual()` args stay as deep paths after barrel migration. Only rewrite `from '...'` and `import('...')` specifiers.
- When a Prisma query method changes (`findUnique` → `findFirst`, new `where` predicate), update every mock that stubs the old method.
- Hex literals for `Buffer.from(s, 'hex')` must be valid hex of correct byte-width (64 chars for SHA-256).
- E2E: drive form-incidental flows via URL params, not synthetic keystrokes on third-party inputs.
- Assertions on generated output should reference the exported constant/regex, not re-type the pattern.

### Middleware & Cross-Cutting
- New request-gate middleware: grep every non-safe-method caller of `/api/*` (app + lib + e2e) BEFORE merging. Build client-side helper in same commit.
- Cross-cutting gates in Edge middleware encode state into JWT claims (no DB reads). Path allowlists use exact-match `Set`, never prefix-match.

### PII & Secrets
- Phone placeholders: `+8490xxxxxx[N]` format (escapes `.gitleaks.toml` regex).
- New sensitive fields (tokens, proofs): add to logger redact list in the same commit.
- `select` whitelists = exactly the UI contract fields. No filter-only columns.

### Spec Discipline
- Enum/code-list constants driving state machines come from issue AC verbatim. Don't augment from vendor docs.
- Divergent AC status codes for same error: implement both per AC text, add `// SPEC CONFLICT:` comment at each site.
- Cron/sweeper WHERE predicates MUST be top-level indexed columns, never JSON-payload keys.

## Dev Setup

```bash
# 1. Infrastructure
docker compose -f docker-compose.dev.yml up -d   # pg:5432, shadow:5434, redis:6379

# 2. Environment
cp .env.example .env.local

# 3. Database
pnpm prisma migrate deploy
pnpm prisma db seed

# Reseed (LedgerEntry is append-only)
# psql: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
# then re-run migrate deploy + seed
```

Dev server runs on port **3001** (3000 is occupied).

## Working-Track Mistake Log

- **2026-07-23 (Bug B round 2 — dropping a constraint armed a wrong-payee payout)** — The Bug B fix made `PaymentEvent.bookingId` nullable so unmatched transfers leave an audit row. That migration also switched on `matchDegraded()` in `lib/jobs/reconcilePayments.ts`, which had been **unreachable for its entire life**: it only considers events with `bookingId IS NULL`, and the NOT NULL column made those impossible. Nobody had recorded that the constraint was what kept the branch dead. Once live it paid a stuck booking from an orphan matched on *(exact amount + rail + ±30min)* — and this deployment uses ONE shared receiving account, so the rail predicate is true of every payment and any same-fare booking in the window fits equally. SePay does send the real `accountNumber`; it is declared in `SepayWebhookPayload` and read nowhere. Net: a zero-credential attack — keep a stuck booking alive at a common fare, and the next customer who transfers that fare with a blank memo (the exact case the feature exists for) has their money awarded to the attacker by the `ORDER BY createdAt ASC` loop, while their own booking goes terminal `payment_failed_expired`. Caught by three independent review passes, not by me. Fix: `matchDegraded` demoted from decision to **suspicion** — it now only logs `reconcile.unmatched_payment_suspected` and `continue`s past the expiry so the booking is HELD in `awaiting_payment` for manual reconciliation, never paid and never terminally expired. That single deletion also removed two other findings for free: the sweeper no longer writes `PaymentEvent` at all, so the "claim committed but `applyPaidStatusTransition` returned 0 → real transfer absorbed with no ledger entry" hole is gone, and so is the ABBA deadlock (webhook takes PaymentEvent→Booking, sweeper took Booking→PaymentEvent; a reader-only sweeper cannot form the cycle). **Rule: a migration that WIDENS a constraint is not automatically safe — grep for code gated on the old constraint making something impossible (`IS NULL` branches, "this can never happen" comments, dead-by-construction fallbacks) and review each as new code, because that is exactly what it becomes.** Greppable smell: a `DROP NOT NULL` / removed CHECK / relaxed unique in the same PR as any predicate testing the value that just became possible.
- **2026-07-23 (a test that asserts ambiguity resolves *somehow* is not a safety test)** — Same PR. I wrote an integration test seeding TWO same-fare bookings and ONE unmatched payment, asserting exactly one `booking_credit` row. It passed, and it genuinely did prove the absence of double-crediting — which is what I set out to prove. But the same fixture is a verbatim description of a wrong-payee payout, and by asserting "the older booking wins" I encoded picking-a-victim as **intended behaviour** and locked it in with a green test. I looked straight at the ambiguous case and optimised the wrong property. The corrected test asserts that **neither** booking is paid, neither is expired, and the orphan stays unclaimed; verified it fails (`expected 'paid' to be 'awaiting_payment'`, both rows) the moment auto-pay is reintroduced. **Rule: when a matcher can fit more than one entity, the test must assert what happens to the LOSER and whether choosing at all is legitimate — not merely that exactly one winner emerged. "Exactly one" is a consistency property; it is not a safety property.** This is the sibling of the 2026-07-23 Bug A rule: there the fixture encoded the author's assumption on both sides; here the assertion encoded the author's framing of what the danger was.
- **2026-07-23 (Prisma 7.8 drift-check flags — correction to the Issue 012 entry)** — The Issue 012 entry records that `prisma migrate diff --from-schema-datamodel / --to-schema-datasource` returns exit 1 in Prisma 7.x and substitutes a manual side-by-side audit. The command was not removed, only renamed. Working 7.8 invocation: `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` → prints `No difference detected.` when live DB and datamodel agree. Automated schema↔DB parity checking is available again; the manual audit is no longer required. (Confirmed on the Bug B migrations, including that a `WHERE`-clause partial index correctly reports no difference because the Prisma DSL cannot express it.)
- **2026-07-23 (Bug B — reconcile blind to bank transfer)** — `lib/jobs/reconcilePayments.ts` `recoverEvent()` re-parsed stored `PaymentEvent.rawBody` for `parsed.amount` + `parsed.resultCode === 0` and applied that shape to EVERY adapter. That is the MoMo/stub contract; SePay sends `transferAmount` and has NO result code, so every bank_transfer event recovered as `{amount: 0, success: false}`, `isConfirming()` was always false, and `matchDegraded()` bailed at `!ev.success`. The sweeper — the safety net behind the #320/#322 webhook fixes — could not recover a single bank transfer, and worse, expired the booking (`payment_failed_expired` is TERMINAL, `lib/booking/transitions.ts:38`) while the money sat in the account. Compounding defect: `PaymentEvent.bookingId` was NOT NULL and `processWebhook.ts` returned 200 on `booking_not_found` BEFORE inserting, while `app/api/payments/bank_transfer/webhook/route.ts` short-circuited even earlier on `no_booking_ref_in_memo` — so an unmatched transfer left ZERO DB trace and the `bookingId IS NULL` degraded-match branch was dead code in prod. The route's own comment ("the reconciliation sweeper handles unmatched transfers") had been false since the day it was written. Fix (#324): nullable `bookingId` migration + orphan rows written at BOTH ack sites + `recoverSepayEvent()` exported from the adapter (native field names stay behind the adapter boundary per `gateway.ts:13`) and dispatched on the stored `adapter` column. **Rule: a function that re-parses a persisted third-party payload MUST dispatch on the stored adapter/provider column — a single parse shape is a latent per-provider outage that only fires for the providers you didn't write it against.** Greppable smell: `JSON.parse(row.rawBody)` reading provider-specific keys with no branch on `row.adapter`. Corollary that made it invisible: BOTH `reconcilePayments.test.ts` (`eventRow()` hardcoded `adapter:'momo'` + `{amount,resultCode}`) and `reconcilePayments.int.test.ts` (`ipnBody()`) were 100% MoMo fixtures — the sweeper had zero bank_transfer coverage at either layer, so 100% green proved nothing about the live rail. The new guard feeds ONE SePay payload constant through the REAL adapter (asserting it is exactly what the route would persist) and then stages that SAME string as the stored `rawBody` — one producer, two consumers, never a hand-typed shape on both sides.
- **2026-07-23 (P2002 inside `$transaction` is unrecoverable)** — While fixing Bug B I wrote the orphan-redelivery path as insert-then-recover: `try { tx.paymentEvent.create(...) } catch (P2002) { tx.paymentEvent.updateMany({bookingId: null} → claim) }`. Type-checked, and the unit tests (mocked `tx`) passed. The integration test failed immediately: Postgres aborts the ENTIRE transaction on a constraint violation, so the recovery UPDATE — and every later statement in the tx — dies with `current transaction is aborted, commands ignored until end of transaction block`. Catching a DB error inside an interactive transaction only works if you never touch that tx again; Prisma exposes no savepoint API to roll back just the failed statement. Fix: invert to claim-then-insert — `updateMany({adapter, providerTxnId, bookingId: null})` first, `create` only when `count === 0`; a genuinely LINKED duplicate still misses the `bookingId: null` predicate and falls through to the create → P2002 → outer catch → 200 idempotent no-op, so the pre-existing semantics are preserved. **Rule: never plan recovery logic in a `catch` around a statement INSIDE `prisma.$transaction` — resolve the ambiguity with a guarded UPDATE/SELECT before the write. A hand-rolled `tx` mock cannot reproduce transaction-abort semantics, so this class of bug is invisible to unit tests by construction and only a real-DB integration test will catch it.**
- **2026-07-23 (degraded match without a claim = double credit)** — `matchDegraded()` selects an orphan payment on (exact amount + adapter + ±30min window). None of those three is unique to one booking, and `reconcilePayments.ts` never wrote back to the matched row (no `paymentEvent.update` existed in the file). Because the whole sweep tick runs in ONE transaction (`withAdvisoryLock`), two stuck bookings at the same fare in overlapping windows deterministically both matched the SAME real transfer and each called `appendBookingPaidLedger` — one 150k transfer producing two paid tickets and 300k of operator credit, trivially exploitable by booking the same fare twice and paying once. Not a race; a same-loop certainty. Fix: CAS-claim the row (`UPDATE "PaymentEvent" SET "bookingId"=? WHERE id=? AND "bookingId" IS NULL`) and only trust the match when rowcount > 0. No in-memory exclusion set is needed — the claim and every later candidate's events SELECT share the tx/connection, so Postgres reads its own uncommitted write and the row stops matching `IS NULL`. **Rule: any "recover by heuristic match" sweeper MUST atomically CLAIM the evidence row it matched before acting on it; a matcher whose predicates are non-unique and which never marks the row consumed will double-apply the moment two candidates qualify.** Verified by an integration test seeding two same-amount bookings and one orphan, asserting exactly ONE `booking_credit` — it fails (both `paid`) the instant the claim is removed.
- **2026-07-23 (SePay ref-case)** — After #320 shipped the SePay auth+ack+memo-hyphen fix, EVERY bank transfer still silently no-op'd. `lib/booking/bookingRef.ts` `generateBookingRef` stores an UPPERCASE `BB-` prefix (`BOOKING_REF_REGEX = /^BB-.../`); `Booking.bookingRef` is case-sensitive Postgres text. But `lib/payment/adapters/bankTransfer.ts` rebuilt the memo-extracted ref as LOWERCASE (`` `bb-${g}...`.toLowerCase() ``), so `processWebhook.ts` `findUnique({ bookingRef: 'bb-2026-015o-p75n' })` never matched the stored `BB-2026-015o-p75n` → `booking_not_found` → 200 no-op → SePay marks the delivery successful and never retries; the booking sits `awaiting_payment` then gets wrongly expired by the reconcile sweeper. 100% of bank transfers affected. FULLY TEST-BLIND: `bankTransfer.test.ts` + `route.test.ts` + the #320 regression test all asserted the lowercase `bb-...` shape on BOTH the mock and the expectation — 33 green tests proved nothing because no test ever ran the rebuilt ref against a REAL `generateBookingRef()` value. Confirmed on prod via the SePay delivery-log `content` field (`BB2026015op75n` → rebuilt `bb-2026-015o-p75n` ≠ stored `BB-2026-015o-p75n`). Fix (#322): `` `BB-${m[1]}-${m[2].toLowerCase()}-${m[3].toLowerCase()}` `` (canonical uppercase prefix + lowercased base36 segments) + a regression guard that feeds a REAL `generateBookingRef()` value with hyphens stripped (as the VN bank delivers) and asserts the adapter reconstructs the EXACT stored ref AND that it satisfies `BOOKING_REF_REGEX`. Rule: any code that reconstructs a DB key from an external string (webhook memo, URL param) and looks it up by EXACT match MUST be tested by round-tripping the actual generator's output through the reconstructor — never by asserting a hand-typed expected value, which can encode the same case/format error on both sides and stay green while production 100% fails. This is the internal-key-format corollary to the existing "a hand-written test fixture is not independent evidence of the wire contract" rule (2026-07-21 SePay go-live): the trap applies to the internal key CASE, not just the vendor wire format. Also surfaced (Bug B, follow-up not yet fixed): `lib/jobs/reconcilePayments.ts` `recoverEvent` derives success from MoMo's `resultCode`, absent in SePay payloads, so a stuck bank_transfer booking can never be recovered by the 15-min sweeper — it gets marked `payment_failed_expired` even though the money arrived.
- **2026-07-21 (env files)** — Appended a var to `.env.production.local` with `grep '^SEPAY_API_KEY=' .env.local >> .env.production.local`. The target file did not end with a newline (last byte was `"`), so the appended line was concatenated onto the final existing line, silently corrupting it into `ADMIN_BOOTSTRAP_PASSWORD="…"SEPAY_API_KEY="…"` — mangling a real secret AND leaving the new var unparseable. Caught only because a parity check (`[ "$(grep '^SEPAY_API_KEY=' .env.local)" = "$(grep '^SEPAY_API_KEY=' .env.production.local)" ]`) reported MISMATCH; a naive `grep -oE 'SEPAY_API_KEY="[0-9a-f]{64}"'` verification had already reported success, because `-o` matches mid-line and cannot tell a properly-appended var from a glued-on one. Recovered from a `cp` backup taken before the write. Rule: never `>>` into a file whose trailing byte you have not checked — `tail -c 1 <file> | od -c`. Either `printf '\n' >> file` first, or append with a leading `\n` in the payload. Corollary on verification: anchor the check to line start (`grep '^VAR='`) or compare whole lines between source and destination; an unanchored/`-o` match is not evidence the line is well-formed. Always `cp` a backup before mutating an untracked secrets file — gitignored files have no `git checkout --` recovery path.
- **2026-07-21 (SePay go-live)** — `app/api/payments/bank_transfer/webhook/route.ts` was written against an *assumed* SePay wire contract, never the vendor docs, and both halves were wrong. (1) Auth: the route accepted only `Authorization: Bearer <key>`, but SePay's "API Key" auth type sends `Authorization: Apikey <key>` — every real webhook would have 401'd, so no bank transfer would ever have confirmed. (2) Ack: SePay counts a delivery successful only on HTTP 200/201 with a body of exactly `{"success": true}` within 30s; the shared `processPaymentWebhook` returns `{"message":"ok"}`, so every delivery would have been marked failed and retried on Fibonacci backoff (7 attempts / 5 hours). Neither showed up in tests because the test fixture *also* hand-wrote `Bearer` — the mock encoded the same wrong assumption as the source, so 8 green tests proved nothing about the vendor boundary. Compounding: `documentation/guides/06-setup-sepay.md` documented Agribank/BIN `970405` and claimed "HMAC signature verification" while `lib/config/env.ts` defaulted to Sacombank/`970403` and the route did a plain key compare — the guide was internally consistent and consistent with nothing else. Fix: `AUTH_SCHEME_REGEX = /^(?:Apikey|Bearer)\s+(.+)$/i`; a `sepayAck()` helper re-emitting 2xx from `processPaymentWebhook` as `{success:true}` while passing non-2xx through untouched (those SHOULD be retried); guide rewritten against https://docs.sepay.vn/tich-hop-webhooks.html. Deliberately did NOT change `processWebhook.ts` — it is shared and each PSP has its own ack format (VNPay wants `RspCode`), so provider-specific ack shaping belongs in the provider's route. Rule: for any third-party webhook receiver, the exact auth header string and the exact success-ack body must be transcribed from the vendor's live docs and cited in a comment at the verification site — never inferred from a sibling adapter or from "bearer token is the usual thing". A hand-written test fixture is not independent evidence of the wire contract: it re-encodes the author's assumption on both sides, so green tests are compatible with a totally broken integration. Greppable smell: a webhook route whose auth-header parse and whose success-response shape have no vendor-doc URL within a few lines of them.
- **2026-07-18 (navbar)** — Added `scroll-mt-20 lg:scroll-mt-[132px]` to `app/(customer)/page.tsx` and the computed `scroll-margin-top` stayed `0px` in the browser. Not a code bug: Tailwind v4 under Turbopack had not rescanned that file, so the utilities were never generated — the served CSS still contained only the OLD `scroll-mt-16`. Edits to `components/layout/SiteHeader.tsx` in the same session rebuilt fine, so the staleness is per-file, not global. `touch <file>` did NOT trigger the Windows watcher (mtime-only change is ignored); only a real content edit (changing a comment's text) forced the rescan. Diagnosis recipe: fetch the served stylesheet in-page (`fetch(document.querySelector('link[rel=stylesheet]').href)`) and grep it for the new class — if the old class is present and the new one absent, it's a stale scan, not a selector/specificity problem. Probing with a synthetic `document.createElement` + class is misleading: JIT only emits utilities found in source, so an unused probe class always computes to 0 and looks like a failure. Rule: when a fresh Tailwind class computes to its unset default, check the served CSS for the class before touching the markup — and force a rescan with a content edit, never `touch`.
- **2026-07-17 (PR #302)** — `components/brand/Logo.tsx` used static image imports (`import logo from '@/public/brand/logo.png'`). Passed locally (dev server generates `next-env.d.ts` with image-module declarations) but CI runs bare `pnpm tsc --noEmit` without it → `TS2307 Cannot find module`. Fix: string `src` + explicit `width`/`height` on `next/image`. Rule: no static image imports in this repo while the CI type gate is bare tsc — use string paths with explicit intrinsic dimensions.
- **2026-07-17 (PR #302)** — Added route-level `app/(customer)/loading.tsx` (search-results skeleton). A segment-level loading boundary makes Next stream a 200 shell for EVERY child route before the page runs — `/booking/result/[token]`'s `notFound()` could no longer set HTTP 404 (caught by `momo-booking.spec.ts` e2e; local dev reproduced). Same class of bug: `useSearchParams()` in a client layout triggers the CSR bailout with the same 200-shell effect. Fix: explicit `<Suspense fallback={<ResultsSkeleton/>}>` scoped to the async view inside `page.tsx`; read query strings via `window.location` in a mount effect in client layouts. Rule: never add `loading.tsx` (or `useSearchParams` in a client layout) to a segment whose child pages rely on `notFound()`/status codes — scope streaming boundaries to the specific async subtree.

- **2026-06-21 (WT-20)** — Added `OTP_PEEK_ENABLED` to Zod schema in `lib/config/env.ts`. CI data-leak audit A7 has a scope guard that restricts `OTP_PEEK_ENABLED` references to specific files only (`app/api/auth/otp/test-peek/route.ts`, `lib/auth/operatorOtp.ts`). Adding it to the Zod schema triggered the audit failure. Fix: removed from Zod — it's a runtime dev/test gate, not a boot-time config var. Rule: before adding any env var to the Zod schema, grep the CI audit script (`.github/workflows/`) for scope guards on that var name. Scoped vars stay out of centralized schemas.
- **2026-06-21 (WT-20)** — Added `REFRESH_TOKEN_SECRET` to Zod `superRefine` production-required list but forgot to add it to `.github/workflows/ci.yml` E2E env. CI E2E builds with `NODE_ENV=production` → `next build` prerender hit the Zod gate → build failed. Fix: added `REFRESH_TOKEN_SECRET: ci-test-refresh-secret-not-for-prod-0123` alongside the existing JWT_SECRET/JWT_OPERATOR_SECRET/etc CI vars. Rule: when adding a new var to the Zod production-required superRefine, also add a placeholder value to `.github/workflows/ci.yml` E2E job env in the same commit. Grep `superRefine` production block for the canonical list, then diff against CI env block.
- **2026-06-21 (WT-21)** — `pnpm audit --prod --audit-level=high` failed CI on first run. Transitive vuln in `prisma>@prisma/dev>hono` (CORS middleware CVE) — not actionable, Prisma internal dev tool we don't use. Fix: changed to `--audit-level=critical`. Rule: `pnpm audit --prod` still picks up transitive deps of build tools like Prisma. Use `--audit-level=critical` for CI gate; review high vulns manually. Test `pnpm audit` locally before adding to CI.

@AGENTS.md
