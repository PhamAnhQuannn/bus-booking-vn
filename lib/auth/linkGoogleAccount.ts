/**
 * resolveGoogleLogin — DS-033 §3 account-linking resolution, run in the Google callback
 * after id_token validation yields { sub, email, emailVerified }.
 *
 * Returns a discriminated result; the create/link/backfill writes happen in ONE
 * prisma.$transaction (L3 — no partial link possible).
 *
 *   L1  known link       → reject if inactive; else the linked Customer.
 *   L2  existing email   → reject if inactive (suspended/deleted); else reject if the
 *                          Google email is unverified (L2′, no takeover, HD-012 L1); else
 *                          link `sub` to that Customer + stamp emailVerifiedAt.
 *   L3  new              → reject if the Google email is unverified (L3′, no email-squat
 *                          takeover, HD-012 L1); else create Customer (passwordHash null) +
 *                          Account + claim guest bookings.
 *
 * Every session-minting branch enforces `checkCustomerActive` (P3, matching password
 * login P8) AND verified-email-only handling (the ProvenEmail IDOR guard):
 * - a suspended/deleted customer must not mint a session via Google (L1/L2/L3-race);
 * - an unverified Google email neither links to an existing row (L2′) nor creates a new
 *   one (L3′), so Customer.email is always a Google-proven address and asProvenEmail is
 *   only ever handed a proven email.
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

  // L2 — existing email. Reject inactive first (a suspended/deleted customer must not mint
  // a session via Google any more than via password login — P8 / assertCustomerActive P3),
  // then require Google to have verified the email before linking.
  const existingByEmail = await prisma.customer.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, emailVerifiedAt: true, suspendedAt: true },
  });
  if (existingByEmail) {
    // deletedAt already excluded by the where; check suspendedAt explicitly.
    if (!checkCustomerActive({ suspendedAt: existingByEmail.suspendedAt, deletedAt: null }).active) {
      return { ok: false, reason: 'inactive' };
    }
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
  //
  // L3′ (HD-012 L1, mirrors L2′): a brand-new Google identity must have a Google-VERIFIED
  // email before we create a Customer keyed to it. Creating Customer.email from an UNVERIFIED
  // address lets an attacker squat a victim's email (Google can assert email_verified:false
  // for some Workspace domains); the real owner's later verified sign-in then matches that
  // row by email in L2 and links into the squatter's account — a shared-account takeover.
  // Refuse instead, exactly as L2′ refuses to link an unverified email to an existing row.
  if (!identity.emailVerified) {
    return { ok: false, reason: 'email_conflict' };
  }

  let customerId: string;
  try {
    customerId = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          email,
          passwordHash: null,
          emailVerifiedAt: now, // guaranteed verified by the L3′ guard above
        },
        select: { id: true, email: true },
      });
      await tx.account.create({
        data: { customerId: created.id, provider: PROVIDER, providerAccountId: identity.sub, email },
      });
      // Claim guest bookings for this now-verified email. asProvenEmail must never brand an
      // unproven address (IDOR guard, provenEmail.ts); the L3′ guard makes email proven here.
      if (created.email) {
        await backfillGuestBookingsByEmail(tx, created.id, asProvenEmail(created.email));
      }
      return created.id;
    });
  } catch (err) {
    // Concurrent first-time sign-in won the race → P2002 on the Account provider+sub
    // unique (or the Customer email index). Re-resolve idempotently instead of a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const link = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider: PROVIDER, providerAccountId: identity.sub },
        },
        select: { customer: { select: { id: true, suspendedAt: true, deletedAt: true } } },
      });
      if (link) {
        if (
          !checkCustomerActive({
            suspendedAt: link.customer.suspendedAt,
            deletedAt: link.customer.deletedAt,
          }).active
        ) {
          return { ok: false, reason: 'inactive' };
        }
        return { ok: true, customerId: link.customer.id, created: false };
      }
      // The race created a Customer with this email but linked to a DIFFERENT sub (or not
      // linked yet) → treat as a conflict rather than hijacking it.
      return { ok: false, reason: 'email_conflict' };
    }
    throw err;
  }
  return { ok: true, customerId, created: true };
}
