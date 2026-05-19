/**
 * Zod schemas for operator fleet management (Issue 011).
 *
 * Field name on the wire is licensePlate — NOT plateNumber. No alias / transform.
 *
 * License plate: 6–11 alphanumeric + dash/dot/space, uppercased after parse.
 * Capacity: 1–80 (Vietnamese coach/sleeper/limousine real-world range).
 * BusType: enum coach | sleeper | limousine — must match Prisma enum exactly.
 */

import { z } from 'zod';

const LICENSE_PLATE = z
  .string()
  .trim()
  .min(6)
  .max(11)
  .regex(/^[A-Za-z0-9.\- ]+$/)
  .transform((s) => s.toUpperCase());

const CAPACITY = z.number().int().min(1).max(80);

export const BusTypeSchema = z.enum(['coach', 'sleeper', 'limousine']);

// ---------------------------------------------------------------------------
// POST /api/op/buses
// ---------------------------------------------------------------------------

export const CreateBusSchema = z.object({
  licensePlate: LICENSE_PLATE,
  capacity: CAPACITY,
  busType: BusTypeSchema,
});

export type CreateBusInput = z.infer<typeof CreateBusSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/op/buses/[id]
// ---------------------------------------------------------------------------

export const UpdateBusSchema = z
  .object({
    licensePlate: LICENSE_PLATE.optional(),
    capacity: CAPACITY.optional(),
    busType: BusTypeSchema.optional(),
  })
  .refine(
    (v) =>
      v.licensePlate !== undefined ||
      v.capacity !== undefined ||
      v.busType !== undefined,
    { message: 'at least one of licensePlate / capacity / busType is required' }
  );

export type UpdateBusInput = z.infer<typeof UpdateBusSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/buses/[id]/maintenance
// ---------------------------------------------------------------------------

export const CreateMaintenanceSchema = z
  .object({
    startAt: z.string().datetime().pipe(z.coerce.date()),
    endAt: z.string().datetime().pipe(z.coerce.date()),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.startAt > new Date(), {
    message: 'startAt must be in the future',
    path: ['startAt'],
  })
  .refine((v) => v.endAt > v.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceSchema>;
