# Migration Safety — `20260726120000_hold_session_seat_cap`

**Verdict: SAFE** (additive-only; no rollback data risk). Worked example for the DR/rollback runbook.

## Change
```sql
ALTER TABLE "Hold" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;               -- nullable, no default
CREATE INDEX IF NOT EXISTS "Hold_sessionId_status_expiresAt_idx"
  ON "Hold" ("sessionId", "status", "expiresAt");                          -- plain composite
```

## Safety scan
| Risk class | Present? | Note |
|------------|----------|------|
| DROP COLUMN / TABLE | No | purely additive |
| NEW NOT NULL column | No | `sessionId` is nullable; existing rows keep NULL (createHold skips the session check for NULL) |
| Type narrowing | No | new TEXT column |
| Rewrite / long lock | No | `ADD COLUMN` nullable-no-default = metadata-only (instant, no table rewrite on PG 11+) |
| Index build lock | Minor | plain `CREATE INDEX` takes a brief `SHARE` lock on `Hold`. `Hold` is small/short-lived (10-min TTL rows). If ever large, use `CREATE INDEX CONCURRENTLY` in a separate non-transactional migration. Not needed at current scale. |
| Backfill required | No | NULL is a valid, intended state |
| `@@index` in schema.prisma | Required | declared in schema.prisma per the Issue-007 raw-SQL-index rule (index is DSL-expressible) |

## Lock budget
`ADD COLUMN` nullable-no-default: metadata-only, ~0 lock time. `CREATE INDEX` (non-concurrent):
`SHARE` lock blocks writes to `Hold` for the build duration — negligible on a small table. No AccessExclusive.

## Rollback / reverse
Forward-only (ADR-017 — no DOWN). If reversal were ever needed: this is a two-phase-safe additive change —
Phase A (this migration) adds the column/index; a hypothetical drop would be a separate Phase-B migration
after all code stops referencing `sessionId`. Promote-previous of the CODE is safe with the column present
(nullable, unused by old code).

## Deploy check
Post-deploy: `\d "Hold"` shows `sessionId` + the index; createHold still succeeds for both NULL-session
(cookie-less) and set-session callers.
