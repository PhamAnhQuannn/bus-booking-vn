SECURITY-DEEP REVIEW — PR #322 "fix(payments): bank_transfer webhook matched wrong-case bookingRef → every transfer no-op"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/322
Base/Head: master ← fix/bank-transfer-ref-case-mismatch @ 9b0a580
Generated: 2026-07-23

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

No security-deep findings.
(Crypto, authz, rate-limit, audit-log, injection, PII patterns clean.)

Category walk (payment-path change — reviewed with care):

  • Cat 1 Crypto — no crypto in the diff (string reconstruction + test assertions).
  • Cat 2 Threat-model — no new endpoint. The rebuilt orderRef is composed only from
    regex-captured, charset-constrained segments (`\d{4}`, `[0-9a-z]{4}`) and flows into a
    PARAMETERIZED `prisma.booking.findUnique` — never raw SQL / shell / HTML / redirect. No
    new attack surface. Correcting the case does not weaken any check: a spoofed webhook still
    needs the valid SEPAY_API_KEY (auth unchanged), a real bookingRef in the memo, and
    amount ≥ totalVnd (processWebhook guards unchanged) to mark a booking paid.
  • Cat 3 Rate-limit — no new endpoint; the webhook's edge exemption is pre-existing/unchanged.
  • Cat 4 Audit-log — no new mutation handler. The PaymentEvent + append-only ledger trail is
    untouched; this change only lets the existing paid path be reached (it was silently
    no-op'ing before).
  • Cat 5 Authz — no new handler; the shared-secret webhook auth is unchanged.
  • Cat 6 PII — verifyWebhook is pure; no new log lines, no PII, no new DB column.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 9b0a580

RECOMMENDED NEXT:
  - Clean. No security remediation required before merge.
