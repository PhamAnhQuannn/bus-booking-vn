/**
 * Forgot-password flow (Issue 008 AC1).
 *
 * Always returns { ok: true } to prevent email enumeration.
 * If the email matches a non-deleted customer, sends OTP via email.
 */

import { prisma } from '@/lib/core/db/client';
import { sendCustomerAccountOtp } from './customerOtp';

const DUMMY_DELAY_MS = 200;

export interface ForgotPasswordResult {
  ok: true;
  retryAfter?: number;
}

export async function forgotPassword(rawEmail: string): Promise<ForgotPasswordResult> {
  const email = rawEmail.trim().toLowerCase();

  const customer = await prisma.customer.findFirst({
    where: { email, deletedAt: null },
    select: { id: true },
  });

  if (!customer) {
    await new Promise((r) => setTimeout(r, DUMMY_DELAY_MS));
    return { ok: true };
  }

  const result = await sendCustomerAccountOtp(email);
  if (!result.ok) {
    return { ok: true, retryAfter: result.retryAfter };
  }

  return { ok: true };
}
