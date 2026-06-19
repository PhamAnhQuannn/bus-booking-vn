> ← [Previous](../01-requirements-functional/) | [Index](../README.md) | [Next →](../03-architecture/)

## 2. Non-Functional Requirements

Non-functional requirements define **how well the system performs** — the quality attributes. Each NFR has a unique ID (NFR-001 through NFR-029), a measurable target, an alert threshold, and a current status. The full NFR table is in [Section 2.9](#29-nfr-tracking-table).

**Context**: Vietnam domestic bus-booking SaaS. Three portals: customer (public), operator (fleet management), admin (approvals/finance). Mobile-first — primary audience is Vietnamese travelers on mid-range Android over 4G (20 Mbps down, 5 Mbps up, 50 ms RTL). Deployed on Vercel (Edge + Node) or self-hosted Docker. PostgreSQL via Prisma 7.8.

### 2.1 Performance Budgets

**Device profile (Lighthouse audit baseline):**
- **Device:** Moto G Power (mid-range Android)
- **Network:** Regular 4G (download 20 Mbps, upload 5 Mbps, latency 50 ms)
- **CPU throttle:** 4× slowdown
- **Tool:** Lighthouse CI (`lhci`) or `npx lighthouse --preset=perf --throttling-method=simulate`

**Customer Portal — Core Web Vitals** (NFR-001):

| Page | LCP | CLS | INP | FCP | TTFB | Bundle JS |
|------|-----|-----|-----|-----|------|-----------|
| `/` (home) | ≤ 2.5 s | ≤ 0.1 | ≤ 200 ms | ≤ 1.8 s | ≤ 600 ms | ≤ 150 kB gz |
| `/search` | ≤ 2.5 s | ≤ 0.1 | ≤ 200 ms | ≤ 1.8 s | ≤ 800 ms | ≤ 120 kB gz |
| `/trips/[id]` | ≤ 2.5 s | ≤ 0.1 | ≤ 200 ms | ≤ 1.8 s | ≤ 600 ms | ≤ 100 kB gz |
| `/booking/review` | ≤ 3.0 s | ≤ 0.1 | ≤ 200 ms | ≤ 2.0 s | ≤ 800 ms | ≤ 130 kB gz |

**Operator Portal — Latency:**

| Page | LCP | INP | TTFB |
|------|-----|-----|------|
| `/op/dashboard` | ≤ 3.0 s | ≤ 200 ms | ≤ 1.0 s |
| `/op/trips` (list) | ≤ 3.0 s | ≤ 200 ms | ≤ 1.0 s |
| `/op/manifest/[tripId]` | ≤ 2.5 s | ≤ 200 ms | ≤ 800 ms |

**API Latency — server-side, p95** (NFR-002):

| Endpoint class | p95 target | p95 threshold |
|----------------|-----------|---------------|
| Trip search (`/api/trips/search`) | ≤ 300 ms | ≤ 500 ms |
| Hold create (`POST /api/holds`) | ≤ 200 ms | ≤ 400 ms |
| Booking initiate | ≤ 300 ms | ≤ 500 ms |
| Payment webhook processing | ≤ 500 ms | ≤ 1000 ms |
| Operator CRUD (buses/routes/trips) | ≤ 200 ms | ≤ 400 ms |
| Admin approval actions | ≤ 300 ms | ≤ 500 ms |
| Cron job tick (any) | ≤ 10 s | ≤ 30 s |

**Bundle size** (NFR-003): ≤ 150 kB gzip per customer page. Measured via `next build` output + `@next/bundle-analyzer`. Threshold: ≤ 200 kB gzip.

### 2.2 Availability & Reliability

- **Uptime** (NFR-021): 99.5% monthly (allows ~3.6 hours downtime/month). Monitored by external probe (UptimeRobot / BetterStack) every 5 min.
- **Payment webhook idempotency** (NFR-022): `@@unique([adapter, providerTxnId])` + P2002 catch — 0 duplicate payment processing. A missed webhook = unpaid booking that needs manual reconciliation; retry + reconciliation sweeper as safety net.
- **Ledger immutability** (NFR-023): DB trigger on `LedgerEntry` blocks UPDATE/DELETE. 0 mutations to committed entries.
- **Hold expiry sweep** (NFR-024): Expired holds swept within 2 minutes. `sweep-holds` cron runs every 1 min.
- **Graceful degradation**: If SMS provider is down, bookings still work (notification is async, decoupled from booking state).

### 2.3 Scalability

- **Current**: ~200 bookings/day, ~100 operators. One server handles this trivially.
- **Near-term**: 10–100+ operators, ~2,000 bookings/day. Same architecture with a read replica.
- **Long-term**: If a single module becomes a measured bottleneck → extract that module only. Never pre-optimize.
- **Concurrent booking flow** (NFR-004): 100 simultaneous hold→book flows. Measured via k6 load test pre-launch. Threshold: 50 simultaneous.
- **Database connections** (NFR-005): ≤ 20 pool connections under peak. PgBouncer pool size 30, app-side pool ≤ 5. Threshold: ≤ 30.

### 2.4 Security Posture

- Three separate auth realms (customer, operator, admin) — never shared.
- Admin: email + password + mandatory TOTP (Time-based One-Time Password — a code from an authenticator app like Google Authenticator, rotating every 30 seconds; NOT SMS, which is vulnerable to SIM-swap attacks).
- All money operations: idempotent (safe to retry), transactional (all-or-nothing), audited.
- Tenant isolation: every operator query scoped to their own data — no cross-operator leakage.
- **No critical CVEs** (NFR-006): 0 critical, 0 high in production deps. Measured via `pnpm audit --prod` in CI.
- **OWASP Top 10** (NFR-007): All 10 categories addressed. Validated by security review doc + threat model. Status: **met**.
- **CRON_SECRET mandatory** (NFR-008): Required env var, min 16 chars. Enforced by Zod env schema validation on startup.

### 2.5 Compliance & Privacy

- **VN PDPD 2023** (Nghị định 13/2023/NĐ-CP — Vietnam's Personal Data Protection Decree): governs how personal data is collected, stored, processed, and erased. Requires consent, data-subject rights (access, correction, deletion), and breach notification. See [Section 19](#19-compliance--data-privacy) for full treatment.
- **PCI DSS** (Payment Card Industry Data Security Standard): We never store card numbers — the PSP handles that. But we must still protect payment metadata.
- Financial record retention: money/audit records retained even on account deletion (anonymize PII, keep financial totals).
- **DPA with sub-processors** (NFR-009): Signed Data Processing Agreement on file per vendor (Vercel, PSPs, SMS). Status: proposed.
- **Guest PII retention** (NFR-010): Anonymize 365 days post-departure. `retentionSweeper` cron + audit log. Status: **met**.
- **KYB doc purge** (NFR-011): Rejected KYB documents purged 90 days post-upload. `retentionSweeper` cron. Status: **met**.
- **No plaintext passwords** (NFR-012): 0 plaintext password columns in production. Status: **at-risk** — `tempPasswordPlain` exists for dev while email is stubbed (Issue 113 blocks go-live).

### 2.6 Maintainability

- Modular monolith with clean domain boundaries — any module can later become a service.
- Colocated tests (unit + integration next to the code they test).
- Structured logging with request ID propagation.
- **TypeScript strict mode** (NFR-025): `strict: true`, 0 `@ts-ignore`. Enforced by `pnpm tsc --noEmit` in CI. Status: **met**.
- **Unit test coverage** (NFR-026): Target ≥ 70% line coverage via `vitest --coverage`. Threshold: ≥ 50%. Status: proposed.
- **Financial integration tests** (NFR-027): All financial paths (hold→book→pay→payout) have integration tests. Status: **at-risk**.
- **Module boundaries** (NFR-028): 0 cross-domain reach-in imports. Enforced by `eslint-plugin-boundaries` entry-point rule (error). Status: **met**.
- **No import cycles** (NFR-029): 0 circular imports. Enforced by `eslint-plugin-import-x` no-cycle rule (error). Status: **met**.

### 2.7 Accessibility & Internationalization

- **WCAG 2.2 Level AA** (NFR-013): AA on all public customer pages. Measured via axe-core automated scan + manual keyboard test. Threshold: AA on top-5 pages. Status: proposed.
- **Touch target minimum** (NFR-014): 44×44 px on all interactive elements. Measured via axe-core `target-size` rule. Status: proposed.
- **Color contrast** (NFR-015): 4.5:1 for normal text, 3:1 for large text. Measured via axe-core `color-contrast` rule. Status: **at-risk**.
- **Vietnamese locale** (NFR-016): `lang="vi"`, VND formatting, VN date format on all customer pages. Status: **met**.
- **Admin console Vietnamese** (NFR-017): All admin UI strings in Vietnamese. 95% translated threshold. Status: **met**.

### 2.8 Observability

- **Structured logging on all routes** (NFR-018): 100% of API routes log entry/exit. Threshold: ≥ 50%. Status: **at-risk**.
- **Error tracking** (NFR-019): 100% server errors captured. Sentry SDK integration deferred; currently logging to Pino. Status: proposed.
- **PII redaction in logs** (NFR-020): All PII fields in Pino redact list (currently 44 paths). Status: **met**.

### 2.9 NFR Tracking Table

| # | Category | Requirement | Target | Measurement | Threshold | Status |
|---|----------|-------------|--------|-------------|-----------|--------|
| NFR-001 | Performance | Customer pages meet CWV "good" | LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms | Lighthouse CI on 4 customer pages (4G, Moto G Power) | LCP ≤ 4.0 s, CLS ≤ 0.25, INP ≤ 500 ms | proposed |
| NFR-002 | Performance | API search responds fast | p95 ≤ 300 ms | k6 on `/api/trips/search` | p95 ≤ 500 ms | proposed |
| NFR-003 | Performance | JS bundle size controlled | ≤ 150 kB gzip per page | `next build` + `@next/bundle-analyzer` | ≤ 200 kB gzip | proposed |
| NFR-004 | Scalability | Concurrent booking flow | 100 simultaneous hold→book | k6 load test pre-launch | 50 simultaneous | proposed |
| NFR-005 | Scalability | Database connections | ≤ 20 pool connections under peak | PG connection count metric | ≤ 30 | proposed |
| NFR-006 | Security | No critical CVE in production deps | 0 critical, 0 high | `pnpm audit --prod` in CI | 0 critical | proposed |
| NFR-007 | Security | OWASP Top 10 baseline | All 10 categories addressed | Security review + threat model | All 10 | met |
| NFR-008 | Security | CRON_SECRET mandatory in production | Required, min 16 chars | Zod env schema on startup | Required | proposed |
| NFR-009 | Privacy | Vietnam PDPL compliance | DPA with all sub-processors | Signed DPA on file per vendor | DPA signed | proposed |
| NFR-010 | Privacy | PII retention — guest bookings | Anonymize 365 d post-departure | `retentionSweeper` cron + audit log | 365 d | met |
| NFR-011 | Privacy | PII retention — KYB docs (rejected) | Purge 90 d post-upload | `retentionSweeper` cron | 90 d | met |
| NFR-012 | Privacy | No plaintext passwords in DB | 0 plaintext password columns | Schema grep | 0 | at-risk |
| NFR-013 | Accessibility | WCAG 2.2 Level AA — customer portal | AA on all public pages | axe-core + manual keyboard test | AA on top-5 | proposed |
| NFR-014 | Accessibility | Touch target minimum | 44×44 px | axe-core `target-size` rule | 44×44 px | proposed |
| NFR-015 | Accessibility | Color contrast | 4.5:1 normal, 3:1 large | axe-core `color-contrast` rule | 4.5:1 normal | at-risk |
| NFR-016 | i18n | Vietnamese locale end-to-end | `lang="vi"`, VND, VN date | Manual audit of customer pages | vi locale | met |
| NFR-017 | i18n | Admin console Vietnamese | All admin UI strings in VN | grep for untranslated English | 95% translated | met |
| NFR-018 | Observability | Structured logging on all routes | 100% route entry/exit logging | grep for `logger.info` in route.ts | ≥ 50% routes | at-risk |
| NFR-019 | Observability | Error tracking | 100% server errors captured | Sentry SDK (deferred) | Pino logging | proposed |
| NFR-020 | Observability | PII redaction in logs | All PII in Pino redact list | Audit redaction paths (44) | All known PII | met |
| NFR-021 | Reliability | Uptime | 99.5% monthly | External monitor every 5 min | 99.0% monthly | proposed |
| NFR-022 | Reliability | Webhook idempotency | 0 duplicate payment processing | `@@unique` + P2002 catch | 0 duplicates | met |
| NFR-023 | Reliability | Ledger immutability | 0 mutations to committed entries | DB trigger blocks UPDATE/DELETE | 0 mutations | met |
| NFR-024 | Reliability | Hold expiry sweep | Swept within 2 min | `sweep-holds` cron every 1 min | ≤ 5 min | met |
| NFR-025 | Maintainability | TypeScript strict mode | `strict: true`, 0 `@ts-ignore` | `pnpm tsc --noEmit` in CI | 0 errors | met |
| NFR-026 | Maintainability | Unit test coverage | ≥ 70% line coverage | `vitest --coverage` | ≥ 50% | proposed |
| NFR-027 | Maintainability | Financial integration tests | All financial paths covered | Coverage map audit | All P1 paths | at-risk |
| NFR-028 | Maintainability | Module boundaries enforced | 0 cross-domain reach-ins | `eslint-plugin-boundaries` (error) | 0 violations | met |
| NFR-029 | Maintainability | No import cycles | 0 circular imports | `eslint-plugin-import-x` (error) | 0 cycles | met |

### 2.10 NFR Conflicts & Resolutions

| NFR A | NFR B | Conflict | Resolution |
|-------|-------|----------|------------|
| NFR-001 (CWV) | NFR-003 (bundle size) | Hero images as CSS `backgroundImage` hurt LCP but avoid JS bundle | Switch to `next/image` with priority loading — fixes both |
| NFR-012 (no plaintext PW) | Issue 113 (dev convenience) | `tempPasswordPlain` exists for dev while email stubbed | Must resolve before go-live (Option A: drop column + real email; Option B: AES-256-GCM encrypt) |
| NFR-018 (100% route logging) | NFR-020 (PII redaction) | Adding logging to all routes increases PII leak surface | Every new `logger.info` must use existing Pino redaction config; extend redact list as needed |

**Status legend:** `proposed` — target set, not yet validated · `agreed` — user confirmed · `in-progress` — underway · `met` — measured and passing · `at-risk` — known gap, tracked issue · `missed` — below threshold, needs remediation
