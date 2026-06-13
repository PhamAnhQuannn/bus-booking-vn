# Non-Functional Requirements

Last updated: 2026-06-12

## Context

Vietnam domestic bus-booking SaaS. Three portals: customer (public), operator (fleet management), admin (approvals/finance). Mobile-first — primary audience is Vietnamese travelers on mid-range Android over 4G (20Mbps down, 5Mbps up, 50ms RTL). Deployed on Vercel (Edge + Node). PostgreSQL via Prisma 7.8.

## Performance Budgets

### Customer Portal (public-facing, SEO-critical)

| Page | LCP | CLS | INP | FCP | TTFB | Bundle JS |
|------|-----|-----|-----|-----|------|-----------|
| `/` (home) | ≤ 2.5s | ≤ 0.1 | ≤ 200ms | ≤ 1.8s | ≤ 600ms | ≤ 150kB gz |
| `/search` | ≤ 2.5s | ≤ 0.1 | ≤ 200ms | ≤ 1.8s | ≤ 800ms | ≤ 120kB gz |
| `/trips/[id]` | ≤ 2.5s | ≤ 0.1 | ≤ 200ms | ≤ 1.8s | ≤ 600ms | ≤ 100kB gz |
| `/booking/review` | ≤ 3.0s | ≤ 0.1 | ≤ 200ms | ≤ 2.0s | ≤ 800ms | ≤ 130kB gz |

### Operator Portal (authenticated, internal)

| Page | LCP | INP | TTFB |
|------|-----|-----|------|
| `/op/dashboard` | ≤ 3.0s | ≤ 200ms | ≤ 1.0s |
| `/op/trips` (list) | ≤ 3.0s | ≤ 200ms | ≤ 1.0s |
| `/op/manifest/[tripId]` | ≤ 2.5s | ≤ 200ms | ≤ 800ms |

### API Latency (server-side, p95)

| Endpoint class | p95 target | p95 threshold |
|----------------|-----------|---------------|
| Trip search (`/api/trips/search`) | ≤ 300ms | ≤ 500ms |
| Hold create (`POST /api/holds`) | ≤ 200ms | ≤ 400ms |
| Booking initiate | ≤ 300ms | ≤ 500ms |
| Payment webhook processing | ≤ 500ms | ≤ 1000ms |
| Operator CRUD (buses/routes/trips) | ≤ 200ms | ≤ 400ms |
| Admin approval actions | ≤ 300ms | ≤ 500ms |
| Cron job tick (any) | ≤ 10s | ≤ 30s |

### Device Profile (Lighthouse audit baseline)

- **Device:** Moto G Power (mid-range Android)
- **Network:** Regular 4G (download 20Mbps, upload 5Mbps, latency 50ms)
- **CPU throttle:** 4x slowdown
- **Tool:** Lighthouse CI (`lhci`) or `npx lighthouse --preset=perf --throttling-method=simulate`

---

## NFR Table

