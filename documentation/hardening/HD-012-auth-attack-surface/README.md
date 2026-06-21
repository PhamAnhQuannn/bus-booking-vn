# HD-012: Auth Attack Surface Catalog

> Status: NOT_STARTED | References: ADR-003, ADR-008, FI-001, FI-011, HD-001, HD-005, HD-006

## Purpose

Comprehensive enumeration of authentication and authorization attack vectors across the three-realm bus booking platform (customer, operator, admin). Maps 50+ specific attacks to defenses, identifies which are handled by the auth provider (Better Auth — ADR-003 D8) vs our application code, and provides CI-gatable verification checks.

## Skill Invocation

- **Primary**: `/security-review` + `/threat-model` — auth flow vulnerability assessment
- **Supplementary**: `/pii-inventory` — data exposure verification

## Better Auth Coverage Map

Better Auth (ADR-003 D8) handles identity primitives. Our app handles business authz. This split determines which attack categories need our testing vs which are provider-covered.

| Category | Provider (Better Auth) | App (Our Code) |
|----------|----------------------|----------------|
| 1. IDOR | — | **We own entirely** |
| 2. Broken auth (tokens) | Token signing, rotation, reuse detection, alg:none rejection | Realm routing, per-realm secret split |
| 2. Broken auth (OTP) | Rate limit, lockout, replay protection | eSMS adapter, lockout sentinel reuse |
| 2. Broken auth (TOTP) | Replay protection (SETNX), backup codes, secret encryption | — |
| 3. Privilege escalation | Token integrity (unforgeable claims) | Realm check in Edge middleware, `withOperatorScope` |
| 4. Data leakage | — | **We own entirely** (select whitelists, PII redaction) |
| 5. CSRF | — | **We own entirely** (double-submit cookie) |
| 6. Mass assignment | — | **We own entirely** (Zod validation) |
| 7. Race conditions | — | **We own entirely** (`SELECT FOR UPDATE`) |
| 8. Session attacks | Session fixation prevention, logout revocation, password-change invalidation | Cookie domain scoping |
| 9. Missing auth | — | **We own entirely** (middleware discipline) |
| 10. Webhook abuse | — | **We own entirely** (SePay bearer token) |

**Summary**: Categories 2 + 8 (~15 vectors) largely provider-handled. Categories 1, 3, 4, 5, 6, 7, 9, 10 (~35 vectors) require our business logic.

## Acceptance Criteria

### Category 1: IDOR (Insecure Direct Object Reference)

Change an ID in URL or request body to access someone else's resource.

**Customer -> Customer IDOR:**

- [ ] 1.1 Booking ID in URL: `GET /api/bookings/abc123` -> try `abc456` (leaks name, phone, trip, payment status)
- [ ] 1.2 Booking ref in status check: `GET /api/bookings/status?ref=BB-2026-xxxx` -> try other refs
- [ ] 1.3 Hold ID: `GET /api/holds/hold123` -> try `hold456` (leaks held seats, price)
- [ ] 1.4 Booking token in result page: `/booking/result/[token]` -> guess another token
- [ ] 1.5 Booking ref enumeration: iterate `BB-2026-0000` through `BB-2026-zzzz`
- [ ] **Defense**: every customer endpoint verifies `booking.customerId === authedCustomerId` (or anonymous via hold cookie only)

**Operator -> Other Operator IDOR (Cross-Tenant):**

