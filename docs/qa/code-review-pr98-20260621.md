CODE REVIEW — PR #98 "WT-04: Add AES-256-GCM encryption for PayoutAccount bank details (KG-03)" @ 80e23042
────────────────────────────────
Diff scope: 10 files, +159 / -14 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

SUMMARY: 0 P1, 0 P2, 0 P3

ANALYSIS NOTES:

Category 1 — Correctness:
  - bankCrypto.ts mirrors the established totpCrypto.ts pattern exactly (AES-256-GCM, 12-byte IV, 16-byte tag, enc:v1: prefix). Pattern already battle-tested.
  - Backward compat: decryptBankField() passes through non-prefixed strings. Bank account numbers are numeric digits — cannot collide with "enc:v1:" prefix. Safe.
  - getKey() test fallback uses 'cd'.repeat(32) — different from totpCrypto's 'ab'.repeat(32). Keys are domain-isolated even in test env. Correct.
  - setPayoutAccount encrypts once, stores encrypted. Read paths decrypt. No double-encrypt risk (encrypt is only called in setPayoutAccount, not in any read path).

Category 2 — Security:
  - Separate BANK_ENCRYPTION_KEY from TOTP_ENCRYPTION_KEY — key isolation per data domain. Good practice.
  - CI secret uses the same test-only hex string as TOTP_ENCRYPTION_KEY — acceptable for CI (not production). Pattern matches existing CI secrets.
  - No secrets in diff (CI values are clearly labeled test-only).
  - accountNumber already on logger redact list (Issue 078). No new PII fields introduced.
  - Production-required via Zod superRefine. App won't boot without it.

Category 3 — Failure mode:
  - encryptBankField/decryptBankField are sync functions (crypto is sync). No unhandled promise risk.
  - If BANK_ENCRYPTION_KEY missing in non-test env, getKey() throws synchronously — fail-fast. Correct.
  - If ciphertext is corrupted (truncated, wrong key), createDecipheriv will throw. This propagates up to the caller (getPayoutAccount/getPayoutAccountInternal). Route handlers above already handle errors. Acceptable — corrupted ciphertext = data integrity issue, should fail loud.

Category 4 — Test coverage:
  - bankCrypto.test.ts: 5 tests (round-trip, random IV, backward compat, empty string, long string). Covers all branches.
  - payoutAccount.test.ts: updated to assert encrypted storage + 2 new backward compat tests. All read/write paths covered.
  - No missing test for any new branch or function.

Category 5 — Naming:
  - encryptBankField / decryptBankField — clear, matches the pattern of encryptTotpSecret / decryptTotpSecret. Consistent naming.
  - No magic numbers beyond crypto constants (12, 16) which are standard AES-256-GCM parameters.

Category 6 — Diff hygiene:
  - Clean diff. No console.log, debugger, .only/.skip. No unrelated changes.

RECOMMENDED NEXT STEPS:
  → No findings. Ship when CI green.
