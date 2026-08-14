/**
 * Zod validation schema for POST /api/op/bookings/cash request body.
 *
 * buyerName / buyerPhone: reuse the holdInputSchema field validators (#527) so an operator
 *   cash booking is validated exactly as a customer hold — including the VN mobile-phone
 *   regex (a bare '123' is rejected) and the Unicode name rule.
 * buyerEmail: OPTIONAL for operator cash walk-ups (#527) — a passenger paying cash at the
 *   counter may have no email, the DB column is nullable, and the pre-#508 flow allowed it.
 *   An empty string coerces to null; a present value must be a valid email.
 */

import { z } from 'zod';
import { holdInputSchema } from './hold';

export const cashBookingSchema = z.object({
  tripId: z.string().min(1).max(64),
  buyerName: holdInputSchema.shape.buyerName,
  buyerPhone: holdInputSchema.shape.buyerPhone,
  buyerEmail: z
    .union([z.literal(''), z.string().trim().toLowerCase().email().max(200)])
    .nullish()
    .transform((v) => (v ? v : null)),
  ticketCount: z.number().int().min(1).max(50),
});

export type CashBookingInput = z.infer<typeof cashBookingSchema>;
