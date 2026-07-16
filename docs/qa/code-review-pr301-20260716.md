CODE REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ f66a1caf
────────────────────────────────
Diff scope: 23 files, +100 / -78 lines

Source changes by domain:
  schema:   prisma/schema.prisma, prisma/migrations/20260715010000_neon_readiness/migration.sql
  ledger:   lib/ledger/{calcPayout,getPayoutReport,getRevenueReport,settlePayout,withdrawal}.ts
  admin:    lib/admin/{getOperatorDetail,getPayoutQueue}.ts
  jobs:     lib/jobs/processPayouts.ts
  core:     lib/core/db/client.ts
  UI:       app/admin/(console)/operators/[id]/page.tsx, app/op/(console)/money/page.tsx,
            app/op/(console)/reports/payouts/PayoutsClient.tsx
  tests:    7 test files + 1 e2e spec updated


PRIORITY 1 — Block push, fix first:
  (none)


PRIORITY 2 — Fix before merge:
  [CORRECTNESS / CONFIG] lib/core/db/client.ts:14-18
    DATABASE_POOL_MAX default changed from 5 to 1, connectionTimeoutMillis from 3000 to 10000.
    Intent: Neon serverless compatibility (Neon proxy handles pooling, cold-start latency).
    Risk: applies to ALL environments — dev with local Postgres and CI integration tests
    also get pool max=1 by default. Concurrent DB operations queue on a single connection.
    Mitigated by DATABASE_POOL_MAX env var override, but undocumented behavior change.
    Fix: either guard with a Neon-specific check, or document the new default in .env.example
    and ensure CI env sets DATABASE_POOL_MAX=5.


PRIORITY 3 — Address when convenient:
  [READABILITY / CONSISTENCY] lib/ledger/getRevenueReport.ts:142-143
    `Number(platformFee)` and `Number(net)` convert BigInt back to Number for
    RevenueReportRow DTO. Other DTOs (PayoutReportRow, PayoutQueueRow,
    OperatorPayoutHistoryItem) use string serialization. Per-trip VND amounts
    are well within Number.MAX_SAFE_INTEGER so this is safe, but inconsistent.


NOTES (informational, not findings):

  [OK] lib/ledger/calcPayout.ts — now returns BigInt end-to-end. Eliminates the
    Number() precision boundary that Issue 016 mistake log flagged. BigInt arithmetic
    preserved through the entire pipeline.

  [OK] lib/jobs/processPayouts.ts:120 — `-payout.net` replaces `-BigInt(payout.net)`.
    Since net is already bigint, direct negation is correct and avoids double-conversion.

  [OK] prisma/schema.prisma — all new @@index declarations match migration SQL:
    - Trip @@index([busId]) ↔ CREATE INDEX Trip_busId_idx
    - LedgerEntry @@index([operatorId, createdAt]) ↔ CREATE INDEX LedgerEntry_operatorId_createdAt_idx
    - Hold @@index([status, expiresAt]) ↔ CREATE INDEX Hold_status_expiresAt_idx (replaces expiresAt-only)
    - Operator @@index([id]) removed ↔ DROP INDEX Operator_id_idx (redundant with PK)
    Compliant with Issue 007 rule: non-partial indices declared in both DSL and SQL.

  [OK] Migration uses ALTER COLUMN SET DATA TYPE BIGINT — Postgres rewrites the column
    in-place. No default needed (existing Int values auto-widen to BigInt). Safe on
    append-only LedgerEntry table (committed migrations never edited per project rules).

  [OK] DTO boundary serialization — BigInt fields consistently converted to string
    via .toString() at service/DTO boundary (getPayoutReport, getPayoutQueue,
    getOperatorDetail). UI layers parse string → Number for display formatting.
    Safe for VND amounts (max ~10^11, well under 2^53).

  [OK] Test coverage — all 7 test files + 1 e2e spec updated to use BigInt() in
    assertions and fixture data. Mock data, Prisma.create calls, and expect()
    assertions all updated consistently.

  [OK] e2e/op-reports.spec.ts:208 — raw SQL INSERT uses BigInt() for money params.
    Matches the new BIGINT column type.


SUMMARY: 0 P1, 1 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → P2: add DATABASE_POOL_MAX=5 to .env.example and CI env, or document the Neon default.
  → P3: consider string-serializing revenue report money fields for consistency (optional).
