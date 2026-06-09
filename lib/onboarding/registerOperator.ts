/**
 * Operator application service (Issue 076; reworked 2026-06-06, S05).
 *
 * A prospective operator submits their company details via the public /op/register
 * form. This service creates ONLY the Operator row in PENDING_REVIEW with the
 * application profile fields + a human-friendly applicationRef, then enqueues a
 * "pending" email so the applicant has a paper trail + reference.
 *
 * 2026-06-06 CHANGE: no self-serve account creation. This NO LONGER creates an
 * OperatorUser and accepts NO password. The login account is provisioned later by
 * a platform admin (lib/admin/createOperatorAccount.ts), which mints a generated
 * username + temp password and emails the credentials. Operators never self-provision.
 *
 * Reuse-by-param: takes the Prisma client as an argument so the same core runs
 * under the request client and a test client.
 *
 * The pending email is ENQUEUED (status='pending') after commit — the Issue 058
 * dispatcher delivers it (NOTIFY_STUB-gated, no network I/O today). The
 * NotificationLog write stays OUT of the transaction so a log failure never rolls
 * back the application.
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '@/lib/core/validation/phone';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { generateApplicationRef } from './applicationRef';

/** Max attempts to mint a collision-free applicationRef (mirrors bookingRepo). */
const MAX_REF_ATTEMPTS = 5;

/** SLA shown to applicants — a RANGE, never an exact countdown (AC3). */
export const REGISTER_SLA_RANGE = 'within 2 business days';

export interface RegisterOperatorInput {
  brandName: string;
  legalName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  routesSummary: string;
  /** Issue 105: operator base province (GSO code + name from lib/geo). Optional. */
  provinceCode?: string;
  provinceName?: string;
  /** Origin for any links in the pending email (derived from request headers). */
  baseUrl: string;
}

export interface RegisterOperatorResult {
  operatorId: string;
  applicationRef: string;
}

export async function registerOperator(
  prisma: PrismaClient,
  input: RegisterOperatorInput
): Promise<RegisterOperatorResult> {
  const contactPhone = normalizePhone(input.contactPhone);

  let result: RegisterOperatorResult | null = null;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const applicationRef = generateApplicationRef();

    try {
      const operator = await prisma.operator.create({
        data: {
          brandName: input.brandName,
          legalName: input.legalName,
          contactName: input.contactName,
          address: input.address,
          routesSummary: input.routesSummary,
          provinceCode: input.provinceCode ?? null,
          provinceName: input.provinceName ?? null,
          contactEmail: input.contactEmail,
          contactPhone,
          notificationPhone: contactPhone,
          applicationRef,
          // Issue 045: PENDING_REVIEW is the schema default; set explicitly so an
          // application can never accidentally land in a bookable state.
          status: 'PENDING_REVIEW',
        },
        select: { id: true },
      });

      result = { operatorId: operator.id, applicationRef };
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // The only unique index on this insert is applicationRef — retry with a
        // fresh ref. (There is no operator-side phone uniqueness; duplicate
        // applications by phone are allowed and de-duped by the admin at review.)
        const target = e.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetStr.includes('applicationRef')) continue;
      }
      throw e;
    }
  }

  if (!result) {
    // Exhausted ref attempts — extremely unlikely (36^6 ≈ 2.1 billion refs/year).
    throw new Error('application_ref_collision');
  }

  // Enqueue the pending email AFTER commit (status='pending'; Issue 058 delivers).
  // A RANGE string for the SLA, never an exact countdown (AC3).
  await createNotificationLog({
    bookingId: null,
    channel: 'email',
    template: 'operatorPending',
    recipient: input.contactEmail,
    payload: JSON.stringify({
      applicationRef: result.applicationRef,
      legalName: input.legalName,
      slaRange: REGISTER_SLA_RANGE,
    }),
    status: 'pending',
  });

  return result;
}
