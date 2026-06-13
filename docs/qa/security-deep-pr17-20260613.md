SECURITY-DEEP REVIEW — PR #17 "fix: pre-go-live BLOCKER hardening (B-02 through B-21)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/17
Base/Head: master ← fix/pre-go-live-blocker-hardening @ 99867928
Generated: 2026-06-13

No security-deep findings.
(Crypto, authz, rate-limit, audit-log, PII patterns clean.)

Notes:
- Cat 1 (Crypto): No crypto code changes. Auth paths (password hash, OTP, JWT) untouched.
- Cat 2 (Threat-model): No new endpoints. Existing cron routes tightened (fail-closed).
  TOTP bypass removal is a security improvement (hardcodes totpVerified=false).
- Cat 3 (Rate-limit): No new auth/login/SMS/payment endpoints. Cron routes use CRON_SECRET (internal auth, not rate-limited).
- Cat 4 (Audit-log): No new admin/payment mutation handlers. Existing audit patterns preserved.
- Cat 5 (Authz): No new handlers. Existing authz unchanged.
- Cat 6 (PII): No new DB columns. No new logger calls with PII. Email recipient lengths logged (not addresses).

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 99867928
