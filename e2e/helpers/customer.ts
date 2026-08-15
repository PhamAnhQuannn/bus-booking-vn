/**
 * Shared e2e helpers for the customer email-OTP flows (#241).
 *
 * The customer OTP contract is EMAIL-based (`{email}` to /api/auth/otp/send, peek `?email=`,
 * verify `{email,code}`, register `{email,otpProof,password,acceptTerms:true}` → 201). These helpers
 * were previously copy-pasted (phone-based) inside each spec; extracted here so the auth + account
 * specs share one correct implementation.
 *
 * Requires the dev server running with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true (OTP lands in the
 * peek sink) and DATABASE_URL pointed at the dev/test DB.
 */
import { expect, type Page } from '@playwright/test';
import { Client } from 'pg';

export function getCsrf(cookies: Array<{ name: string; value: string }>): string {
  return cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
}

/** Delete a customer + its OTP attempts + sessions by email (opens/closes its own connection). */
export async function cleanupCustomer(dbUrl: string, email: string): Promise<void> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await cleanupCustomerWith(client, email);
  } finally {
    await client.end();
  }
}

/** Same as cleanupCustomer but reuses a caller-owned pg client (specs that hold one open). */
export async function cleanupCustomerWith(client: Client, email: string): Promise<void> {
  await client.query(`DELETE FROM "OtpAttempt" WHERE email = $1`, [email]);
  await client.query(
    `DELETE FROM "Session" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE email = $1)`,
    [email],
  );
  await client.query(`DELETE FROM "Customer" WHERE email = $1`, [email]);
}

/** Read the last OTP code for an email (or phone) from the dev/test peek sink. */
export async function peekOtp(
  page: Page,
  baseUrl: string,
  key: { email?: string; phone?: string },
): Promise<string> {
  const q = key.email
    ? `email=${encodeURIComponent(key.email)}`
    : `phone=${encodeURIComponent(key.phone ?? '')}`;
  const res = await page.evaluate(
    async ([qq, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/test-peek?${qq}`, { credentials: 'include' });
      return { status: r.status, body: (await r.json()) as { code?: string } };
    },
    [q, baseUrl] as const,
  );
  expect(res.status, 'otp/test-peek').toBe(200);
  return res.body.code ?? '';
}

/**
 * Register a customer via the email OTP flow. Returns the access token.
 * send → peek → verify → register (201, with acceptTerms).
 */
export async function registerCustomer(
  page: Page,
  baseUrl: string,
  csrf: string,
  opts: { email: string; password: string; displayName?: string },
): Promise<string> {
  const { email, password, displayName } = opts;

  const send = await page.evaluate(
    async ([e, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({ email: e }),
        credentials: 'include',
      });
      return { status: r.status, body: (await r.json()) as { success?: boolean } };
    },
    [email, csrf, baseUrl] as const,
  );
  expect(send.status, 'otp/send').toBe(200);
  expect(send.body.success).toBe(true);

  const code = await peekOtp(page, baseUrl, { email });
  expect(code).toMatch(/^[0-9]{6}$/);

  const verify = await page.evaluate(
    async ([e, c, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({ email: e, code: c }),
        credentials: 'include',
      });
      return { status: r.status, body: (await r.json()) as { otpProof?: string } };
    },
    [email, code, csrf, baseUrl] as const,
  );
  expect(verify.status, 'otp/verify').toBe(200);
  const otpProof = verify.body.otpProof ?? '';
  expect(otpProof.length).toBeGreaterThan(0);

  const reg = await page.evaluate(
    async ([e, pf, pw, dn, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({
          email: e,
          otpProof: pf,
          password: pw,
          acceptTerms: true, // #472: register requires explicit consent
          ...(dn ? { displayName: dn } : {}),
        }),
        credentials: 'include',
      });
      return { status: r.status, body: (await r.json()) as { accessToken?: string } };
    },
    [email, otpProof, password, displayName ?? '', csrf, baseUrl] as const,
  );
  expect(reg.status, 'register').toBe(201); // DS-003 §6.1: register creates a Customer → 201
  return reg.body.accessToken ?? '';
}
