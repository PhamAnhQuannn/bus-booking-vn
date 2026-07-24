# 04 -- PayoutAccount Bank Details Field-Level Encryption

## Status: DONE

## What changed

Added AES-256-GCM field-level encryption for `PayoutAccount.accountNumber` (KG-03, HD-001 Layer 3).

### New files
- `lib/security/bankCrypto.ts` — `encryptBankField()` / `decryptBankField()` using `BANK_ENCRYPTION_KEY`
- `lib/security/__tests__/bankCrypto.test.ts` — round-trip, random IV, backward compat, edge cases

### Modified files
- `lib/onboarding/payoutAccount.ts` — encrypt on write (`setPayoutAccount`), decrypt on read (`getPayoutAccount`, `getPayoutAccountInternal`)
- `lib/onboarding/__tests__/payoutAccount.test.ts` — updated to assert encrypted storage + backward compat with plaintext rows
- `lib/security/index.ts` — barrel export for bankCrypto
- `lib/config/env.ts` — added `BANK_ENCRYPTION_KEY` to Zod schema + production-required list
- `.env.example` — added `BANK_ENCRYPTION_KEY` placeholder
- `.github/workflows/ci.yml` — added `BANK_ENCRYPTION_KEY` to E2E job env

## Design decisions

1. **Separate key from TOTP** — `BANK_ENCRYPTION_KEY` isolated from `TOTP_ENCRYPTION_KEY`. Key compromise in one domain doesn't expose the other.
2. **Backward-compatible decrypt** — `enc:v1:` prefix detection. Pre-encryption plaintext rows pass through `decryptBankField()` unmodified. Next write encrypts them.
3. **No migration needed** — rolling encryption via backward compat. No big-bang column rewrite.

## Verification

- `pnpm tsc --noEmit` — clean
- `pnpm test` — 1475/1475 pass (14 new/updated tests)
