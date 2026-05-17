<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Mistake Log

- **2026-05-17 (Issue 001)** — Maintenance-window filter compared `new Date()` (wall-clock now) instead of `trip.departureAt`. Future trips on a bus with a future maintenance window were incorrectly included whenever maintenance wasn't active *right now*. Fix: window-vs-window overlap (`maintenanceStart ≤ endUtc AND maintenanceEnd ≥ startUtc`) — encoded as `OR: [maintenanceStart null, maintenanceEnd < startUtc, maintenanceStart > endUtc]` in `app/api/trips/search/route.ts` + `lib/db/searchTrips.ts`.
- **2026-05-17 (Issue 001)** — `searchResultSelect` whitelisted `salesClosed` + `status` despite both being `where`-clause-only. Leaked internal state into client payload. Fix: drop from select; filter logic in `where` unchanged. Rule: `select` whitelist = exactly the UI contract fields, no filter columns.
- **2026-05-17 (Issue 001)** — Seed phone placeholders `+84901111111` matched `.gitleaks.toml` regex `\+84[35789]\d{8}` (`9` is a valid mobile prefix). Real-mobile-prefix all-digits placeholders trip the very rule meant to catch real numbers. Fix: use literal-x mask `+8490xxxxxx[12]` — `\d{8}` can't consume `x` chars. Rule: PII placeholders must escape the project's PII detection regex.
- **2026-05-17 (Issue 001)** — Phase 4b plan referenced a `getRateLimiter().check()` API that didn't exist; real API is `ratelimit.limit(ip)` returning `{allowed, remaining, retryAfter}`. Always read the actual module before writing mocks in the plan.
