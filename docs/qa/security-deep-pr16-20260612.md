SECURITY-DEEP REVIEW — PR #16 "feat(admin): show temp password + unmasked phone on operator detail (issue 113)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/16
Base/Head: master <- feat/113-temp-password-plain @ 2f9684dd
Generated: 2026-06-12

Findings: 1  (P1: 0 · P2: 0 · P3: 1)

P1 — BLOCKING:
  (none)

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  prisma/schema.prisma (OperatorUser.tempPasswordPlain)  ℹ️  P3: New column stores plaintext password.
    Column is nullable TEXT with no at-rest encryption. The PR description and
    issues/113-remove-temp-password-plain.md document this as dev-only, blocking
    094 go-live. No action needed now — issue 113 tracks removal/encryption before
    production. Noting for completeness.

CHECKLIST (all clean):
  [CRYPTO]       No crypto changes in diff. Existing bcrypt/argon2 paths untouched.
  [AUTHZ]        No new handlers. Admin page guarded by requireAdminPage(). Auth
                 routes (password/change, forgot-password/reset) are existing handlers
                 with unchanged authz — only data field added to update call.
  [RATE-LIMIT]   No new endpoints. Pre-existing rate-limit posture unchanged.
  [AUDIT-LOG]    createOperatorAccount already calls writeAdminAuditLog(). No new
                 admin mutations introduced. Auth routes are operator-facing, not admin.
  [PII/LOGGING]  No console.log or logger calls in changed files. tempPasswordPlain
                 flows through RSC props to admin-only UI (requireAdminPage guard).
                 contactPhone unmasked — acceptable for admin view (was over-redacted).
  [INJECTION]    No user input flows changed. No new SQL, shell, or HTML interpolation.

SUMMARY: 0 P1 · 0 P2 · 1 P3 · pinned to 2f9684dd
