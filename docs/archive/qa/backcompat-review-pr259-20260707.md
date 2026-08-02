BACKCOMPAT REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)"
───────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/259
Base/Head: master ← feat/customer-auth-enable @ 026729fb
Decision:  (no review decision yet)
Size:      +1368 / -779 across 60 files
Project license: none declared ("private": true in package.json — internal app, not published)
Generated: 2026-07-07T00:00:00Z

Findings: 9  (P1: 3 · P2: 4 · P3: 2)

═══════════════════════════════════════════════════════════════════════════
P1 — BLOCKING
═══════════════════════════════════════════════════════════════════════════

lib/auth/authService.ts:36-39, 130-138  💥 P1: Response field renamed — `customer.phone` → `customer.email`.
  Before:  AuthResult.customer = { id, phone: string | null, displayName }
  After:   AuthResult.customer = { id, email: string | null, displayName }
  Surfaced verbatim in the POST /api/auth/login (customer branch) and POST
  /api/auth/register response bodies (app/api/auth/login/route.ts:114-116,
  app/api/auth/register/route.ts final return). Any consumer reading
  `customer.phone` off these responses gets `undefined`.
  Mitigating context: both endpoints were previously gated to an
  unconditional HTTP 410 for the entire customer scope (proxy.ts Layer 0.5,
  removed by this PR — see P2 finding below), so there is no currently-live
  production caller that ever received a 200 with `customer.phone` from
  these two routes. Still P1 on wire-contract grounds — any external
  doc/SDK/mobile-client stub written against the pre-pause phone-based
  contract will silently break the moment this ships, and there is no
  transition period (no `phone` field retained alongside `email`).
  Fix: consider returning both `email` and `phone` (phone nullable/omitted
  for email-registered accounts) for one release, or confirm via product/
  business owner that zero external integrations exist against the old
  shape before merging as-is.

prisma/schema.prisma:474 (Customer.email) vs lib/auth/authService.ts:73-83 (register)  💥 P1: Register's duplicate-detection relies on a DB unique constraint that does not exist on `Customer.email`.
  `register()` wraps `tx.customer.create({ data: { email, ... } })` in a
  try/catch that maps Prisma `P2002` (unique-constraint violation) to
  `AuthServiceError('EMAIL_TAKEN')` (lib/auth/authService.ts:88-91,
  test asserted at lib/auth/__tests__/authService.test.ts:99-108). But
  `Customer.email` is declared `email String?` with **no `@unique` /
  `@@unique`** (prisma/schema.prisma:474) — only `Customer.phone` carries
  `@unique` (schema.prisma:473). Contrast with a sibling model at
  schema.prisma:611 (`email String @unique`) which shows the pattern the
  team normally uses for email-uniqueness. Because no constraint exists,
  `P2002` can never fire on a duplicate email: two customers can register
  with the identical email, `EMAIL_TAKEN` is dead code, and every
  email-keyed lookup downstream (`login`, `forgotPassword`,
  `resetPassword`, all doing `findFirst({ where: { email } })`) becomes
  non-deterministic — the "wrong" account can resolve first, letting one
  registrant's login/reset flow touch another's account.
  Fix: add `@@unique([email])` (or a partial unique index
  `WHERE email IS NOT NULL` to keep multiple guest/soft-deleted NULLs
  legal, mirroring the `OtpAttempt_email_active_key` pattern already used
  in this same PR's migration) in a follow-up migration, and add the
  concurrent-duplicate-registration test the Mistake Log pattern calls for.
  This must land before (or atomically with) enabling customer
  registration in production.

app/api/auth/login|register|forgot-password (email-only lookups)  💥 P1: No migration/backfill path for legacy phone-only Customer rows — likely permanent account lockout.
  `login()`, `forgotPassword()`, and `register()` are now 100% keyed on
  `Customer.email` (lib/auth/authService.ts, lib/account/forgotPassword.ts)
  with no phone-based fallback. The removed proxy comment
  (proxy.ts diff, deleted lines) states customer accounts were "PAUSED
  (guest-only)" as of 2026-06-06 — implying customer registration/login
  was live and phone-based *before* that date. Any `Customer` row created
  before the pause with `phone` set and `email` NULL now has **no path to
  authenticate or self-recover**: login can't find it (`where: { email }`
  with email NULL never matches), forgot-password can't find it either,
  and register only creates new rows (a re-registration with a fresh email
  does not link back to the old phone-keyed account or its booking
  history).
  Fix (before deploying to a database that may hold pre-pause rows): run
  `SELECT count(*) FROM "Customer" WHERE phone IS NOT NULL AND email IS
  NULL AND "deletedAt" IS NULL;`. If non-zero, ship a one-time backfill/
  migration path (e.g., a "claim your account" flow keyed on phone +
  password, or an admin-assisted email-attach step) before this PR reaches
  any environment containing those rows. If the count is (and will always
  be) zero — e.g. this is a pre-launch/staging DB only — downgrade this
  finding and note it explicitly in the PR description so the next reader
  doesn't have to re-derive it.

