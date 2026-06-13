# Threat Model: Bus-Booking Platform (Full System)

**Last updated:** 2026-06-12  
**Method:** STRIDE  
**Scope:** All 3 auth realms, payment webhooks, multi-tenant operator isolation, admin console, public booking flow  

## Trust Boundaries

1. **Browser ↔ Next.js proxy** (cookie auth, CSRF, rate-limit)
2. **Proxy ↔ API route handlers** (JWT verification, role/scope guards)
3. **Route handlers ↔ PostgreSQL** (tenant-scoped queries, FOR UPDATE locks)
4. **MoMo PSP ↔ webhook handler** (HMAC-SHA256 signature verification)
5. **eSMS ↔ notification dispatcher** (API key auth, stub in dev)
6. **S3-compatible storage ↔ signed URL handler** (HMAC-signed time-bound URLs)
7. **Vercel Cron ↔ cron route handlers** (CRON_SECRET bearer token)
8. **Operator A ↔ Operator B** (operatorId tenant boundary in DB)

## Threats

### S — Spoofing

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| S1 | Cross-realm token injection (operator token used on admin endpoint) | authenticated user | 1 | 3 | 3 | Strict `scope` claim validation per realm; `verifyOperatorAccess`/`verifyAdminAccess` reject wrong scopes | None — well-mitigated | low |
| S2 | Stolen operator session cookie via XSS | scripted | 2 | 3 | **6** | HttpOnly+SameSite=strict cookies; proxy guards | No CSP header configured; add `Content-Security-Policy: default-src 'self'` + Trusted Types | medium |
| S3 | Credential enumeration via login timing | scripted | 1 | 2 | 2 | `dummyVerify()` on missing/disabled users (timing parity); uniform error responses | None — well-mitigated | low |
| S4 | OTP brute-force on operator password reset | scripted | 2 | 2 | 4 | 5-attempt cap + 15min lockout sentinel; 3 sends/15min/phone | None — well-mitigated | low |
| S5 | Refresh token replay (bolt-hole attack) | authenticated user | 2 | 3 | **6** | Family reuse detection → revoke entire family; SHA-256 hash stored (not plaintext) | None — well-mitigated | low |

### T — Tampering

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| T1 | Forge MoMo payment webhook (fake paid IPN) | external | 1 | 3 | 3 | HMAC-SHA256 signature verification + constant-time comparison | Consider IP allowlist for MoMo webhook origin | low |
| T2 | Tamper hold cookie to claim different seat | scripted | 1 | 2 | 2 | HMAC-SHA256 signed cookie with constant-time verification | None — well-mitigated | low |
| T3 | Modify booking amount in transit (underpay) | MITM | 1 | 3 | 3 | TLS; amount validated server-side against `booking.totalVnd`; underpaid IPNs rejected | None — well-mitigated | low |
| T4 | Direct DB write bypassing application (insider) | insider | 1 | 3 | 3 | LedgerEntry immutable trigger; least-privilege DB user (managed by Prisma) | Add pg_audit logging for production DB | low |
| T5 | Ledger entry with wrong sign (app bug) | bug | 2 | 3 | **6** | Sign convention documented + integration tests | No DB CHECK constraint per type; add `CHECK(CASE WHEN type='booking_credit' THEN amount>0 ...)` | medium |

### R — Repudiation

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| R1 | Operator denies withdrawing funds | authenticated user | 2 | 2 | 4 | Ledger entries append-only with `sourceEventId` + `createdAt`; admin audit log | None — well-mitigated | low |
| R2 | Admin denies making manual ledger adjustment | insider | 2 | 3 | **6** | `writeAdminAuditLog()` on every finance action with actor ID + args | Audit log has no tamper-proof chain (no hash-chain or external witness) | medium |
| R3 | Customer claims booking never made | guest user | 2 | 1 | 2 | PaymentEvent raw body stored; booking confirmation token; SMS confirmation | None — well-mitigated | low |

### I — Information Disclosure

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| I1 | Operator A reads Operator B's bookings/buses/revenue | authenticated operator | 1 | 3 | 3 | `operatorId` scoping via JWT claim + DB WHERE on every query; `withOperatorScope()` utility | None — well-mitigated | low |
| I2 | Customer enumerates other customers' bookings | authenticated customer | 1 | 2 | 2 | Booking queries filter by `customerId` from JWT; 404 on non-owned (no 403 distinguishing) | None — well-mitigated | low |
| I3 | PII leakage in structured logs | bug | 2 | 3 | **6** | Pino redaction list for phone/password/token; webhook rawBody never logged | Logger redaction list may miss new fields as they're added | medium |
| I4 | Signed storage URL re-use after expiry | scripted | 1 | 2 | 2 | URLs expire in 5min; method-binding prevents GET→PUT replay | None — well-mitigated | low |
| I5 | Error responses leak stack traces | scripted | 2 | 1 | 2 | Next.js production hides stack; API routes return only coded errors | None — well-mitigated | low |
| I6 | Charter request ref enables booking enumeration | external | 2 | 1 | 2 | Charter refs are CUIDs (not sequential); cancel endpoint checks ref ownership | None — well-mitigated | low |

