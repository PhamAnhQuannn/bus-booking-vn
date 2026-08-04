PERF REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)"
─────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/259
Base/Head: master ← feat/customer-auth-enable @ 026729fb
Decision:  (no review decision yet)
Size:      +1368 / -779 across 60 files
Generated: 2026-07-07T08:22:24Z

Findings: 2  (P1: 1 · P2: 0 · P3: 1)

P1 — BLOCKING:
  lib/booking/attachGuestBookingByPhone.ts:101-123  🐢 P1: New query pattern on unindexed column — `backfillGuestBookingsByEmail` runs
    `tx.booking.updateMany({ where: { buyerEmail: normalized, customerId: null } } )` on EVERY customer
    registration (called from `lib/auth/authService.ts::register()`, invoked by `app/api/auth/register/route.ts`,
    inside the same `$transaction` as the `Customer` insert).

    `Booking.buyerEmail` has NO index anywhere — confirmed against `prisma/schema.prisma` (only
    `@@index([buyerPhone])` exists on Booking, added in the Issue 009 migration for the equivalent
    phone-based backfill) and against every `prisma/migrations/**/migration.sql` (buyerEmail was added
    nullable-only in `20260601000001_booking_buyer_email`, no accompanying index, ever). Every matching
    row requires a full sequential scan of the `Booking` table — the largest, unboundedly-growing
    transactional table in the schema (booking history is retained, never pruned) — while holding open
    the registration transaction's row lock on the freshly-created Customer row. This will get
    measurably worse every month as booking volume accumulates, and it fires on the customer-facing
    signup hot path, not an admin/batch job.

    Fix: add `@@index([buyerEmail])` to the `Booking` model in `prisma/schema.prisma` in a new migration
    (mirrors the existing `@@index([buyerPhone])` pattern from Issue 009 — same shape, same justification).

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  lib/account/customerOtp.ts:30-44 (findCustomerLockoutSentinel)  ℹ️  P3: `ORDER BY "expiresAt" DESC`
    doesn't align with the available `OtpAttempt_email_createdAt_idx` (`email, createdAt DESC`) — Postgres
    can use the index for the `email = $1` equality predicate but must filesort/scan-in-memory for the
    ORDER BY. Low risk in practice: the compound predicate (`attemptCount >= 3 AND consumed = true AND
    expiresAt > NOW()`) narrows matches to at most a handful of rows per email even without an index on
    `expiresAt`, so the filesort cost is negligible. No action required unless `OtpAttempt` retention
    policy changes (e.g. rows stop being pruned/consumed and start accumulating per email).

Verified clean (no findings):
  - Cat 1 N+1: no loop body in the diff contains a per-item `prisma.*.findUnique/findFirst` call — grepped
    all `for (`/`forEach(`/`.map(async`/`while (` blocks in the diff; the only loops are a test's
    verify-failure exhaustion loop (`lib/account/__tests__/lockout.int.test.ts`), an in-memory rate-limiter
    Map cleanup, and an env-var validation loop — none touch the DB per iteration.
  - Cat 1 missing index — OtpAttempt.email: covered. Migration `20260703030000_otp_email_column` adds both
    `OtpAttempt_email_active_key` (partial unique, for the `ON CONFLICT` supersede-on-resend upsert) and
    `OtpAttempt_email_createdAt_idx` (composite, for the `WHERE email = … ORDER BY createdAt DESC LIMIT 1`
    consume/verify lookups in `lib/auth/otp.ts` and `lib/account/customerOtp.ts`). Query shape matches
    index shape exactly.
  - Cat 1 missing index — Customer.email: `login()`/`forgotPassword()`/`resetPassword()` all now do
    `findFirst({ where: { email, deletedAt: null } })`. Schema.prisma shows no `@unique`/`@@index` on
    `Customer.email`, but a partial unique index (`Customer_email_key ... WHERE email IS NOT NULL`) was
    added via raw SQL in the pre-existing Issue 007 migration and has never been dropped — confirmed
    index-backed, and also means `register()`'s `P2002` → `EMAIL_TAKEN` mapping is real (not dead code).
  - Cat 2 unbounded findMany: no new `findMany(` calls anywhere in the diff (grepped).
  - Cat 3 bundle: new `components/auth/CustomerAccountMenu.tsx` (~95 lines, wired into the site-wide
    `SiteHeader.tsx`) only imports `@base-ui/react/menu` (already used by `SiteHeader`'s existing
    `Dialog`) and tree-shaken `lucide-react` icons already used elsewhere. `lib/auth/clientSession.ts`
    depends only on `zustand`, which was already a dependency before this PR (`package.json` unchanged
    for it). No new client-bundle weight.
  - Cat 4 cold start / always-on cost: `clientSession.ts`'s proactive-refresh mechanism uses a single
    `setTimeout` keyed off the JWT `exp` claim (cleared/rescheduled on every token set), not
    `setInterval` — no polling loop, no new cron, no new server-side always-on cost. Single-flight
    guard (`inFlight`) prevents refresh thundering-herd on concurrent 401s.
  - Cat 5 caching: no new GET route handlers with DB reads in this diff (`otp/test-peek` is test-only,
    reads an in-memory Map, guarded 404 in production).

RECOMMENDED NEXT:
  - Add `@@index([buyerEmail])` on `Booking` before merge (P1).
  - If reviewer already requested changes: /pr-feedback-route 259

SUMMARY: 1 P1 · 0 P2 · 1 P3 · pinned to 026729fb
