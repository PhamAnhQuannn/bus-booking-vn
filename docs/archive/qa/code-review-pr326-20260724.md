CODE REVIEW — PR #326 "feat(notification): customer email notifications" @ a55c3c6b
────────────────────────────────
Scope reviewed: EMAIL DELTA ONLY — `git diff fix/bank-transfer-reconcile-orphan...HEAD`
Diff scope: 10 files, +280 / -29 lines
Base pin: fix/bank-transfer-reconcile-orphan (NOT master — excludes stacked #324 Bug-B work)

Files: documentation/guides/10-setup-resend.md, lib/config/env.ts,
lib/jobs/reconcilePayments.ts (+ .test + .int.test), lib/notification/{email,esms,index}.ts
(+ esms.test), lib/payment/processWebhook.ts

═══════════════════════════════════════════════════════════════════
VERDICT: Clean delta. No P1. The safety-critical logic (never-pay-on-guess,
per-booking suspectedUnresolved threading, once-only unique(bookingId,template))
is correct. Two P2 (delivery-safety + a test gap on the webhook path), three P3.
═══════════════════════════════════════════════════════════════════

SCRUTINY CHECKLIST (all PASS):
  ✓ Stub gate `process.env.EMAIL_PROVIDER !== 'resend'` — unset→stub (matches Zod
    `.default('stub')`), ''→stub, only exact 'resend'→real. Consistent with the
    prior `notifyStubbed()` raw-read pattern. Does NOT defeat the schema default.
    Real send path still routes RESEND_API_KEY through getEnv() (email.ts:147).
  ✓ `buyerEmail ? 'email' : 'sms'` + `buyerEmail ?? buyerPhone` — channel/recipient
    always paired. buyerEmail is `String?` (nullable, schema.prisma:323) so the
    legacy-null fallback is meaningful, not dead. dispatchRow() routes on
    row.channel, so nothing downstream assumes SMS.
  ✓ `suspectedUnresolved` declared INSIDE the candidates loop (reconcile:471, loop
    from :300) — per-iteration, no cross-booking state leak. Expiry template chosen
    by a single ternary → never BOTH customerPaymentUnverified + customerBookingExpired;
    always exactly one when expired>0, none when the guarded UPDATE matches 0 (correct).
  ✓ unique(bookingId, template) once-only: ops alert + review fire once across ticks
    (P2002 swallowed in enqueuePendingNotification). Different templates never collide;
    held→review then lapse→unverified is the intended two-message arc.
  ✓ Template bodies: every payload key interpolated is supplied at each call site
    (review: bookingRef/supportEmail/hotline; unverified: +route/departureAt; ops:
    bookingRef/amountVnd/providerTxnId). No missing keys, no PII beyond ref + route +
    support contacts; ops copy carries no customer name/phone/email.
  ✓ Reconcile channel+recipient asserted in int test (channel:'email',
    recipient:'recon-bt@test.invalid' / 'hotro@lenxevn.com') and unit test.
  ✓ Out-of-diff momo route test unaffected — asserts templates+status only, not channel.

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  [TEST / PAYMENT PATH] lib/payment/processWebhook.ts:398-406
    The webhook customer-confirmation switch (channel=email, recipient=buyerEmail)
    has NO test asserting the new channel/recipient. The only covering test
    (app/api/payments/momo/webhook/__tests__/route.test.ts:229) asserts template +
    status='pending' only — it would stay green even if the channel routing regressed
    to SMS-to-an-email-address. The reconcile twin IS covered; the webhook twin is not.
    Fix: assert channel:'email' / recipient=buyerEmail on the customerBookingPaid
    createNotificationLog call in the webhook route test (fixture already sets
    buyerEmail:'buyer@example.com' at route.test.ts:107).

  [FAILURE MODE / DELIVERY] lib/notification/dispatchNotifications.ts:102-108
    SMS dispatch passes `requestId: row.id` as the eSMS idempotency key; the email
    branch calls sendEmail() with NO idempotency token. A crash between a successful
    Resend send and the status='sent' UPDATE re-claims the row next tick → duplicate
    customer email. This infra pre-dates #326, but #326 is what promotes the customer
    booking-outcome notices (paid / review / unverified / expired) from the idempotent
    SMS rail onto this unguarded email rail — so the PR newly exposes it. Low harm
    (dup email, not double-charge) but on the now-primary customer channel.
    Fix: pass Resend's Idempotency-Key header (use row.id) in sendViaResend, mirroring
    the SMS requestId guard. Reasonable to defer as a tracked follow-up if noted.

PRIORITY 3 — Address when convenient:
  [HYGIENE / DEAD CODE] lib/config/env.ts:373-379
    This block duplicates a pre-existing identical check at :514-523 (same superRefine
    callback, same condition `EMAIL_PROVIDER==='resend' && !RESEND_API_KEY`, same path,
    same message). Boot still fails correctly, but the issue is emitted TWICE. The new
    block appears added without noticing the existing one. Fix: drop :373-379 (keep the
    original :514-523) or vice-versa.

  [TEST QUALITY] lib/jobs/__tests__/reconcilePayments.int.test.ts:143-144,
                 lib/notification/__tests__/esms.test.ts:581-583
    Tests re-type the literals 'hotro@lenxevn.com' / '1900 xxxx' instead of importing
    SUPPORT_EMAIL / OPS_EMAIL / SUPPORT_HOTLINE from lib/notification. The int test uses
    the real modules and could reference the exported consts directly — matches the
    CLAUDE.md rule "assertions on generated output should reference the exported
    constant, not re-type the pattern." (The unit test mocks the barrel, so re-typing
    there is unavoidable — this note is mainly for the int test + esms fixture.)

  [OPERATIONAL NOTE] lib/jobs/reconcilePayments.ts:435-440, processWebhook.ts operator notice
    operatorNewBooking still enqueues with the default 'sms' channel to the operator
    phone. The documented go-live config (guide 10) keeps NOTIFY_STUB=true, so operators
    receive NOTHING while customers get real email. Not a regression from this PR (operator
    was always SMS), but the "email as the customer channel" go-live leaves the operator
    channel dark. Flag for the operator whether that is acceptable at launch.

SUMMARY: 0 P1, 2 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → P2 webhook-channel test: add before merge — cheap, closes the one untested branch
    on a payment route.
  → P2 email idempotency: fix or file a tracked follow-up; acceptable to ship with the
    known low-harm dup-email risk if explicitly accepted.
  → P3 duplicate superRefine: 5-second delete, do it in this PR.
  → P3 test-const + operator-channel note: defer / product decision.