### D — Denial of Service

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| D1 | Single user holds all seats on popular trip | authenticated/guest | 3 | 3 | **9** | Rate-limit 60/min/IP on POST; holds expire in 5min (sweeper) | **No per-user/per-trip hold cap** — single IP can hold ~5 seats before expiry; distributed attack can lock entire bus | **high** |
| D2 | Distributed account creation + hold flood | scripted | 2 | 3 | **6** | Per-IP rate-limit; hold expiry sweeper | No CAPTCHA on hold creation; consider per-trip hold cap (max N active holds/trip) | medium |
| D3 | OTP flood draining SMS budget | scripted | 2 | 2 | 4 | 3/15min/phone for operator OTP; customer OTP routes return 410 | SMS cost exposure on operator forgot-password; consider CAPTCHA on forgot-password | low |
| D4 | Webhook replay flood on payment endpoints | scripted | 2 | 1 | 2 | Idempotent (duplicate providerTxnId → 200 no-op); HMAC rejects forged | None — well-mitigated | low |
| D5 | Advisory lock contention on cron jobs | race condition | 1 | 2 | 2 | Advisory locks + SKIP LOCKED prevent double-processing | None — well-mitigated | low |

### E — Elevation of Privilege

| ID | Threat | Attacker | L | I | Score | Existing Mitigation | Gap / Recommendation | Residual |
|----|--------|----------|---|---|-------|---------------------|----------------------|----------|
| E1 | Operator staff accesses admin-only management routes | authenticated staff | 1 | 3 | 3 | `adminOnly: true` flag on management routes; staff role check in `requireOperatorAuth` | None — well-mitigated | low |
| E2 | SUPPORT admin accesses FINANCE endpoints | authenticated admin | 1 | 3 | 3 | Role restriction on finance routes (`SUPER_ADMIN`/`FINANCE` only); step-up gate | None — well-mitigated | low |
| E3 | Admin bypasses TOTP in production | configuration error | 1 | 3 | 3 | `ADMIN_TOTP_DISABLED` env var (only for dev/test) | Ensure production deployment NEVER sets this; add startup assertion | low |
| E4 | JWT secret leak enables token forging | insider/breach | 1 | 3 | 3 | Secrets from env vars; not committed to repo; gitleaks scanning | **No key rotation mechanism** — compromised JWT_SECRET = full access until manual rotation + session invalidation | medium |

## Top Threats by Score

| Rank | ID | Score | Threat | Recommended Action |
|------|-----|-------|--------|--------------------|
| 1 | **D1** | **9** | Seat-hold flood locks entire bus | Add per-trip active-hold cap (e.g., max 6 holds/trip/IP); add CAPTCHA on hold creation |
| 2 | **S2** | 6 | XSS → stolen session cookie | Add CSP header (`default-src 'self'`); consider Trusted Types |
| 3 | **S5** | 6 | Refresh token replay | Already mitigated by family revocation — residual is low |
| 4 | **T5** | 6 | Ledger sign convention bug | Add DB CHECK constraint per ledger entry type |
| 5 | **R2** | 6 | Admin repudiation on finance actions | Add hash-chain to admin audit log for tamper evidence |
| 6 | **I3** | 6 | PII in logs | Audit pino redaction list against all PII fields quarterly |
| 7 | **D2** | 6 | Distributed hold flood | Per-trip hold cap + CAPTCHA |
| 8 | **E4** | 6* | JWT secret compromise | Implement key rotation mechanism (dual-key acceptance during rollover) |

*E4 scored 3 (L=1×I=3) but impact is catastrophic — flagged as priority regardless.

## Security Architecture Strengths

- **Three isolated auth realms** with strict JWT scope guards
- **Constant-time comparison** on every crypto operation (CSRF, HMAC, OTP, password)
- **Timing-parity dummy verification** prevents credential enumeration
- **Refresh token family reuse detection** catches bolt-hole attacks
- **DB-level ledger immutability** (trigger-based, role-independent)
- **TOCTOU protection** via FOR UPDATE serialization on all state-changing financial operations
- **Multi-layer idempotency** on payment + ledger writes
- **Centralized tenant scoping** via `withOperatorScope()`
- **Admin step-up re-auth** for high-sensitivity finance operations
- **No IDOR gaps found** across all 120+ API endpoints

## Open Items

1. **CSP header** not configured — highest-priority web security gap
2. **JWT key rotation** — no mechanism exists; manual rotation requires coordinated redeploy
3. **Per-trip hold cap** — most impactful DoS vector currently unmitigated
4. **Payment webhook IP allowlist** — defense-in-depth beyond HMAC
5. **Admin audit log integrity** — append-only but no cryptographic tamper evidence
