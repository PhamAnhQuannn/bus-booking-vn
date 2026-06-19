# ADR-008: Security Posture

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking handles financial transactions, sensitive personal data (phone numbers, payment records, government IDs), and multi-tenant operator data across three web portals (customer, operator, admin). The security posture must satisfy Vietnam-specific regulatory requirements while protecting against the threat landscape of a marketplace processing real money.

Key constraints driving security decisions (sourced from `documentation/business/`):

- **PDPL 2025 (No. 91/2025) + Decree 356/2025**: Distinguishes "basic personal data" (name, phone, email) from "sensitive personal data" (payment records, government ID, location). Different consent and handling requirements per category. Breach notification to MPS A05 within 72 hours (24 hours for cybersecurity attacks). Penalties up to 5% annual VN revenue. (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- **Data residency (Decree 53/2022 + Decree 147/2024)**: Vietnamese user PII must reside on Vietnam-hosted servers. Cross-border transfer requires CDTIA filing. Platform currently on Vercel sin1 (Singapore). (regulatory/data-privacy.md, market-research/regulatory-compliance.md)
- **Financial integrity**: 8 state machines with ACID requirements, append-only ledger invariant, BigInt currency math. Admin compromise or payment forgery rated CRITICAL in risk-matrix.md. (domain-model/invariants-catalog.md, risk-matrix.md)
- **Multi-tenant isolation**: Shared database serving multiple operators. `withOperatorScope` bypass = cross-tenant data leak. Single large operator leaving removes 30-50% of supply. (domain-model/bounded-contexts.md, stakeholder-map.md)
- **Informal operator risk**: 20-30% of inter-provincial trips operate informally (unlicensed). Admitting unlicensed operators = regulatory shutdown risk from Ministry of Transport. (stakeholder-map.md, vietnam-market-context.md)
- **Investor diligence**: Regulatory non-compliance in diligence = term sheet pulled. Security posture is audited during Series A. (stakeholder-map.md)
- **Platform CTO as single point**: Only person enforcing security invariants, maintaining ledger immutability, preventing catastrophic failures (double-sell, money loss, PII leak). (stakeholder-map.md)

### Scope Boundaries with Adjacent ADRs

ADR-008 is the cross-cutting security umbrella. It does NOT re-decide topics owned by adjacent ADRs:

| Topic | Owned By | ADR-008 Role |
|-------|----------|-------------|
| Customer OTP, operator password+OTP, admin TOTP, session strategy, CSRF, rate limiting, OTP lockout | ADR-003 | References; does not re-decide |
| HMAC webhook verification, payment idempotency, amount guard, ledger immutability, BigInt currency math, refund strategy | ADR-005 | References; does not re-decide |
| PII redaction at log serialization, audit trail architecture, retention tiers, payment pipeline monitoring, Sentry error reporting | ADR-007 | References; does not re-decide |
| Defense-in-depth layers, data classification, encryption, HTTP headers, input validation, dependency security, secret management, tenant isolation enforcement, PII minimization/PDPL compliance, KYB/fraud, incident response, infrastructure security | **ADR-008** | Decides |

---

## Decisions

### 1. Defense-in-Depth Architecture — Five-Layer Model

| Option | Pros | Cons |
|--------|------|------|
| Perimeter-only (WAF + rate limit) | Simple; single enforcement point | Single point of failure; once past the edge, attacker has full access to financial data and PII |
| Three-layer (edge + application + DB) | Covers network, application logic, and data layer | Missing object-storage and CI pipeline layers; insufficient for a platform handling financial transactions |
| **Five-layer (edge + app + data + storage + pipeline)** | Each layer independently enforces security controls; no single bypass grants full access; aligns with how invariants I1/I7/I9 naturally span multiple layers | More layers to maintain; requires discipline to ensure each layer is independently complete |

**Choice**: Five-layer defense-in-depth

**Reasons**:
- Risk-matrix.md rates admin compromise, payment webhook forgery, and data breach as CRITICAL/HIGH severity — a single enforcement point is structurally inadequate (risk-matrix.md)
- Domain invariants I1 (concurrency/double-sell), I7 (no client-originated price), and I9 (PII redaction) each span multiple architectural layers — the security model must match (domain-model/invariants-catalog.md)
- **Layer 1 (Edge/Proxy)**: JWT decode (no DB), CSRF double-submit, IP rate limiting, forced-redirect gates. Runs in Edge Runtime. Established by ADR-003 D4/D5
- **Layer 2 (Application/Route)**: Zod schema validation at API boundary, `requireOperatorAuth`/`requireAdminAuth` guards with DB session verification, `withOperatorScope` tenant boundary, `server-only` imports for sensitive modules
- **Layer 3 (Data/DB)**: PostgreSQL `BEFORE UPDATE/DELETE` immutability triggers on LedgerEntry/AdminAuditLog/ConsentRecord, `FOR UPDATE` serialization (I1 invariant), CHECK constraints
- **Layer 4 (Object Storage)**: HMAC-signed short-lived URLs (PUT 15min, GET 5min); server never proxies object bytes; PII-purpose files identified by `StoragePurpose` enum
- **Layer 5 (CI Pipeline)**: Gitleaks secret scanning, data-leak-grep audit, `pnpm lint` with eslint-plugin-boundaries, tsc --noEmit, unit+integration+e2e test suites

---

### 2. Data Classification — Three-Tier (PDPL 2025 Aligned)

| Option | Pros | Cons |
|--------|------|------|
| Treat all data at highest sensitivity | Simplest; no classification errors | Over-restricts anonymous analytics; unnecessary consent overhead for FunnelEvent; impractical at scale |
| Two-tier (PII vs non-PII) | Simple binary; easy to enforce | Misses PDPL "sensitive personal data" distinction (payment/financial data has stricter handling than name/phone); location data classified differently |
| **Three-tier aligned with PDPL 2025** | Matches exact PDPL categories; separate consent for sensitive data (Decree 356); maps to DPIA inventory of 11 data categories; enables proportional controls | Three tiers require classification discipline; new fields must be classified at creation time |

**Choice**: Three-tier classification aligned with PDPL 2025

| Tier | Classification | Examples (from DPIA Section A) | Handling |
|------|---------------|-------------------------------|----------|
| T0 — Public/Anonymous | Not personal data | FunnelEvent (sessionId, no PII), Place, Route metadata, aggregated stats | No consent needed; no retention limit; can be cached freely |
| T1 — Basic Personal Data | PDPL "basic" | Name, phone, email, booking history, OTP attempts, device/session data, operator name/company | Consent (Art. 9); redact in logs (ADR-007 D2); access/correct/delete within 10-20 days; 24-month minimum retention |
| T2 — Sensitive Personal Data | PDPL "sensitive" | Payment records (amount, PSP reference, status), government ID (CCCD), location (GPS/IP-resolved), financial records (payout, ledger) | Explicit additional consent; encrypt at rest; stricter access control; breach notification to SBV if payment data; 5-10 year retention for financial |

**Reasons**:
- PDPL 2025 + Decree 356/2025 legally distinguish basic from sensitive personal data with different consent requirements — a two-tier model would either under-protect sensitive data or over-protect basic data (regulatory/data-privacy.md Section 2)
- DPIA checklist Section A already inventories 11 data categories that map cleanly to these three tiers (regulatory/dpia-checklist.md)
- T0 classification enables anonymous FunnelEvent analytics (sessionId, no PII) without cookie consent — critical for investor KPI measurement (personas/investor-kpis.md)
- ADR-007 D2 `/// @pii` schema comments extended: each comment now carries the tier (`@pii:T1` or `@pii:T2`) for auditability

---

### 3. Encryption at Rest and in Transit

| Option | Pros | Cons |
|--------|------|------|
| No encryption at rest (rely on provider disk encryption only) | Zero application-level effort; most VN cloud providers offer disk-level by default | No granularity; cannot selectively protect T2-sensitive columns; harder to answer "appropriate security measures" audit question for specific fields |
| Full column-level encryption (app-layer AES for all PII) | Granular per-field protection; data useless without application keys | Prevents DB-level indexing/searching on encrypted columns — phone number search breaks; massive performance impact; kills Prisma query builder for PII columns |
| **Provider disk encryption + app-layer AES-256-GCM for T2-only columns** | Provider encryption covers all data at rest (base layer); app-layer AES only for T2 columns NOT used as search keys (CCCD, TOTP secret, payout account number); T1 fields remain searchable | Two encryption layers to manage; key rotation requires app-level re-encrypt sweep for T2 columns |

**Choice**: Provider disk encryption (base) + application-layer AES-256-GCM for select T2 columns

**Reasons**:
- Phone number is the primary identity and search key across customer lookup, OTP flow, booking attachment, and admin search — encrypting it breaks fundamental platform operations. Phone stays T1: plaintext in DB, redacted in logs (ADR-007 D2) (regulatory/dpia-checklist.md Section I risk #7)
- TOTP secret encryption at rest via AES-256-GCM with dedicated encryption key is an established pattern. Same pattern extends to CCCD/passport numbers and payout account numbers (regulatory/data-privacy.md "appropriate security measures")
- TLS 1.2+ for all connections: HTTPS enforced for all incoming traffic; PostgreSQL connection uses `sslmode=require` for Vietnam-hosted DB; 5-15ms cross-border latency acceptable (market-research/regulatory-compliance.md)
- Full column-level encryption rejected: indexing and Prisma query builder incompatibility makes it impractical for T1 fields that are search keys
- PDPL requires "appropriate security measures" — provider disk encryption + T2 app-layer encryption is a defensible answer to auditors (regulatory/data-privacy.md)

---

### 4. HTTP Security Headers — Full OWASP Set

| Option | Pros | Cons |
|--------|------|------|
| No headers (current state) | Zero configuration; no breakage risk | Missing basic protections against clickjacking, MIME sniffing, XSS, referrer leakage; fails any security audit or investor diligence review |
| Minimal (HSTS + X-Frame-Options + X-Content-Type-Options) | Covers three most commonly exploited header gaps; low breakage risk | Missing CSP (XSS protection), Referrer-Policy, Permissions-Policy; incomplete audit answer |
| **Full OWASP recommended set** | Comprehensive: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; single configuration point; satisfies security audit checklist | CSP requires tuning per PSP redirect domain (MoMo, VNPay sandbox vs production URLs); misconfiguration breaks payment flow |

**Choice**: Full OWASP recommended set via `next.config.ts headers()`

**Headers**:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (production only)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (no legitimate iframe embedding use case)
- `Referrer-Policy: strict-origin-when-cross-origin` (preserves origin for PSP redirects, strips path)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (no hardware access needed)
- `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' <psp-origins> <sentry-origin>; frame-ancestors 'none'; form-action 'self'` — PSP-specific `connect-src` origins maintained per environment (sandbox vs production)

**Reasons**:
- Investor diligence flags missing security headers — "regulatory non-compliance in diligence = term sheet pulled" (stakeholder-map.md)
- Consumer-protection.md requires platform to protect against unauthorized transactions — CSP and X-Frame-Options prevent clickjacking attacks on the payment flow (regulatory/consumer-protection.md)
- CSP `connect-src` must include PSP redirect origins (MoMo sandbox, VNPay sandbox/production) — misconfiguration here breaks payment checkout, so PSP-specific origins are maintained in a named constant per environment

---

### 5. Input Validation Strategy — Zod at API Boundary + Domain Invariants in Service Layer

| Option | Pros | Cons |
|--------|------|------|
| Ad-hoc validation per route | Flexible; no framework overhead | Inconsistent; some routes may skip validation; SQL injection possible if raw strings reach queries |
| Zod at API boundary only | Single enforcement point; typed parse-or-reject; Zod strips unknown keys (prevents mass assignment) | Domain invariants (capacity check, maintenance overlap, salesClosed) require DB-consistent state — Zod cannot express DB-dependent constraints |
| **Zod at API boundary + domain invariants in service layer** | Zod handles shape/type/format at entry; domain checks run inside `$transaction` where state is consistent; two-layer injection defense | Two validation layers to maintain; must ensure domain checks are not accidentally bypassed by new endpoints |

**Choice**: Zod at API boundary + domain invariants in `$transaction` service layer

**Reasons**:
- Invariants I1 (concurrency/double-sell) and I7 (no client-originated price) require DB-consistent state checks inside transactions — Zod alone cannot enforce these (domain-model/invariants-catalog.md)
- Zod `.strip()` mode (default) removes unrecognized keys from parsed input — prevents mass assignment attacks where attacker injects `operatorId`, `price`, or `status` fields into the request body
- No raw user input reaches SQL: Prisma parameterizes all queries; raw SQL uses `Prisma.sql` tagged template (parameterized); `$queryRaw` calls in FOR UPDATE locks use parameter binding, never string interpolation
- Every API route handler calls `schema.parse()` BEFORE entering the service layer — parse failure returns 400 with Zod error details; invalid data never reaches business logic

---

### 6. Dependency and Supply-Chain Security

| Option | Pros | Cons |
|--------|------|------|
| No dependency scanning | Zero overhead; no alert noise | Vulnerable dependencies go undetected until exploited; fails security audit and investor diligence |
| `pnpm audit` in CI only | Zero-cost; blocks PR on known high/critical vulns; runs npm advisory database | No automated PR for updates; only detects published advisories; does not automate the update process |
| **GitHub Dependabot + `pnpm audit` in CI** | Automated PRs for vulnerable deps (Dependabot); CI gate blocks merge on known vulns (`pnpm audit`); covers both automated updates and merge-gate enforcement | Alert noise from low-severity advisories; Dependabot PRs need human review |
| Snyk / Socket.dev | Deeper analysis (reachability, malicious package detection); license compliance | Cost; additional integration; overkill for Phase 1 team size |

**Choice**: GitHub Dependabot (security-updates-only, weekly) + `pnpm audit --audit-level=high` CI gate

**Reasons**:
- Risk-matrix.md #13 demonstrates how dependency misconfiguration creates security gaps (Redis rate-limit silently failing open) — proactive scanning prevents similar gaps from known CVEs (risk-matrix.md)
- Investor diligence reviews dependency CVEs during Series A security audit — Dependabot + CI audit demonstrates proactive posture (stakeholder-map.md)
- `--audit-level=high` in CI blocks only high/critical severity advisories; low/moderate are informational only (avoids blocking CI on unfixable transitive vulns)
- `pnpm install --frozen-lockfile` in CI already prevents phantom dependency changes
- Snyk deferred to post-Series-A when team and budget scale — current tooling is zero-cost

---

### 7. Secret Management — Env Vars with Zod Validation + Rotation Runbook

| Option | Pros | Cons |
|--------|------|------|
| Env vars only (current state) | Simple; Vercel-native; Zod validates at boot; gitleaks prevents accidental commits | No rotation automation; no audit trail of secret access; Vercel dashboard compromise exposes all secrets |
| External secret manager (HashiCorp Vault, AWS Secrets Manager) | Centralized rotation; audit log of access; dynamic secrets; principle of least privilege | Infrastructure overhead; cold-start latency to fetch secrets; cost; no Vietnam-region Vault/ASM offering; overkill for Phase 1 team size |
| **Env vars + documented rotation runbook + 90-day rotation cron alert** | Retains simplicity of env vars; rotation runbook ensures secrets are changed on schedule; cron alert prevents drift; gitleaks prevents accidental commit | Manual rotation process; no automatic rotation; relies on discipline |

**Choice**: Env vars with Zod validation at boot + documented rotation runbook + 90-day rotation cron alert

**Reasons**:
- External vault is overkill for Phase 1 team size — no Vietnam-region Vault offering exists; cold-start latency adds to serverless function boot time
- Zod validation at boot enforces minimum key lengths and rejects known-bad values: HOLD_SECRET (64 hex chars = 32 bytes), VNPAY_HASH_SECRET (32 chars min), TOTP_ENCRYPTION_KEY (64 hex chars = 32 bytes), JWT secrets
- Sandbox sentinel detection: `env.ts` `superRefine` rejects production deployment with sandbox/test credential values (VNPAY_TMN_CODE === 'VNPAYTEST' or MOMO_PARTNER_CODE === 'MOMOBKUN20180529' when PAYMENTS_STUB=false) — prevents accidental production launch with test keys
- Rotation runbook documents: which secrets need rotation, rotation procedure per secret (JWT = mint new key, deploy, old key valid until TTL expiry; HMAC = deploy new, in-flight webhooks complete within 5 min), 90-day cadence, verification steps
- `tempPasswordPlain` (dev-only field on OperatorUser) must be removed or encrypted before Issue 094 go-live — documented as HALT-level blocker (vietnam-market-context.md)

---

### 8. Tenant Data Isolation Enforcement — Application Scope + Lint Guard

| Option | Pros | Cons |
|--------|------|------|
| Application scope only (trust developers) | Simplest; works when team is small and disciplined | Any new endpoint that forgets `withOperatorScope` leaks cross-tenant data; no automated detection; scales poorly |
| **Application scope + eslint-plugin-boundaries enforcement** | `eslint-plugin-boundaries` enforces that cross-domain imports go through barrels; import rules prevent bypassing the scope module; automated detection in CI | Lint rules can be `eslint-disable`d; requires discipline to keep rules updated as service modules are added |
| Row-Level Security (Postgres RLS) | Database-enforced; impossible to bypass from application code; each query filtered by `current_setting('app.operator_id')` | Requires setting session variable per request (added latency); Prisma's `$queryRaw` and `$transaction` don't natively set session vars; RLS policies on every tenant-scoped table; debugging complexity; Prisma migration compatibility unclear |

**Choice**: Application-level `withOperatorScope` + eslint-plugin-boundaries lint enforcement; RLS deferred to Phase 3 (50+ operators)

**Reasons**:
- ADR-004 D6 chose shared-DB + application-level scope — ADR-008 hardens the enforcement mechanism, not re-decides the isolation model
- `operatorId` MUST come from the JWT claim (set at token mint via `requireOperatorAuth`), never from request body — greppable check: `grep -rn "body.*operatorId" app/api/op/` must return zero results (domain-model/bounded-contexts.md)
- Admin routes that access operator data pass `operatorId` from the URL path parameter (verified against the operator table), never from the request body
- A cross-tenant data leak would trigger the #1 operator churn event — "single large operator leaving removes 30-50% of supply" (stakeholder-map.md)
- RLS deferred: at Phase 1 (1-3 operators), application-level + lint enforcement is proportional to the risk. When the platform reaches 50+ operators (Phase 3), RLS becomes a worthwhile defense-in-depth addition. RLS migration path: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + per-table policies, introduced as a non-breaking migration
- eslint-plugin-boundaries `entry-point` rule: cross-domain imports must go through barrel (barrel re-exports only public API). Enforced in CI via `pnpm lint`

---

### 9. PII Minimization & PDPL Compliance Architecture

| Option | Pros | Cons |
|--------|------|------|
| Minimal (consent banner + manual DSAR handling) | Lowest effort; satisfies basic consent; manual DSAR within 10-20 day SLA | No automated data export/deletion; Compliance Officer pain point "no single-source PII audit log" unresolved; scales poorly beyond 1,000 customers |
| **Consent + automated anonymization sweeper + DSAR API** | ConsentRecord (existing, append-only with immutability trigger); automated booking PII anonymization sweeper; admin DSAR endpoint for export/delete | More code to build; anonymization must preserve ledger integrity (financial records need 5-10 year retention exempt from deletion) |
| Full privacy-by-design + differential privacy | Strongest PDPL compliance; analytics provably anonymous; future-proof | Differential privacy is overkill — FunnelEvent is already anonymous by design (sessionId, no PII); excessive engineering for pre-Series-A team |

**Choice**: Consent + automated anonymization sweeper + DSAR API

**Reasons**:
- PDPL requires data subject rights response within 10-20 working days — manual processing scales poorly and creates compliance risk as the customer base grows (regulatory/data-privacy.md)
- Compliance Officer persona pain point: "no single-source PII audit log" — the DSAR API must enable export of all personal data for a customer by phone without engineering involvement (personas/admin-personas.md)
- **Consent**: ConsentRecord model (append-only with immutability trigger). Two consent records atomically at booking initiation: `no_refund` + `pii_storage`. Per-purpose consent as required by PDPL 2025 Art. 9. Pre-ticked boxes prohibited (regulatory/dpia-checklist.md Section D)
- **Anonymization sweeper**: Replaces T1 PII (name, phone, email) with anonymized values on Booking/Customer records after retention period + 24 months. Financial data (LedgerEntry, PaymentEvent) retained for 5-10 years per Accounting Law/Decree 123 — ledger amounts persist but PII is anonymized (regulatory/dpia-checklist.md Section E)
- **DSAR API**: Admin endpoint to (1) export all personal data for a customer by phone, (2) delete/anonymize on request. The 5-10 year financial retention exemption means booking amounts and ledger entries persist but customer PII is anonymized
- **VN Cloud migration path**: PII database migration to Viettel IDC/FPT Cloud documented as executable fallback within 6 months if MPS requests. Current Vercel sin1 + CDTIA filing is the Phase 1 path (market-research/regulatory-compliance.md)

---

### 10. KYB and Fraud Prevention — Three-Vector Defense

| Option | Pros | Cons |
|--------|------|------|
| KYB gate only (document check at onboarding) | Catches unlicensed operators at entry; one-time verification | No ongoing monitoring; expired licenses go undetected; payout fraud possible if account details changed post-onboarding |
| **KYB gate + payout account verification + license expiry monitoring** | Covers three distinct threat vectors: entry-time fraud (KYB), post-onboarding financial fraud (payout re-verification), ongoing compliance (license expiry cron) | More operational overhead for admin; false positive alerts on license expiry (operator may have renewed but not uploaded) |
| Add real-time transaction monitoring | Automated detection of unusual patterns (bulk purchases, rapid refund cycling, sudden booking velocity changes) | Requires baseline data the platform doesn't have yet; ML-based detection premature for Phase 1 volume (~200 bookings/day) |

**Choice**: Three-vector defense (KYB + payout account re-verification + license expiry monitoring); transaction monitoring deferred to Phase 3

**Reasons**:
- 20-30% of inter-provincial trips operate informally (unlicensed) — admitting unlicensed operators creates regulatory shutdown risk from Ministry of Transport. KYB license gate is both compliance requirement and competitive moat vs. unlicensed informal channels (stakeholder-map.md, vietnam-market-context.md)
- Risk-matrix.md #9 rates operator transport license not verified as a risk — KYB document check (transport license / Giay phep kinh doanh van tai) required at onboarding with license expiry captured (risk-matrix.md)
- **KYB at entry**: KybDocument types: `business_license`, `identity`, `payout_account`. Status lifecycle: `PENDING_REVIEW -> UNDER_REVIEW -> APPROVED | REJECTED`. Only APPROVED operators visible in search
- **Payout account re-verification**: Any edit to bank account fields (name, number, holder) resets `PayoutAccount.verifiedAt` to null, blocking withdrawals until admin re-verifies. Prevents post-onboarding financial fraud (domain-model/invariants-catalog.md)
- **License expiry cron**: 60-day-before-expiry alert to admin. Expired license triggers operator status flag (not auto-suspend — admin review, since operator may have renewed but not uploaded)
- Transaction monitoring deferred: at Phase 1 volume (~200 bookings/day across 1-3 operators), admin can visually inspect anomalies. FunnelEvent + BookingEvent data serve as baseline for future anomaly detection

---

### 11. Incident Response — 72-Hour Breach Notification Playbook

| Option | Pros | Cons |
|--------|------|------|
| Ad-hoc response (no formal procedure) | Zero preparation effort | 72-hour window starts at detection; without a procedure, triage consumes the window; penalties up to 5% annual VN revenue |
| Documented playbook only | Clear escalation chain; pre-drafted templates; evidence preservation steps | No automation; detection relies on human observation |
| **Documented playbook + automated detection triggers + pre-staged notification channel** | Playbook plus: P1 alerts from ADR-007 D6 trigger incident commander activation; pre-staged MPS A05 notification template; AdminAuditLog provides forensic trail | More infrastructure; tabletop exercise cadence needed to prevent staleness |

**Choice**: Documented playbook + automated detection triggers + pre-staged MPS A05 notification

**Reasons**:
- PDPL 2025 requires breach notification to MPS A05 within 72 hours (24 hours for cybersecurity attacks affecting consumer info). SBV notification required if payment data involved. Penalties up to 5% annual VN revenue (regulatory/data-privacy.md, regulatory/dpia-checklist.md Section F)
- **Detection**: P1 alerting (ADR-007 D6) triggers incident commander activation. Sentry captures exceptions. BetterStack uptime monitoring provides external probe (2-minute detection target per ADR-002)
- **Escalation timeline**: 0h internal detection → 0-2h DPO + CEO escalation → within 72h MPS A05 notification → within 72h affected user notification → 30-day forensic report
- **If payment data involved**: SBV notification in parallel with MPS A05 (regulatory/dpia-checklist.md Section F)
- **Evidence preservation**: AdminAuditLog (immutable, DB-trigger-enforced) provides forensic trail. Structured logs in PG with 24-month retention (ADR-007 D7). Sentry error captures with PII scrubbed
- **Tabletop exercise**: Quarterly, testing the 72-hour timeline. First exercise before Issue 094 go-live
- Compliance Officer persona target: data incident count = 0 (personas/admin-personas.md)

---

### 12. Infrastructure Security — Vercel Compute + VN-Hosted PG + CDTIA

| Option | Pros | Cons |
|--------|------|------|
| All on Vercel + Singapore DB (Neon/Supabase) | Simplest; single vendor; low latency | PII in Singapore = cross-border transfer violation without CDTIA; no data localization compliance; flagged as non-compliant in ADR-001 |
| **Vercel compute + VN-hosted PG + CDTIA filing** | Compute stays on Vercel (auto-scaling for Tet surge, CDN, Edge runtime); PII resides in Vietnam (data localization compliant); CDTIA covers compute-to-DB data transit; 5-15ms added latency (acceptable) | Cross-border connection must be TLS-encrypted; VN cloud provider SLA may be lower than Vercel/AWS |
| All on VN infrastructure | Maximum data sovereignty; zero cross-border transit; no CDTIA needed | No Vercel auto-scaling (Tet surge risk — 10-20x traffic spike); must self-manage Node.js deployment; CDN coverage weaker; operational burden on small team |

**Choice**: Vercel compute (sin1) + VN-hosted PostgreSQL (Viettel IDC or FPT Cloud) + CDTIA filing for cross-border

**Reasons**:
- Data residency (Decree 53/2022 + Decree 147/2024) requires Vietnamese user PII on Vietnam-hosted servers — current all-Singapore deployment is non-compliant for production go-live (regulatory/data-privacy.md, market-research/regulatory-compliance.md)
- Tet surge (risk-matrix.md #4) produces 10-20x traffic spike over 2 weeks — self-hosting compute loses Vercel's auto-scaling, CDN, and Edge runtime. Risk of downtime during the highest-revenue period of the year
- 5-15ms cross-border latency (Vercel sin1 ↔ Vietnam DB) is acceptable for a web application (market-research/regulatory-compliance.md)
- **Database**: PG on Viettel IDC or FPT Cloud with `sslmode=require`; PgBouncer connection pooling; disk encryption enabled (provider-managed)
- **Vercel**: DDoS protection built-in; TLS termination at edge; auto-scaling for Tet. Edge Runtime for `proxy.ts` (JWT verification, CSRF, rate limiting — no DB dependency)
- **Redis**: Upstash (serverless) for rate limiting counters only (no PII). If session data or PII ever stored in Redis, must be VN-hosted or CDTIA filed
- **DNS**: `.vn` + `.com.vn` domains registered defensively (regulatory/labor-aml-ip.md)
- **Object storage**: Signed URLs (15min PUT, 5min GET) for KYB documents. Production S3 or VN-equivalent for PII-classified documents

---

## Consequences

### Positive
- Five-layer defense-in-depth means no single compromised layer grants full access to financial data or PII
- Three-tier data classification maps directly to PDPL 2025 categories — audit-defensible when MPS A05 requests documentation
- HTTP security headers close the most common web-attack surface (clickjacking, MIME sniffing, XSS) with zero runtime cost
- Gitleaks + Dependabot + pnpm audit provide automated supply-chain protection with zero ongoing human cost
- 72-hour incident response playbook with pre-staged MPS notification template ensures the breach window is not wasted on triage
- Zod validation at API boundary + domain invariants in transactions creates a two-layer injection defense
- KYB gate serves dual purpose: regulatory compliance + competitive moat vs. unlicensed informal operators
- Tenant isolation enforcement via lint rules catches `withOperatorScope` bypass before code reaches production

### Negative
- Application-layer T2 encryption adds key management complexity (TOTP_ENCRYPTION_KEY, future CCCD encryption key) — key loss = data loss
- HTTP CSP headers require per-PSP tuning (MoMo, VNPay sandbox vs production URLs) — misconfiguration breaks payment checkout flow
- Dependabot may create alert noise from transitive dependency vulns that are not directly exploitable — requires triage discipline
- VN-hosted PG adds 5-15ms latency vs co-located Singapore PG — acceptable but measurable
- Manual secret rotation (no external vault) relies on discipline and the 90-day cron alert
- Incident response playbook requires quarterly tabletop exercises to remain current
- Application-level tenant isolation can be `eslint-disable`d by a developer — not DB-enforced until Phase 3 RLS migration

### Mitigations
- Key management: rotation runbook documents per-secret procedure; backup key stored in separate secure location; env.ts Zod validation fails fast on missing/malformed key
- CSP tuning: PSP-specific `connect-src` origins maintained in a named constant per environment; CI e2e tests validate payment flow with headers enabled
- Dependabot noise: `dependabot.yml` configured for security-updates-only (not version updates); `pnpm audit --audit-level=high` blocks only high/critical in CI
- VN PG latency: PgBouncer connection pooling reduces connection overhead; read replicas available for Phase 3 scale
- Secret rotation discipline: 90-day cron alert; sandbox sentinel detection in env.ts prevents production launch with test credentials
- Playbook staleness: quarterly tabletop exercise; post-incident retrospective updates the playbook in the same sprint
- Tenant isolation: `eslint-disable` for boundary rules flagged in code review; RLS migration planned for Phase 3 as defense-in-depth addition

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| risk-matrix.md | D1, D6, D7, D10, D11, D12 |
| regulatory/data-privacy.md | D2, D3, D7, D9, D11, D12 |
| regulatory/dpia-checklist.md | D2, D3, D9, D11 |
| regulatory/consumer-protection.md | D4 |
| regulatory/payment.md | Context |
| regulatory/labor-aml-ip.md | D12 |
| regulatory/compliance-timeline.md | D12 |
| market-research/regulatory-compliance.md | D3, D9, D12 |
| market-research/user-insights.md | Context |
| domain-model/invariants-catalog.md | D1, D5, D10 |
| domain-model/bounded-contexts.md | D1, D5, D8 |
| domain-model/state-machines.md | Context |
| domain-model/ubiquitous-language.md | Context |
| personas/admin-personas.md | D9, D10, D11 |
| personas/investor-kpis.md | D2 |
| personas/operator-personas.md | Context |
| stakeholder-map.md | D1, D4, D6, D7, D8, D10 |
| vietnam-market-context.md | D7, D10, D12 |
| competitor-benchmark/operator-sentiment.md | Context |
