/**
 * Zod validation schema for the /api/trips/search query parameters.
 *
 * AC-10: 400 response on Zod breach.
 * - origin / destination: 1–50 character strings (Vietnamese unicode accepted)
 * - date: YYYY-MM-DD wall-clock format (Asia/Ho_Chi_Minh)
 * - ticketCount: coerced integer 1–10
 */

import { z } from 'zod';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export const searchParamsSchema = z.object({
  origin: z
    .string()
    .min(1, 'Origin is required')
    .max(50, 'Origin must be 50 characters or fewer'),

  destination: z
    .string()
    .min(1, 'Destination is required')
    .max(50, 'Destination must be 50 characters or fewer'),

  date: z.string().regex(YYYY_MM_DD, 'Date must be in YYYY-MM-DD format'),

  ticketCount: z.coerce
    .number()
    .int('ticketCount must be an integer')
    .min(1, 'ticketCount must be at least 1')
    .max(10, 'ticketCount must be at most 10'),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

