/**
 * GET /api/account/export (#471 — PDPL right-to-access)
 * Bearer auth required. Returns the authenticated customer's own personal data as JSON.
 *
 * Complements DELETE /api/account (right-to-erasure). No secrets are returned — see
 * lib/account/exportData.ts for the field whitelist.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { exportCustomerData } from '@/lib/account';

async function handler(_req: NextRequest, { customerId }: { customerId: string }): Promise<Response> {
  const data = await exportCustomerData(customerId);
  if (!data) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), customer: data },
    // Never let a browser/CDN cache a personal-data export.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withErrorHandler(requireCustomerAuth()(handler));
