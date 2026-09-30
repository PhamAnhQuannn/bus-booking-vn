/**
 * E2E spec: charter dispatch journey — request → dispatch → accept (issue #776, P1).
 *
 * Drives the happy-path charter ("thuê xe hợp đồng") lead lifecycle across all three
 * actors, asserting each CharterStatus transition BOTH in the DB (enum verbatim) and
 * on a real UI surface (the public ref-keyed customer status page):
 *
 *   1. REQUEST  (customer)  → status ADMIN_REVIEW
 *        The real /lien-he-dat-xe page renders (guards the design-audit "E1 charter 500"),
 *        then the request is submitted through the real POST /api/charter endpoint the
 *        form posts to. The base-ui DatePicker is form-incidental, so the date is supplied
 *        via the API payload rather than synthetic clicks on the calendar popover
 *        (CLAUDE.md: drive form-incidental flows via params, not keystrokes on 3rd-party inputs).
 *   2. DISPATCH (admin)     → ADMIN_REVIEW → ASSIGNED_DIRECT
 *        Real admin auth (login + TOTP enroll/confirm → totpVerified session), then the
 *        real POST /api/admin/charter/:id/assign-direct route (role SUPER_ADMIN + TOTP).
 *   3. ACCEPT   (operator)  → ASSIGNED_DIRECT → ACCEPTED
 *        Real operator login (seed PB-0001), then the real POST /api/op/charter/:id/accept.
 *
 * The concurrent first-accept-wins race is ALREADY covered by
 * lib/charter/__tests__/claimCharter.int.test.ts (public-pool claim) — this spec deliberately
 * covers the DIRECT-ASSIGN dispatch journey through the real surfaces, not the race.
 *
 * No auth bypass: every mutation goes through the real HTTP route with a real session and a
 * real CSRF double-submit token. Sessions are established the same way a human login would.
 *
 * SANDBOX-GATED: set E2E_CHARTER_DISPATCH_ENABLED=true to run.
 *   - Requires the dev server running with the seeded dev DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: PB-0001 / BBOp2026! (its Operator org is APPROVED)
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { generateTotp } from '../lib/auth/totp';
import { CHARTER_REF_REGEX } from '../lib/charter/charterRef';

const SANDBOX_ENABLED = process.env.E2E_CHARTER_DISPATCH_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_OP_USERNAME = 'PB-0001';
const SEED_OP_PASSWORD = 'BBOp2026!';

// Dedicated test admin (invite-only realm has no dev seed — we create one).
const ADMIN_EMAIL = 'charter-dispatch-e2e@admin.dev';
const ADMIN_PASSWORD = 'AdminDispatch2026!';

// Customer contact phone — distinct from the seed operator's contactPhone (+8490xxxxxx1)
// so the operator phone is a clean ACCEPTED-only anchor on the status page. Placeholder
// format `+8490xxxxxx[N]` keeps it out of the gitleaks phone regex.
const CUSTOMER_PHONE = '+8490xxxxxx8';

interface Ctx {
  operatorId: string;
  operatorPhone: string;
  adminId: string;
}

/** Current bb_csrf value for this request context (re-read after each auth-state change). */
async function currentCsrf(request: APIRequestContext): Promise<string> {
  const { cookies } = await request.storageState();
  return cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
}

/** A valid TOTP code for `secret` at the current instant. */
function totpCode(secret: string): string {
  return generateTotp(secret, Math.floor(Date.now() / 1000 / 30));
}

/**
 * Seed setup: ensure the PB-0001 seed operator is APPROVED + login-ready, and create a
 * fresh ACTIVE SUPER_ADMIN with a known password (no TOTP yet — enrolled via the real
 * flow at dispatch time).
 */
