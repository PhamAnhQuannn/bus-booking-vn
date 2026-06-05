/**
 * adminAuthService — admin login (Issue 054).
 *
 * adminLogin(email, password) authenticates an AdminUser by email.
 *
 * NO ENUMERATION: a missing user, a non-ACTIVE status, and a wrong password all
 * return the SAME { ok: false } shape and never throw. To keep response timing
 * indistinguishable between the missing-user path and the wrong-password path, we
 * run verifyPassword against a constant valid argon2id hash (DUMMY_HASH) whenever
 * the user is missing or disabled — the password compare cost is incurred either way.
 *
 * There is NO registration function — admin accounts are invite-only (issue 057).
 */

import { prisma } from '@/lib/core/db/client';
import { verify as verifyPassword } from './password';
import type { AdminAccessPayload } from './jwt';

type AdminRole = AdminAccessPayload['role'];

// Constant argon2id hash used purely for timing equalization on the missing-user
// / disabled-user paths. It is a real, valid argon2id encoding of a throwaway
// password ('timing-dummy'); the verify result is discarded. Verifying against a
// real hash makes the missing-user path cost the same as the wrong-password path,
// so an attacker cannot distinguish "no such email" from "wrong password" by timing.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$Hd0nE0n0p1qZf3kPq2m4nQ8vP6yKfHj5wXr9bC1aT2s';

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
    await verifyPassword(DUMMY_HASH, password).catch(() => false);
    return { ok: false };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, adminUserId: user.id, role: user.role as AdminRole };
}