| # | Category | Requirement | Target | Measurement | Threshold | Owner | Status |
|---|----------|-------------|--------|-------------|-----------|-------|--------|
| NFR-001 | Performance | Customer pages meet CWV "good" | LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms | Lighthouse CI on 4 customer pages (4G, Moto G Power) | LCP ≤ 4.0s, CLS ≤ 0.25, INP ≤ 500ms | self | proposed |
| NFR-002 | Performance | API search responds fast | p95 ≤ 300ms | `pnpm test:load` (k6) on `/api/trips/search` | p95 ≤ 500ms | self | proposed |
| NFR-003 | Performance | JS bundle size controlled | ≤ 150kB gzip per page | `next build` output + `@next/bundle-analyzer` | ≤ 200kB gzip | self | proposed |
| NFR-004 | Scalability | Concurrent booking flow | 100 simultaneous hold→book flows | k6 load test pre-launch | 50 simultaneous | self | proposed |
| NFR-005 | Scalability | Database connections | ≤ 20 pool connections under peak | Vercel PG connection count metric | ≤ 30 | self | proposed |
| NFR-006 | Security | No critical CVE in production deps | 0 critical, 0 high | `pnpm audit --prod` in CI | 0 critical | self | proposed |
| NFR-007 | Security | OWASP Top 10 baseline | All 10 categories addressed | Security review doc + threat model | All 10 | self | met |
| NFR-008 | Security | CRON_SECRET mandatory in production | Env var required, min 16 chars | Zod env schema validation on startup | Required | self | proposed |
| NFR-009 | Privacy | Vietnam PDPL compliance | DPA with all sub-processors | Signed DPA on file per vendor | DPA signed | self | proposed |
| NFR-010 | Privacy | PII retention — guest bookings | Anonymize 365d post-departure | `retentionSweeper` cron + audit log | 365d | self | met |
| NFR-011 | Privacy | PII retention — KYB docs (rejected) | Purge 90d post-upload | `retentionSweeper` cron | 90d | self | met |
| NFR-012 | Privacy | No plaintext passwords in DB | 0 plaintext password columns | `grep tempPasswordPlain` returns 0 hits in schema | 0 | self | at-risk |
| NFR-013 | Accessibility | WCAG 2.2 Level AA — customer portal | AA on all public pages | axe-core automated scan + manual keyboard test | AA on top-5 pages | self | proposed |
| NFR-014 | Accessibility | Touch target minimum | 44×44px on all interactive elements | axe-core `target-size` rule | 44×44px | self | proposed |
| NFR-015 | Accessibility | Color contrast | 4.5:1 for normal text, 3:1 for large | axe-core `color-contrast` rule | 4.5:1 normal | self | at-risk |
| NFR-016 | i18n | Vietnamese locale end-to-end | `lang="vi"`, VND formatting, VN date format | Manual audit of all customer pages | vi locale | self | met |
| NFR-017 | i18n | Admin console Vietnamese | All admin UI strings in Vietnamese | `grep` for untranslated English strings | 95% translated | self | met |
| NFR-018 | Observability | Structured logging on all routes | 100% of API routes log entry/exit | `grep` for `logger.info` in all `route.ts` | ≥ 50% routes | self | at-risk |
| NFR-019 | Observability | Error tracking | 100% server errors captured | Sentry SDK integration (deferred) | Error logging to Pino | self | proposed |
| NFR-020 | Observability | PII redaction in logs | All PII fields in Pino redact list | Audit `lib/core/logger` redaction paths (currently 44) | All known PII | self | met |
| NFR-021 | Reliability | Uptime (Vercel) | 99.5% monthly | External monitor (UptimeRobot / BetterStack) every 5min | 99.0% monthly | self | proposed |
| NFR-022 | Reliability | Payment webhook idempotency | 0 duplicate payment processing | `@@unique([adapter, providerTxnId])` + P2002 catch | 0 duplicates | self | met |
| NFR-023 | Reliability | Ledger immutability | 0 mutations to committed entries | DB trigger on LedgerEntry (UPDATE/DELETE blocked) | 0 mutations | self | met |
| NFR-024 | Reliability | Hold expiry sweep | Expired holds swept within 2 minutes | `sweep-holds` cron runs every 1 min | ≤ 5 min | self | met |
| NFR-025 | Maintainability | TypeScript strict mode | `strict: true`, 0 `@ts-ignore` | `pnpm tsc --noEmit` in CI | 0 errors | self | met |
| NFR-026 | Maintainability | Test coverage — unit | ≥ 70% line coverage | `vitest --coverage` | ≥ 50% | self | proposed |
| NFR-027 | Maintainability | Test coverage — integration | All financial paths have integration tests | Coverage map audit | All P1 paths | self | at-risk |
| NFR-028 | Maintainability | Module boundaries enforced | 0 cross-domain reach-in imports | `eslint-plugin-boundaries` entry-point rule (error) | 0 violations | self | met |
| NFR-029 | Maintainability | No import cycles | 0 circular imports | `eslint-plugin-import-x` no-cycle rule (error) | 0 cycles | self | met |

## Conflicts

| NFR A | NFR B | Conflict | Resolution |
|-------|-------|----------|------------|
| NFR-001 (CWV) | NFR-003 (bundle size) | Hero images as CSS `backgroundImage` hurt LCP but avoid JS bundle | Switch to `next/image` with priority loading — fixes both |
| NFR-012 (no plaintext PW) | Issue 113 (dev convenience) | `tempPasswordPlain` exists for dev while email stubbed | Must resolve before go-live (Option A: drop column + real email; Option B: AES-256-GCM encrypt) |
| NFR-018 (100% route logging) | NFR-020 (PII redaction) | Adding logging to all routes increases PII leak surface | Every new `logger.info` must use the existing Pino redaction config; extend redact list as needed |

## Status Legend

`proposed` — target set, not yet validated
`agreed` — user confirmed target
`in-progress` — instrumentation/implementation underway
`met` — measured and passing
`at-risk` — known gap, tracked issue exists
`missed` — below threshold, requires remediation