async function prepare(): Promise<Ctx> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // ---- Seed operator (dispatch target + acceptor) ----
    const opUser = await client.query(
      `SELECT "operatorId" FROM "OperatorUser" WHERE username = $1 LIMIT 1`,
      [SEED_OP_USERNAME]
    );
    if (opUser.rows.length === 0) {
      throw new Error('seed operator PB-0001 missing — run pnpm prisma db seed');
    }
    const operatorId: string = opUser.rows[0].operatorId;

    // Guarantee APPROVED (assign-direct + accept both require it) and a known password.
    await client.query(`UPDATE "Operator" SET status = 'APPROVED' WHERE id = $1`, [operatorId]);
    const opHash = await hash(SEED_OP_PASSWORD);
    await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE username = $2`,
      [opHash, SEED_OP_USERNAME]
    );
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE username = $1)`,
      [SEED_OP_USERNAME]
    );
    const opRow = await client.query(
      `SELECT "contactPhone" FROM "Operator" WHERE id = $1`,
      [operatorId]
    );
    const operatorPhone: string = opRow.rows[0].contactPhone;

    // ---- Fresh admin (SUPER_ADMIN, ACTIVE, no TOTP) ----
    await client.query(`DELETE FROM "AdminUser" WHERE email = $1`, [ADMIN_EMAIL]); // cascades sessions
    const adminHash = await hash(ADMIN_PASSWORD);
    const admin = await client.query(
      `INSERT INTO "AdminUser" ("id","email","passwordHash","role","status","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'SUPER_ADMIN', 'ACTIVE', NOW(), NOW())
       RETURNING id`,
      [ADMIN_EMAIL, adminHash]
    );
    const adminId: string = admin.rows[0].id;

    return { operatorId, operatorPhone, adminId };
  } finally {
    await client.end();
  }
}

