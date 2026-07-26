SECURITY-DEEP REVIEW — PR #339 "feat(notification): branded HTML emails — logo + ticket detail rows"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/339
Base/Head: master ← feat/ticket-email-render @ c3778e16
Decision:  (none yet)
Generated: 2026-07-24

Findings: 1  (P1: 0 · P2: 0 · P3: 1)

P1 — BLOCKING:
  (none)

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  lib/jobs/generateTicketPdfs.ts:106  ℹ️  P3: enriched ticketReady payload now
    persists passenger name + route + plate + operator in NotificationLog.payload
    at rest (plaintext). Same KIND of PII the existing SMS payloads already store
    (operatorNewBooking stores buyerPhone; bookingPendingCash stores name/route),
    so not a new exposure class — but it widens what a NotificationLog dump reveals.
    Action: ensure the deferred NotificationLog PII-retention/purge follow-up
    (already filed) covers payload contents. No code change required in this PR.

Checked, clean:
  - Crypto (Cat 1): no cipher/hash/random-token code; this PR REMOVES the
    mintTicketToken call. ✓
  - Threat-model (Cat 2): HTML injection — buyerName/route/operator are
    customer-controlled but every value passes through escapeHtml before entering
    the email HTML (double-quoted attributes), and the HTML is sent to Resend, not
    rendered in our own DOM (no dangerouslySetInnerHTML). renderEmailBody's
    JSON.parse reads OUR OWN NotificationLog.payload (we wrote it), not raw network
    input, and is try/catch-guarded. No eval/exec/redirect/SSRF. ✓
  - Rate-limit (Cat 3): no new endpoint. ✓
  - Audit-log (Cat 4): no admin/payment mutation handler. ✓
  - Authz (Cat 5): no new handler; generateTicketPdfs already gates on paid status. ✓
  - PII in logs (Cat 6): email.ts logs template + externalRef + *lengths*
    (bodyLen/recipientLen), never the recipient or body. No new PII log sink. ✓

RECOMMENDED NEXT:
  - No blocking findings. P3 is an at-rest note routed to the existing PII-retention
    follow-up, not a change for this PR.

SUMMARY: 0 P1 · 0 P2 · 1 P3 · pinned to c3778e16
