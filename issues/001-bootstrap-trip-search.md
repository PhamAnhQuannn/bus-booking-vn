---
depends-on: []
type: AFK
acceptance_criteria: defined
---

## Parent PRD

`issues/prd.md`

## What to build

Bootstrap the project stack and ship a working customer trip-search slice end-to-end.

- Initialize Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Zustand + Prisma + Postgres.
- Define initial Prisma models: `Operator`, `Bus`, `Route`, `Trip` (with the integer `availableSeats` derivation rule described in PRD § Implementation Decisions → Schema highlights).
- Seed script with at least 2 operators, 5 buses, 3 routes, 10 trips spanning today + next 14 days.
- `GET /api/trips/search?origin&destination&date&ticketCount` — filters per PRD AC for stories 1/2 (excludes cancelled, closed-sales, in-maintenance, sold-out).
- `/search` page (mobile-first) with form (origin, destination, date, ticketCount 1–10) and results list (operator name, departure time, price, `availableSeats`). Empty state with nearby-date suggestion.
- Zustand `searchStore` holding the last query; back-navigation restores it.

## Acceptance criteria

- [ ] `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev` runs cleanly on a fresh clone.
- [ ] Visiting `/search`, filling the form, and submitting returns matching seeded trips, sorted by departure ascending.
- [ ] Cancelled trips and trips where `availableSeats < ticketCount` are excluded from results.
- [ ] "No trips found" state renders with a "Try nearby dates" suggestion when zero results.
- [ ] Navigating away and pressing back restores the form values from `searchStore`.
- [ ] CI runs typecheck + lint + a smoke test that boots the dev server and queries `/api/trips/search`.

## Outcome Definition — What "Done" Looks Like from the User Perspective

### Guest customer CAN (on `/` and `/search`)

- Navigate to `/search` on an iPhone 12 (390 px viewport) or Android 10 baseline browser and see a fully usable search form — origin text input, destination text input, date picker defaulting to today in `Asia/Ho_Chi_Minh` timezone, and a ticket-count stepper (1–10) — without horizontal scroll or overlapping elements.
- Type a city name in Vietnamese with or without diacritics (e.g. "Ha Noi", "Hà Nội", "ha noi") in either the origin or destination field and receive results that match the seeded route regardless of diacritic form (unaccent ILIKE matching).
- Submit a valid search and receive a results list within 500 ms (measured at the network response boundary on localhost with seeded data).
- See each result card showing: operator legal name, departure time formatted as `HH:mm, DD/MM/YYYY` in `Asia/Ho_Chi_Minh` (e.g. "07:30, 18/05/2026"), price formatted as `###.###đ` with VN thousand-separator (e.g. "250.000đ"), and the integer `availableSeats` count.
- See results sorted by departure time ascending — the earliest departure appears first.
- See a Vietnamese-language empty state — "Không tìm thấy chuyến xe" — with a "Thử ngày lân cận" suggestion rendered as clickable ±1-day date chips when zero results match.
- Navigate to any other page and press the browser back button to land on `/search` with the origin, destination, date, and ticket-count fields pre-populated exactly as last submitted (restored from Zustand `searchStore`, not from browser history state).
- See the page render usably on desktop (≥1280 px) and mid-range tablet (768 px) without layout regression.

### Guest customer CANNOT (explicitly out of scope for issue 001)

- Book, hold, or pay for any trip — there is no "Book" button or any booking flow in this slice.
- Pick or view seats — no seat map or seat selector exists anywhere in the product, ever.
- Log in, register, or manage an account — no auth UI exists yet.
- See any PDPD consent modal or cookie banner — not shipped in this slice.
- Access any operator dashboard, fleet management, or manifest view.

### Pilot operator visibility (indirect — via seed data only)

- The 2 seeded operators' trips appear in search results with correct legal name, price, departure time, and `availableSeats` derived as `bus.capacity − 0 blockedSeats − 0 activeHolds − 0 paidBookings` (seed state).
- Trips seeded with `status = cancelled`, `salesClosed = true`, or a bus in a maintenance window covering the departure are absent from all search results.
- Trips where `availableSeats < ticketCount` (as submitted by the guest) are absent from results.

