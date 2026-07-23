# 05 -- Admin TOTP Replay Protection

## Status: DONE

## What changed

Added TOTP replay protection per HD-012 spec. Same TOTP code cannot be reused within the ±1 window (90s TTL).

1. **Exported `consumeJti`** from `lib/auth/otpProof.ts` — reuses existing Redis SETNX infrastructure (in-memory dev/test, ioredis, upstash)
2. **Added replay guard** to `verifyLoginTotp()` in `lib/auth/adminTotp.ts` — after TOTP code validates, `consumeJti('totp-replay:{adminId}:{code}', 90)` prevents reuse
3. **New result reason** `'code_already_used'` in `VerifyLoginTotpResult` union
4. **Route handler** (`app/api/admin/auth/totp/verify/route.ts`) needs no changes — replay falls through to generic `!result.ok` → 401 INVALID_CODE (correct: no information leak)

## Files modified

- `lib/auth/otpProof.ts` — export `consumeJti`
- `lib/auth/adminTotp.ts` — import `consumeJti`, add replay check, extend result type
- `lib/auth/__tests__/adminTotp.test.ts` — mock `consumeJti`, add replay test, update existing test

## Verification

- `pnpm vitest run lib/auth/__tests__/adminTotp.test.ts` — 9/9 pass
- `pnpm tsc --noEmit` — clean
- `pnpm lint` — 0 errors
