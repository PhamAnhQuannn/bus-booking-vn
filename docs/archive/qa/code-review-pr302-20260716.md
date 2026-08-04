CODE REVIEW — PR #302 "feat: hero redesign, booking-journey audit fixes, brand logo, Vercel Analytics" @ ff2e2ac3
────────────────────────────────
Diff scope: 66 files (+1067 / −369), ~20 binary assets (hero/brand images, icons)

Context: large share of this diff (booking-journey audit fixes, hero layout, brand wiring) was
produced and behaviorally verified by the 5-round measure→judge→fix audit loop earlier today
(26 findings closed, Playwright-verified). This review focused line-level effort on the
never-reviewed pre-session files (search form/store/validation, ui primitives) plus the newest
risk surfaces (booking layout guard rewrite, CSP change, new bank-transfer components).

PRIORITY 1 — Block push, fix first:
  (none)

  Mistake-Log pattern sweep: no RSC self-fetch, no Date.now()/Math.random() in RSC render bodies
  (PaymentDeadline/SiteFooter are 'use client'; opengraph-image is a route), no currency math
  changes, no select-whitelist widening, no new NOT NULL columns, no env vars added to Zod
  schema, bank-transfer page tests updated in the same diff and passing (11/11), CSP change is
  an additive allowlist (img.vietqr.io) not a new gate. searchParamsSchema origin≠destination
  refine carries the required `// SPEC CONFLICT:` annotation (FD-004 vs DS-030) per convention.

PRIORITY 2 — Fix before merge:
  [FAILURE MODE / BUILD] app/(customer)/booking/layout.tsx:24
    useSearchParams() added to a client layout wrapping all /booking routes. If any /booking
    page is statically prerendered, `next build` fails with the missing-Suspense CSR-bailout
    error (dev + tsc don't catch this). CI build is the arbiter — if red, wrap the layout body
    in <Suspense> or read the param in the page instead.

  [CORRECTNESS / UX] components/search/SearchForm.tsx:52-56
    Validation error text persists after the user corrects the offending field — `error` only
    clears inside handleSubmit. aria-invalid derives live but the role="alert" copy goes stale.
    Fix: clear error when the referenced fields change, or derive the message.

PRIORITY 3 — Address when convenient:
  [HYGIENE / UNUSED IMPORT] app/(customer)/trips/[id]/page.tsx:14
    CardHeader, CardTitle imported but no longer used (usage removed by an audit fix; import
    left behind — violates CLAUDE.md "remove imports YOUR changes made unused"). Lint warns.

  [READABILITY / TOKEN] app/(customer)/booking/bank-transfer/CopyButton.tsx:60
    Tooltip uses literal `text-white` on bg-destructive; project token is
    `text-destructive-foreground` (same rendered color today, drifts if theme changes).

Positive notes (verified, no action):
  - booking guard widening (review/bank-transfer bypass tripId) is sound: each bypassed route
    re-verifies its own server-side access key (bb_hold cookie / confirmationToken); the client
    store check was never an auth boundary.
  - ui primitive changes (combobox/date-picker aria-invalid, calendar 44px nav, iconPosition)
    are additive with unchanged defaults — op/admin consumers unaffected.
  - searchStore ticketCount string→number migration includes a persist `version: 1` +
    `migrate` for existing localStorage payloads.
  - trips page cache(getTripDetails) + metadata try/catch removes the double DB hit and the
    metadata-crash path (audit F5), matching the React cache() convention.

SUMMARY: 0 P1, 2 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → No P1 → proceed to CI. P2#1 is CI-arbitrated (build); fix immediately if the build fails.
  → P2#2 + P3s can ride this PR or a follow-up.
