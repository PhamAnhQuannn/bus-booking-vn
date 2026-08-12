/**
 * Zod validation schema for POST /api/op/bookings/cash request body.
 *
 * buyerEmail: required — the ticket is delivered by email (Issue 042), so operator
 *   walk-up cash bookings must capture a valid email too. Trimmed + lowercased,
 *   format-validated via .email(). The DB column stays nullable for historical rows.
 */

import { z } from 'zod';

export const cashBookingSchema = z.object({
  tripId: z.string().min(1),
  buyerName: z.string().min(1).max(200),
  buyerPhone: z.string().min(1).max(20),
  buyerEmail: z.string().trim().toLowerCase().email().max(200),
  ticketCount: z.number().int().min(1).max(50),
});

export type CashBookingInput = z.infer<typeof cashBookingSchema>;
