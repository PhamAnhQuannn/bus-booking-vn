# Consistency Audit — Bus Booking VN — 2026-05-28
Scope: app, components, lib, prisma · Branch: feat/ota-redesign

| Severity | Count | Areas |
|---|---|---|
| P1 | 0 | — |
| P2 | 2 | lib/booking, lib/buses + lib/db |
| P3 | minor | per-page local `Props`/`PageProps` (Next idiom — not real violations) |

**Gate: CLEAN of P1.** Payment HMAC is correctly centralized in `lib/payment/` (momo/processWebhook/stub) and consumed by the webhook routes — no crypto scattered in route handlers (Pass 3.1 PASS).

## P2 findings

**P2-a — `HoldDetails` interface declared twice (type drift)**
- `lib/booking/getHoldDetails.ts:14` (canonical, server read) and `app/booking/review/ReviewClient.tsx:29` (duplicate, extended this session with extra fields).
- Risk: the two must be hand-synced; adding a field to one silently diverges the other.
- Fix: export from `getHoldDetails.ts` only; `import type { HoldDetails } from '@/lib/booking/getHoldDetails'` in ReviewClient. (Introduced this session.)

**P2-b — `busType` union `'coach' | 'sleeper' | 'limousine'` inlined in ~10 sites**
- `lib/api/busesClient.ts`, `lib/buses/{createBus,getOperatorBus,listOperatorBuses,updateBus}.ts`, `lib/db/{searchTrips,getTripDetails}.ts`, `app/op/(console)/buses/BusesClient.tsx`, `app/search/page.tsx` (BUS_TYPE_LABEL).
- Canonical sources already exist: `BusType` enum from `@prisma/client` **and** `BusType` re-derived in `lib/validation/search.ts:81`.
- Risk: adding a 4th bus type means editing 10 files; drift if one is missed.
- Fix: import `BusType` (prefer `@prisma/client`) everywhere; delete inline unions. Mostly **pre-existing** (8 of 10 predate the redesign); 2 added this session.

## Notes
- No `lib/types/` barrel — shared types come from `@prisma/client`, which is fine for this stack; the two P2s are the exceptions that should route through it.
- P3 per-file `Props`/`PageProps` interfaces are standard App Router per-page typing, not violations.
