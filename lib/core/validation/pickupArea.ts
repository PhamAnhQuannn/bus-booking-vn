/**
 * Zod schema for operator pickup-area management (Issue 105).
 *
 * The client sends only the GSO code triple; the server resolves the canonical
 * names + label from the vendored dataset (lib/geo) — never trusting a
 * client-supplied label/name.
 */

import { z } from 'zod';

/** Named-point identity fields (shared by create + update). */
const pointFields = {
  name: z.string().trim().min(2, 'Tên điểm đón quá ngắn').max(120),
  addressLine: z.string().trim().max(200).optional(),
};

export const operatorPickupAreaCreateSchema = z.object({
  provinceCode: z.string().trim().min(1),
  districtCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  ...pointFields,
});

export type OperatorPickupAreaCreateInput = z.infer<typeof operatorPickupAreaCreateSchema>;

/** Update: only the named-point identity is editable (ward stays put). */
export const operatorPickupAreaUpdateSchema = z.object(pointFields);

export type OperatorPickupAreaUpdateInput = z.infer<typeof operatorPickupAreaUpdateSchema>;
