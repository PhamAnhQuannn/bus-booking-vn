> ← [Previous](../17-file-storage/) | [Index](../README.md) | [Next →](../19-compliance/)

## 18. Security

### 18.1 CSRF — Cross-Site Request Forgery

**What it is**: An attack where a malicious website tricks your browser into making requests to our site using your existing login session. Example: you're logged into the operator console, you visit a malicious site, and it silently submits a POST request to our API to create a trip — using your session cookies.

**How we prevent it** (Double-Submit Cookie pattern):
1. Server sets a `bb_csrf` cookie (readable by JavaScript, NOT HttpOnly)
2. Client reads this cookie and sends its value as an `X-CSRF-Token` header with every POST/PUT/DELETE
3. Server verifies: cookie value = header value

The malicious site can trigger the browser to send cookies (automatic), but it CANNOT read our cookies (same-origin policy) → it can't set the header → request rejected.

**Scope**: All non-safe (`POST/PUT/PATCH/DELETE`) requests to `/api/*` — customer, operator, AND admin. Webhook endpoints are exempt (they authenticate via HMAC, not cookies).

### 18.2 HMAC — Hash-based Message Authentication Code

**What it is**: A way for payment providers to prove that a webhook really came from them (not an attacker). Both sides share a secret key. The sender hashes the request body with the secret → attaches the hash as a header. The receiver hashes the same body with the same secret → compares. If they match, the message is authentic.

```
MoMo sends:  POST /api/payments/momo/webhook
             Body: { orderRef: "BB-2026-...", amount: 450000, ... }
             Header: X-MoMo-Signature: sha256(body + secret_key)

Our server:  Computes sha256(body + our_copy_of_secret_key)
             Compares with the header value
             Match → authentic. Mismatch → reject (401).
```

### 18.3 Rate Limiting

**What it is**: Capping how many requests a client can make in a time window. Prevents brute-force attacks, abuse, and accidental DoS.

| Endpoint | Limit | Why |
|----------|-------|-----|
| Search API | 30 req/min per IP | Prevent scraping |
| OTP send | 3 req/15 min per phone | Prevent SMS bombing |
| OTP verify | 5 attempts per code | Prevent brute-force guessing |
| Login | 5 req/15 min per username | Prevent credential stuffing |
| Hold creation | 3 concurrent per IP | Prevent inventory DoS |
| General API | 100 req/min per IP | Safety net |

Implemented via Redis counters with TTL expiry.

### 18.4 Tenant Isolation

Every operator-owned query is scoped by `operatorId`. A `withOperatorScope` helper ensures this automatically. Without it:

```sql
-- WRONG: returns ALL operators' trips
SELECT * FROM "Trip" WHERE status = 'scheduled';

-- RIGHT: returns only this operator's trips
SELECT * FROM "Trip" WHERE status = 'scheduled' AND "operatorId" = 'op123';
```

### 18.5 Input Validation

All user input is validated at the API boundary using Zod schemas (typed validation). This prevents:
- **SQL injection**: Prisma parameterizes queries automatically, but validation catches malformed data before it reaches the ORM
- **XSS** (Cross-Site Scripting): Server-rendered content is escaped by React; user input in URLs is validated
- **Command injection**: No shell commands are constructed from user input

### 18.6 Admin Hardened Door

The admin console has additional security layers:
- Separate credential store (not in customer/operator tables)
- Invite-only (no self-registration path exists)
- Mandatory TOTP (not optional)
- Step-up re-auth for privileged actions (re-enter TOTP before approving operators or processing payouts)
- Short session TTL (30 minutes)
- Exact-match path allowlist in middleware (not prefix-match — prevents `/admin-bypass` attacks)
- Audit log on every action
