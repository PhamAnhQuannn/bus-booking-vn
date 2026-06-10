/**
 * Zod validation schema for POST /api/holds request body.
 *
 * buyerPhone: accepts both local (0...) and international (+84...) VN mobile formats.
 * buyerName: Unicode letters/marks/spaces/apostrophes/hyphens/dots — covers Vietnamese names.
 * buyerEmail: required (Issue 042) — ticket delivery needs it. Trimmed + lowercased,
 *   format-validated via .email(). DB column is nullable for pre-042 rows only.
 */

import { z } from 'zod';

export const holdInputSchema = z.object({
  tripId: z.string().cuid(),
  ticketCount: z.number().int().min(1).max(10),
  buyerName: z
    .string()
    .trim()
    .min(4)
    .max(100)
    .regex(/^[\p{L}\p{M}\s'.-]+$/u),
  buyerPhone: z.string().trim().regex(/^(0|\+84)[35789][0-9]{8}$/),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email(),
  // Issue 107: traveler pickup selection. Optional for back-compat (absent = station);
  // the point/detail constraints are enforced server-side against the trip's areas.
  pickupKind: z.enum(['station', 'point', 'custom']).optional().default('station'),
  pickupAreaId: z.string().optional(),
  pickupDetail: z.string().trim().max(300).optional(),
});

export type HoldInput = z.infer<typeof holdInputSchema>;
