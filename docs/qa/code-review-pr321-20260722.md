CODE REVIEW — PR #321 "fix(booking): 15-min transfer countdown on bank-transfer waiting page" @ 2ed6d10b
────────────────────────────────
Diff scope: 4 files, +71 / -71 lines
Base: master · Head SHA: 2ed6d10bffa6378154ff21c42379c397ff520862

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [TEST COVERAGE] app/(customer)/booking/bank-transfer/BankTransferClient.tsx:120
    The expired branch (remainingMs <= 0 → "Đã hết thời gian thanh toán") is not
    explicitly asserted; only the active-countdown branch is tested. Cosmetic copy,
    very low risk — optional to add a fake-timer test advancing past the deadline.

SUMMARY: 0 P1, 0 P2, 1 P3

Category notes (verified clean):
  • Cat 1 Correctness — formatCountdown clamps at 0 (Math.max) and pads seconds; 900000ms
    → "15:00". Countdown effect guards `!deadlineIso` and `Number.isNaN(deadline)`, ticks
    1s, clears on unmount. remainingMs starts null → renders nothing until mounted, so no
    SSR/hydration mismatch. MAX_REFRESHES 120→180 aligns polling with the 15-min window.
  • Cat 1 Purity — deadlineIso derived from fullBooking.createdAt (booking data), NOT
    Date.now(), so the RSC render body stays pure (respects the CLAUDE.md react-hooks/
    purity rule). undefined when fullBooking is null → countdown inert, graceful fallback.
  • Cat 2/3 — UI only: no auth, input, external call, or new failure path. Poll logic
    unchanged.
  • Cat 4 — new active-countdown branch tested (asserts `còn M:SS` present AND `mỗi 5 giây`
    absent); timeout tests updated to reference the exported MAX_REFRESHES (no re-typed
    literal — matches the CLAUDE.md "reference the exported constant" rule).
  • Cat 5/6 — formatCountdown / MAX_REFRESHES well-named; no console/debugger/.only; deleted
    PaymentDeadline fully removed (import gone, no dangling refs). Symmetric 71/71 = the
    delete + the added countdown.

RECOMMENDED NEXT STEPS:
  → No blocking findings. Safe to merge on the code-review axis.
