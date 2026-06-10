CODE REVIEW — PR #6 "feat: OTA redesign + payment/booking correctness fixes + rebuild backlog" @ 02e6eab5
────────────────────────────────
Diff scope: 258 files, +15538 / -854 (review concentrated on the 5 money-path commits + new op routes,
per severity rules: risk-path domains = payment, auth, schema, admin/operator). UI/docs given a hygiene
sweep only.
Mistake Log: read; cross-checked diff against every logged pattern (issues 001, 004, 007, 011, 013, 014).

PRIORITY 1 — Block push, fix first:
  (none on the money paths — see verdict notes below)

PRIORITY 2 — Fix before merge:

  [FAILURE MODE / OBSERVABILITY] lib/payment/processWebhook.ts:160-170 (overpay branch)
    The overpay delta (overpayVnd) is recorded ONLY via logger.warn — not persisted to a queryable
    column or row. The refund-out rail (issue 051) is named as the consumer; a cron/sweeper cannot
    SELECT a log line. Echoes the Mistake-Log #014 rule (predicate fields belong in indexed columns,
    not logs/JSON).
    Mitigation present: the delta IS reconstructable from PaymentEvent.amount − Booking.totalVnd, so
    no money is lost and 051 can backfill. Acceptable to defer IF issue 051 explicitly reconstructs
    from those two columns rather than scraping logs.
    Fix (or accept-with-note): when 051 lands, compute the delta from PaymentEvent vs Booking — do NOT
    parse the log line. Add a one-line comment at processWebhook.ts pointing 051 at the reconstruction
    source so a future reader doesn't build a log-scraper.

  [CORRECTNESS / NON-RISK] lib/db/searchTrips.ts:153-157 (availability math)
    available = capacity − blockedSeats − heldSeats − bookedSeats. If a hold that has already been
    converted to a booking is still status='active' (not released on booking confirm), its seats are
    subtracted twice — once as heldSeats, once as bookedSeats. Direction is SAFE (under-reports
    availability → never oversell), so not a P1, but it can hide real inventory and shrink sellable
    seats. Confirm holdRepo flips Hold.status off 'active' at booking creation; if it does, no issue.
    Fix: verify the hold→booking transition releases/consumes the hold; add an int-test asserting a
    booked seat is counted once, not twice.

PRIORITY 3 — Address when convenient:

  [PRODUCT / DEAD-END] app/(...)/lien-he-dat-xe contact form — `// TODO: POST to an inquiry API
    (validate + store/notify) when available`. The new charter-inquiry form submits nowhere; user
    input is dropped. Ship behind a "coming soon" note or wire a real endpoint before exposing it.

  [HYGIENE] .env.example:24,26 still lists SEARCH_USE_BLOCKED_SEATS after its removal from
    lib/config/env.ts (also flagged in /pr-review). Drop the stale key.

MONEY-PATH VERDICT (the reason there is no P1):
  ✓ fix(search) oversell — flag removed; searchTrips ALWAYS subtracts blockedSeats + active holds +
    paid/pending/completed bookings (lib/db/searchTrips.ts:134-157). Closes the raw-capacity gap.
  ✓ fix(trips) double-book — lib/trips/busOverlap.ts does true window-vs-window overlap (candidate
    vs each existing trip's own route duration + 60m buffer), called inside $transaction holding
    SELECT … FOR UPDATE on the gating row in BOTH createTrip.ts and reassignBus.ts (FOR UPDATE OF t,
    excludeTripId on reassign). Matches Mistake-Log #011 TOCTOU rule exactly. No departureAt-equality
    shortcut. status IN ('scheduled','departed') correctly keeps a departed bus occupied.
  ✓ fix(payment) overpay — underpay success-IPN now rejected (left awaiting_payment, logged
    amount_mismatch); overpay marked paid + delta flagged. PaymentEvent recorded before the branch.
    Exact-amount path unchanged. (See P2 on persistence.)
  ✓ fix(payout) T+1 — pure constant change THREE_DAYS_MS→ONE_DAY_MS in completeTripCore.ts; drives
    both NotificationLog.scheduledFor and Payout.scheduledAt; both int-test assertions updated.
  ✓ fix(booking) guest-attach — genuine SECURITY improvement: spoofable phone-match attach removed
    from the webhook; Booking.customerId now stamped at initiate from getCustomerOptional(req)
    (session-proven), threaded through initiateBooking → bookingRepo INSERT (${customerId}::text,
    parameterized). Guests stay null, link later via OTP-proven backfill.
  ✓ New op route app/api/op/activity is tenant-isolated (requireOperatorAuth, operatorId from JWT,
    limit clamped 1-100). bus_overlap → 409 consistent with the I3 convention.
  ✓ Every new route handler has a companion test in the diff (initiate, op/activity, op/trips,
    webhook). No risk-path branch left untested.

SUMMARY: 0 P1, 2 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → The money-path code is correct and well-tested at the unit/int level — but NONE of it has run in
    CI on this HEAD (see /pr-review MERGE READINESS P1). Getting CI green is the real gate, not a
    code fix.
  → Resolve the P2 overpay-persistence question when issue 051 is scoped (accept-with-note is fine now).
  → Verify the hold-release-on-booking assumption behind the searchTrips double-subtract P2.
