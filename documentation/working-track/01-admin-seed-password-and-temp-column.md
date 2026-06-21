# 01 -- Admin Seed Password + tempPasswordPlain Column

## Status: DONE

## What changed

1. **tempPasswordPlain column** — already dropped in migration `20260615000000_drop_temp_password_plain`. No further action needed.
2. **Admin seed password** — replaced hardcoded `'123456'` with `genTempPassword()` in `scripts/seed/seed-admin.ts`. Password is now cryptographically random, printed to console on each seed run.

## Files modified

- `scripts/seed/seed-admin.ts` — import `genTempPassword`, replace hardcoded password

## Verification

- `pnpm tsc --noEmit` — clean
- Logger redaction + forbidden-field guards already cover `tempPassword`/`tempPasswordPlain` defensively
- Column confirmed absent from `prisma/schema.prisma` OperatorUser model

## Out of scope

- Operator seed password `BBOp2026!` in `prisma/seed.ts` — used as test fixture across 30+ e2e specs. Changing it would require updating all e2e files. Separate concern if needed.
