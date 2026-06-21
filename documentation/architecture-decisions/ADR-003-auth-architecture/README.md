# ADR-003: Auth Architecture

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking serves three distinct user groups through separate auth realms: customers (travelers), operators (nhà xe staff), and platform admins. Each group has fundamentally different security requirements, technical literacy levels, and interaction frequencies.

Key business constraints driving auth decisions (sourced from `documentation/business/`):

- **Phone-first population**: 6 customer personas are overwhelmingly phone-centric — "Em Quan" (student) is Zalo-native, "Ba Hoa" (elderly) forgets passwords, "Chị Lan" (migrant worker) has no stable email. Email is explicitly rated low-importance for Vietnamese bus travelers. (personas/customer-personas.md, market-research/user-insights.md)
- **Operator diversity**: 5 operator segments range from micro operators (1-5 buses, 60-70% of market, low-tech, owner-operated) to large fleets (50-800+ buses, IT teams, need enterprise-grade security). (personas/operator-personas.md)
- **Sensitive admin roles**: 4 admin roles handle payouts, PII, compliance, and dispute resolution — a compromised admin account risks financial loss and regulatory breach. (personas/admin-personas.md)
- **OTP delivery economics**: Zalo ZNS costs ~200-500 VND/msg vs SMS at 300-800 VND/msg — 50-70% savings with ZNS-primary strategy; but brandname SMS registration is a 2-4 week hard blocker per carrier. (regulatory/telecom-sms.md)
- **Data retention**: PDPL 2025 requires 90-day OTP log retention for audit; DPO mandatory. (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- **Edge middleware constraint**: auth gates must run at Edge (zero cold start, no DB access) — only cryptographic verification (JWT decode, HMAC) is available. (ADR-001, Decision 5)
- **Three independent session lifecycles**: customer sessions are long-lived (repeat bookings over weeks), operator sessions are work-shift-scoped, admin sessions are short-lived with heightened security. (domain-model/bounded-contexts.md)
- **Competitor baseline**: VeXeRe uses phone OTP for customers; redBus uses email+password; FUTA has a native app with phone login. (competitor-benchmark/feature-parity-matrix.md)

---

## Decisions

### 1. Customer Authentication — OTP-Only (Passwordless)

| Option | Pros | Cons |
|--------|------|------|
| **OTP-only (passwordless via phone)** | Zero password to forget; matches phone-first population; fastest onboarding (enter phone → get code → logged in); aligns with Zalo-native user behavior; competitor parity with VeXeRe | Delivery cost per login (~200-500 VND); depends on SMS/Zalo infrastructure availability; no offline auth |
| Email + password | Familiar to international users; zero per-login delivery cost; works offline | Email low-importance for Vietnamese bus travelers; password reset flow needed; friction for elderly/low-literacy segments; poor fit for "Chị Lan" (no stable email) |
| Social login (Zalo/Facebook) | One-tap login; leverages existing accounts; popular in Vietnam | Platform dependency on third-party auth; Zalo API terms change risk; "Ba Hoa" (elderly) may not have social accounts; no phone verification = weaker identity signal for booking |
| OTP + optional password | Flexibility for power users; fallback when SMS is down | Complexity: two auth paths to maintain; password recovery still needed; "paradox of choice" slows onboarding |

**Choice**: OTP-only (passwordless via phone)

**Reasons**:
- All 6 customer personas are phone-first — "Em Quan" uses Zalo natively, "Ba Hoa" forgets passwords, "Chị Lan" and "Anh Minh" identify by phone number, "Marco" (tourist) gets local SIM on arrival (personas/customer-personas.md)
- Email explicitly rated low-importance for Vietnamese bus travelers — Zalo is primary channel, SMS secondary, email tertiary (market-research/user-insights.md)
- Passwordless eliminates entire categories of support tickets: password reset, account lockout, credential stuffing — complaint handling SLA is 3-day acknowledge / 7-30 day resolve (regulatory/consumer-protection.md)
- VeXeRe (dominant competitor, ~80% market) uses phone OTP — matching this removes friction for multi-homing users who already expect the pattern (competitor-benchmark/feature-parity-matrix.md, competitor-benchmark/operator-sentiment.md)
- Phone number serves as a natural unique identifier that connects booking history, OTP logs, and notification delivery into one identity (domain-model/ubiquitous-language.md)

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: OTP-only (passwordless via phone). No password involved.
> - **Actual**: Customer model includes a `passwordHash` column in schema despite OTP-only decision. Column exists but is not used in any auth flow — likely residual from earlier design iteration.
> - **Status**: `IMPLEMENTED_DIFFERENTLY`
> - **Tracking**: Remove unused `passwordHash` column from Customer model or document its intended future use.

---

### 2. Operator Authentication — Password + OTP Hybrid

| Option | Pros | Cons |
|--------|------|------|
| Password-only | Simple for micro operators (low-tech); familiar; no delivery cost | Weak security for console that manages revenue, fleet, and payouts; credential stuffing risk; no second factor for sensitive operations |
| OTP-only | Strong auth per-login; same system as customer | Excessive friction for daily-use console (operator logs in every shift); delivery cost on every login adds up; micro operators on shared phones may miss OTPs |
| **Password + OTP hybrid** | Password for daily login (fast, no delivery cost); OTP step-up for sensitive operations (payout withdrawal, staff management); first-login temp password forces credential setup | Two systems to maintain; operator must have phone access for sensitive ops |
| SSO/SAML | Enterprise-grade; centralized identity management | Only large fleets (5-10 operators nationally) have IT teams that could configure SSO; micro operators (60-70% of market) have no IT infrastructure; integration overhead per operator |

**Choice**: Password + OTP hybrid (temp password on first login → permanent password + OTP step-up for sensitive operations)

**Reasons**:
- 60-70% of market is micro operators (1-5 buses, owner-operated) — need simple daily password login without per-login delivery cost (personas/operator-personas.md)
- Operator console controls revenue (6% commission on all bookings — admin-configurable), fleet assets, and payout requests — password-only is insufficient for a surface that handles money (competitor-benchmark/pricing-comparison.md, domain-model/invariants-catalog.md)
- First-login temp password → forced password change gates the operator onboarding flow — admin provisions account, operator claims it (domain-model/event-flows.md, personas/admin-personas.md)
- OTP step-up for sensitive operations (payout withdrawal, staff role changes) adds security proportional to risk without burdening daily route/trip management (domain-model/bounded-contexts.md)
- SSO/SAML only relevant for large fleets (5-10 operators nationally) — premature infrastructure for a beachhead launch targeting 10-20 operators in one corridor (vietnam-market-context.md)
- Operator account takeover flagged in risk matrix — hybrid auth mitigates without blocking daily operations (risk-matrix.md)

---

### 3. Admin Authentication — Password + TOTP MFA

| Option | Pros | Cons |
|--------|------|------|
| Password-only | Simplest; no additional tooling | Unacceptable for roles that handle payouts, PII, and compliance; single-factor on a surface that can suspend operators and access financial data |
| **Password + TOTP MFA** | Strong second factor; works offline (authenticator app); no per-login delivery cost; TOTP apps are free; industry standard | Requires authenticator app setup; device loss = recovery flow needed |
| SSO (Google/Azure AD) | Centralized identity; automatic deprovisioning; audit trail | Team is small (4 admin roles) — SSO infrastructure overhead unjustified; adds external dependency for critical access path; Google/Azure admin console needed |
| Hardware key (FIDO2/YubiKey) | Strongest auth; phishing-proof; no TOTP code to intercept | Hardware procurement and distribution; device loss = physical replacement; overkill for pre-launch team size; not justified until post-Series A scale |

**Choice**: Password + TOTP MFA

**Reasons**:
- Finance/Accounting Manager handles payouts, commissions, and tax withholding — compromised access = direct financial loss (personas/admin-personas.md, domain-model/event-flows.md)
- Compliance Officer handles PDPL data, breach notifications (72-hour window to MPS), and DPIA — compromised access = regulatory violation (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- Operations Manager can suspend/approve operators and manage disputes — compromised access = operator business disruption (personas/admin-personas.md)
- Admin compromise rated as critical risk (risk-matrix.md)
- Small team (4 roles) makes SSO infrastructure overhead unjustified — Google Workspace admin setup + SAML configuration is disproportionate to team size (personas/admin-personas.md)
- TOTP authenticator apps (Google Authenticator, Authy) are free, work offline, and require no per-login delivery cost — sustainable for a pre-revenue startup (vietnam-market-context.md)
- Hardware keys (FIDO2) are appropriate post-Series A when team scales and physical key logistics are justified — not now (investor-kpis.md)

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Password + TOTP MFA with backup codes for device-loss recovery.
> - **Actual**: TOTP is implemented (`lib/auth/totp.ts` with encrypted secret storage). However: (1) no TOTP replay protection (no jti/SETNX — same code can be reused within its 30-second window), (2) backup codes not implemented (Mitigations section mentions them but no code exists).
> - **Status**: `PARTIALLY_IMPLEMENTED`
> - **Tracking**: Add TOTP replay protection (SETNX with 30s TTL on last-used code) and backup code generation before go-live.

---

### 4. Session Strategy — Hybrid JWT Access + Refresh Token Rotation

| Option | Pros | Cons |
|--------|------|------|
| Stateless JWT only | No server-side session storage; Edge-decodable; scales horizontally | Cannot revoke individual sessions without blocklist; token theft = access until expiry; no refresh = re-auth on every expiry; long-lived JWT = extended exposure window |
| Server-side sessions (DB/Redis) | Instant revocation; full session audit trail; simple mental model | Every request requires DB/Redis lookup = latency + cost; incompatible with Edge middleware (cannot query DB at Edge); connection pressure during Tet surge |
| **Hybrid (short-lived JWT access + refresh token rotation)** | JWT decoded at Edge (zero DB hit for auth gate); short access TTL limits exposure; refresh rotation detects token theft; revocation via refresh token invalidation; audit trail via refresh token table | Two token types to manage; refresh endpoint needed; rotation logic adds complexity; clock skew sensitivity |

**Choice**: Hybrid — short-lived JWT access token + refresh token rotation

**Reasons**:
- Edge middleware must verify auth on every request without DB access (ADR-001 Decision 5) — JWT decode via `jose` is the only Edge-compatible auth verification (domain-model/invariants-catalog.md)
- Three auth realms (customer, operator, admin) need independent session lifecycles: customer sessions span weeks (repeat booking behavior), operator sessions are work-shift scoped, admin sessions are short-lived for security (domain-model/bounded-contexts.md, personas/customer-personas.md, personas/operator-personas.md)
- JWT claims carry `operatorId` for per-request tenant scoping in middleware — eliminates DB lookup for multi-tenant enforcement (domain-model/bounded-contexts.md, domain-model/invariants-catalog.md)
- Cross-cutting gates (e.g., operator `requiresPasswordChange` flag) encoded as JWT claims enable Edge-level redirect without DB query — new routes auto-gated without per-route enforcement gaps (domain-model/event-flows.md)
- Refresh token rotation enables theft detection (reused refresh token → invalidate entire family) while keeping access tokens short-lived (risk-matrix.md)
- 90-day session audit trail requirement (PDPL 2025) satisfied by refresh token table records without bloating JWT payloads (regulatory/data-privacy.md)
- Full stateless JWT rejected: cannot revoke compromised operator sessions fast enough — operator console handles financial operations (domain-model/invariants-catalog.md)
- Full server-side sessions rejected: DB lookup on every request incompatible with Edge middleware and adds connection pressure during Tet surge (risk-matrix.md)

> **IMPLEMENTATION STATUS** (2026-06-21)
> - **Documented**: Three independent session lifecycles with realm-isolated tokens. Per-realm signing secrets for both access and refresh tokens (D10).
> - **Actual**: Single `REFRESH_TOKEN_SECRET` env var shared across all three realms. Access tokens already use per-realm secrets. Refresh layer uses one shared secret.
> - **Status**: `PLANNED` — D10 decides per-realm refresh secrets. Migration to Better Auth (D8) will implement this as part of the auth provider integration.
> - **Tracking**: Generate per-realm refresh secrets during Better Auth migration. Interim: refresh endpoints validate realm claim.

---

### 5. CSRF Protection — Double-Submit Cookie

| Option | Pros | Cons |
|--------|------|------|
| Synchronizer token pattern | Server generates unique token per session; strong protection; well-understood | Requires server-side token storage; incompatible with Edge middleware (no DB at Edge); adds state management complexity |
| **Double-submit cookie** | Stateless (no server storage); Edge-compatible (middleware compares cookie vs header); works with JWT session strategy; no DB lookup needed | Relies on same-origin policy; subdomain cookie leakage risk if misconfigured; requires client-side JS to read cookie and set header |
| SameSite cookie only | Zero implementation effort; browser-enforced | Incomplete protection — does not defend against subdomain attacks; older browsers may not enforce SameSite; not a standalone CSRF defense per OWASP |
| Origin/Referer header check | No token management; simple middleware check | Referer can be stripped by privacy extensions; Origin not sent on some same-origin navigations; unreliable as sole defense |

**Choice**: Double-submit cookie

**Reasons**:
- Stateless approach aligns with JWT session strategy — no additional server-side state to manage (consistent with Decision 4)
- Edge middleware can compare cookie value against `X-CSRF-Token` header without DB access — fits hybrid Edge/Origin architecture (ADR-001 Decision 5)
- Both customer and operator realms make state-changing API calls that need CSRF protection — double-submit scales across all three portals with one middleware (domain-model/bounded-contexts.md)
- CSRF enforcement listed as a security requirement in invariants catalog (domain-model/invariants-catalog.md)
- SameSite-only rejected: insufficient as standalone defense per OWASP guidance; regulatory/consumer-protection.md requires platform to protect against unauthorized transactions
- Client-side token reading (`readCsrfToken()` from non-HttpOnly cookie) is a well-documented pattern with no PII exposure — the CSRF token is a random value, not user data (regulatory/data-privacy.md)

---

### 6. OTP Delivery Channel — Zalo ZNS Primary + SMS Fallback

| Option | Pros | Cons |
|--------|------|------|
| SMS only | Universal reach (every phone receives SMS); no app dependency; simple integration | 300-800 VND per message (expensive at scale); brandname SMS registration = 2-4 week hard blocker per carrier (Viettel, VNPT, Mobifone); delivery latency varies |
| Zalo ZNS only | 200-500 VND per message (50-70% cheaper than SMS); rich message format; instant delivery; dominant messaging app in Vietnam | Requires Zalo app installed; elderly segment ("Ba Hoa") may not use Zalo; tourists ("Marco") unlikely to have Zalo on arrival; no coverage for feature phones |
| Email OTP | Near-zero delivery cost; no carrier registration; works globally | Email rated low-importance for Vietnamese bus travelers; delivery to spam folder; not real-time; poor fit for time-sensitive OTP (60-second confirmation is a trust signal) |
| **Zalo ZNS primary + SMS fallback** | Optimal cost (ZNS for majority of users); universal reach (SMS catches non-Zalo users); resilient (if ZNS fails, SMS delivers); matches actual channel preference hierarchy | Two integrations to maintain; routing logic needed; SMS brandname registration still required for fallback |

**Choice**: Zalo ZNS primary + SMS fallback (Phase 2 target). **Phase 1: eSMS (SMS) only.**

**Reasons**:
- 50-70% cost savings with ZNS-primary strategy — at scale, OTP delivery is a significant operating cost line item (regulatory/telecom-sms.md)
- Zalo is the primary communication channel for Vietnamese travelers — "Em Quan" (student) is Zalo-native; MoMo (68% e-wallet share, 31M users) proves Vietnamese users expect in-app messaging (market-research/user-insights.md)
- SMS fallback covers segments that don't use Zalo: "Ba Hoa" (elderly, feature phone), "Marco" (international tourist, fresh local SIM), users in low-connectivity areas (personas/customer-personas.md)
- Brandname SMS registration (5-10 weeks per carrier) is a hard blocker — start early (regulatory/telecom-sms.md)
- Dual-channel provides resilience: carrier SMS outages during Tet surge (10-20x traffic) are a known risk — Zalo ZNS is an independent delivery path (risk-matrix.md)
- eSMS aggregator recommended for SMS to avoid per-carrier integration (regulatory/telecom-sms.md)

> **Phase 1 Scope**: eSMS (SMS) only. Zalo ZNS integration deferred to Phase 2 — ZNS template approval and OA verification add lead time incompatible with beachhead launch timeline. SMS provides universal reach for 1-3 operator launch corridor. Better Auth OTP plugin (D8) wires to eSMS via custom adapter.

---

### 7. Rate Limiting & OTP Lockout — Phone-Based Sliding Window + 15-Minute Lockout

| Option | Pros | Cons |
|--------|------|------|
| IP-based rate limit only | Simple to implement; catches automated attacks from single source | Shared IPs (NAT, corporate, mobile carrier CGNAT) block legitimate users; VPN/proxy rotation trivially bypasses; does not protect per-account |
| Phone-based rate limit only | Targets the actual identity being attacked; doesn't affect other users | No protection against distributed phone enumeration (trying many phones from one IP); allows unlimited attempts from different IPs against one phone within the window |
| **Phone-based sliding window + lockout** | Per-phone tracking catches targeted brute-force; 15-min lockout after 3 failures stops automated OTP guessing; lockout sentinel reuses existing OTP row (no new table); audit-friendly (90-day log retention) | Legitimate user locked out after 3 typos (frustration); attacker can intentionally lock out a phone (denial-of-service on specific user) |
| CAPTCHA after N failures | Stops bots without locking out humans; no temporal lockout frustration | Poor mobile experience (CAPTCHA on phone is slow); accessibility barrier for "Ba Hoa" (elderly); adds third-party dependency (Google reCAPTCHA / hCaptcha); CAPTCHA solving services exist |

**Choice**: Phone-based sliding window + 15-minute lockout after failed OTP verifications

**Reasons**:
- OTP brute-force flagged as a risk — 6-digit OTP has 1M combinations; without rate limiting, automated guessing can crack it within the 5-minute TTL (risk-matrix.md)
- OTP state machine defines lockout sentinel: on failed verify mismatch threshold, the existing OTP row is repurposed as a lockout marker (`consumed=true`, `expiresAt` extended to `now + 15min`) — no new table or column needed (domain-model/state-machines.md)

> **CORRECTION** (2026-06-18): ADR states "3 failed OTP verifications" as lockout threshold. Code uses `MAX_OTP_ATTEMPTS=5`. The 15-minute lockout window is correct.
- 90-day OTP log retention requirement (PDPL 2025) means lockout events are naturally auditable through the same OTP table (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- CAPTCHA rejected: poor mobile experience is unacceptable for a population where 6/6 customer personas are mobile-primary; accessibility barrier for elderly segment "Ba Hoa" (personas/customer-personas.md)
- IP-based-only rejected: Vietnamese mobile carriers use extensive CGNAT — blocking by IP would lock out entire carrier subnets during Tet surge (risk-matrix.md)
- Lockout applies to BOTH send-OTP and verify-OTP paths — prevents attacker from burning delivery budget by spamming send requests (domain-model/invariants-catalog.md)
- I9 invariant (no raw phone in notification payload) ensures lockout events don't leak phone numbers through notification logs (domain-model/invariants-catalog.md)

---

### 8. Auth Provider — Better Auth (Self-Hosted in Next.js)

| Option | Pros | Cons |
|--------|------|------|
| Build from scratch | Full control; no dependencies; exact fit for three-realm model | Massive surface area: password hashing, token rotation, reuse detection, brute-force, TOTP — each a bug category we'd own entirely |
| Auth0 / Clerk (SaaS) | Decades of hardening; managed infrastructure; SOC2 audit logs | US/EU-hosted — requires CDTIA for Vietnamese user PII; per-MAU pricing at scale; external dependency for critical path |
| Firebase Auth (Google) | 50k MAU free; phone OTP built-in | Google Cloud = CDTIA needed; 1000-byte custom claim limit; no self-host |
| Supabase Auth (self-host) | Self-host on FPT Cloud (zero CDTIA); free; PostgreSQL-native | Separate GoTrue Docker container; Go codebase harder to debug for TypeScript team |
| **Better Auth (self-host)** | Self-host inside Next.js (zero CDTIA, zero extra container); MIT licensed, zero per-MAU; TypeScript-native with Prisma adapter; plugins for OTP, TOTP, phone-number; full session customization | Younger than Auth0/Firebase; smaller community; we still own realm routing, tenant isolation, CSRF, business authz |

**Choice**: Better Auth (self-hosted in Next.js, Prisma adapter)

**Reasons**:
- **Data residency solved** — runs inside our Next.js app on FPT Cloud. No separate container, no cross-border transfer, zero CDTIA
- **Zero ongoing cost** — MIT licensed, no per-MAU. SaaS providers cost $240-$300+/year at 10k MAU
- **TypeScript-native** — same Prisma ORM and PostgreSQL; no language boundary when debugging auth
- **Plugin system covers three realms**: `phoneNumber()` + `otp()` for customer via eSMS; built-in email+password for operator; `twoFactor()` for admin TOTP with backup codes
- **Custom session fields** — `realm`, `operatorId` stored in session; Edge middleware reads without DB lookup
- SaaS providers (Auth0, Clerk, Firebase) rejected: US/EU-hosted = CDTIA; external critical-path dependency; per-MAU pricing misaligned with pre-revenue startup

**Provider vs App Responsibility Split:**

| Provider (Better Auth) | App (Our Code) |
|----------------------|----------------|
| Password hashing (bcrypt cost 12) | Tenant isolation (`withOperatorScope`) |
| Session management (DB-backed, revocable) | IDOR checks (resource ownership) |
| Refresh token rotation + reuse detection | Zod validation (mass assignment) |
| Brute-force protection + rate limiting | Race condition guards (`SELECT FOR UPDATE`) |
| TOTP (setup, verify, backup codes, replay) | Webhook auth (SePay bearer token) |
| OTP (custom eSMS adapter) | CSRF double-submit |
| Token integrity (JWT signing, alg:none rejection) | Select whitelists (data leak prevention) |
| | Realm routing (path enforcement) |

**Three-Realm Routing via Better Auth:**
```
/api/auth/customer/otp/send     → phone OTP (eSMS)
/api/auth/customer/otp/verify   → session with realm='customer'

/api/auth/operator/login        → password → session with realm='operator', operatorId=X
/api/auth/operator/otp/send     → step-up OTP for sensitive ops

/api/auth/admin/login           → password+TOTP → session with realm='admin'
/api/auth/admin/totp/setup      → first-login QR scan
```

---

### 9. Password Hashing — bcrypt Cost 12

**Choice**: bcrypt with cost factor 12 (handled by Better Auth)

**Reasons**:
- ~250ms hash time balances security vs login latency
- Only operator and admin realms use passwords; customer is OTP-only

---

### 10. Separate JWT Signing Secrets Per Realm

**Choice**: Independent signing secret per realm (customer, operator, admin) — both access and refresh tokens

**Reasons**:
- Blast-radius isolation: compromised customer secret cannot forge operator/admin tokens
- Refresh secrets also per-realm — eliminates cross-realm token exchange attack
- Each secret independently rotatable (90-day cadence per D7)

---

### 11. Customer Refresh Token TTL — 30 Days

**Choice**: 30-day refresh token TTL for customer realm

**Reasons**:
- Phone-first Vietnam market: customers book trips days/weeks apart; 7-day TTL forces unnecessary OTP re-auth
- 30 days aligns with repeat booking: "Chị Lan" (migrant worker) books returns 2-4 weeks apart
- Operator stays 7 days (shift-scoped); admin stays 24 hours (high-security)
- Rotation + reuse detection still active regardless of TTL length

---

### 12. Phase 1 Staff Deferral

**Choice**: Staff management (FI-011) deferred to Phase 2. Phase 1 = single operator user per company (`role='admin'` only).

**Reasons**:
- Beachhead launch targets 1-3 operators in one corridor — owner-operated micro fleets (60-70% of market) have no staff to manage
- Staff RBAC, `StaffTripAssignment`, mobile console ship in Phase 2 when multi-operator adoption drives demand
- `OperatorRole` enum (`admin | staff`) already in schema; no migration needed when Phase 2 ships

---

## Consequences

### Positive
- Passwordless customer auth eliminates password-related support burden (resets, credential stuffing, account lockout) — reduces complaint volume against 3-day acknowledge SLA
- Three-realm separation (OTP / password+OTP / password+TOTP) matches security requirements proportional to each group's risk profile and technical literacy
- Hybrid JWT session enables Edge-level auth enforcement with zero DB hit — critical for Tet surge latency and cross-cutting gate enforcement
- Better Auth handles identity primitives (password hashing, session rotation, TOTP, OTP) — reduces hand-rolled auth surface and resolves TOTP replay/backup-code HALT blockers
- Phase 2: Zalo ZNS primary channel will save 50-70% on OTP delivery costs at scale
- OTP lockout sentinel reusing existing OTP row avoids schema sprawl — no new table for a single boolean state
- Double-submit CSRF is stateless, Edge-compatible, and consistent with JWT session architecture

### Negative
- OTP-only customer auth has per-login delivery cost (~200-500 VND) — becomes a significant cost line at scale (100K+ logins/month)
- Dual OTP channel (Zalo ZNS + SMS) doubles integration surface and requires routing logic with fallback detection
- 15-minute lockout after 3 failures enables targeted denial-of-service against specific phone numbers (attacker intentionally locks out a user)
- Operator hybrid auth (password + OTP step-up) is two systems to build and maintain — more complexity than either pure approach
- TOTP MFA for admins requires authenticator app setup and device-loss recovery flow

### Mitigations
- OTP delivery cost: Zalo ZNS primary (200-500 VND) vs SMS-only (300-800 VND) saves 50-70%; long-term, session refresh extends time between OTP logins
- Lockout DoS: 15-minute window is short enough to self-resolve; support agent can verify identity and clear lockout via admin portal (personas/admin-personas.md, Customer Support Agent role)
- Dual channel complexity: eSMS aggregator abstracts carrier-level SMS complexity; Zalo ZNS has a single API endpoint; routing logic is a simple "try ZNS → on failure → SMS" waterfall
- TOTP device loss: backup codes generated at MFA enrollment; Operations Manager can temporarily disable MFA for admin account recovery (personas/admin-personas.md)
- Operator auth complexity: first-login flow is a one-time cost per operator; daily usage is password-only (low friction); OTP step-up triggers only on high-risk operations (infrequent)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| personas/customer-personas.md | D1, D6, D7 |
| personas/operator-personas.md | D2, D4 |
| personas/admin-personas.md | D2, D3, Mitigations |
| market-research/user-insights.md | D1, D6 |
| regulatory/telecom-sms.md | D6 |
| regulatory/data-privacy.md | D3, D4, D5, D7 |
| regulatory/dpia-checklist.md | D3, D7 |
| regulatory/consumer-protection.md | D1, D5 |
| domain-model/bounded-contexts.md | D2, D4, D5 |
| domain-model/state-machines.md | D4, D7 |
| domain-model/invariants-catalog.md | D2, D4, D5, D7 |
| domain-model/event-flows.md | D2, D3, D4 |
| domain-model/ubiquitous-language.md | D1 |
| competitor-benchmark/feature-parity-matrix.md | D1 |
| competitor-benchmark/operator-sentiment.md | D1 |
| competitor-benchmark/pricing-comparison.md | D2 |
| risk-matrix.md | D2, D3, D4, D6, D7 |
| vietnam-market-context.md | D2, D3 |
| investor-kpis.md | D3 |
