/**
 * Issue 082: customer charter-request create service.
 *
 * The public charter form (components/contact/ContactBookingForm.tsx →
 * POST /api/charter) lands here. We resolve the origin to a canonical Place
 * (Issue 044 resolveOrCreatePlace), store the destinations as a JSON string array
 * (see DESTINATIONS doc below), generate a collision-free ref (retry on the unique
 * index, mirroring registerOperator / bookingRepo), and create the CharterRequest.
 *
 * STATUS DECISION: the submit IS the SUBMITTED → ADMIN_REVIEW transition (the
 * customer has handed the lead to BBVN ops for routing). Rather than create in
 * SUBMITTED and immediately call transitionCharterRequest, we create DIRECTLY in
 * ADMIN_REVIEW — there is no meaningful SUBMITTED dwell time for a self-serve
 * request and no side-effect attached to the SUBMITTED → ADMIN_REVIEW edge. The
 * row's first persisted state is therefore ADMIN_REVIEW. (Admin/operator-driven
 * transitions from here on still go through transitionCharterRequest.)
 *
 * DESTINATIONS: the schema column `destinations Json` is documented as an array of
 * `{ placeId?, name }` descriptors. Issue 082 stores the customer-typed destination
 * NAME strings only (no Place resolution for destinations — they're free-text trip
 * stops, often informal tourism spots that don't map to bookable Places). We store
 * the bare string array; a later issue can backfill placeId if destination
 * resolution is ever needed.
 *
 * GUEST vs ATTACHED: customerId is optional — a guest request stores null; a
 * logged-in customer's id is stamped (the route reads it via getCustomerOptional,
 * never requires it). This both pre-links the request to the account and is the
 * authoritative attach (no phone-match spoof vector).
 *
 * Reuse-by-param: takes the Prisma client as an argument so the same core runs
 * under the request client and a test client.
 *
 * The charterSubmitted confirmation (sms + email) is ENQUEUED post-commit
 * (status='pending') — the Issue 058 dispatcher delivers it. We keep the
 * NotificationLog write OUT of the transaction so a log failure never rolls back
 * the request (mirrors registerOperator).
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { resolveOrCreatePlace } from '@/lib/places';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { generateCharterRef } from './charterRef';

/** Max attempts to mint a collision-free ref (mirrors registerOperator). */
const MAX_REF_ATTEMPTS = 5;

export interface CreateCharterRequestInput {
  /** Logged-in customer id, or undefined/null for a guest request. */
  customerId?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  /** Free-text origin name; resolved to a canonical Place (Issue 044). */
  originName: string;
  /** Customer-typed destination name strings (stored as a JSON string array). */
  destinationNames: string[];
  startDate: Date;
  endDate?: Date | null;
  durationDays?: number | null;
  passengers: number;
  /** 'coach' | 'sleeper' | 'limousine' (documented free-text set). */
  vehicleType: string;
  budgetVnd?: number | null;
  notes?: string | null;
}

export interface CreateCharterRequestResult {
  ref: string;
  charterId: string;
}

export async function createCharterRequest(
  prisma: PrismaClient,
  input: CreateCharterRequestInput
): Promise<CreateCharterRequestResult> {
  // Resolve the origin to a canonical Place (creates one if new).
  const origin = await resolveOrCreatePlace(input.originName);

  // Destinations stored as a bare JSON string array (see file header).
  const destinations = input.destinationNames.map((n) => n.trim()).filter((n) => n.length > 0);

  let result: CreateCharterRequestResult | null = null;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const ref = generateCharterRef();

    try {
      const created = await prisma.charterRequest.create({
        data: {
          ref,
          customerId: input.customerId ?? null,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          contactEmail: input.contactEmail,
          originPlaceId: origin.id,
          destinations,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          durationDays: input.durationDays ?? null,
          passengers: input.passengers,
          vehicleType: input.vehicleType,
          budgetVnd: input.budgetVnd ?? null,
          notes: input.notes ?? null,
          // STATUS DECISION (see file header): the submit IS SUBMITTED →
          // ADMIN_REVIEW; create directly in ADMIN_REVIEW.
          status: 'ADMIN_REVIEW',
        },
        select: { id: true, ref: true },
      });
      result = { ref: created.ref, charterId: created.id };
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = e.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetStr.includes('ref')) {
          continue; // collision on the random ref — retry with a fresh one
        }
      }
      throw e;
    }
  }

  if (!result) {
    // Exhausted ref attempts (36^6 ≈ 2.1B refs/year → vanishingly unlikely).
    throw new Error('charter_ref_collision');
  }

  // Enqueue the confirmation (sms + email) AFTER commit (status='pending').
  const payload = JSON.stringify({ ref: result.ref, contactName: input.contactName });
  await createNotificationLog({
    channel: 'sms',
    template: 'charterSubmitted',
    recipient: input.contactPhone,
    payload,
    status: 'pending',
  });
  await createNotificationLog({
    channel: 'email',
    template: 'charterSubmitted',
    recipient: input.contactEmail,
    payload,
    status: 'pending',
  });

  return result;
}
