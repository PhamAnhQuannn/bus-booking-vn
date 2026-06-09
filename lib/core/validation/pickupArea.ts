/**
 * Zod schema for operator pickup-area management (Issue 105).
 *
 * The client sends only the GSO code triple; the server resolves the canonical
 * names + label from the vendored dataset (lib/geo) — never trusting a
 * client-supplied label/name.
 */

import { z } from 'zod';

export const operatorPickupAreaCreateSchema = z.object({
  provinceCode: z.string().trim().min(1),
  districtCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
});

export type OperatorPickupAreaCreateInput = z.infer<typeof operatorPickupAreaCreateSchema>;
