/**
 * Update customer display name (Issue 008 AC4).
 *
 * Validates 4–100 Unicode graphemes, then upserts the displayName column.
 */

import { prisma } from '@/lib/core/db/client';
import { validateDisplayName } from './validateDisplayName';

export type UpdateNameErrorCode = 'DISPLAY_NAME_TOO_SHORT' | 'DISPLAY_NAME_TOO_LONG' | 'CUSTOMER_NOT_FOUND';

export class UpdateNameError extends Error {
  constructor(public readonly code: UpdateNameErrorCode) {
    super(code);
    this.name = 'UpdateNameError';
  }
}

export interface UpdateNameResult {
  id: string;
  displayName: string;
}

export async function updateName(
  customerId: string,
  rawName: string
): Promise<UpdateNameResult> {
  const name = rawName.trim();
  const err = validateDisplayName(name);
  if (err === 'TOO_SHORT') throw new UpdateNameError('DISPLAY_NAME_TOO_SHORT');
  if (err === 'TOO_LONG') throw new UpdateNameError('DISPLAY_NAME_TOO_LONG');

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { displayName: name },
    select: { id: true, displayName: true },
  }).catch(() => null);

  if (!customer) throw new UpdateNameError('CUSTOMER_NOT_FOUND');

  return { id: customer.id, displayName: customer.displayName ?? name };
}
