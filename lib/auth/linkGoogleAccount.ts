/**
 * resolveGoogleLogin — DS-033 §3 account-linking resolution, run in the Google callback
 * after id_token validation yields { sub, email, emailVerified }.
 *
 * Returns a discriminated result; the create/link/backfill writes happen in ONE
 * prisma.$transaction (L3 — no partial link possible).
 *
 *   L1  known link              → the linked Customer (reject if inactive).
 *   L2  existing verified email → link `sub` to that Customer; stamp emailVerifiedAt.
 *   L2′ existing email, Google-unverified → reject (no account takeover, HD-012 L1).
 *   L3  new                     → create Customer (passwordHash null) + Account + backfill.
 *
 * Tightening vs DS-033 §3 line 76: a new customer's emailVerifiedAt is set only when
 * Google asserts email_verified — an unverified Google email must not silently mark the
 * new account's email as proven.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { checkCustomerActive } from './assertCustomerActive';
import { backfillGuestBookingsByEmail } from '@/lib/booking';
import { asProvenEmail } from '@/lib/core/validation/provenEmail';

const PROVIDER = 'google';

export interface GoogleIdentityInput {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export type ResolveGoogleResult =
  | { ok: true; customerId: string; created: boolean }
  | { ok: false; reason: 'inactive' | 'email_conflict' };

export async function resolveGoogleLogin(identity: GoogleIdentityInput): Promise<ResolveGoogleResult> {
  const email = identity.email.trim().toLowerCase();
  const now = new Date();

  // L1 — known link.
  const existingLink = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: PROVIDER, providerAccountId: identity.sub },
    },
    select: { customer: { select: { id: true, suspendedAt: true, deletedAt: true } } },
  });
  if (existingLink) {
    const c = existingLink.customer;
    if (!checkCustomerActive({ suspendedAt: c.suspendedAt, deletedAt: c.deletedAt }).active) {
      return { ok: false, reason: 'inactive' };
    }
    return { ok: true, customerId: c.id, created: false };
  }

  // L2 — existing email. Only link when Google asserts the email is verified.
  const existingByEmail = await prisma.customer.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, emailVerifiedAt: true },
  });
  if (existingByEmail) {
    if (!identity.emailVerified) {
      return { ok: false, reason: 'email_conflict' }; // L2′ — no takeover
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            customerId: existingByEmail.id,
            provider: PROVIDER,
            providerAccountId: identity.sub,
            email,
          },
        });
        if (existingByEmail.emailVerifiedAt === null) {
          await tx.customer.update({
            where: { id: existingByEmail.id },
            data: { emailVerifiedAt: now },
          });
        }
      });
    } catch (err) {
      // L2 idempotent: a concurrent request created the link first (P2002 on the
      // provider+sub unique) → treat as already linked, not an error.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    return { ok: true, customerId: existingByEmail.id, created: false };
  }

  // L3 — new customer + link + guest-booking backfill, atomically.
  const customerId = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        email,
        passwordHash: null,
        emailVerifiedAt: identity.emailVerified ? now : null,
      },
      select: { id: true, email: true },
    });
    await tx.account.create({
      data: { customerId: created.id, provider: PROVIDER, providerAccountId: identity.sub, email },
    });
    if (created.email) {
      await backfillGuestBookingsByEmail(tx, created.id, asProvenEmail(created.email));
    }
    return created.id;
  });
  return { ok: true, customerId, created: true };
}
