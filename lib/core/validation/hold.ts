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
  // Prisma 7's @default(cuid()) generates cuid2 (no 'c' prefix), which z.cuid()
  // (cuid v1) REJECTS — that silently 400'd every real booking. tripId is looked up
  // in the DB (createHold → null → 409 if it doesn't exist), so a bounded-length
  // string is the right amount of validation and is robust across the cuid→cuid2 shift.
  tripId: z.string().min(1).max(64),
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
  // custom detail constraints are enforced server-side.
  pickupKind: z.enum(['station', 'custom']).optional().default('station'),
  pickupDetail: z.string().trim().max(300).optional(),
  // Chosen boarding point (name + "HH:MM") from the results card. Distinct from
  // pickupKind/pickupDetail; optional/back-compat.
  boardingPoint: z.string().trim().min(1).max(120).optional(),
  boardingTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
});

export type HoldInput = z.infer<typeof holdInputSchema>;
