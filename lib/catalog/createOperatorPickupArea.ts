/**
 * createOperatorPickupArea — add an entry to the operator's reusable pickup-area
 * menu (Issue 105). The server resolves names + label from lib/geo (authoritative;
 * client only supplies the GSO code triple). Tenant-scoped.
 *
 * Rejects:
 *   - invalid_area    — the code triple is not a consistent province→huyện→xã path
 *   - duplicate_area  — an ACTIVE area with the same ward already exists for this operator
 */

import { prisma } from '@/lib/core/db/client';
import { getProvince, getDistrict, getWard, isValidSelection, resolveLabel } from '@/lib/geo';
import type { OperatorPickupAreaCreateInput } from '@/lib/core/validation/pickupArea';

export class PickupAreaServiceError extends Error {
  constructor(public code: 'invalid_area' | 'duplicate_area' | 'not_found' | 'already_inactive') {
    super(code);
    this.name = 'PickupAreaServiceError';
  }
}

export interface OperatorPickupAreaDto {
  id: string;
  provinceCode: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  /** Named-point stop name (e.g. "Bến xe Mỹ Đình"). */
  name: string;
  /** Optional street / landmark line. */
  addressLine: string | null;
  /** Ward address "Phường X, Quận Y, Tỉnh Z" — region context for the operator menu. */
  label: string;
  isActive: boolean;
  displayOrder: number;
}

export const areaSelect = {
  id: true,
  provinceCode: true,
  districtCode: true,
  districtName: true,
  wardCode: true,
  wardName: true,
  name: true,
  addressLine: true,
  label: true,
  isActive: true,
  displayOrder: true,
} as const;

/**
 * The customer-facing display for a pickup point — snapshotted into TripPickupArea /
 * TemplatePickupArea / Hold / Booking. The named point IS the location, so we show the
 * stop name plus its optional address line (not the ward `label`, which is region context).
 */
export function composePickupLabel(p: { name: string; addressLine?: string | null }): string {
  const addr = p.addressLine?.trim();
  return addr ? `${p.name} — ${addr}` : p.name;
}

export async function createOperatorPickupArea({
  operatorId,
  data,
}: {
  operatorId: string;
  data: OperatorPickupAreaCreateInput;
}): Promise<OperatorPickupAreaDto> {
  const sel = {
    provinceCode: data.provinceCode,
    districtCode: data.districtCode,
    wardCode: data.wardCode,
  };
  if (!isValidSelection(sel)) throw new PickupAreaServiceError('invalid_area');

  const province = getProvince(sel.provinceCode)!;
  const district = getDistrict(sel.districtCode)!;
  const ward = getWard(sel.wardCode)!;
  const label = resolveLabel(sel)!;

  // Dedupe against an existing ACTIVE point with the same name in the same ward.
  // Named points allow multiple stops per ward, so the key is (ward, name).
  const dup = await prisma.operatorPickupArea.findFirst({
    where: {
      operatorId,
      wardCode: sel.wardCode,
      name: { equals: data.name, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true },
  });
  if (dup) throw new PickupAreaServiceError('duplicate_area');

  const max = await prisma.operatorPickupArea.aggregate({
    where: { operatorId },
    _max: { displayOrder: true },
  });
  const displayOrder = (max._max.displayOrder ?? 0) + 1;

  return prisma.operatorPickupArea.create({
    data: {
      operatorId,
      provinceCode: province.code,
      districtCode: district.code,
      districtName: district.name,
      wardCode: ward.code,
      wardName: ward.name,
      name: data.name,
      addressLine: data.addressLine ?? null,
      label,
      displayOrder,
    },
    select: areaSelect,
  });
}