async function readCharter(ref: string): Promise<{
  id: string;
  status: string;
  assigneeOperatorId: string | null;
  acceptByAt: Date | null;
}> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT id, status, "assigneeOperatorId", "acceptByAt" FROM "CharterRequest" WHERE ref = $1`,
      [ref]
    );
    if (r.rows.length === 0) throw new Error(`charter ${ref} not found`);
    return r.rows[0];
  } finally {
    await client.end();
  }
}

async function cleanup(ctx: Ctx | undefined): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // Charter rows created this run carry CUSTOMER_PHONE; their notification rows go with them.
    await client.query(
      `DELETE FROM "NotificationLog" WHERE template IN ('charterSubmitted','charterMatched')
       AND recipient IN ($1, $2)`,
      [CUSTOMER_PHONE, ctx?.operatorPhone ?? CUSTOMER_PHONE]
    );
    await client.query(`DELETE FROM "CharterRequest" WHERE "contactPhone" = $1`, [CUSTOMER_PHONE]);
    if (ctx) {
      await client.query(`DELETE FROM "AdminUser" WHERE id = $1`, [ctx.adminId]); // cascades sessions
    }
  } finally {
    await client.end();
  }
}

test.describe('Charter dispatch journey (request → dispatch → accept)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_CHARTER_DISPATCH_ENABLED=true to run');

  let ctx: Ctx;

  test.beforeAll(async () => {
    ctx = await prepare();
  });

  test.afterAll(async () => {
    await cleanup(ctx);
  });

  test('request lands ADMIN_REVIEW, admin dispatches ASSIGNED_DIRECT, operator accepts ACCEPTED', async ({
    page,
    request,
  }) => {
    // Full three-actor journey across many first-compiled dev routes (webpack) + admin
    // TOTP enrollment + several navigations — legitimately longer than the 30s default.
    test.setTimeout(120_000);

    // ───────────────────────── STEP 1 · REQUEST (customer) ─────────────────────────
    // The real charter request page must render (this is the design-audit "E1 charter 500"
    // watch point — a 500 here would surface as a >=400 nav status / missing form).
    const pageResp = await page.goto('/lien-he-dat-xe');
    expect(pageResp?.status(), 'GET /lien-he-dat-xe').toBeLessThan(400);
    await expect(page.getByLabel(/Điểm đón|Origin/i).first()).toBeVisible();

    // Submit through the real endpoint the form posts to (form-incidental → payload, not
    // synthetic clicks on the base-ui DatePicker).
    const startDate = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
    const csrf = await primeCsrf(request);
    const createRes = await request.post('/api/charter', {
      data: {
        contactName: 'Charter Dispatch E2E',
        contactPhone: CUSTOMER_PHONE,
        contactEmail: 'charter-dispatch-e2e@customer.dev',
        originName: 'Hà Nội',
        destinationNames: ['Sa Pa'],
        startDate,
        passengers: 30,
        vehicleType: 'coach',
        company: '', // honeypot left empty
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(createRes.status(), 'POST /api/charter').toBe(201);
    const { ref } = (await createRes.json()) as { ref: string };
    expect(ref).toMatch(CHARTER_REF_REGEX);

    // DB: the submit IS the SUBMITTED→ADMIN_REVIEW edge (created directly in ADMIN_REVIEW).
    const afterRequest = await readCharter(ref);
    expect(afterRequest.status).toBe('ADMIN_REVIEW');
    expect(afterRequest.assigneeOperatorId).toBeNull();
    const charterId = afterRequest.id;

    // UI: the public status page shows the request as "finding an operator" (ref visible),
    // and the ACCEPTED-only operator card (operator phone) is NOT yet present.
    await page.goto(`/charter/status/${ref}`);
    await expect(page.getByText(ref)).toBeVisible();
    await expect(page.getByText(ctx.operatorPhone)).toHaveCount(0);

    // ───────────────────────── STEP 2 · DISPATCH (admin) ──────────────────────────
    // Real admin login → TOTP enroll → TOTP confirm (confirm re-issues the session with
    // totpVerified=true, clearing the TOTP gate the dispatch route requires).
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(loginRes.status(), 'admin login').toBe(200);

    const enrollRes = await request.post('/api/admin/auth/totp/enroll', {
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(enrollRes.status(), 'totp enroll').toBe(200);
    const { secret } = (await enrollRes.json()) as { secret: string };

    const confirmRes = await request.post('/api/admin/auth/totp/confirm', {
      data: { code: totpCode(secret) },
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(confirmRes.status(), 'totp confirm').toBe(200);

    // Dispatch: ADMIN_REVIEW → ASSIGNED_DIRECT to the seed operator.
    const assignRes = await request.post(`/api/admin/charter/${charterId}/assign-direct`, {
      data: { operatorId: ctx.operatorId },
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(assignRes.status(), 'assign-direct').toBe(200);

    const afterDispatch = await readCharter(ref);
    expect(afterDispatch.status).toBe('ASSIGNED_DIRECT');
    expect(afterDispatch.assigneeOperatorId).toBe(ctx.operatorId);
    expect(afterDispatch.acceptByAt).not.toBeNull(); // 24h accept window stamped

    // UI: still pre-accept → operator card still absent (customer sees "finding").
    await page.goto(`/charter/status/${ref}`);
    await expect(page.getByText(ref)).toBeVisible();
    await expect(page.getByText(ctx.operatorPhone)).toHaveCount(0);

    // ───────────────────────── STEP 3 · ACCEPT (operator) ─────────────────────────
    const opLoginRes = await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_OP_USERNAME, password: SEED_OP_PASSWORD },
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(opLoginRes.status(), 'operator login').toBe(200);

    const acceptRes = await request.post(`/api/op/charter/${charterId}/accept`, {
      headers: { 'X-CSRF-Token': await currentCsrf(request) },
    });
    expect(acceptRes.status(), 'operator accept').toBe(200);

    const afterAccept = await readCharter(ref);
    expect(afterAccept.status).toBe('ACCEPTED');
    expect(afterAccept.assigneeOperatorId).toBe(ctx.operatorId);

    // UI: the status page now shows the match — the operator contact card (its phone) appears.
    await page.goto(`/charter/status/${ref}`);
    await expect(page.getByText(ctx.operatorPhone)).toBeVisible();
  });
});
