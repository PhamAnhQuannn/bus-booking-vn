CODE REVIEW — PR #339 "feat(notification): branded HTML emails — logo + ticket detail rows" @ c3778e16
────────────────────────────────
Diff scope: 4 files, +365 / -15 lines
Files: lib/notification/emailBody.ts (new), lib/notification/email.ts, lib/jobs/generateTicketPdfs.ts, lib/notification/__tests__/emailBody.test.ts (new)

PRIORITY 1 — Block push, fix first:
  [TEST / SHAPE-DRIFT] lib/jobs/__tests__/generateTicketPdfs.test.ts:146
    Asserts the OLD ticketReady payload exactly:
      expect(payload).toEqual({ bookingRef, verifyUrl: '/verify/signed.lookup.token', ticketUrl })
    The enrich change removes `verifyUrl` and adds buyerName/route/departureAt/
    ticketCount/vehicle/operator/amount → this `toEqual` fails and CI goes red.
    Also `mockMintToken` + vi.mock('@/lib/ticketing/ticketToken') are now dead
    (source no longer mints a token). This is the CLAUDE.md Mistake-Log pattern
    (Issue 013/019: update every assertion in the SAME commit a payload/where
    shape changes) → auto-P1.
    Fix: update the assertion to the new payload (assert stable fields exactly;
    departureAt via contains-'11/06/2026' + '05:00' to avoid ICU-format brittleness);
    drop the now-unused mintToken mock, hoisted var, and beforeEach stub.

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

Notes (checked, NOT findings):
  - HTML injection: every dynamic value (title, bodyLines, detail rows, button
    label+url) passes through escapeHtml (escapes & < > "); attributes are
    double-quoted → safe. ✓
  - PII: buyerName/route/plate/operator go only to the booking's own buyerEmail
    (the customer's ticket). No new authz surface — generateTicketPdfs already
    gates on paid status. ✓
  - Remote logo URL is built from PUBLIC_BASE_URL (env/const), not user input →
    no SSRF/open-redirect; it's an <img src> rendered client-side, not a
    server fetch. ✓
  - renderEmailBody wraps parse+build in try/catch → never throws; bad payload
    degrades to raw text so delivery is never blocked. ✓
  - formatVnd treats totalVnd as whole đồng — confirmed (10k fare → 10000 →
    "10.000đ"; test fixture 150000 → "150.000đ"). ✓
  - departureAt formatted with explicit timeZone 'Asia/Ho_Chi_Minh' → deterministic
    regardless of runner TZ. ✓

SUMMARY: 1 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Fix the P1 (update generateTicketPdfs.test.ts assertion + drop mint mock) before CI.
  → No other blockers.
