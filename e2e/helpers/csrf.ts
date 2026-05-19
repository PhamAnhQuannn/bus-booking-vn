/**
 * Playwright e2e helper for CSRF double-submit.
 *
 * proxy.ts issues the bb_csrf cookie on the first safe-method request.
 * State-changing /api/* calls must echo it in the X-CSRF-Token header.
 *
 * Usage:
 *   const csrf = await primeCsrf(request);
 *   await request.post('/api/holds', {
 *     data: body,
 *     headers: { 'X-CSRF-Token': csrf },
 *   });
 */

import type { APIRequestContext } from '@playwright/test';

export async function primeCsrf(request: APIRequestContext): Promise<string> {
  await request.get('/');
  const { cookies } = await request.storageState();
  const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value;
  if (!csrf) throw new Error('bb_csrf cookie not issued by proxy.ts GET /');
  return csrf;
}