═══════════════════════════════════════════════════════════════════════════
P2 — SHOULD FIX
═══════════════════════════════════════════════════════════════════════════

proxy.ts:184-219 (deleted block) + app/api/auth/login/route.ts:33-36  ⚠️  P2: Removed blanket HTTP 410 for the customer-auth surface — status codes change from 410 → {200, 400, 401, 409, 429} across 7 route prefixes.
  Removed: `/auth*`, `/account*` page redirects, and 410
  `{ error: 'customer_accounts_disabled' }` for `/api/auth/register`,
  `/api/auth/otp/*` (except test-peek), `/api/auth/forgot-password*`,
  `/api/auth/reset-password`, `/api/auth/refresh`, `/api/account*`, plus
  the customer branch of `/api/auth/login` (route-level 410
  `customer_login_disabled`, also removed). This is the PR's stated intent
  ("enable customer auth") and is verified by updated tests (e.g.
  app/api/auth/login/__tests__/route.test.ts:80-115 now expects 200/401
  instead of 410). Flagging per the Cat-1 status-code-change rule: anything
  that was built to treat this surface as permanently-off (synthetic
  uptime checks expecting 410, a stale service-worker cache, ops runbooks,
  partner docs) will now see live account-creation/session side effects
  instead of a no-op rejection.
  Fix: none required functionally (this is the intended feature), but
  confirm no monitoring/synthetic check hard-asserts 410 on these paths
  before merge, and update any external-facing docs that still describe
  the "customer accounts paused" state.

lib/auth/otpProof.ts:105-138 (verifyOtpProof) — re-exported via lib/auth/index.ts  ⚠️  P2: Return shape widened/changed — `{ phone: string; jti: string }` → `OtpProofPayload { email?: string; phone?: string; jti: string }`.
  Both `phone` and the new `email` are now optional where `phone` used to
  be a required non-null string. `verifyOtpProof` is re-exported from the
  `lib/auth` barrel (lib/auth/index.ts), so per this skill's Cat-3 rule
  ("P1 if re-exported from a barrel") this would normally be P1; downgraded
  to P2 because every current in-repo call site was updated in this same
  commit (lib/account/resetPassword.ts:30, app/api/auth/register/route.ts,
  app/api/auth/otp/verify/route.ts) and each now null-checks the relevant
  field. No out-of-tree consumers exist (internal monorepo, not a
  published package). Still worth a P2 because the security-sensitive
  proof-verification contract got looser (a payload with neither `email`
  nor `phone` is now structurally representable at the type level, guarded
  only by the runtime `if (!email && !phone) return null` added at
  otpProof.ts:116) — a future call site that destructures `proof.phone`
  without a null-check will typecheck-fail loudly (good) but any `as`
  cast or `!` non-null assertion added under time pressure would silently
  reintroduce the old unsafe-access bug.
  Fix: none blocking; just keep the runtime guard in sync with the type,
  and consider a discriminated union (`{ purpose: 'op_pwd_reset'; phone:
  string } | { purpose: 'otp_proof' | 'reset_password' | 'phone_change';
  email: string }`) instead of two independent optionals, which would make
  "email XOR phone" a compile-time invariant instead of a runtime check.

