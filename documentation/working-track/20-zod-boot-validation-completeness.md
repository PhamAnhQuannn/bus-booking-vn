# 20 -- Zod Boot Validation Completeness

## Status: DONE

## What changed

Audited all `process.env.*` reads across the codebase (86 unique vars) against the Zod schema in `lib/config/env.ts` (was 43 vars). Added 5 missing production-facing variables:

1. **`REFRESH_TOKEN_SECRET`** — min 32 chars, optional (test fallback), required in production via superRefine
2. **`UPSTASH_REDIS_REST_URL`** — url, optional, required when `REDIS_PROVIDER=upstash` via superRefine
3. **`UPSTASH_REDIS_REST_TOKEN`** — string, optional, required when `REDIS_PROVIDER=upstash` via superRefine
4. **`SHADOW_DATABASE_URL`** — url, optional (Prisma migrations only)
5. **`OTP_PEEK_ENABLED`** — string, optional (dev/test gate)

## What was NOT added (and why)

- `SEARCH_USE_BLOCKED_SEATS`, `MANUAL_BOOKING_ENABLED` — not referenced in code, only in `.env.example` comments
- `ADMIN_TOTP_DISABLED` — not referenced in code, only in docs
- `NEXT_PUBLIC_*` vars — client-side, not server boot-time validated
- `E2E_*` flags, `CI`, `NODE_ENV` — test/CI infra, not app boot
- `STORAGE_BUCKET` — already in schema (optional), no code reads it yet (deferred Wave-9 S3)

## Files modified

- `lib/config/env.ts` — added 5 schema fields + Upstash superRefine + REFRESH_TOKEN_SECRET to production required list

## Verification

- `pnpm tsc --noEmit` — clean
- `pnpm lint` — 0 errors
