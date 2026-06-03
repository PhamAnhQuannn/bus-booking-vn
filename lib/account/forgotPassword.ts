/**
 * Forgot-password flow (Issue 008 AC1).
 *
 * Always returns { ok: true } to prevent phone enumeration.
 * If the phone matches a non-deleted customer, sends OTP via the
 * customer account OTP module (3-failure/15-min lockout, 3-send/15-min ratelimit).
 * If no customer row exists, performs a dummy delay for timing safety.
 *
 * The caller (POST /api/auth/forgot-password) always 200s.
 */

import { prisma } from '@/lib/core/db/client';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { sendCustomerAccountOtp } from './customerOtp';

const DUMMY_DELAY_MS = 200; // approximate timing of SMS send — prevents enumeration

export interface ForgotPasswordResult {
  ok: true;
  /** Present when lockout/ratelimit kicked in — callers may surface as Retry-After */
  retryAfter?: number;
}

export async function forgotPassword(rawPhone: string): Promise<ForgotPasswordResult> {
  const phone = normalizePhone(rawPhone);

  // Check if customer exists (non-deleted)
  const customer = await prisma.customer.findFirst({
    where: { phone, deletedAt: null },
    select: { id: true },
  });

  if (!customer) {
    // Dummy delay to mask the existence check timing difference
    await new Promise((r) => setTimeout(r, DUMMY_DELAY_MS));
    return { ok: true };
  }

  const result = await sendCustomerAccountOtp(phone);
  if (!result.ok) {
    // Rate-limited or locked-out — still return 200 (no enumeration) but include retryAfter
    return { ok: true, retryAfter: result.retryAfter };
  }

  return { ok: true };
}
