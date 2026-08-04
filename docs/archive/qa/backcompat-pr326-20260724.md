BACKCOMPAT REVIEW — PR #326 "feat(notifications): email customer confirmations + unmatched-payment notices"
───────────────────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/326
Base/Head: fix/bank-transfer-reconcile-orphan ← feat/customer-email-notifications @ a55c3c6b
Decision:  (none yet)
Size:      +280 / -29 across 10 files
Project license: private (no `license` field in package.json)
Generated: 2026-07-24

Scope: email delta only — `gh pr diff 326` (base = `fix/bank-transfer-reconcile-orphan`, NOT `master`).
No `app/api/**` route file, `prisma/schema.prisma`, `package.json`, or lockfile is touched by this diff, so
Cat 1 (API shape), Cat 2 (schema), Cat 4/5/6 (deps/lockfile/typosquat) are N/A this PR. Findings below are
custom checks against the six review points requested, closest-mapped to Cat 3 (shared surface) severities.

Findings: 4  (P1: 0 · P2: 2 · P3: 2)

════════════════════════════════════════════════════════════════════════════════
P2 — SHOULD FIX
════════════════════════════════════════════════════════════════════════════════

lib/notification/email.ts:126-134  ⚠️ P2: Stub-gate decoupling turns a loud misconfiguration into a silent one.

  Before (this PR): `notifyStubbed()` read `NOTIFY_STUB`. With `NOTIFY_STUB=false` (real mode intended)
  and `EMAIL_PROVIDER` unset/`'stub'`, `sendEmail` took the "real" branch, found no provider wired, and
  returned `{ ok:false, error:'real_email_provider_not_wired' }` + `logger.warn('email.real.not-wired')`.
  The dispatcher (`dispatchNotifications.ts`) then marked the row `status:'failed'`, retried with backoff,
  eventually exhausted at `MAX_ATTEMPTS=5`, and fired `captureException` (Sentry) on every failed attempt.
  That misconfiguration was **impossible to miss**.

  After (this PR): `emailStubbed()` reads `EMAIL_PROVIDER` only. The exact same env combo
  (`NOTIFY_STUB=false`, `EMAIL_PROVIDER` unset/`'stub'`) now takes the stub branch cleanly — returns
  `{ ok:true, externalRef: 'stub_email_...' }`, logs `INFO` (not `WARN`), and the dispatcher marks the row
  `sent`. No retry, no alert, no failed-row signal. The row *looks* delivered forever.

  This is the PR's explicit, intended design (decouple email from SMS gating — confirmed correct and
  matches the updated `documentation/guides/10-setup-resend.md`, which prescribes `NOTIFY_STUB=true` +
  `EMAIL_PROVIDER=resend` as the target prod config). It is also NOT a currently-live regression: prod
  today runs fully stubbed (`PAYMENTS_STUB`/`NOTIFY_STUB=true`, per project memory), so no deployment
  exists today that hits the old "real-but-not-wired" branch.

  The residual risk is forward-looking: the project's own `documentation/feature-implementation/FI-014-
  notifications/README.md` ("HIGH — Must confirm NOTIFY_STUB=false in production env") and
  `documentation/design-specifications/DS-006-background-jobs/README.md:933` (table row: `Notifications |
  NOTIFY_STUB=true | Logged but not sent | eSMS/Resend live dispatch`) both still describe ONE flag
  governing both channels. Anyone flipping `NOTIFY_STUB=false` for real SMS off that stale doc, without
  separately setting `EMAIL_PROVIDER=resend`, now gets zero signal that email is still stubbed — every
  booking-paid/expired email "succeeds" while never leaving the stub path.

  Verified no test/CI dependency on the old gating: `.github/workflows/ci.yml` sets neither
  `NOTIFY_STUB` nor `EMAIL_PROVIDER` (defaults apply either way); `vitest.setup.ts` only forces
  `NOTIFY_STUB` default; `lib/notification/__tests__/email.test.ts` never sets either var; no test
  references the removed `real_email_provider_not_wired` string.

  Fix: emit a `logger.warn` (not silence) when `NOTIFY_STUB=false` and `EMAIL_PROVIDER` is still
  `'stub'` — i.e., flag the half-migrated state explicitly instead of only handling the fully-migrated
  and fully-stub states. Also correct the DS-006 table row and FI-014 gap note to describe email/SMS as
  independently gated, so the doc doesn't keep steering ops toward the wrong mental model.

lib/config/env.ts:312 vs lib/notification/esms.ts:95  ⚠️ P2: `OPS_EMAIL` name collision — two unrelated
sources of truth under the identical identifier.

  `lib/config/env.ts:312` already declares `OPS_EMAIL: z.string().email().optional()` — an
  operator-configurable env var, consumed via `getEnv().OPS_EMAIL` by
  `app/api/op/charter/[id]/decline/route.ts` (charter-decline ops alert).

  This PR adds a second, independent `export const OPS_EMAIL = 'hotro@lenxevn.com'` — a **hardcoded
  literal** — in `lib/notification/esms.ts:95`, re-exported through the `@/lib/notification` barrel
  (`lib/notification/index.ts`) and consumed by `lib/jobs/reconcilePayments.ts` for the new
  `opsUnmatchedPayment` alert recipient.

  No compile-time collision (different import paths: `getEnv().OPS_EMAIL` vs
  `import { OPS_EMAIL } from '@/lib/notification'`), so nothing breaks today — but it is a live
  correctness trap: if ops ever rotates the support inbox via the `OPS_EMAIL` env var (the discoverable,
  documented mechanism), they will reasonably expect every "ops alert" to follow — but the new
  unmatched-bank-transfer alert will keep going to the hardcoded `hotro@lenxevn.com` silently, with no
  error, no warning, and no obvious place to look (the two `OPS_EMAIL`s live in different files with
  different shapes).

  Fix: rename the new constant (e.g. `NOTIFY_OPS_EMAIL` / `RECONCILE_OPS_EMAIL`) or route it through
  `getEnv().OPS_EMAIL ?? 'hotro@lenxevn.com'` so there is exactly one `OPS_EMAIL` concept in the codebase.

════════════════════════════════════════════════════════════════════════════════
P3 — ADVISORY
════════════════════════════════════════════════════════════════════════════════

app/api/payments/momo/webhook/__tests__/route.test.ts:229  ℹ️ P3: New channel-switch logic exercised but
not asserted.

  The fixture sets `buyerEmail: 'buyer@example.com'` (line 106-107), which now drives
  `lib/payment/processWebhook.ts`'s new `customerChannel`/`customerRecipient` branch (email vs SMS,
  buyerEmail vs buyerPhone). The test's only assertion on the enqueued rows is
  `expect(templates).toEqual(['customerBookingPaid', 'operatorNewBooking'])` — it never checks `channel`
  or `recipient`. A regression in that branch (e.g. `channel:'email'` paired with `recipient:
  booking.buyerPhone`) would pass this test silently. Contrast with `lib/jobs/__tests__/
  reconcilePayments.int.test.ts` and `reconcilePayments.test.ts`, both updated in this same PR to assert
  `channel`+`recipient` explicitly for the sweeper's own new sends — the momo webhook test wasn't given
  the equivalent assertion.
  Fix: add `expect(calls.find(c => c[0].template === 'customerBookingPaid')[0]).toMatchObject({ channel:
  'email', recipient: 'buyer@example.com' })`.

lib/config/env.ts:373-379 vs :515-523  ℹ️ P3: Duplicate `superRefine` guard (informational only — already
flagged in `docs/qa/security-deep-pr326-20260724.md`).

  This PR's new `EMAIL_PROVIDER==='resend' && !RESEND_API_KEY` boot check (L373-379) is byte-for-byte
  identical to the pre-existing check at L515-523 (Issue 080). Because the pre-existing check already
  covered this, item 5 of the review brief ("does the new superRefine addition break any env combo that
  currently boots") has a clean answer: **no** — any env with `EMAIL_PROVIDER=resend` and no
  `RESEND_API_KEY` was ALREADY failing to boot before this PR; the new check changes nothing observable.
  Pure redundancy, zero behavior delta, safe to leave or dedupe.

════════════════════════════════════════════════════════════════════════════════
CLEAN — reviewed, no finding
════════════════════════════════════════════════════════════════════════════════

- **Union additions** (`EmailTemplate` +4, `SmsTemplate` +3, `SUBJECTS` +4 keys) — purely additive.
  `SUBJECTS` is `Record<string, string>` (not keyed to the union), so no exhaustiveness requirement.
  `esms.ts`'s `renderTemplate` switch has a `default:` branch (line ~181) — new template values can't
  fall through unhandled, and all 3 new `SmsTemplate` values got explicit cases in this diff. No
  exhaustive-switch-without-default consumer found for `EmailTemplate` either (only usage is
  `template: EmailTemplate | string`).
- **New barrel exports** `SUPPORT_EMAIL` / `SUPPORT_HOTLINE` — no prior symbols under those names
  anywhere in the codebase; clean additions. (`OPS_EMAIL` is the one exception — see P2 above.)
- **Channel switch** (customer paid/expired notices: SMS→email when `buyerEmail` present) — grepped
  `app/**` and `lib/**` for any consumer/report/dashboard that filters `NotificationLog` by
  `channel:'sms'` scoped to `customerBookingPaid`/`customerBookingExpired`/`customerPaymentReview`/
  `customerPaymentUnverified`/`opsUnmatchedPayment` — none found. `buyerEmail` is nullable
  (`String?`, pre-existing schema, not touched by this PR) with an explicit SMS fallback
  (`booking.buyerEmail ? 'email' : 'sms'`) at all three call sites in `reconcilePayments.ts` and the one
  in `processWebhook.ts`, so legacy null-email rows keep the old SMS path — not a hard cutover.
- **CI / e2e reliance on old gating** — `.github/workflows/ci.yml` sets neither `NOTIFY_STUB` nor
  `EMAIL_PROVIDER` (both default); no `e2e/**` spec references either var; no test asserts the removed
  `real_email_provider_not_wired` error string. Old-gating removal is test-blind-safe.
- **Dependencies / lockfile** — `package.json` / `pnpm-lock.yaml` not present in this diff at all
  (verified via the full `diff --git` file list: 10 files, all under `documentation/`, `lib/`). No new
  dep, no typosquat surface, no license question this PR.
- **Cat 1 / Cat 2** — no `app/api/**/route.ts` or `prisma/schema.prisma` hunks in this diff. N/A.
- **`lib/jobs/reconcilePayments.ts`'s `enqueuePendingNotification`** gained an optional `channel?:
  'sms'|'email'` field defaulting to `'sms'` — module-private function, not exported, and the added
  field is optional, so this is backward-compatible even if it were exported.

RECOMMENDED NEXT:
  - Address the two P2s before flipping `EMAIL_PROVIDER=resend` in any real environment: (1) add the
    half-migrated-state warning in `emailStubbed()`'s caller and fix the stale NOTIFY_STUB-governs-email
    doc lines (DS-006, FI-014); (2) rename or unify the new `OPS_EMAIL` constant with the existing
    `getEnv().OPS_EMAIL`.
  - P3s are advisory: tighten the momo webhook test's assertion; dedupe the redundant superRefine block
    (already noted in the security-deep review, no action required to merge).
  - No P1s — safe to merge from a back-compat/supply-chain standpoint.

SUMMARY: 0 P1 · 2 P2 · 2 P3 · pinned to a55c3c6
