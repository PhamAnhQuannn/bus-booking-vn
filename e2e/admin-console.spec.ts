/**
 * E2E spec: admin-console — the highest-blast-radius admin journey (issue #771).
 *
 * Journey (driven through the REAL admin UI + real auth path):
 *   1. Admin login  → POST /api/admin/auth/login   (email + password)
 *   2. TOTP step    → POST /api/admin/auth/totp/verify (per-login TOTP)
 *   3. Suspend an operator (APPROVED → SUSPENDED) via the Operator detail page.
 *      This is a PRIVILEGED action: the UI hits a 403 STEP_UP_REQUIRED, reveals the
 *      inline TOTP step-up prompt, mints bb_admin_stepup, then retries.
 *   4. Reinstate (SUSPENDED → APPROVED): reuses the still-fresh step-up cookie
 *      (300s TTL) — no second prompt.
 *   5. Assert the audit trail: one AdminAuditLog row per action
 *      (actor=admin:<id>, action=operator-status:<STATE>, target=<operatorId>).
 *
 * Identity is established ONLY through the real requireAdminAuth login path — no
 * auth bypass. TOTP codes are generated with the SAME lib the server verifies
 * against (lib/auth/totp), from a seeded secret stored PLAINTEXT in the dev DB
 * (decryptTotpSecret passes non-`enc:`-prefixed secrets through unmodified), which
 * decouples the test from TOTP_ENCRYPTION_KEY. DEV/TEST seed only.
 *
 * Prerequisites: running dev server (:3001) + dev Postgres (docker). Chromium only
 * (the flow has no mobile-specific surface; a single project avoids two projects
 * racing over the same seeded admin/operator rows).
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { hash } from '../lib/auth/password';
import { generateTotpSecret, generateTotp } from '../lib/auth/totp';

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Dedicated identities so this spec never disturbs the seeded SUPER_ADMIN / operators
// that other specs and manual flows rely on.
const ADMIN_EMAIL = 'e2e-admin-console@busbookvn.local';
// Per-run random password (never a committed credential); suffix satisfies complexity.
const ADMIN_PASSWORD = `${randomBytes(12).toString('hex')}!Aa1`;
const OPERATOR_EMAIL = 'e2e-admin-console-op@test.invalid';
const OPERATOR_PHONE = '+8490xxxxxx7'; // gitleaks-safe placeholder — not a real number

// Populated in beforeAll.
let adminId = '';
let operatorId = '';
let totpSecret = '';

// TOTP codes are single-use within the ±1 window (consumeJti replay guard, keyed
// adminId:code). If the current step's code was already spent, use the NEXT step's
// code instead of waiting: it differs, and the server's ±1 window accepts it.
const usedCodes = new Set<string>();
function freshTotp(): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  let code = generateTotp(totpSecret, counter);
  if (usedCodes.has(code)) code = generateTotp(totpSecret, counter + 1);
  usedCodes.add(code);
  return code;
}

test.beforeAll(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    totpSecret = generateTotpSecret();
    const passwordHash = await hash(ADMIN_PASSWORD);

    // Upsert a SUPER_ADMIN with a KNOWN password + an enabled, PLAINTEXT TOTP secret.
    const adminRow = await client.query<{ id: string }>(
      `INSERT INTO "AdminUser" ("id","email","passwordHash","role","status","totpSecret","totpEnabledAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'SUPER_ADMIN', 'ACTIVE', $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET "passwordHash" = $2, "role" = 'SUPER_ADMIN', "status" = 'ACTIVE',
             "totpSecret" = $3, "totpEnabledAt" = NOW(), "updatedAt" = NOW()
       RETURNING id`,
      [ADMIN_EMAIL, passwordHash, totpSecret]
    );
    adminId = adminRow.rows[0].id;

    // Fresh, APPROVED operator each run → a fresh operatorId, so the audit-log
    // assertions can't collide with rows left by a prior run. No child rows exist,
    // so a delete-then-insert is safe.
    await client.query(`DELETE FROM "Operator" WHERE "contactEmail" = $1`, [OPERATOR_EMAIL]);
    const opRow = await client.query<{ id: string }>(
      `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail","status")
       VALUES (gen_random_uuid()::text, 'E2E Admin Console Operator', $1, $2, 'APPROVED')
       RETURNING id`,
      [OPERATOR_PHONE, OPERATOR_EMAIL]
    );
    operatorId = opRow.rows[0].id;
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // AdminAuditLog is append-only (DB trigger blocks DELETE) — intentionally not cleaned.
    await client.query(`DELETE FROM "Operator" WHERE "contactEmail" = $1`, [OPERATOR_EMAIL]);
    await client.query(`DELETE FROM "AdminUser" WHERE email = $1`, [ADMIN_EMAIL]);
  } finally {
    await client.end();
  }
});

test.describe('Admin console — operator suspend/reinstate journey', () => {
  test.describe.configure({ timeout: 60_000 });

  test('login → TOTP step-up → suspend → reinstate → audit trail', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-390', 'Admin console has no mobile-specific surface — chromium covers it');

    // --- 1. Real admin login (email + password) --------------------------------
    // GET first so proxy.ts issues the bb_csrf double-submit cookie the login POSTs echo.
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill(ADMIN_EMAIL);
    await page.locator('#admin-password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // --- 2. Per-login TOTP -----------------------------------------------------
    const loginCode = freshTotp();
    await page.locator('#admin-totp-code').fill(loginCode);
    await page.getByRole('button', { name: 'Xác thực' }).click();
    // Lands on the console home once totpVerified flips true.
    await page.waitForURL('**/admin');

    // --- 3. Suspend the operator (privileged → step-up) ------------------------
    await page.goto(`/admin/operators/${operatorId}`);
    await expect(page.getByRole('heading', { name: 'E2E Admin Console Operator' })).toBeVisible();

    await page.getByTestId('action-suspend').click();

    // The first privileged POST returns 403 STEP_UP_REQUIRED → inline TOTP prompt.
    const stepUpInput = page.getByTestId('stepup-code');
    await expect(stepUpInput).toBeVisible();
    await stepUpInput.fill(freshTotp());
    await page.getByRole('button', { name: 'Xác nhận' }).click();

    // After router.refresh() the RSC re-renders SUSPENDED: reinstate button + badge.
    await expect(page.getByTestId('action-reinstate')).toBeVisible();
    await expect(page.getByText('Tạm ngưng', { exact: true })).toBeVisible();

    // DB truth: status flipped + disabledAt stamped (transition service invariant).
    await expectOperator({ status: 'SUSPENDED', disabled: true });

    // --- 4. Reinstate (reuses the fresh step-up cookie — no second prompt) ------
    await page.getByTestId('action-reinstate').click();
    await expect(page.getByTestId('action-suspend')).toBeVisible();
    await expect(page.getByText('Đã duyệt', { exact: true })).toBeVisible();

    await expectOperator({ status: 'APPROVED', disabled: false });

    // --- 5. Audit trail: one row per action, correct actor / action / target ---
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ actor: string; action: string; target: string }>(
        `SELECT actor, action, target FROM "AdminAuditLog"
         WHERE target = $1 AND action IN ('operator-status:SUSPENDED','operator-status:APPROVED')`,
        [operatorId]
      );
      expect(rows).toHaveLength(2);
      const actions = rows.map((r) => r.action);
      expect(actions).toContain('operator-status:SUSPENDED');
      expect(actions).toContain('operator-status:APPROVED');
      // Every row is attributed to the acting admin and targets this operator.
      for (const r of rows) {
        expect(r.actor).toBe(`admin:${adminId}`);
        expect(r.target).toBe(operatorId);
      }
    } finally {
      await client.end();
    }
  });
});

async function expectOperator(want: { status: string; disabled: boolean }): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ status: string; disabledAt: Date | null }>(
      `SELECT status, "disabledAt" FROM "Operator" WHERE id = $1`,
      [operatorId]
    );
    expect(rows[0]?.status).toBe(want.status);
    if (want.disabled) {
      expect(rows[0]?.disabledAt).not.toBeNull();
    } else {
      expect(rows[0]?.disabledAt).toBeNull();
    }
  } finally {
    await client.end();
  }
}
