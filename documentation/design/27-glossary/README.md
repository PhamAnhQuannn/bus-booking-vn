> ← [Previous](../26-evolution/) | [Index](../README.md) | [Next →](../README.md)

## 27. Glossary

| Term | Definition | First used |
|------|-----------|------------|
| **ACID** | Atomicity, Consistency, Isolation, Durability — four guarantees of a reliable database transaction. All-or-nothing, rules enforced, concurrent ops don't interfere, committed data survives crashes. | Section 6.1 |
| **Advisory lock** | A PostgreSQL lock acquired by application code (not tied to a row/table) to serialize concurrent operations — used to prevent duplicate cron runs. | Section 16.3 |
| **Aggregate root** | The single entity through which all modifications to a cluster of related objects must pass. You lock the root to ensure consistency of the whole cluster. | Section 6.6 |
| **Barrel file** | An `index.ts` that re-exports a module's public API. Other modules import only through this file — hides internal implementation details. | Section 3.1 |
| **BigInt** | JavaScript's arbitrary-precision integer type. Used for all money math to avoid floating-point rounding errors that occur with `Number`. | Section 10.2 |
| **Bounded context** | A self-contained area of the system with its own vocabulary and rules. Each `lib/<domain>/` folder is a bounded context. | Section 6.6 |
| **CDN** | Content Delivery Network — geographically distributed servers that cache static assets (JS, CSS, images) close to users for faster delivery. | Section 4.2 |
| **CUID** | Collision-resistant Unique Identifier — time-sorted, globally unique ID generated without a central coordinator. Better B-tree locality than random UUIDs. | Section 6.5 |
| **CSRF** | Cross-Site Request Forgery — an attack where a malicious site tricks your browser into making authenticated requests to another site using your cookies. | Section 18.1 |
| **Edge runtime** | A lightweight JavaScript environment at CDN edge nodes (Vercel). Cannot use Node.js APIs like Prisma or `crypto` — only `jose` for JWT verification. | Section 8.5 |
| **HMAC** | Hash-based Message Authentication Code — a cryptographic signature proving a message (e.g., webhook) came from the claimed sender. Both sides share a secret key. | Section 18.2 |
| **Idempotency** | Property where performing an operation multiple times produces the same result as doing it once. Critical for payment webhooks that may be retried. | Section 9.4 |
| **JWT** | JSON Web Token — a small, signed data packet (`header.payload.signature`) proving identity. The server verifies the signature without a database query. | Section 8.2 |
| **Monotonic transition** | A state machine that only moves forward, never backward. `paid → pending` is illegal even if a stale webhook tries it. | Section 9.5 |
| **OTP** | One-Time Password — a temporary code sent to your phone (SMS) to prove phone ownership. Expires after a short TTL. | Section 1.2 |
| **PII** | Personally Identifiable Information — any data that can identify a specific person (name, phone, email). Must be anonymized on account deletion. | Section 19.3 |
| **PDPD** | Vietnam's Personal Data Protection Decree (Nghị định 13/2023/NĐ-CP) — governs collection, storage, processing, and erasure of personal data in Vietnam. | Section 2.5 |
| **PSP** | Payment Service Provider — a company handling money movement (MoMo, VNPay, Stripe). Integrates with banks so you don't have to. | Section 9.2 |
| **RBAC** | Role-Based Access Control — permissions assigned to roles (admin, staff, finance), not individual users. System checks "does this role allow this action?" | Section 8.3 |
| **Tenant isolation** | Ensuring one operator can never see or modify another's data. Every query includes `WHERE operatorId = ?` via the `withOperatorScope` helper. | Section 8.4 |
| **TOCTOU** | Time-of-Check to Time-of-Use — a race condition where state changes between checking a condition and acting on it. Fixed by locking during both steps. | Section 11.4 |
| **TOTP** | Time-based One-Time Password — a rotating code from an authenticator app (Google Authenticator), changing every 30 seconds. Stronger than SMS OTP. | Section 2.4 |
| **TTL** | Time-To-Live — a countdown after which data expires. Holds expire after 10 minutes, OTPs after 5 minutes, access tokens after 15 minutes. | Section 13.1 |
| **Webhook** | A URL that a third party (e.g., MoMo) calls to notify us of an event (e.g., payment confirmed). The reverse of an API call — they call us. | Section 7.1 |

---

*This document is the system design source of truth. It should be updated as decisions change or new subsystems are added. For code-level specifications, see `rebuild-plan.md`.*
