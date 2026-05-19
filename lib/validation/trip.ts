/**
 * Zod schemas for operator trip lifecycle management (Issue 013).
 *
 * All error codes used in route handlers MUST come from the AC verbatim
 * (Issue 004 rule — no vendor-doc supersets).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/op/trips  — create a one-off trip
// ---------------------------------------------------------------------------

export const CreateTripSchema = z.object({
  routeId: z.string().min(1),
  busId: z.string().min(1),
  departureAt: z.string().datetime().pipe(z.coerce.date()),
  price: z.number().int().min(0),
  blockedSeats: z.number().int().min(0).optional().default(0),
});

export type CreateTripInput = z.infer<typeof CreateTripSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/op/trips/[id]  — generic partial update (price, salesClosed)
// ---------------------------------------------------------------------------

export const PatchTripSchema = z
  .object({
    price: z.number().int().min(0).optional(),
    salesClosed: z.boolean().optional(),
    blockedSeats: z.number().int().min(0).optional(),
  })
  .refine(
    (v) =>
      v.price !== undefined ||
      v.salesClosed !== undefined ||
      v.blockedSeats !== undefined,
    { message: 'at least one field required' }
  );

export type PatchTripInput = z.infer<typeof PatchTripSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/block-seats
// ---------------------------------------------------------------------------

export const BlockSeatsSchema = z.object({
  blockedSeats: z.number().int().min(0),
});

export type BlockSeatsInput = z.infer<typeof BlockSeatsSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/reassign-bus
// ---------------------------------------------------------------------------

export const ReassignBusSchema = z.object({
  busId: z.string().min(1),
});

export type ReassignBusInput = z.infer<typeof ReassignBusSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/cancel
// ---------------------------------------------------------------------------

export const CancelTripSchema = z.object({
  reason: z.string().trim().min(10, 'cancelReason must be at least 10 characters'),
});

export type CancelTripInput = z.infer<typeof CancelTripSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/from-template  — generate a trip from a recurring template
// ---------------------------------------------------------------------------

export const FromTemplateSchema = z.object({
  templateId: z.string().min(1),
  departureAt: z.string().datetime().pipe(z.coerce.date()),
  price: z.number().int().min(0).optional(),
});

export type FromTemplateInput = z.infer<typeof FromTemplateSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/paired-return  — create paired outbound+return
// ---------------------------------------------------------------------------

export const PairedReturnSchema = z.object({
  returnDepartureAt: z.string().datetime().pipe(z.coerce.date()),
  price: z.number().int().min(0).optional(),
});

export type PairedReturnInput = z.infer<typeof PairedReturnSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trip-templates  — create recurring template
// ---------------------------------------------------------------------------

const DEPARTURE_LOCAL_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const YYYYMMDD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const CreateRecurringTemplateSchema = z
  .object({
    routeId: z.string().min(1),
    busId: z.string().min(1),
    price: z.number().int().min(0),
    departureLocalTime: z
      .string()
      .regex(DEPARTURE_LOCAL_TIME_REGEX, 'departureLocalTime must be HH:MM (00:00–23:59)'),
    /// Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (1-127)
    daysOfMask: z.number().int().min(1).max(127),
    validFrom: z.string().regex(YYYYMMDD_REGEX, 'validFrom must be YYYY-MM-DD'),
    validUntil: z.string().regex(YYYYMMDD_REGEX, 'validUntil must be YYYY-MM-DD'),
  })
  .refine((v) => v.validFrom <= v.validUntil, {
    message: 'validUntil must be >= validFrom',
    path: ['validUntil'],
  });

export type CreateRecurringTemplateInput = z.infer<typeof CreateRecurringTemplateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/op/trip-templates/[id]  — partial update of recurring template
// ---------------------------------------------------------------------------

export const PatchRecurringTemplateSchema = z
  .object({
    price: z.number().int().min(0).optional(),
    departureLocalTime: z
      .string()
      .regex(DEPARTURE_LOCAL_TIME_REGEX, 'departureLocalTime must be HH:MM')
      .optional(),
    daysOfMask: z.number().int().min(1).max(127).optional(),
    validFrom: z.string().regex(YYYYMMDD_REGEX).optional(),
    validUntil: z.string().regex(YYYYMMDD_REGEX).optional(),
    busId: z.string().min(1).optional(),
    deactivatedAt: z.string().datetime().pipe(z.coerce.date()).nullable().optional(),
  })
  .refine(
    (v) =>
      v.price !== undefined ||
      v.departureLocalTime !== undefined ||
      v.daysOfMask !== undefined ||
      v.validFrom !== undefined ||
      v.validUntil !== undefined ||
      v.busId !== undefined ||
      v.deactivatedAt !== undefined,
    { message: 'at least one field required' }
  );

export type PatchRecurringTemplateInput = z.infer<typeof PatchRecurringTemplateSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/sales-toggle
// ---------------------------------------------------------------------------

export const SalesToggleSchema = z.object({
  salesClosed: z.boolean(),
});

export type SalesToggleInput = z.infer<typeof SalesToggleSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/trips/[id]/manual-booking  (Issue 015)
// ---------------------------------------------------------------------------

// buyerName: min 4 Unicode letters (accepts any script, not ASCII-only)
const UNICODE_LETTER_REGEX = /\p{L}/u;

// buyerPhone: VN mobile (local or +84) — same predicate as lib/validation/auth.ts
// PII placeholder form (+8490xxxxxx[0-9]) is accepted for test fixtures — regex uses \d
const BUYER_PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;

export const ManualBookingSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(4, 'buyerName must be at least 4 characters')
    .refine(
      (v) => UNICODE_LETTER_REGEX.test(v),
      'buyerName must contain at least one letter'
    ),
  buyerPhone: z
    .string()
    .trim()
    .regex(BUYER_PHONE_REGEX, 'buyerPhone must be a valid VN mobile number'),
  ticketCount: z
    .number()
    .int()
    .min(1, 'ticketCount must be at least 1'),
  paymentMethod: z.enum(['paid', 'cash']),
});

export type ManualBookingInput = z.infer<typeof ManualBookingSchema>;
