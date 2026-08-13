# HD-013 — Security ruleset

Standing security rules distilled from the 2026-08-13 multi-agent security audit (3 analysts +
red-team → synthesis; umbrella issue #570). These are **invariants to preserve**, not a one-time
checklist — each maps to a finding (SEC-* / issue #) and, where applicable, a regression test.

The highest-signal rules are also mirrored in `CLAUDE.md` → `## Project Rules` → `### Security`
(always loaded). This doc is the full reference.

## Baseline that MUST NOT regress
Per-realm JWT secrets + cross-realm `scope` guards · tenant isolation via `withOperatorScope`
(force-overwrites `operatorId`) + service-layer ownership predicates with 404 existence-hiding ·
admin RBAC = `requireAdminAuth`(role+TOTP) + `requireStepUp` on money/approval, DB-role
authoritative · self-target guards on role-change/revoke · all raw SQL parameterized (no
`*Unsafe`/`Prisma.raw` on user input) · outbound fetches env-pinned (no SSRF) · comprehensive
logger redaction · security headers present · zod at route boundaries · `withErrorHandler`
leak-safe.

## Rules

### Web / output encoding
1. **Inline-script serialization** (SEC-XSS-JSONLD #557) — any DB/user string serialized into an
   inline `<script>` MUST go through `jsonLdHtml()` (`lib/seo/index.ts`) or an equivalent that
   escapes `<`,`>`,`&`,`U+2028/9`. Never bare `JSON.stringify` in `dangerouslySetInnerHTML`.
2. **Prod `script-src`** (SEC-CSP-NONCE #560) — production `script-src` MUST use a per-request
   nonce (or hash allowlist), never `'unsafe-inline'`. *(Open — deferred to a dedicated PR.)*

### Dev-only surfaces & config
3. **`app/dev/**` prod guard** (SEC-DEV-STUB-PROD-SAFETY #559) — every `app/dev/*` route/action/page
   MUST refuse in production via `@/lib/dev/prodGuard` (`devRouteProdGuard` / `assertDevActionAllowed`
   / `assertDevPageAllowed`), independent of any `*_STUB` flag.
4. **Prod fail-fast** — `getEnv()` MUST fail the boot in production unless `STORAGE_STUB=false`
   (real object storage). *(`PAYMENTS_STUB` is intentionally allowed true in Phase-1: online PSP is
   stubbed, bank transfer is the real rail, and `/dev/stub-pay` is prod-404'd.)*
5. **No committed secret defaults** — anything with a signing/verify role MUST NOT ship a hardcoded
   default (e.g. `STORAGE_STUB_SECRET` now defaults to a per-process random).

### Data layer
6. **Runtime DB role** (SEC-DB-LEASTPRIV #558) — production `DATABASE_URL` MUST authenticate as a
   DML-only role (no DDL/DROP/TRUNCATE); DDL reserved to the `DIRECT_URL` migration role. See
   `scripts/db/least-privilege-role.sql` + its runbook.

### Middleware / auth plumbing
7. **CSRF exemption** (SEC-CSRF-EXACT #561) — CSRF-exempt matching MUST be exact-path `Set`
   membership (`CSRF_EXEMPT` in `proxy.ts`), never `startsWith`. One entry per exempt route.
8. **Identity via HOFs only** (SEC-OP-PROFILE-HOF #563) — route handlers MUST obtain identity only
   through `require{Customer,Operator,Admin}Auth` HOFs; never call `verify*Access` inline.
9. **Step-up elevation anchored server-side** (SEC-ADMIN-TOTP-ANCHOR #564) — second-factor/step-up
   elevation MUST be read from the server session row, never reconstructed from a self-asserted
   refresh parameter.
10. **Static-bearer auth** (SEC-CRON-AUTH #562) — cron/webhook bearer checks MUST use
    `crypto.timingSafeEqual` via one shared helper (`assertCronAuth`, `lib/core/http/cronAuth.ts`);
    every `app/api/cron/*` MUST 401 without the secret (test-enforced).

### Requests / responses
11. **Trusted base URLs** (SEC-BASEURL #565) — outbound-email/redirect base URLs MUST come from a
    trusted env (`NEXT_PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL`), fail-closed in prod; never
    `Host`/`x-forwarded-host`/`req.origin`.
12. **Opaque error bodies** (SEC-ZOD-LEAK #566) — route error responses MUST return an opaque code
    (`{ error: 'INVALID' }`); never echo `zodError.issues`.

### CI / ops
13. **CI gates** (SEC-CI-GATE #567) — `master` MUST require the security jobs (gitleaks, dep-audit,
    data-leak-audit, greppable-invariants) as passing checks; dependency-audit MUST fail on `high`.
14. **Secret rotation** (SEC-SECRET-ROTATION #568) — every prod-required secret MUST have a rotation
    runbook; at-rest encryption keys (`BANK_ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY`) MUST support a
    documented dual-key re-encrypt rotation.
15. **Durable refund-outs** (SEC-REFUND-DURABILITY #569) — refund-out obligations MUST be persisted
    (outbox) in the paid transaction and cron-driven, not fire-and-forget `after()`.

## Status (2026-08-13)
- **Done (this batch):** 1 (#557), 3+4+5 (#559), 7 (#561), 10 (#562).
- **Infra artifact (user applies):** 6 (#558).
- **Open / planned:** 2 (#560), 8 (#563), 9 (#564), 11 (#565), 12 (#566), 13 (#567), 14 (#568),
  15 (#569).
