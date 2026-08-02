SECURITY-DEEP REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/259
Base/Head: master ← feat/customer-auth-enable @ 026729fb
Decision:  (none)
Generated: 2026-07-07T08:23:48Z

Scope note: a prior same-day report at this path was pinned to an earlier,
partial head (1679a7d7) that only saw the login-route diff. This report
supersedes it — re-run against the full PR (60 files: OTP phone→email
migration, lib/auth/**, lib/account/**, app/api/auth/**, proxy.ts,
prisma/schema.prisma + migration 20260703030000_otp_email_column) at the
current head 026729fb. Per caller instructions, the following are already
known from /code-review and are NOT re-reported here:
  - Customer login has no per-email lockout (P2).
  - Phone-change flow broken by the OTP email migration (correctness).

Findings: 2  (P1: 0 · P2: 1 · P3: 1)

Cat 1 — Crypto correctness:

  P2 — SHOULD FIX:
  lib/ticketing/ticketToken.ts:57-63  ⚠️  P2: TICKET_SECRET dev/test fallback silently
  widened to cover EVERY non-production NODE_ENV, not just `test`.
    Before this PR: `process.env.TICKET_SECRET ?? (NODE_ENV === 'test' ? 't'.repeat(32) : null)`
    — only unit/CI test runs got a fallback; anything else threw if unset.
    After this PR:  `process.env.TICKET_SECRET ?? (NODE_ENV === 'production' ? null : 'tk'.repeat(16))`
    — now `development`, `staging`, unset/misconfigured `NODE_ENV`, or any preview
    deploy silently signs ticket lookup tokens (PDF download + QR check-in,
    see module header) with the hardcoded, source-visible constant
    `'tk'.repeat(16)` ("tktktktktktktktktktktktktktktktk"). The in-file doc
    comment at line 12-13 still says the old "test-only" behavior — the code
    and its own comment now disagree, which is the tell that this was an
    unintentional widening, not a deliberate decision.
    Impact: any internet-reachable deployment that isn't exactly
    `NODE_ENV=production` (the codebase's own AGENTS.md notes NODE_ENV "may be
    unset or 'development' even in a live environment" on Docker/Railway — the
    same risk the OTP_PEEK_ENABLED dual-guard was designed against, and whose
    docstring this PR trimmed) forges valid `scope:'ticket'` tokens with the
    known key, defeating the tamper-evident guarantee `verifyTicketToken()` is
    documented to provide for any ref/ct pair the attacker can guess or has
    partially observed (e.g. a leaked bookingRef).
    Production itself is protected — `TICKET_SECRET` is in the Zod
    production-required list (this PR added it there, and to CI env, correctly)
    — so this is scoped to non-prod-but-reachable environments.
    Fix: restrict the fallback to `NODE_ENV === 'test'` (restore prior scope),
    or better, make the fallback itself derived-but-still-required (fail closed)
    outside of automated test runs; update the stale docstring either way.

  Cat 1 otherwise clean: OTP codes use `crypto.randomInt` (lib/auth/otp.ts
  `generateCode`), salts use `crypto.randomBytes(16)`, OTP hash comparison uses
  `crypto.timingSafeEqual`, otpProof/session tokens use `crypto.randomUUID()` —
  no `Math.random()` on any secret path in the diff. No new `createCipher`/ECB/
  weak-KDF code introduced.

Cat 2 — Threat-model delta:

  No newly-created API route handlers in this diff (all `app/api/auth/**`
  files are modifications of pre-existing routes; the only new files are
  `components/auth/CustomerAccountMenu.tsx`, a migration, and a doc). The
  meaningful surface change is `proxy.ts` removing the "customer accounts
  paused" block that previously 410'd `/api/auth/register`, `/api/auth/otp/*`,
  `/api/auth/forgot-password*`, `/api/auth/reset-password`, `/api/auth/refresh`,
  and `/api/account/*` at the edge — those routes (built and reviewed in
  earlier issues) are now live again. Spot-checked `/api/auth/refresh` and
  `app/api/account/delete/route.ts` (both pre-existing, unchanged by this
  diff): refresh does reuse-detection + cascade revoke on `bb_rt`, and the
  account routes still gate on `requireCustomerAuth()`. Nothing indicates
  these were altered or weakened to enable the re-launch.
  `backfillGuestBookingsByEmail` (lib/booking/attachGuestBookingByPhone.ts) is
  a genuinely new function: it mass-`updateMany`s guest `Booking` rows by
  `buyerEmail` onto the new customer at register time. This is only reachable
  after the caller has proven ownership of that exact email via a consumed
  `otpProof` (register route checks `proof.email !== normalizedEmail`), so it
  carries the same authorization guarantee as the existing phone-based
  `backfillGuestBookingsForCustomer` — no new attack vector.
  All new/changed raw SQL (`lib/auth/otp.ts`, `lib/account/customerOtp.ts`,
  `lib/auth/sendOtp.ts`) uses `Prisma.sql` tagged templates — parameterized,
  no string concatenation of request input. No `eval`, no redirect target
  derived from request input, no SSRF-shaped `fetch(<param>)`.

Cat 3 — Rate-limit + abuse: no new gaps beyond the already-known per-email
  lockout item. `sendCustomerAccountOtp`/`sendOtp` keep the existing 3-sends/
  15-min-per-identifier limiter (now keyed on email instead of phone) and the
  generic proxy Layer-2 per-IP limiter still covers every non-safe-method
  `/api/*` call, including the re-enabled routes.

Cat 4 — Audit-log emission: no admin or payment mutation handlers touched by
  this diff. N/A.

Cat 5 — Authz surface: no newly-created handlers to compare against siblings.
  Clean.

Cat 6 — PII:

  P3 — ADVISORY:
  lib/logger.ts:54-107  ℹ️  P3: top-level `email` key is not in the Pino redact
  list, even though this PR systematically replaces `phone` — which IS redacted
  as a top-level path ("phone — top-level phone PII (Issue 007)") — with
  `email` as the primary request-body field across
  `/api/auth/login`, `/api/auth/register`, `/api/auth/otp/send`,
  `/api/auth/otp/verify`, `/api/auth/forgot-password`, and
  `/api/auth/forgot-password/verify`. `customerEmail` and `buyerEmail` are
  redacted, but the bare `email` field (and the `email` claim now carried in
  the `otpProof` JWT payload, `lib/auth/otpProof.ts`) is not.
  No currently-shipped code path in this diff actually logs a raw request body
  or JWT payload containing `email` (checked `withErrorHandler.ts` — it only
  logs `err.message`/`err.name`; `lib/notification/email.ts` logs
  `recipientLen`/`bodyLen`, not the address) — so this is latent, not actively
  firing. But per the project's own rule ("New sensitive fields... add to
  logger redact list in the same commit" — CLAUDE.md Project Rules / PII &
  Secrets), a field that just became the primary account identifier and
  replaced an already-redacted field should get the same top-level redact
  entry so a future `logger.info(body, ...)` or `logger.debug(parsed.data)`
  doesn't leak it. Fix: add `'email'` to the `redact.paths` array alongside
  the existing `'phone'` entry.
  `OtpAttempt.email` (new nullable column, prisma/schema.prisma) stores the
  address in plaintext — consistent with the pre-existing plaintext-phone
  treatment on the same table and `Customer.email` (already plaintext since
  Issue 007), so this is not a new deviation, just noted for completeness.

RECOMMENDED NEXT:
  - Fix the TICKET_SECRET fallback scope (P2) before this PR reaches any
    shared/staging deployment that's internet-reachable.
  - Add `'email'` to lib/logger.ts redact paths (P3) in this PR or a fast
    follow — cheap, same commit pattern the project already uses for `phone`.
  - Known P2 (customer login per-email lockout) and the phone-change
    correctness break are tracked separately per caller — not repeated here.

SUMMARY: 0 P1 · 1 P2 · 1 P3 · pinned to 026729fb