---

## Acceptance Criteria

**AC-1**: Search returns matching trips sorted by departure (happy path)
- **Given** the DB is seeded with a trip: operator "Phương Trang", route Hà Nội → TP.HCM, departure 07:30 `Asia/Ho_Chi_Minh` on tomorrow's date, price 250000 VND, bus capacity 40, no holds or bookings
- **When** guest submits search with origin "Ha Noi", destination "TP.HCM", date = tomorrow, ticketCount = 2
- **Then** `GET /api/trips/search` returns HTTP 200 with a JSON array containing that trip
- **And** the trip card displays "07:30, \<tomorrow DD/MM/YYYY\>", "250.000đ", "40 chỗ trống", "Phương Trang"
- **And** the HTTP response is received within 500 ms

**AC-2**: Diacritic-insensitive origin/destination matching
- **Given** a seeded trip on route origin stored as "Hà Nội"
- **When** guest submits search with origin typed as "ha noi" (no diacritics, lowercase)
- **Then** the trip appears in results (unaccent ILIKE match)
- **And** a search with "HÀ NỘI" (uppercase diacritics) also returns the same trip

**AC-3**: Excluded trip types absent from results
- **Given** four seeded trips on the same route and date: (A) status=`cancelled`, (B) `salesClosed=true`, (C) bus in active maintenance window covering departureAt, (D) `availableSeats=1` with ticketCount=2 in the query
- **When** guest searches that route and date with ticketCount=2
- **Then** none of trips A, B, C, D appear in the JSON response

**AC-4**: Empty state with nearby-date suggestion
- **Given** no trips are seeded for the queried origin/destination/date combination
- **When** guest submits the search
- **Then** the `/search` page displays Vietnamese copy "Không tìm thấy chuyến xe"
- **And** two clickable date chips appear: one for the day before and one for the day after the searched date
- **And** clicking a chip re-submits the search with the chip's date

**AC-5**: Search form restored on back navigation
- **Given** guest submitted a search with origin="Đà Nẵng", destination="Huế", date=2026-05-20, ticketCount=3
- **When** guest navigates to `/` (home) and then presses the browser back button
- **Then** the `/search` page renders with all four fields pre-populated: origin "Đà Nẵng", destination "Huế", date 20/05/2026, ticketCount 3
- **And** the previous results list is visible without re-submitting the form

**AC-6**: Mobile layout integrity on 390 px viewport
- **Given** the `/search` page is loaded in a browser viewport set to 390 × 844 px (iPhone 12 baseline)
- **When** the page fully renders
- **Then** all four form fields, the submit button, and at least one result card are visible without horizontal scrolling
- **And** no two interactive elements overlap

**AC-7**: Rate limiter blocks excess requests
- **Given** a single IP has made 60 requests to `GET /api/trips/search` within the current 60-second window (Upstash Ratelimit)
- **When** the 61st request arrives from the same IP within that window
- **Then** the API returns HTTP 429 with a JSON body containing `{ error: "Too many requests" }`
- **And** the `Retry-After` header is present

**AC-8**: Dev stack boots from scratch
- **Given** a fresh clone with no `node_modules` and a running local Docker `postgres:16` container
- **When** the developer runs `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`
- **Then** all four commands exit 0 with no TypeScript or Prisma errors
- **And** `curl http://localhost:3000/api/trips/search?origin=a&destination=b&date=2026-05-18&ticketCount=1` returns a valid JSON response (array, may be empty)

**AC-9**: CI typecheck + lint + smoke test pass
- **Given** a CI run on the main branch after issue 001 is merged
- **When** the CI pipeline executes
- **Then** `tsc --noEmit`, ESLint, and the Vitest smoke test (which boots the dev server and calls `/api/trips/search`) all exit 0

---

Issue 001: 9 AC added (2 happy, 4 alt/variation, 3 failure/constraint)

---

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1
- User story 2
- User story 3
