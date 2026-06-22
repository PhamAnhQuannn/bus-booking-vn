# Current Status — Codebase Reference

Comprehensive reference for the Bus-Booking platform. Last updated: 2026-06-21.

## Quick Stats

| Metric | Count |
|--------|-------|
| Prisma models | 38 |
| Prisma enums | 19 |
| Migrations | 67 |
| lib/ domains | 34 |
| lib/ source files | 488 |
| Customer pages | 18 |
| Operator pages | 32 |
| Admin pages | 11 |
| API routes | 136 |
| Components | 63 |
| E2E specs | 19 |
| Scripts | 19 |

## File Index

| # | File | Scope | Files Covered |
|---|------|-------|---------------|
| 00 | [00-project-structure.md](00-project-structure.md) | Full directory/file tree | All directories + file counts |
| 01 | [01-project-overview.md](01-project-overview.md) | Architecture, stack, dependency flow | Root configs, proxy.ts, lib/ tree |
| 02 | [02-root-configs.md](02-root-configs.md) | Every root config file | package.json, tsconfig, eslint, tailwind, prettier, husky, docker, .env |
| 03 | [03-prisma-schema.md](03-prisma-schema.md) | All models, enums, relations, indices | prisma/schema.prisma |
| 04 | [04-prisma-migrations.md](04-prisma-migrations.md) | All migrations chronologically | prisma/migrations/ (67 dirs) |
| 05 | [05-middleware-proxy.md](05-middleware-proxy.md) | proxy.ts: 3 enforcement layers | proxy.ts |
| 06 | [06-lib-core.md](06-lib-core.md) | lib/core/ (db, validation, logger, config) | lib/core/, lib/config/, lib/utils/ |
| 07 | [07-lib-auth.md](07-lib-auth.md) | 3-realm auth, JWT, OTP, CSRF, sessions | lib/auth/ |
| 08 | [08-lib-booking.md](08-lib-booking.md) | Holds, bookings, DTOs, transitions | lib/booking/ |
| 09 | [09-lib-catalog.md](09-lib-catalog.md) | Buses, routes, pickup areas, capacity | lib/catalog/ |
| 10 | [10-lib-trips.md](10-lib-trips.md) | Trip CRUD, lifecycle, search, templates | lib/trips/ |
| 11 | [11-lib-ledger.md](11-lib-ledger.md) | Revenue, payouts, fees, refunds, BigInt math | lib/ledger/ |
| 12 | [12-lib-admin.md](12-lib-admin.md) | Operator mgmt, moderation, audit | lib/admin/ |
| 13 | [13-lib-payment-notification.md](13-lib-payment-notification.md) | Payment gateways + SMS/email dispatch | lib/payment/, lib/notification/ |
| 14 | [14-lib-operations.md](14-lib-operations.md) | lib/op + lib/staff + lib/onboarding | lib/op/, lib/staff/, lib/onboarding/ |
| 15 | [15-lib-support.md](15-lib-support.md) | Charter requests, cron jobs, ticketing | lib/charter/, lib/jobs/, lib/ticketing/ |
| 16 | [16-lib-utilities.md](16-lib-utilities.md) | Small domains (api, analytics, flags, geo, etc.) | lib/api/, lib/analytics/, lib/flags/, lib/geo/, lib/places/, lib/search/, lib/format/, lib/text/, lib/seo/, lib/state/, lib/storage/, lib/ratelimit/, lib/observability/, lib/security/, lib/audit/, lib/einvoice/, lib/reports/ |
| 17 | [17-app-customer-pages.md](17-app-customer-pages.md) | Customer pages + client components | app/(customer)/ |
| 18 | [18-app-operator-pages.md](18-app-operator-pages.md) | Operator pages + client components | app/op/ |
| 19 | [19-app-admin-pages.md](19-app-admin-pages.md) | Admin pages + action components | app/admin/ |
| 20 | [20-api-customer-public.md](20-api-customer-public.md) | Customer-facing API routes | app/api/auth/, app/api/account/, app/api/bookings/, app/api/holds/, app/api/charter/, app/api/trips/, app/api/geo/, app/api/payments/ |
| 21 | [21-api-operator.md](21-api-operator.md) | Operator API routes | app/api/op/ |
| 22 | [22-api-admin.md](22-api-admin.md) | Admin API routes | app/api/admin/ |
| 23 | [23-api-cron-dev.md](23-api-cron-dev.md) | Cron jobs + dev-only routes | app/api/cron/, app/api/dev/, app/dev/ |
| 24 | [24-components.md](24-components.md) | All React components | components/ |
| 25 | [25-tests.md](25-tests.md) | Unit/integration/e2e test inventory | __tests__/, *.test.ts, *.int.test.ts, e2e/ |
| 26 | [26-scripts-ci.md](26-scripts-ci.md) | Admin CLI, dev tools, CI, Docker | scripts/, .github/, docker-compose*.yml |
| 27 | [27-documentation-index.md](27-documentation-index.md) | Map of all spec series | documentation/ (ADR, DS, FD, FI, SI, GL, HD, business) |
