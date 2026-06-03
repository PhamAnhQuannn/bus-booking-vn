/**
 * Issue 076: self-serve operator registration service.
 *
 * A prospective operator submits their company details + a password they CHOOSE
 * (vs the admin-CLI flow in lib/admin/createOperator.ts which mints a one-time
 * temp password and forces a change). This service creates the Operator in
 * PENDING_REVIEW (Issue 045 default — set explicitly to be safe) plus its first
 * bootstrap admin OperatorUser, then enqueues a "pending" email so the applicant
 * has a paper trail + their application reference.
 *
 * requiresPasswordChange DECISION: false here, true in createOperator.
 *   - CLI (createOperator): the admin sets a temp password the operator has
 *     never seen → force a change on first login.
 *   - Self-serve (this): the registrant TYPED their own password → no forced
 *     change. They can log in immediately to draft their fleet while the
 *     application is under review (only APPROVED operators are search-visible /
 *     bookable per S05, so drafting-while-pending is safe).
 *
 * Reuse-by-param: takes the Prisma client as an argument (mirrors createOperator)
 * so the same core runs under the request client and a test client.
 *
 * Field set MIRRORS createOperator's Operator + bootstrap OperatorUser insert:
 *   - Operator: legalName, contactEmail, contactPhone(normalized),
 *     notificationPhone (same as contact — an Operator company row; the Issue 020
 *     OperatorUser_phones_differ CHECK was DROPPED, so identical phones are fine),
 *     applicationRef, status=PENDING_REVIEW.
 *   - OperatorUser: operatorId, phone, contactPhone, notificationPhone (all the
 *     normalized login phone — Issue 012 NOT-NULL columns must all be set),
 *     passwordHash, displayName=legalName, role='admin', requiresPasswordChange=false.
 *
 * The pending email is ENQUEUED (status='pending') after commit — the Issue 058
 * dispatcher delivers it (NOTIFY_STUB-gated, no network I/O today). We keep the
 * NotificationLog write OUT of the transaction so a log failure never rolls back
 * the operator (mirrors createOperator).
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { hash } from '@/lib/auth/password';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { generateApplicationRef } from './applicationRef';
import { RegisterError } from './errors';

/** Max attempts to mint a collision-free applicationRef (mirrors bookingRepo). */
const MAX_REF_ATTEMPTS = 5;

/** SLA shown to applicants — a RANGE, never an exact countdown (AC3). */
export const REGISTER_SLA_RANGE = 'within 2 business days';

export interface RegisterOperatorInput {
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
  /** Origin for any links in the pending email (derived from request headers). */
  baseUrl: string;
}

export interface RegisterOperatorResult {
  operatorId: string;
  operatorUserId: string;
  applicationRef: string;
}

export async function registerOperator(
  prisma: PrismaClient,
  input: RegisterOperatorInput
): Promise<RegisterOperatorResult> {
  const loginPhone = normalizePhone(input.contactPhone);
  const passwordHash = await hash(input.password);

  let result: RegisterOperatorResult | null = null;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const applicationRef = generateApplicationRef();

    try {
      result = await prisma.$transaction(async (tx) => {
        const operator = await tx.operator.create({
          data: {
            legalName: input.legalName,
            contactEmail: input.contactEmail,
            contactPhone: loginPhone,
            notificationPhone: loginPhone,
            applicationRef,
            // Issue 045: PENDING_REVIEW is the schema default; set explicitly so
            // the self-serve path can never accidentally land an applicant in a
            // bookable state.
            status: 'PENDING_REVIEW',
          },
          select: { id: true },
        });

        const operatorUser = await tx.operatorUser.create({
          data: {
            operatorId: operator.id,
            phone: loginPhone,
            contactPhone: loginPhone,
            notificationPhone: loginPhone,
            passwordHash,
            displayName: input.legalName,
            role: 'admin',
            // Self-serve: the registrant chose their own password (see file
            // header) — no forced change, unlike the CLI temp-password flow.
            requiresPasswordChange: false,
          },
          select: { id: true },
        });

        return {
          operatorId: operator.id,
          operatorUserId: operatorUser.id,
          applicationRef,
        };
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // P2002 target tells us WHICH unique index collided. applicationRef →
        // retry with a fresh ref; OperatorUser.phone → permanent (typed) error.
        const target = e.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetStr.includes('applicationRef')) {
          continue; // collision on the random ref — retry
        }
        // Any other unique collision is the login phone (OperatorUser.phone /
        // Operator.contactPhone share the same value in this flow).
        throw new RegisterError('phone_in_use');
      }
      throw e;
    }
  }

  if (!result) {
    // Exhausted ref attempts — surfaced as a generic error (extremely unlikely;
    // 36^6 ≈ 2.1 billion refs per year).
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