lib/config/env.ts:189 (production superRefine) + .env.example:34-36  ⚠️  P2: `TICKET_SECRET` added to the production-required env-var list; no `phone`/`email` relation but a real deploy-time contract narrowing bundled into this PR.
  `TICKET_SECRET` is now required whenever `NODE_ENV === 'production'`
  (lib/config/env.ts, superRefine block). Any already-running production
  deployment that never set `TICKET_SECRET` will fail closed at boot after
  this ships (Zod `superRefine` throws during `next build`/server start —
  same class of issue as the CLAUDE.md Mistake Log WT-20 entry for
  `REFRESH_TOKEN_SECRET`). CI env was correctly updated in the same commit
  (.github/workflows/ci.yml:49,57 add
  `TICKET_SECRET: ci-test-ticket-secret-not-for-prod`), so CI won't catch
  this — only a real production/staging boot without the var set would.
  Separately, `lib/ticketing/ticketToken.ts:59` widened the *dev* fallback
  secret from `NODE_ENV === 'test'`-only to `NODE_ENV !== 'production'`
  (i.e. now also covers `development`) and changed its literal value from
  `'t'.repeat(32)` to `'tk'.repeat(16)` — any ticket-lookup token already
  issued in a dev/staging environment that was relying on the old fallback
  becomes unverifiable after this deploys there.
  Fix: confirm `TICKET_SECRET` is already set in every production/staging
  env target before merge (per the WT-20 rule: grep the deploy env docs/
  secrets manager, don't just check CI).

Two auth-route request bodies swap their sole identifying field, `phone` → `email` (app/api/auth/otp/send, /otp/verify, /register, /forgot-password, /forgot-password/verify — lib/core/validation/auth.ts schemas)  ⚠️  P2: Request-shape break, same field-rename class as the Cat-1 response check but on the request side.
  `otpSendInput`, `otpVerifyInput`, `registerInput`, `loginInput`, and the
  new `CustomerForgotPasswordVerifySchema` all replace `phone: phoneSchema`
  with `email: emailSchema` (lib/core/validation/auth.ts:23-46,
  lib/auth/types.ts:128-136). A caller still POSTing `{ phone, ... }`
  now gets `400 { error: 'INVALID' }` instead of proceeding.
  Mitigating context: identical to the P2 finding above — every one of
  these five routes was already unconditionally 410'd for all request
  bodies before this PR (proxy.ts Layer 0.5), so no live caller could have
  been succeeding with the old `{ phone }` shape in the first place. Kept
  at P2 (not P1) for that reason — this is a "new contract for a
  newly-enabled surface" rather than a break to a working integration, but
  it's still worth a single line in the PR description/changelog so a
  future reader (or an old mobile-app build predating the June 2026 pause,
  if one exists) isn't surprised.

═══════════════════════════════════════════════════════════════════════════
P3 — ADVISORY
═══════════════════════════════════════════════════════════════════════════

app/api/auth/otp/test-peek/route.ts:20-24, lib/notification/esms.ts:66-72  ℹ️  P3: `getTestOtp`/new `stashTestOtp` keying changed from phone-only to "phone or email" (`const key = email || phone`).
  Test/E2E-only surface, already gated `NODE_ENV !== 'production' &&
  OTP_PEEK_ENABLED === 'true'` (unchanged). No production exposure. Update
  any E2E specs still calling `?phone=` for the customer OTP flow to
  `?email=` (the diff already migrates
  app/api/auth/otp/verify/__tests__/route.test.ts and others — spot-check
  `e2e/**` for any remaining `test-peek?phone=` against the *customer*
  flow specifically; the operator OTP flow still legitimately uses phone).

.env.example:9-16, lib/config/env.ts:64-68  ℹ️  P3: Unrelated-to-auth default change bundled into this PR — `VIETQR_BANK_BIN`/`VIETQR_ACCOUNT_NUMBER`/`VIETQR_ACCOUNT_NAME` defaults switch from Agribank/"BUS BOOK VN" to Sacombank/"CTNHH MINH QUAN", and a new `VNPAY_ENABLED` flag (default false) gates the previously-`PAYMENTS_STUB`-gated VNPay production-credential validation. Not a schema/API/dependency break per this skill's categories, and these are `z.string().default(...)` values only used when the corresponding env var is unset — but it's a payments-identity change riding in an auth-migration PR, worth a callout in the PR description for reviewer awareness (any deployed environment relying on the old bank-transfer defaults without an explicit override will silently start showing the new payee).

═══════════════════════════════════════════════════════════════════════════
NOT FLAGGED (checked, clean)
═══════════════════════════════════════════════════════════════════════════

- prisma/migrations/20260703030000_otp_email_column/migration.sql — safe,
  additive-only: `ALTER COLUMN "phone" DROP NOT NULL` (widening, never
  destructive), `ADD COLUMN "email" TEXT` (nullable, no backfill needed),
  plus a WHERE-scoped partial unique index and a plain composite index.
  The plain composite index (`OtpAttempt_email_createdAt_idx`) is also
  declared as `@@index([email, createdAt(sort: Desc)])` in
  prisma/schema.prisma:501 — matches the Issue 007 Mistake Log rule
  (non-partial raw-SQL indices must also be declared in the Prisma DSL).
  The partial unique index correctly stays SQL-only (Prisma DSL can't
  express `WHERE` clauses) per the same rule. Existing phone-based partial
  unique index (`OtpAttempt_phone_active_key`) is left untouched, so the
  operator-side and phone-change OTP flows are unaffected.
- No `package.json` / lockfile changes in this diff — Cat 4/5/6 (license,
  typosquat, lifecycle-script, lockfile-drift) all N/A for this PR.
- `ForgotPasswordVerifySchema` (operator, phone-based) was NOT renamed —
  a new sibling `CustomerForgotPasswordVerifySchema` (email-based) was
  added alongside it (lib/auth/types.ts:128-136, lib/auth/index.ts:52).
  `app/api/op/auth/forgot-password/verify/route.ts` still imports and uses
  the original, unmodified schema. No break to the operator flow.
  Initially suspected a Cat-3 rename break; verified false positive by
  grepping both call sites.
- `AuthError` union member renamed `PHONE_TAKEN` → `EMAIL_TAKEN`
  (lib/auth/authService.ts:47) — internal error-code enum, not
  client-visible; the route handler maps it to the same wire-level
  `{ error: 'invalid_credentials' }` / HTTP 409 both before and after
  (app/api/auth/register/route.ts). No contract change at the boundary.
- Client-side session helpers (`getAccessToken`, `getCustomerPhone`, etc.)
  moved from `app/(customer)/auth/register/page.tsx` into the new
  `lib/auth/clientSession.ts` and renamed to email-based equivalents
  (`getCustomerEmail`). This is app-internal (not a published package or
  cross-domain barrel contract); all 2 call sites
  (CustomerForm.tsx, ReviewClient.tsx) were updated in the same commit.
  Not flagged as Cat-3 since nothing outside this app tree could have
  depended on it.

RECOMMENDED NEXT:
  - Before merge: run the `Customer` phone-only/email-null row count query
    (P1 #3) against the target deploy database(s). If non-zero, this PR
    needs a backfill/account-recovery plan, not just a code merge.
  - Before merge: add `@@unique` (or a partial-unique, NULL-tolerant
    equivalent) on `Customer.email` in a follow-up migration (P1 #2) —
    the `EMAIL_TAKEN` error path is currently unreachable.
  - Before merge: confirm `TICKET_SECRET` is set in every real deploy
    target's env (P2, TICKET_SECRET).
  - Decide and document (one line in the PR description is enough) whether
    the `customer.phone`→`customer.email` response shape and the
    phone→email request-body renames are acceptable as a hard cutover
    (no old-shape compatibility window) given the pre-pause history —
    this report assumes "acceptable, but should be a stated decision" per
    the mitigating-context notes above.
  - If reviewer already requested changes: /pr-feedback-route 259

SUMMARY: 3 P1 · 4 P2 · 2 P3 · pinned to 026729fb
