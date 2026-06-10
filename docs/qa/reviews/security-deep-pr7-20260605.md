SECURITY-DEEP REVIEW — PR #7 "feat: push rebuild backlog + OTA polish + pay/profile/OTP fixes"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/7
Base/Head: master ← feat/rebuild-complete @ 3fc5afba
Decision:  (none yet)
Generated: 2026-06-05

Findings: 4  (P1: 1 · P2: 0 · P3: 3)
Method: pattern scan over added (+) lines of the full master..HEAD diff across 6 categories
        (crypto / threat-delta / rate-limit / audit-log / authz / PII).

P1 — BLOCKING:
  app/api/auth/register/route.ts + login counterpart  🚫 P1: OTP proof not consumed (replay).
    The route does a raw `jwtVerify` of the `otpProof` JWT; `lib/auth/otpProof.ts:30-33`
    `JTI_REQUIRED_PURPOSES` omits `'otp_proof'`, so the jti is never SETNX-consumed. The proof is
    replayable for its full 5-min TTL — contradicting the one-shot guarantee documented in the
    AGENTS.md Issue 007 Mistake Log. (Same finding as /code-review pass — listed here as the
    security-authoritative record.)
    Fix: add `'otp_proof'` to `JTI_REQUIRED_PURPOSES` + route register/login through
    `verifyOtpProof()` (Redis SETNX jti-consume) instead of raw `jwtVerify`. Mitigated today by
    PHONE_TAKEN unique constraint + global IP rate-limit, but the replay-safety property is lost.

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  app/api/charter/[ref]/cancel/route.ts:38  ℹ️  P3: capability-ref authz (no session check).
    By DESIGN (documented): the charter ref (CH-YYYY-XXXXXX, 36^6 ≈ 2.1B/yr) is the access key;
    anyone with the customer's status link can cancel pre-accept. CSRF double-submit still applies;
    no payment, no PII beyond the customer's own submitted contact. Enumeration is impractical
    under the global edge IP rate-limit. Acceptable for lead-gen — noted, not blocking.
    Optional hardening: bump ref entropy or bind a status-link token if charter ever carries PII.

  prisma/schema.prisma  ℹ️  P3: PII columns stored plaintext at rest.
    contactPhone/contactEmail/buyerPhone/buyerEmail/phone/email persist unencrypted (passwordHash
    is argon2id — correct). Standard for a booking domain; MITIGATED by the issue-090 retention
    sweeper (snapshotAnonymizedAt anonymizes guest PII on expiry) + redactPhone in logs.
    No action required unless a compliance regime mandates at-rest encryption.

  email/SMS dispatch  ℹ️  P3: no per-USER quota on notification sends (only per-IP edge limit).
    NOTIFY_STUB makes email/SMS log-only today, so no real paid-action abuse surface. Revisit at
    go-live when real ESMS/email keys land — add a per-customer/per-phone send quota then.

CLEAN (scanned, no findings):
  - CRYPTO: passwords argon2id (m=65536,t=3,p=4) + constant DUMMY_HASH for timing equalization on
    missing/disabled-user paths (good practice). No createCipher/ECB/md5/sha1-on-password,
    no Math.random for secrets. randomBytes(1) in *Ref.ts is CSPRNG base36 ref-code chars (not a
    key/IV/nonce — out of the <16-byte rule's scope). TOTP RFC6238 on node crypto. JWT HS256.
  - RATE-LIMIT: global edge IP limiter in proxy.ts on ALL non-safe /api/* (issue 096) — 429 +
    Retry-After, webhooks HMAC-exempt. Covers login/otp/password/register abuse surface.
  - AUDIT-LOG: every POST/PUT/PATCH/DELETE under app/api/admin/** emits writeAdminAuditLog
    (zero NO-AUDIT hits). Admin finance routes additionally gated by TOTP + role + step-up.
  - AUTHZ: every non-webhook/non-health mutation route calls an auth helper
    (requireCustomerAuth/requireOperatorAuth/requireAdminAuth/readHoldCookie) — the sole
    no-helper route (charter cancel) is intentional capability-ref authz (P3 above).
  - DANGEROUS SINKS: no eval/Function/child_process/exec, no dangerouslySetInnerHTML, no
    $queryRawUnsafe/$executeRawUnsafe, no DDL in app code, no user-input→raw-SQL/redirect.
    ($$eval hits are Playwright smoke scripts, not JS eval.)

RECOMMENDED NEXT:
  - Address the P1 otpProof replay before merge (or document the deliberate exemption).
  - P3s are advisory; the email/SMS quota one is a go-live (#094) follow-up.

SUMMARY: 1 P1 · 0 P2 · 3 P3 · pinned to 3fc5afba
