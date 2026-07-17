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

export const searchParamsSchema = z
  .object({
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
  })
  // SPEC CONFLICT: FD-004 submit-disabled list omits origin===destination;
  // DS-030/FD-013 §1.3 requires it. Implementing the stricter DS-030 rule.
  .refine((v) => v.origin.trim().toLowerCase() !== v.destination.trim().toLowerCase(), {
    message: 'Origin and destination must be different',
    path: ['destination'],
  });

export type SearchParams = z.infer<typeof searchParamsSchema>;

/**
 * Optional client-side filter/sort params layered over the base search.
 * Parsed in the /search RSC and applied in-memory via applyTripFilters().
 * The API contract (searchParamsSchema) is intentionally unchanged — filtering
 * happens over the base result set, not in the DB query.
 *
 * - operatorId: exact Operator id
 * - busType: comma-separated subset of coach|sleeper|limousine
 * - priceMin / priceMax: VND bounds (coerced int ≥ 0)
 * - window: departure time bucket in Asia/Ho_Chi_Minh
 * - maxDurationMinutes: upper bound on Route.durationMinutes
 * - sort: result ordering (default departure_asc)
 */
export const BUS_TYPES = ['coach', 'sleeper', 'limousine'] as const;
export const TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'night'] as const;
export const SORT_OPTIONS = [
  'departure_asc',
  'price_asc',
  'price_desc',
  'duration_asc',
] as const;

export const searchFiltersSchema = z.object({
  operatorId: z.string().min(1).max(40).optional(),
  busType: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter((s): s is (typeof BUS_TYPES)[number] =>
              (BUS_TYPES as readonly string[]).includes(s)
            )
        : undefined
    ),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  window: z.enum(TIME_WINDOWS).optional(),
  maxDurationMinutes: z.coerce.number().int().min(1).optional(),
  sort: z.enum(SORT_OPTIONS).default('departure_asc'),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type BusType = (typeof BUS_TYPES)[number];
export type TimeWindow = (typeof TIME_WINDOWS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];

