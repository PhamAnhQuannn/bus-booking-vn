/**
 * E2E spec: operator revenue + payout reports (Issue 016).
 *
 * Covers:
 *   Case 1  Revenue report page renders trip row with correct amounts.
 *   Case 2  CSV download starts with UTF-8 BOM (0xEF 0xBB 0xBF).
 *   Case 3  Payouts report page renders a failed payout row.
 *   Case 4  Retry button transitions payout to 'processing'.
 *   Case 5  Cross-operator IDOR: POST retry for operator A's payout returns 404
 *           when authenticated as operator B.
 *
 * SANDBOX-GATED: set E2E_OP_REPORTS_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Phone placeholders: +8490xxxxxx3 (operator A admin), +8490xxxxxx4 (customer booking)
 *     (reserved for Issue 016 per plan step 21).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/auth/phoneNormalize';
import * as fs from 'fs';

const SANDBOX_ENABLED = process.env.E2E_OP_REPORTS_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Login-identity phones: local-format literals (gitleaks-safe), normalized at runtime.
// The DB phone column and operatorLogin both use the normalized (+84…) form.
const OP_A_PHONE = normalizePhone('0901230003');
const OP_A_PASSWORD = 'BBOp2026!';
const OP_B_PHONE = normalizePhone('0901230004'); // used only for IDOR test — operator user, not customer
const OP_B_PASSWORD = 'BBOp2026!';

// Gross amount for the seeded booking
const GROSS_VND = 1_500_000;
// Platform fee: 1_500_000 * 0.06 = 90_000 exactly
const PLATFORM_FEE_VND = 90_000;
const NET_VND = GROSS_VND - PLATFORM_FEE_VND; // 1_410_000

interface PrepareCtx {
  opAId: string;
  opBId: string;
  tripId: string;
  payoutId: string;
}

async function prepareReports(): Promise<PrepareCtx> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHashA = await hash(OP_A_PASSWORD);
    const passwordHashB = await hash(OP_B_PASSWORD);

    // ---- Operator A ----
    // Resolve via the existing OperatorUser first so prepareReports is idempotent
    // across the 5 beforeEach runs. Operator has no unique constraint on contactPhone,
    // so an unconditional INSERT would orphan the OperatorUser→operatorId link.
    let opAId: string;
    const existingA = await client.query<{ operatorId: string }>(
      `SELECT "operatorId" FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_A_PHONE]
    );
    if (existingA.rows.length > 0) {
      opAId = existingA.rows[0].operatorId;
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Reports Test Op A', $1, 'reports-op-a@test.invalid')
         RETURNING id`,
        [OP_A_PHONE]
      );
      opAId = ins.rows[0].id;
    }

    // Upsert OperatorUser for Op A
    await client.query(
      `INSERT INTO "OperatorUser"
         ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'admin', false, 'Reports Op A Admin', NOW())
       ON CONFLICT (phone) DO UPDATE
         SET "passwordHash" = $4, "requiresPasswordChange" = false`,
      [OP_A_PHONE, '+8490xxxxxx3', '+8490xxxxxx3', passwordHashA, opAId]
    );

    // Revoke stale sessions for Op A
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [OP_A_PHONE]
    );

    // ---- Operator B (for IDOR test) ----
    let opBId: string;
    const existingB = await client.query<{ operatorId: string }>(
      `SELECT "operatorId" FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    if (existingB.rows.length > 0) {
      opBId = existingB.rows[0].operatorId;
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Reports Test Op B', $1, 'reports-op-b@test.invalid')
         RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
    }

    await client.query(
      `INSERT INTO "OperatorUser"
         ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'admin', false, 'Reports Op B Admin', NOW())
       ON CONFLICT (phone) DO UPDATE
         SET "passwordHash" = $4, "requiresPasswordChange" = false`,
      [OP_B_PHONE, '+8490xxxxxx4', '+8490xxxxxx4', passwordHashB, opBId]
    );

    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [OP_B_PHONE]
    );

    // Wipe Op A's prior-run trips/payouts/bookings. No reseed runs between the 5
    // beforeEach calls, so without this each run would stack another completed trip +
    // failed payout — yielding multiple 'Thử lại' buttons that break strict-mode
    // locators in Cases 3/4, and a duplicate bookingRef on re-insert.
    // FK order: Payout→Trip, NotificationLog/PaymentEvent→Booking→Trip.
    await client.query(`DELETE FROM "Payout" WHERE "operatorId" = $1`, [opAId]);
    await client.query(
      `DELETE FROM "NotificationLog" WHERE "bookingId" IN
         (SELECT b.id FROM "Booking" b JOIN "Trip" t ON b."tripId" = t.id WHERE t."operatorId" = $1)`,
      [opAId]
    );
    await client.query(
      `DELETE FROM "PaymentEvent" WHERE "bookingId" IN
         (SELECT b.id FROM "Booking" b JOIN "Trip" t ON b."tripId" = t.id WHERE t."operatorId" = $1)`,
      [opAId]
    );
    await client.query(
      `DELETE FROM "Booking" WHERE "tripId" IN (SELECT id FROM "Trip" WHERE "operatorId" = $1)`,
      [opAId]
    );
    await client.query(`DELETE FROM "Trip" WHERE "operatorId" = $1`, [opAId]);

    // ---- Route + Bus + Trip for Op A ----
    const busRow = await client.query<{ id: string }>(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 40, 'RPT-REPORT-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 40
       RETURNING id`,
      [opAId]
    );
    const busId: string = busRow.rows[0].id;

    const routeRow = await client.query<{ id: string }>(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'Hà Nội', 'Hải Phòng', 120, NOW())
       ON CONFLICT DO NOTHING RETURNING id`,
      [opAId]
    );
    let routeId: string;
    if (routeRow.rows.length > 0) {
      routeId = routeRow.rows[0].id;
    } else {
      const r = await client.query<{ id: string }>(
        `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = 'Hà Nội' LIMIT 1`,
        [opAId]
      );
      routeId = r.rows[0].id;
    }

    // Trip departing 7 days ago (falls in the default 30-day window)
    const depAt = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const tripRow = await client.query<{ id: string }>(
      `INSERT INTO "Trip"
         ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 150000, 'completed', true, 0, NOW())
       RETURNING id`,
      [routeId, busId, opAId, depAt]
    );
    const tripId: string = tripRow.rows[0].id;

    // Paid booking on the trip (gross = GROSS_VND)
    const bookingId = await randomUuid();
    await client.query(
      `INSERT INTO "Booking"
         ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone",
          "ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus")
       VALUES ($1, $2, $3, $4, 'Reports Tester', '+8490xxxxxx3',
               1, $5, 'momo', 'paid_operator_notified', false, 'pending')`,
      [bookingId, `BB-2026-rpt1-rr01`, `tok-rpt-${tripId}`, tripId, GROSS_VND]
    );

    // Payout row with status=failed (so retry button is visible)
    const scheduledAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const payoutRow = await client.query<{ id: string }>(
      `INSERT INTO "Payout"
         ("id","tripId","operatorId","gross","platformFee","net","status","scheduledAt","failureReason","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'failed', $6, 'bank_timeout', NOW())
       RETURNING id`,
      [tripId, opAId, GROSS_VND, PLATFORM_FEE_VND, NET_VND, scheduledAt]
    );
    const payoutId: string = payoutRow.rows[0].id;

    return { opAId, opBId, tripId, payoutId };
  } finally {
    await client.end();
  }
}

/** Generate a random UUID v4 string. */
async function randomUuid(): Promise<string> {
  const { randomUUID } = await import('crypto');
  return randomUUID();
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

test.describe('Operator revenue + payout reports (Issue 016)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_REPORTS_ENABLED=true to run');

  let ctx: PrepareCtx;

  test.beforeEach(async () => {
    ctx = await prepareReports();
  });

  test('Case 1: revenue report page renders trip row with correct amounts', async ({ page }) => {
    // Log in as Op A
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', phone: OP_A_PHONE, password: OP_A_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Navigate to revenue report (default 30-day window covers trip 7 days ago)
    await page.goto('/op/reports/revenue');
    await page.waitForLoadState('networkidle');

    // Each amount renders twice (trip row cell + <tfoot> totals row); with one trip
    // the per-row and total values are equal, so scope to the first match.
    await expect(page.getByText('1.500.000').first()).toBeVisible();
    await expect(page.getByText('90.000').first()).toBeVisible();
    await expect(page.getByText('1.410.000').first()).toBeVisible();
  });

  test('Case 2: CSV download starts with UTF-8 BOM, has correct English headers, and contains the seeded booking row (AC2)', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', phone: OP_A_PHONE, password: OP_A_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    await page.goto('/op/reports/revenue');
    await page.waitForLoadState('networkidle');

    // Click the CSV download link and capture the download event
    const downloadPromise = page.waitForEvent('download');
    await page.click('a[href*="revenue.csv"]');
    const download = await downloadPromise;

    // Read the downloaded file
    const filePath = await download.path();
    expect(filePath).not.toBeNull();

    const bytes = fs.readFileSync(filePath!);

    // First 3 bytes must be UTF-8 BOM: 0xEF 0xBB 0xBF
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    // Parse CSV content (strip BOM, split on CRLF).
    const csvText = bytes.toString('utf8').replace(/^﻿/, '');
    const lines = csvText.split('\r\n').filter((l) => l.length > 0);

    // AC2 (PRD story 57): header must be verbatim English column names.
    expect(lines[0]).toBe(
      'bookingRef,route,departure,buyerName,buyerPhone,ticketCount,total,paymentMethod,status'
    );

    // AC2: CSV body must contain at least 1 data row with the seeded booking ref.
    // prepareReports() seeds bookingRef = 'BB-2026-rpt1-rr01'.
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const dataRows = lines.slice(1);
    const hasSeededBooking = dataRows.some((line) => line.includes('BB-2026-rpt1-rr01'));
    expect(hasSeededBooking).toBe(true);
  });

  test('Case 3: payouts report page renders the failed payout row', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', phone: OP_A_PHONE, password: OP_A_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    await page.goto('/op/reports/payouts');
    await page.waitForLoadState('networkidle');

    // Payout status 'failed' should be rendered
    await expect(page.getByText('Thất bại', { exact: true })).toBeVisible();
    // Retry button should be visible
    await expect(page.getByRole('button', { name: /Thử lại/ })).toBeVisible();
  });

  test('Case 4: retry button transitions payout to processing', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', phone: OP_A_PHONE, password: OP_A_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    await page.goto('/op/reports/payouts');
    await page.waitForLoadState('networkidle');

    // Click retry
    await page.getByRole('button', { name: /Thử lại/ }).click();

    // Wait for page refresh (router.refresh() triggers RSC re-render)
    await page.waitForLoadState('networkidle');

    // After retry, status should be 'processing'
    await expect(page.getByText('Đang xử lý')).toBeVisible();
    // The retry button should no longer be visible (status is no longer 'failed')
    await expect(page.getByRole('button', { name: /Thử lại/ })).not.toBeVisible();
  });

  test('Case 5: cross-operator IDOR — Op B gets 404 on Op A payout retry', async ({ request }) => {
    // Log in as Op B
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: OP_B_PHONE, password: OP_B_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Attempt to retry Op A's payout as Op B → must return 404 (not 403, not 422)
    const res = await request.post(`/api/op/reports/payouts/${ctx.payoutId}/retry`, {
      headers: { 'X-CSRF-Token': csrf },
    });

    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});
