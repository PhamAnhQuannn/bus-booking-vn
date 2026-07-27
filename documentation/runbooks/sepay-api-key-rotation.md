# Runbook — rotate `SEPAY_API_KEY`

**Trigger:** a `payment.bank_transfer.webhook.invalid_bearer` alert, a suspected key leak
(key pasted into a log/ticket/screenshot, laptop compromise, contractor offboarding), or the
scheduled rotation below.

**Why this key matters more than most.** SePay does not sign webhook bodies — there is no HMAC,
no timestamp, no nonce. The static key **is** the entire authentication for
`POST /api/payments/bank_transfer/webhook` (`app/api/payments/bank_transfer/webhook/route.ts`).
Anyone holding it can post arbitrary `transferAmount` / `content` / `accountNumber` payloads and
mark bookings paid. The account-number check from #341 is *not* a control against a key holder —
they simply set the correct account number. Amount-match against `booking.totalVnd` and
booking-existence are defence in depth, not the perimeter.

Bank transfer is the only live payment rail, so this key is the crown jewel.

## Rotation procedure

Order matters: SePay must accept the new key before the app stops accepting the old one, or
deliveries 401 in the gap.

1. **Mint** a new key in the SePay dashboard (Webhooks → `bus-booking-prod`, webhook #46678).
   Do not delete the old one yet.
2. **Set** `SEPAY_API_KEY` to the new value in Vercel → Project → Settings → Environment
   Variables → **Production**. Update `.env.production.local` to match (untracked; keep a `cp`
   backup first — gitignored files have no `git checkout --` recovery path, per the 2026-07-21
   mistake-log entry, and **never** `>>` into it without checking the trailing byte).
3. **Redeploy** production. `getEnv()` is parsed once at module load, so the new key is not live
   until a fresh deploy — editing the env var alone does nothing to warm instances.
4. **Verify** before revoking: SePay dashboard → "Gửi thử" (test send). Expect HTTP 200 with body
   exactly `{"success": true}`. A 401 here means step 2 or 3 did not take effect — fix before
   continuing, do not proceed to step 5.
5. **Revoke** the old key in the SePay dashboard.
6. **Confirm** no `invalid_bearer` alerts fire in the following hour. If they do, a stale
   integration is still presenting the old key — find it before assuming it is an attacker.

## Responding to an `invalid_bearer` alert

The route logs at `error` and calls `captureException` on any well-formed request bearing the
wrong key. SePay only ever presents the correct key, so this is never routine traffic.

1. Check whether a rotation, redeploy, or SePay reconfiguration is in flight — that is the common
   benign cause, and step 4 above catches it.
2. If not: treat as a probe or leak. Rotate immediately using the procedure above.
3. Check `PaymentEvent` for rows in the alert window whose `providerTxnId` does not correspond to
   a real bank statement line. The reconcile sweeper (`lib/jobs/reconcilePayments.ts`) does not
   distinguish a forged event from a real one — only the bank statement does.
4. Cross-check any booking that moved to `paid` in the window against the Sacombank statement for
   account `030976167267`.

## Handling rules

- Vercel Production env only. Never in the repo, never in `.env.example`, never in a PR body,
  never pasted into an issue or chat.
- It is on the logger redact list — keep it there. The route deliberately never logs the presented
  token: logging a near-miss would leak key material, and logging length would confirm the real
  key's length.
- Rotate on a schedule (suggested: every 6 months) in addition to on-incident, so the procedure
  above is known to work before it is needed urgently.

## Why not HMAC

Transcribed from the vendor docs (https://docs.sepay.vn/tich-hop-webhooks.html): SePay's webhook
auth is an API key in the `Authorization` header (`Apikey <key>`), with no body-signature scheme
offered. Implementing a custom signature the vendor will never produce would be theatre. If SePay
ships body signing, adopt it — transcribe the exact scheme from their live docs and cite the URL
at the verification site, per the 2026-07-21 mistake-log rule.

Related: #361 (accepted with these compensating controls rather than "fixed").
