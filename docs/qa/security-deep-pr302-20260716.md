SECURITY-DEEP REVIEW — PR #302 "feat: hero redesign, audit fixes, brand logo, analytics"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/302
Base/Head: master ← feat/vercel-analytics @ ff2e2ac3
Decision:  (none yet)
Generated: 2026-07-16T22:10+07:00

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

No security-deep findings.
(Crypto, authz, rate-limit, audit-log, PII patterns clean.)

Category walk:
- Cat 1 crypto: no crypto primitives touched. Pattern grep over added lines: zero hits for
  Math.random/createCipher/createHash/eval/exec/$queryRaw/innerHTML/dangerouslySetInnerHTML.
- Cat 2 threat-model delta: no new app/api handlers (manifest.ts + opengraph-image.tsx are
  Next metadata routes with no user input; opengraph reads a static public/brand path via
  fs — no user-controlled path segment). booking/layout.tsx reads ?tripId= into client store
  only; server-side Zod on /api/holds remains the validation boundary. The silent
  redirect-from-state path was REMOVED (replaced by static interstitial) — net reduction of
  redirect surface. QrImage src is server-constructed, not user-controlled.
- Cat 3 rate-limit: no new endpoints. ContactBookingForm targets existing /api/charter
  (unchanged; client already handles its 429 branch).
- Cat 4 audit-log: no new admin/payment mutations.
- Cat 5 authz: no new handlers; op/admin surfaces untouched.
- Cat 6 PII: no new logging statements, no new schema columns.

Positive security notes:
- CSP img-src widened by exactly one pinned host (https://img.vietqr.io) — no wildcard.
- Vercel Analytics gated to production, keeping dev CSP strict (no third-party script
  allowance added to script-src).
- Double-submit guard on the charter form reduces duplicate-lead abuse surface.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to ff2e2ac3
