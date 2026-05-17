---
depends-on: [001-bootstrap-trip-search]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

End-to-end pre-payment booking path: clicking Book on a search result reaches the buyer-info page, creates an atomic 10-minute hold, and shows a countdown timer through the review step.

- Prisma `Hold` model per PRD § Schema.
- `POST /api/holds` with atomic `UPDATE ... WHERE availableSeats >= ticketCount RETURNING` pattern to prevent oversell races (PRD § Implementation Decisions → Atomic hold creation).
- Returns `{ holdId, expiresAt }` on success, `409 SOLD_OUT { availableSeats }` on capacity miss.
- `/booking/customer` page: name + phone form per PRD AC for story 5 (validation regex + Unicode name + 4–100 chars + `localStorage.busbooking_last_phone` pre-fill).
- `/booking/review` page: read-only summary with `total` fetched from server.
- Zustand `bookingStore` (holds trip + holdId + buyer info); direct URL access without store → redirect to `/search`.
- Zustand `holdTimerStore` countdown visible on buyer-info + review pages; color warning at T-2 min; non-dismissible modal + redirect to `/search` on expiry.
- Conflict path: when `POST /holds` returns 409, surface clear sold-out state and invalidate the cached search results.

## Acceptance criteria

- [ ] Submitting buyer info creates a hold via `POST /api/holds` and starts the countdown.
- [ ] Phone format `/^(0|\+84)[35789][0-9]{8}$/` enforced both client and server.
- [ ] `localStorage.busbooking_last_phone` pre-fills the form when present, saves on successful hold.
- [ ] Concurrent-hold race test: N parallel requests on a single-seat trip → exactly 1 succeeds, rest receive `409 SOLD_OUT`.
- [ ] Timer counts down accurately; turns warning color at T-2 min; on expiry shows non-dismissible modal and redirects to `/search`.
- [ ] Direct URL access to `/booking/customer` or `/booking/review` with no `bookingStore` state redirects to `/search`.
- [ ] Review page total comes from the server response, never recomputed client-side.

## Blocked by

- Blocked by `issues/001-bootstrap-trip-search.md`

## User stories addressed

- User story 4
- User story 5
- User story 6
- User story 7
- User story 8