- [ ] 1.6 Bus ID: `GET /api/op/buses/bus123` -> try `bus456` (another operator's fleet)
- [ ] 1.7 Route ID: `GET /api/op/routes/route123` -> try other IDs
- [ ] 1.8 Trip ID: `GET /api/op/trips/trip123` -> try other IDs (leaks manifest, passenger list)
- [ ] 1.9 Booking ID in operator view: `GET /api/op/bookings/book123` -> try other IDs (leaks customer PII)
- [ ] 1.10 Payout ID: `GET /api/op/payouts/payout123` -> try other IDs (leaks financials)
- [ ] 1.11 Modify bus on another operator's trip: `PATCH /api/op/trips/trip123 { busId: "myBus" }`
- [ ] 1.12 Create trip on another operator's route: `POST /api/op/trips { routeId: "opB-route" }`
- [ ] **Defense**: every `/api/op/*` query includes `WHERE operatorId = <from JWT>` via `withOperatorScope`. Defer to HD-005 for full tenant isolation audit.

**Customer -> Operator Data:**

- [ ] 1.13 Customer calls `GET /api/op/buses` (operator fleet data)
- [ ] 1.14 Customer calls `GET /api/op/reports/revenue` (operator financials)
- [ ] **Defense**: route-level realm check — customer JWT rejected at `/api/op/*`

### Category 2: Broken Authentication

**Token Theft & Misuse:**

- [ ] 2.1 XSS steals access token — cookies must be HttpOnly (XSS can't read)
- [ ] 2.2 XSS steals CSRF token — `bb_csrf` intentionally non-HttpOnly (only protects CSRF, not XSS)
- [ ] 2.3 Stolen refresh token — limited to TTL window (30d customer, 7d operator, 24h admin)
- [ ] 2.4 Refresh token reuse after rotation — reuse detection revokes entire family (Better Auth)
- [ ] 2.5 Access token used after logout — 15-min window accepted risk; logout revokes refresh family

**Token Forging & Manipulation:**

- [ ] 2.6 `alg: none` JWT forgery — Better Auth rejects; verify allowlist `["HS256"]` only
- [ ] 2.7 Brute-force weak signing secret — secrets must be >= 32 bytes random
- [ ] 2.8 Cross-realm token reuse — separate signing secrets per realm (D10)
- [ ] 2.9 Tamper JWT `operatorId` claim — signature verification prevents; operatorId from session, not body
- [ ] 2.10 Expired token accepted — verify `exp` claim enforced

**OTP Attacks:**

- [ ] 2.11 OTP brute-force (000000-999999) — 3 attempts -> 15-min lockout (Better Auth)
- [ ] 2.12 OTP replay — consumed on first verify (Better Auth OTP plugin)
- [ ] 2.13 SMS bombing — rate limit: 5 sends / 15 min per phone
- [ ] 2.14 OTP interception (SIM swap, SS7) — residual risk accepted for Phase 1
- [ ] 2.15 Phone enumeration — same response regardless of registration status

**TOTP Attacks (Admin):**

- [ ] 2.16 TOTP replay within 30s window — SETNX on jti (Better Auth twoFactor plugin)
- [ ] 2.17 TOTP secret theft from DB — encrypted at rest (AES-256-GCM)
- [ ] 2.18 No TOTP backup — 10 single-use backup codes generated at setup (Better Auth)

### Category 3: Broken Authorization (Privilege Escalation)

**Vertical Escalation:**

- [ ] 3.1 Customer JWT at `/api/op/*` -> 401/403
- [ ] 3.2 Customer JWT at `/api/admin/*` -> 401/403
- [ ] 3.3 Operator JWT at `/api/admin/*` -> 401/403
- [ ] 3.4 Operator bypasses first-login gate — `requiresPasswordChange` claim in JWT, exact-match Set allowlist
- [ ] **Defense**: Edge middleware checks `realm` claim matches route prefix; separate signing secrets prevent cross-realm forgery

**Horizontal Escalation:**

- [ ] 3.5 Operator A acts as Operator B — manipulate operatorId in body -> ignored (JWT value used)
- [ ] 3.6 Customer A acts as Customer B — manipulate customerId in body -> ignored (JWT value used)
- [ ] **Defense**: greppable invariant: `grep "body.*operatorId"` and `grep "body.*customerId"` must return zero in route handlers

### Category 4: Data Leakage in Responses

**Over-Exposed Fields:**

- [ ] 4.1 API returns all DB columns — explicit `select` whitelist on every Prisma query
- [ ] 4.2 Filter columns in response — `where` predicates (e.g. `salesClosed`) NOT in `select`
- [ ] 4.3 Operator phone in customer search — trip search must NOT return operator contact phone
- [ ] 4.4 Full customer phone in manifest — mask to last 4 digits
- [ ] 4.5 Co-passengers in booking response — booking returns only requester's data
- [ ] 4.6 Payment details in booking response — no bank account or txn IDs to customer
- [ ] 4.7 Stack traces in production — generic 500 envelope, no stack
- [ ] 4.8 Verbose error messages — no PII in error responses ("user not found" not "+84901234567 not found")

**Logging & Monitoring Leaks:**

- [ ] 4.9 PII in logs — logger redaction covers phone, email, otpCode, tokens
- [ ] 4.10 Tokens in logs — accessToken, refreshToken, otpProof in redact list
- [ ] 4.11 Payment data in logs — raw webhook payload not logged verbatim

### Category 5: CSRF (Cross-Site Request Forgery)

- [ ] 5.1 Forge booking cancellation from attacker page
- [ ] 5.2 Forge payout config change (redirect payouts to attacker bank)
- [ ] 5.3 Forge admin action (suspend operator)
- [ ] **Defense**: double-submit CSRF on all non-safe methods; `SameSite=Lax`; exempt webhook routes (bearer token auth)

### Category 6: Mass Assignment / Parameter Tampering

- [ ] 6.1 `role: "admin"` in registration body — Zod strips unknown fields
- [ ] 6.2 `operatorId` in booking body — from JWT only, never body
- [ ] 6.3 `price: 0` in booking body — server-computed (`Trip.price * ticketCount`, I7 invariant)
- [ ] 6.4 `status: "paid"` in booking body — status transitions via service layer only
- [ ] 6.5 `isAdmin: true` in profile update — Zod strips unknown fields
- [ ] 6.6 `totalVnd: 1000` in payment — amount from server, never client

### Category 7: Race Conditions

- [ ] 7.1 Double-booking last seat — `SELECT FOR UPDATE` on Trip in `$transaction`
- [ ] 7.2 Double payment webhook — `PaymentEvent @@unique([adapter, providerTxnId])`
- [ ] 7.3 Cancel + pay race — booking status locked via `FOR UPDATE` before transition
- [ ] 7.4 Capacity change during booking — `$transaction` with booking/hold recount under lock
- [ ] 7.5 Concurrent payout + refund — settlement inside `$transaction` with balance recheck

### Category 8: Session & Cookie Attacks

- [ ] 8.1 Session fixation — new tokens minted on login (Better Auth)
- [ ] 8.2 Cookie not cleared on logout — logout deletes cookies + revokes refresh family (Better Auth)
- [ ] 8.3 Password change doesn't invalidate sessions — revoke all refresh tokens for user (Better Auth)
- [ ] 8.4 Cookie accessible from subdomain — `Domain` not set (defaults to exact origin)

### Category 9: Missing Auth Entirely

- [ ] 9.1 API endpoint without auth middleware — default-deny for `/api/op/*` and `/api/admin/*`
- [ ] 9.2 Server component without session check — RSC must verify session before rendering protected data
- [ ] 9.3 Cron endpoint without `CRON_SECRET` — enforced in shared middleware
- [ ] 9.4 `app/dev/**` routes in production — must not be included in production build
- [ ] **Greppable**: route handlers missing `requireOperatorAuth` or `requireAdminAuth` must be audited

### Category 10: Webhook Abuse

- [ ] 10.1 Fake webhook without bearer token -> 401
- [ ] 10.2 Replay webhook -> `PaymentEvent @@unique` returns 200, no new ledger entry
- [ ] 10.3 Modified webhook amount -> amount guard rejects underpay
- [ ] 10.4 Webhook URL not a secret — security from bearer token auth, not obscurity

## Verification Strategy

### Automated (CI-Gatable)

| Check | Command / Method | Catches |
|-------|-----------------|---------|
| No `body.*operatorId` in op routes | `grep -rn "body.*operatorId" app/api/op/` -> 0 results | 3.5, 6.2 |
| No `body.*customerId` in routes | `grep -rn "body.*customerId" app/api/` -> 0 results | 3.6 |
| No missing `select` in queries | Grep for `.findMany({` without `select:` | 4.1-4.2 |
| Zod on all POST/PUT/PATCH | Grep handlers without `schema.parse` | 6.* |
| Auth on all `/api/op/*` | Grep for missing `requireOperatorAuth` | 9.1 |
| Auth on all `/api/admin/*` | Grep for missing `requireAdminAuth` | 9.1 |
| CRON_SECRET on `/api/cron/*` | Grep for missing secret check | 9.3 |
| PII not in logs | Logger redaction test | 4.9-4.11 |
| Client barrel guard | `grep -rln "from ['\"]@/lib/auth['\"]" app/ components/` + check for `'use client'` | Barrel import 500s |

### Integration Tests

| Test | Catches |
|------|---------|
| Customer A fetches Customer B's booking -> 403/404 | 1.1-1.5 |
| Operator A fetches Operator B's bus -> 404 (scoped query) | 1.6-1.12 |
| Customer JWT at `/api/op/*` -> 401/403 | 1.13, 3.1 |
| Operator JWT at `/api/admin/*` -> 401/403 | 3.3 |
| Body with `operatorId` field -> ignored (JWT value used) | 3.5, 6.2 |
| Body with `price` field -> ignored (server-computed) | 6.3 |
| Concurrent hold for last seat -> only one succeeds | 7.1 |
| Duplicate webhook -> 200, no new ledger entry | 7.2, 10.2 |
| Fake webhook without bearer token -> 401 | 10.1 |
| Expired JWT -> 401 | 2.10 |

### Manual Pentest Checklist

- [ ] Change IDs in browser URL for every page
- [ ] Inspect network tab: check response payloads for excess fields
- [ ] Add `operatorId`, `role`, `isAdmin` to POST bodies
- [ ] Use customer JWT cookie against operator endpoints
- [ ] Replay captured webhook requests
- [ ] Verify logout invalidates session
- [ ] Verify password change invalidates other sessions
- [ ] Verify CSRF token required on all state-changing requests

## Verdict

**PASS** when: all automated checks return zero violations, integration tests pass for all cross-tenant and cross-realm scenarios, and manual pentest checklist completed with no findings.

## Cross-References

- ADR-003 -- auth architecture (three realms, Better Auth, per-realm secrets)
- ADR-003 D8 -- Better Auth provider decision + coverage map
- ADR-008 -- security posture (defense-in-depth, data classification)
- FI-001 -- core auth implementation
- HD-001 -- security review (Layer 2 auth checks)
- HD-005 -- tenant isolation audit (IDOR Category 1.6-1.12)
- HD-006 -- payment webhook security (Category 10)
