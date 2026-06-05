/**
 * E2E spec: recurring trip generation cron (Issue 013 AC5).
 *
 * Tests the GET /api/cron/generate-trips endpoint:
 *   - 401 without CRON_SECRET when secret is set
 *   - Returns {generated, skipped, failed} shape
 *   - Idempotent: second run returns 0 generated
 *
 * SANDBOX-GATED: set E2E_CRON_RECURRING_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires CRON_SECRET env var to be set (or unset for open access)
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';

const SANDBOX_ENABLED = process.env.E2E_CRON_RECURRING_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';

interface PrepareResult {
  templateId: string;
  opAId: string;
}

async function prepareTemplate(): Promise<PrepareResult> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // Ensure seed operator is ready
    const a = await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE phone = $2 RETURNING "operatorId"`,
      [await hash(SEED_PASSWORD), SEED_PHONE]
    );
    const opAId: string = a.rows[0].operatorId;

    // Bus for template
    const busRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'E2E-CRON-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 30
       RETURNING id`,
      [opAId]
    );
    const busId: string = busRow.rows[0].id;

    // Route
    const routeRow = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'CRON-Origin', 'CRON-Dest', 100, NOW())
       ON CONFLICT DO NOTHING RETURNING id`,
      [opAId]
    );
    let routeId: string;
    if (routeRow.rows.length > 0) {
      routeId = routeRow.rows[0].id;
    } else {
      const r = await client.query(
        `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = 'CRON-Origin' LIMIT 1`,
        [opAId]
      );
      routeId = r.rows[0].id;
    }

    // Template that covers today (all days of week, valid for 30 days)
    const today = new Date();
    const validFrom = today.toISOString().slice(0, 10);
    const validUntil = new Date(today.getTime() + 86400 * 1000 * 30).toISOString().slice(0, 10);

    const templateRow = await client.query(
      `INSERT INTO "RecurringTripTemplate"
         ("id","operatorId","routeId","busId","price","departureLocalTime","daysOfMask","validFrom","validUntil","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 50000, '09:00', 127, $4::date, $5::date, NOW())
       RETURNING id`,
      [opAId, routeId, busId, validFrom, validUntil]
    );
    const templateId: string = templateRow.rows[0].id;

    return { templateId, opAId };
  } finally {
    await client.end();
  }
}

test.describe('Recurring trip generation cron (Issue 013)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_CRON_RECURRING_ENABLED=true to run');

  let templateId: string;

  test.beforeAll(async () => {
    const ctx = await prepareTemplate();
    templateId = ctx.templateId;
  });

  test.afterAll(async () => {
    // Clean up generated trips for this template
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query(
        `DELETE FROM "RecurringGenerationLog" WHERE "templateId" = $1`,
        [templateId]
      );
      await client.query(
        `DELETE FROM "Trip" WHERE "recurringTemplateId" = $1`,
        [templateId]
      );
      await client.query(
        `DELETE FROM "RecurringTripTemplate" WHERE id = $1`,
        [templateId]
      );
    } finally {
      await client.end();
    }
  });

  test('401 when CRON_SECRET set and header missing', async ({ request }) => {
    if (!CRON_SECRET) {
      // If no CRON_SECRET configured, skip this sub-check
      return;
    }
    const res = await request.get('/api/cron/generate-trips');
    expect(res.status()).toBe(401);
  });

  test('returns {generated, skipped, failed} shape and generates trips', async ({ request }) => {
    const headers: Record<string, string> = {};
    if (CRON_SECRET) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    }

    const res = await request.get('/api/cron/generate-trips', { headers });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(typeof json.generated).toBe('number');
    expect(typeof json.skipped).toBe('number');
    expect(typeof json.failed).toBe('number');
    // With our all-days template, generated should be >= 1
    expect(json.generated).toBeGreaterThanOrEqual(1);
  });

  test('idempotent: second run returns 0 generated for same template', async ({ request }) => {
    const headers: Record<string, string> = {};
    if (CRON_SECRET) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    }

    // First run (may have been done in prior test — that's fine, idempotent)
    await request.get('/api/cron/generate-trips', { headers });

    // Second run
    const res2 = await request.get('/api/cron/generate-trips', { headers });
    expect(res2.status()).toBe(200);
    const json2 = await res2.json();
    // All should be skipped (already_exists), 0 newly generated
    expect(json2.generated).toBe(0);
  });

  test('AC5: operator can see generated trip via GET /api/op/trips', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const cronHeaders: Record<string, string> = {};
    if (CRON_SECRET) {
      cronHeaders['Authorization'] = `Bearer ${CRON_SECRET}`;
    }
    await request.get('/api/cron/generate-trips', { headers: cronHeaders });

    const list = await request.get('/api/op/trips');
    expect(list.status()).toBe(200);
    const json = await list.json();
    const templateTrips = json.trips.filter(
      (t: { recurringTemplateId?: string }) => t.recurringTemplateId === templateId
    );
    expect(templateTrips.length).toBeGreaterThanOrEqual(1);
  });
});
