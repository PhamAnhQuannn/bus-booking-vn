/**
 * Zod validation schema for POST /api/holds request body.
 *
 * buyerPhone: accepts both local (0...) and international (+84...) VN mobile formats.
 * buyerName: Unicode letters/marks/spaces/apostrophes/hyphens/dots — covers Vietnamese names.
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
});

export type HoldInput = z.infer<typeof holdInputSchema>;
