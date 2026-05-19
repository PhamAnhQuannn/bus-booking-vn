/**
 * Zod schemas for operator route + pickup point management (Issue 012).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Route schemas
// ---------------------------------------------------------------------------

export const routeCreateSchema = z.object({
  origin: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(1).max(7200),
});

export type RouteCreateInput = z.infer<typeof routeCreateSchema>;

export const routePatchSchema = z.object({
  origin: z.string().trim().min(1).max(120).optional(),
  destination: z.string().trim().min(1).max(120).optional(),
  durationMinutes: z.number().int().min(1).max(7200).optional(),
});

export type RoutePatchInput = z.infer<typeof routePatchSchema>;

// ---------------------------------------------------------------------------
// PickupPoint schemas
// ---------------------------------------------------------------------------

export const pickupPointCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(500),
  displayOrder: z.number().int().min(1).optional(),
});

export type PickupPointCreateInput = z.infer<typeof pickupPointCreateSchema>;

export const pickupPointPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  displayOrder: z.number().int().min(1).optional(),
});

export type PickupPointPatchInput = z.infer<typeof pickupPointPatchSchema>;

// ---------------------------------------------------------------------------
// Bulk reorder schema
// ---------------------------------------------------------------------------

export const bulkReorderSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1).max(50),
});

export type BulkReorderInput = z.infer<typeof bulkReorderSchema>;
