/**
 * adminAuthService — admin login (Issue 054).
 *
 * adminLogin(email, password) authenticates an AdminUser by email.
 *
 * NO ENUMERATION: a missing user, a non-ACTIVE status, and a wrong password all
 * return the SAME { ok: false } shape and never throw. To keep response timing
 * indistinguishable between the missing-user path and the wrong-password path, the
 * missing/disabled branch runs the scrypt-aware dummyVerify() — the SAME algorithm and
 * cost as a real verify (#590). Verifying a constant argon2 hash instead would return in
 * microseconds when AUTH_ARGON2_ENABLED is off (the prod default → scrypt real verifies),
 * re-opening the timing oracle it was meant to close.
 *
 * There is NO registration function — admin accounts are invite-only (issue 057).
 */

import { prisma } from '@/lib/core/db/client';
import { verify as verifyPassword, dummyVerify } from './password';
import type { AdminAccessPayload } from './jwt';

type AdminRole = AdminAccessPayload['role'];

export type AdminLoginResult =
  | { ok: true; adminUserId: string; role: AdminRole }
  | { ok: false };

export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      role: true,
      status: true,
    },
  });

  // Missing user OR non-ACTIVE status → run a dummy verify for timing parity,
  // then return the uniform failure shape (no enumeration, no throw).
  if (!user || user.status !== 'ACTIVE') {
    await dummyVerify();
    return { ok: false };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, adminUserId: user.id, role: user.role as AdminRole };
}
