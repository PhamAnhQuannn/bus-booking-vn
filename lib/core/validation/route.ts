/**
 * Zod schemas for operator route management (Issue 012). Pickup-point schemas
 * removed in issue 104 (legacy route-scoped PickupPoint replaced by OperatorPickupArea).
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
