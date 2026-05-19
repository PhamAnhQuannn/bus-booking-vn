# Bus-Booking Repo Status Report
**Generated:** 2026-05-19 (automated check)  
**Repo:** https://github.com/PhamAnhQuannn/bus-booking-vn.git  
**Branch:** `master`

---

## Latest Commit
```
9d1b485  docs(agents): Issue 012 Mistake Log — NOT NULL seed gap + Prisma 7.8 flag drift
Author:  Bus Booking Dev <phamanhquan4068@gmail.com>
When:    ~7 hours ago
```

---

## Active Work: Issue 013 — Operator Trip Lifecycle

**Status: IN PROGRESS (uncommitted changes on disk)**

### New files added (not yet committed):
| Path | Purpose |
|------|---------|
| `app/api/op/trips/` | Trip CRUD endpoints (GET list + POST create one-off) |
| `app/api/op/trips/[id]/block-seats/` | Block seats on a trip |
| `app/api/op/trip-templates/` | Recurring template endpoints |
| `app/api/cron/generate-trips/` | Vercel Cron — daily 14-day trip generation |
| `app/op/trips/` | Operator trip UI pages |
| `app/op/trip-templates/` | Operator template UI pages |
| `lib/trips/` | Full trip service layer (create, cancel, reassign bus, sales toggle, block seats, paired return, DTO) |
| `lib/validation/trip.ts` | Zod schemas for trip + template payloads |
| `lib/op/getOperatorSession.ts` | Operator session helper |
| `e2e/op-trips.spec.ts` | Playwright e2e for trip management |
| `e2e/cron-recurring.spec.ts` | Playwright e2e for recurring trip generation |
| `prisma/migrations/20260519060000_*` | Step 1: RecurringTripTemplate model |
| `prisma/migrations/20260519060001_*` | Step 2: Trip extended with operatorId |
| `prisma/migrations/20260519060002_*` | Step 3: RecurringGenerationLog with tripId |

### Modified files (uncommitted):
- `prisma/schema.prisma` — new `RecurringTripTemplate` + `RecurringGenerationLog` models
- `prisma/seed.ts` — `operatorId` added to all `trip.create` calls
- `lib/booking/__tests__/initiateBooking.int.test.ts` — operatorId fix
- `lib/buses/__tests__/capacityGuard.int.test.ts` — operatorId fix
- `lib/db/__tests__/bookingRepo.int.test.ts` — operatorId fix
- `lib/db/__tests__/holdRepo.int.test.ts` — operatorId fix
- `.env.example` — likely CRON_SECRET added
- `vercel.json` — cron schedule entry
- `docker-compose.dev.yml` — dev env update
- `pnpm-workspace.yaml` — workspace update

---

## Mistake Log Entries Added (Issue 013)
Three rules already captured in `AGENTS.md`:
1. **TripDto missing `price` field** — always copy every non-relational scalar from Prisma model in sequence
2. **NOT NULL `operatorId` on Trip broke 4 test fixtures** — grep `prisma.<model>.create` calls across all test files when adding NOT NULL columns
3. **I7 price-invariant clarified** — `/api/op/**` endpoints are exempt when operator is the price authority; document inline with `// I7-exempt:`

---

## Issue History (completed)
| Issue | Feature | Committed |
|-------|---------|-----------|
| 001 | Trip search + maintenance window | ✅ |
| 002 | Booking review page | ✅ |
| 003 | Hold + booking flow | ✅ |
| 004 | MoMo payment webhook | ✅ |
| 007 | Customer auth (OTP, CSRF, session) | ✅ |
| 010 | Operator auth + first-login gate | ✅ |
| 011 | Operator fleet management | ✅ |
| 012 | Operator routes + pickup points | ✅ |
| **013** | **Operator trip lifecycle** | **🔄 In progress** |

---

## Note on "Keep Awake"
This script cannot prevent Windows sleep via a scheduled task alone. To keep the machine awake all day, run this once in PowerShell (as admin):

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
```

Or use [Caffeine](https://www.zhornsoftware.co.uk/caffeine/) / `caffeinate` equivalent for Windows. The automated check-in will continue running every 5 minutes as scheduled regardless of sleep settings.
