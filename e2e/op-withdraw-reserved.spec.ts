/**
 * E2E spec: operator withdrawal is BLOCKED for money already committed to a due
 * pending auto-payout (P0-1 double-payout fix, money-flow audit 2026-08-11).
 *
 * The per-trip auto-payout (completeTripCore) and the on-demand withdrawal rail
 * both disburse the same earned money. The fix makes `available` reserve the net
 * of a due, not-yet-debited pending payout so it is NOT offered a second time.
 * This spec proves that end-to-end in the operator console:
 *   - the money page shows `available` = 0 (the trip net is fully reserved),
 *   - the Withdraw button is disabled (server-computed from available < min),
 *   - a direct POST /api/op/money/withdraw for the reserved amount → 422.
 *
 * SANDBOX-GATED: set E2E_OP_WITHDRAW_ENABLED=true to run (needs dev server + DB).
 * Phone placeholders: +8490xxxxxx7 (operator admin), +8490xxxxxx8 (booking buyer).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';

const SANDBOX_ENABLED = process.env.E2E_OP_WITHDRAW_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const OP_PHONE = normalizePhone('0901230007');
const OP_PASSWORD = 'BBOp2026!';
const OP_USERNAME = 'WDR-A';

// Platform fee = 6% half-even (calcPayout). Hardcoded here (like op-reports) so the
// spec never imports the server-only ledger barrel into the Playwright runtime.
const GROSS = 500_000;
const FEE = 30_000;
const NET = GROSS - FEE; // 470_000 — fully reserved by the pending auto-payout

// Fixed IDs make the seed fully idempotent WITHOUT deleting rows — the ledger is
// append-only (DELETE is blocked by an immutability trigger), so a re-run must
// re-assert the same state via ON CONFLICT DO NOTHING, never wipe-and-reinsert.
const BOOKING_ID = 'd1e2f3a4-b5c6-4d7e-8f90-000000000701';
const BOOKING_REF = 'BB-2026-wdr1-rr01';

async function prepareReservedOperator(): Promise<{ operatorId: string }> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHash = await hash(OP_PASSWORD);

    // Operator (no unique on contactPhone → resolve via OperatorUser for idempotency).
    let operatorId: string;
    const existing = await client.query<{ operatorId: string }>(
      `SELECT "operatorId" FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_PHONE]
    );
    if (existing.rows.length > 0) {
      operatorId = existing.rows[0].operatorId;
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Withdraw Reserved Op', $1, 'wd-reserved@test.invalid')
         RETURNING id`,
        [OP_PHONE]
      );
      operatorId = ins.rows[0].id;
    }

    await client.query(
      `INSERT INTO "OperatorUser"
         ("id","username","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","updatedAt")
       VALUES (gen_random_uuid()::text, '${OP_USERNAME}', $1, $2, $3, $4, $5, 'admin', false, 'Withdraw Op Admin', NOW())
       ON CONFLICT (phone) DO UPDATE SET "passwordHash" = $4, "requiresPasswordChange" = false`,
      [OP_PHONE, '+8490xxxxxx7', '+8490xxxxxx7', passwordHash, operatorId]
    );
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [OP_PHONE]
    );

    // Verified payout account (else the withdrawal short-circuits to _unverified).
    await client.query(
      `INSERT INTO "PayoutAccount"
         ("id","operatorId","bankName","accountNumber","accountHolderName","verifiedAt","verifyMethod","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'Test Bank', '0123456789', 'Withdraw Reserved Op', NOW(), 'name_match', NOW())
       ON CONFLICT ("operatorId") DO UPDATE SET "verifiedAt" = NOW()`,
      [operatorId]
    );

    // Clean slate for THIS operator's money rows. The ledger is append-only
    // (DELETE blocked by an immutability trigger), so drop the triggers, delete in
    // FK order (Payout→Trip, LedgerEntry→Booking→Trip), then recreate the triggers.
    // Same technique the ledger integration tests use in their teardown.
    await client.query('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
    await client.query('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
    try {
      await client.query(`DELETE FROM "Payout" WHERE "operatorId" = $1`, [operatorId]);
      await client.query(`DELETE FROM "LedgerEntry" WHERE "operatorId" = $1`, [operatorId]);
      await client.query(
        `DELETE FROM "Booking" WHERE "tripId" IN (SELECT id FROM "Trip" WHERE "operatorId" = $1)`,
        [operatorId]
      );
      await client.query(`DELETE FROM "Trip" WHERE "operatorId" = $1`, [operatorId]);
    } finally {
      await client.query(
        'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
      );
      await client.query(
        'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
      );
    }

    const busRow = await client.query<{ id: string }>(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 40, 'WDR-BUS1', 'coach')
       ON CONFLICT ("operatorId","licensePlate") DO UPDATE SET "capacity" = 40 RETURNING id`,
      [operatorId]
    );
    const busId = busRow.rows[0].id;

    const routeRow = await client.query<{ id: string }>(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'WDR Origin', 'WDR Destination', 120, NOW())
       ON CONFLICT DO NOTHING RETURNING id`,
      [operatorId]
    );
    let routeId: string;
    if (routeRow.rows.length > 0) routeId = routeRow.rows[0].id;
    else {
      const r = await client.query<{ id: string }>(
        `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = 'WDR Origin' LIMIT 1`,
        [operatorId]
      );
      routeId = r.rows[0].id;
    }

    // Completed Trip (completedAt past T+1 → credit/fee are settlement-eligible).
    // Find-or-create so re-runs reuse the same trip (no delete needed).
    const past = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    let tripId: string;
    const existingTrip = await client.query<{ id: string }>(
      `SELECT id FROM "Trip" WHERE "operatorId" = $1 AND "routeId" = $2 LIMIT 1`,
      [operatorId, routeId]
    );
    if (existingTrip.rows.length > 0) {
      tripId = existingTrip.rows[0].id;
      await client.query(
        `UPDATE "Trip" SET status='completed', "salesClosed"=true, "completedAt"=$2, "departureAt"=$2 WHERE id=$1`,
        [tripId, past]
      );
    } else {
      const tripRow = await client.query<{ id: string }>(
        `INSERT INTO "Trip"
           ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","completedAt","blockedSeats","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'completed', true, $4, 0, NOW())
         RETURNING id`,
        [routeId, busId, operatorId, past, GROSS]
      );
      tripId = tripRow.rows[0].id;
    }

    await client.query(
      `INSERT INTO "Booking"
         ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","buyerEmail",
          "ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus")
       VALUES ($1::uuid, $2, $3, $4, 'Reserved Buyer', '+8490xxxxxx8', 'wdbuyer@test.invalid',
               1, $5, 'bank_transfer', 'completed', false, 'pending')
       ON CONFLICT ("bookingRef") DO NOTHING`,
      [BOOKING_ID, BOOKING_REF, `tok-wdr-${tripId.slice(0, 8)}`, tripId, GROSS]
    );

    // Paid-transition ledger (fixed sourceEventIds → append-only-safe re-runs).
    await client.query(
      `INSERT INTO "LedgerEntry" ("id","operatorId","bookingId","type","amount","currency","sourceEventId")
       VALUES (gen_random_uuid()::text, $1, $2::uuid, 'booking_credit', $3, 'VND', $4)
       ON CONFLICT ("sourceEventId") DO NOTHING`,
      [operatorId, BOOKING_ID, BigInt(GROSS), `booking_credit:${BOOKING_ID}`]
    );
    await client.query(
      `INSERT INTO "LedgerEntry" ("id","operatorId","bookingId","type","amount","currency","sourceEventId")
       VALUES (gen_random_uuid()::text, $1, $2::uuid, 'platform_fee', $3, 'VND', $4)
       ON CONFLICT ("sourceEventId") DO NOTHING`,
      [operatorId, BOOKING_ID, BigInt(-FEE), `platform_fee:${BOOKING_ID}`]
    );

    // Auto per-trip Payout: requested, due (scheduledAt past), NO payout_debit.
    // Find-or-create so exactly one requested auto-payout stands across re-runs.
    const existingPayout = await client.query<{ id: string }>(
      `SELECT id FROM "Payout" WHERE "operatorId" = $1 AND "tripId" = $2 AND status = 'requested' LIMIT 1`,
      [operatorId, tripId]
    );
    if (existingPayout.rows.length === 0) {
      await client.query(
        `INSERT INTO "Payout"
           ("id","tripId","operatorId","gross","platformFee","net","status","scheduledAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'requested', $6, NOW())`,
        [tripId, operatorId, BigInt(GROSS), BigInt(FEE), BigInt(NET), past]
      );
    }

    return { operatorId };
  } finally {
    await client.end();
  }
}

test.describe('Operator withdrawal reserves committed auto-payout money (P0-1)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_WITHDRAW_ENABLED=true to run');

  test.beforeEach(async () => {
    await prepareReservedOperator();
  });

  test('money page hides reserved balance and blocks the withdraw button', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', username: OP_USERNAME, password: OP_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    await page.goto('/op/money');
    await page.waitForLoadState('networkidle');

    // The trip net (470.000) is fully committed to the pending auto-payout, so it
    // must NOT appear as available, and the withdraw button must be disabled.
    await expect(page.getByTestId('balance-available')).not.toContainText('470.000');
    await expect(page.getByTestId('withdraw-open')).toBeDisabled();
  });

  test('direct withdraw API rejects the reserved amount with 422 insufficient_available', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', username: OP_USERNAME, password: OP_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await page.request.post('/api/op/money/withdraw', {
      data: { amountMinor: NET },
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': randomUUID() },
    });

    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe('insufficient_available');
  });
});
