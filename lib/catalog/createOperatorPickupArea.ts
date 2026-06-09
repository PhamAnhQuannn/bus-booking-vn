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
  label: string;
  isActive: boolean;
  displayOrder: number;
}

const areaSelect = {
  id: true,
  provinceCode: true,
  districtCode: true,
  districtName: true,
  wardCode: true,
  wardName: true,
  label: true,
  isActive: true,
  displayOrder: true,
} as const;

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

  // Dedupe against an existing ACTIVE area on the same ward for this operator.
  const dup = await prisma.operatorPickupArea.findFirst({
    where: { operatorId, wardCode: sel.wardCode, isActive: true },
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
      label,
      displayOrder,
    },
    select: areaSelect,
  });
}
