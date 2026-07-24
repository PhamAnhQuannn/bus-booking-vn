---
migration: 20260723120000_payment_event_orphan_bookingid
reviewed-date: 2026-07-23
verdict: GO
risk-band: 🟢 SAFE
pr: "#324"
---

# Migration Safety — `20260723120000_payment_event_orphan_bookingid`

Single-statement migration widening `PaymentEvent.bookingId` to nullable so an unmatched
SePay bank transfer can be recorded as an orphan row (Bug B, PR #324).

## Statements

| # | Statement | Table | Risk | Lock | Est. duration |
|---|-----------|-------|------|------|----------------|
| 1 | `ALTER TABLE "PaymentEvent" ALTER COLUMN "bookingId" DROP NOT NULL` | PaymentEvent (~0 rows prod, launch phase) | 🟢 SAFE | ACCESS EXCLUSIVE | sub-millisecond — catalog-only |

Nothing else. No index, no FK change, no backfill, no `UPDATE`.

## Verdict: 🟢 GO

`DROP NOT NULL` is the **safe inverse** of the blocking `SET NOT NULL` case. It clears
`pg_attribute.attnotnull` and returns — Postgres performs **no table scan and no rewrite**,
because widening a constraint cannot invalidate any existing row. Every stored row already
satisfies "nullable".

**The verdict is insensitive to table size.** A 0-row and a 500M-row table take the same
time here. The prod row estimate (`reltuples`) is near-zero anyway — bank transfer went live
2026-07-22 and Bug A meant almost nothing was ever written.

## Lock analysis — the one real caveat

`ACCESS EXCLUSIVE` is the strongest lock, and the duration of the *statement* is not the
whole story. The `ALTER` must first **queue behind any in-flight transaction touching
`PaymentEvent`**, and while it waits, every new reader and writer queues behind *it*. A
single long-running transaction on the table converts a sub-millisecond DDL into a stall
for its entire duration.

`PaymentEvent` is written by the payment webhook and read by the reconcile sweeper
(`*/15`), whose whole tick runs in one transaction. Mitigation:

```sql
SET lock_timeout = '3s';
ALTER TABLE "PaymentEvent" ALTER COLUMN "bookingId" DROP NOT NULL;
```

If it times out, retry — do not raise the timeout. Ideally apply **off the :00/:15/:30/:45
minute boundary** so the reconcile cron is not mid-tick.

Replication lag: none. No long transaction, no WAL volume beyond a catalog row.

## Foreign key — verified, deliberately untouched

The relation became optional in `schema.prisma` (`booking Booking?`). **This is the trap in
this migration**: Prisma's default `onDelete` for an *optional* relation is `SetNull`, not
`Restrict`. Had the default been taken, a deleted booking would have silently converted its
payment event into a `bookingId IS NULL` row — i.e. into a **sweeper-eligible orphan that
the reconcile job would then try to match against some other booking**. The schema therefore
declares `onDelete: Restrict` explicitly.

Verified against the live DB rather than assumed:

```
conname                     | confdeltype | pg_get_constraintdef
PaymentEvent_bookingId_fkey | r           | FOREIGN KEY ("bookingId") REFERENCES "Booking"(id)
                                            ON UPDATE CASCADE ON DELETE RESTRICT
```

`confdeltype = 'r'` is RESTRICT (not `'a'`/NO ACTION), matching both the original
`20260518161139` definition and the new explicit declaration. No FK recreation is needed and
none is emitted.

**Drift check passes clean:**

```
$ pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
No difference detected.
```

> Note for the Mistake Log: the Issue 012 entry records that the old
> `--from-schema-datamodel` / `--to-schema-datasource` flags were removed. The working
> Prisma 7.8 invocation is the one above (`--from-config-datasource` + `--to-schema`).
> The parity check is automatable again; the manual side-by-side audit is no longer needed.

## Reverse migration — ⚠️ not a clean inverse

```sql
-- Reverse (forward-only; committed migrations are never edited)
ALTER TABLE "PaymentEvent" ALTER COLUMN "bookingId" SET NOT NULL;
```

**This will fail outright if any orphan row exists** — and orphan rows are the entire point
of the change. Worse, an orphan row is **the only DB evidence that a real customer's money
arrived** for an unmatchable transfer. So the reverse path is:

1. `SELECT id, "providerTxnId", "receivedAt", "rawBody" FROM "PaymentEvent" WHERE "bookingId" IS NULL;`
2. Reconcile each against the bank statement — refund or manually link. **An ops decision, never a script default.**
3. Only once the count is 0, apply `SET NOT NULL` as a new forward migration.

### ⚠️ Rollback is NOT a plain code-revert — that RE-ARMS the wrong-payee bug

The pre-PR (`master`) `lib/jobs/reconcilePayments.ts` still contains the **auto-pay**
degraded-match path (`confirming = matchDegraded(...)`, no suspicion demotion). On
`master` it is DEAD CODE only because this column is `NOT NULL` (orphan rows are
impossible). Once this migration is applied the column is nullable **and stays nullable**
(migrations are forward-only — a `git revert` of the code does NOT undo the migration).

So reverting the code while the column is nullable resurrects the exact wrong-payee /
double-credit vulnerability the suspicion-hold was built to close: the reverted code would
auto-pay bookings from now-possible orphan rows. **Do not roll back by reverting the code.**

**Correct rollback: forward-fix only.** If the sweeper behaviour must be undone, ship a new
forward commit that keeps the suspicion-hold semantics (never auto-pay/claim from an orphan),
not a revert to the pre-PR reconcile logic. The nullable column itself is harmless to keep;
it is the pre-PR *code* that is unsafe against it.

## Deploy order — migration BEFORE code

| Order | Result |
|---|---|
| Migration → code ✅ | Old code against the nullable column is a no-op: every existing write supplies a real `bookingId`, and the sweeper's `bookingId IS NULL` branch keeps matching zero rows. |
| Code → migration ❌ | `recordUnmatchedPaymentEvent` hits a NOT NULL violation. It never throws (logs + `captureException`, still acks 200), so it degrades soft rather than breaking the webhook — but every unmatched transfer in that window is lost exactly as before the fix, silently. |

On Vercel this means the migration must be applied before the new deployment serves traffic.

## Pre-deploy checklist

- [ ] Neon PITR confirmed (no separate backup step needed; branch-based restore available)
- [ ] `SET lock_timeout = '3s'` used; retry on timeout rather than raising it
- [ ] Applied off the `*/15` cron boundary so the reconcile tick is not mid-transaction
- [ ] Migration applied **before** the PR #324 deployment goes live
- [ ] After apply: `SELECT attnotnull FROM pg_attribute WHERE attrelid='"PaymentEvent"'::regclass AND attname='bookingId';` → `f`
- [ ] After apply: re-run the drift check above → "No difference detected."

## Post-deploy monitoring

Orphan rows are new and nothing in `app/admin` or `app/op` surfaces them (a known deferred
gap). Until that ships, this query is the runbook — run daily:

```sql
-- money nobody claimed
SELECT id, "providerTxnId", "receivedAt"
FROM "PaymentEvent"
WHERE "bookingId" IS NULL
  AND "receivedAt" < now() - interval '1 hour';
```

A steadily growing count means the degraded matcher is failing (wrong amount, outside the
±30-min window, or the booking already expired) and each row is unclaimed customer money.

## Auto-chain

- GO verdict → `/deploy-health-gate` for a monitoring window after apply.
- After successful prod apply → archive this doc under `docs/migrations/applied/`.
