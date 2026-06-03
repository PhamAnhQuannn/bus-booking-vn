/**
 * getCustomerDetail — admin "Users" tab detail read for a single customer (Issue 066).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Returns the
 * customer profile + a small activity summary (booking count, last login) the detail
 * page renders. Phone is masked via redactPhone(); email shown in full.
 *
 * Operators do NOT get a detail read here — the Users tab links an operator row out
 * to /admin/operators/<id> (Issue 067, not yet built), so there is no operator branch.
 */

import { prisma as defaultPrisma } from '@/lib/db/client';
import { redactPhone } from '@/lib/audit/redactPhone';
import type { UserStatus } from './searchUsers';

export interface CustomerDetail {
  id: string;
  name: string;
  /** Masked phone (redactPhone) or null when the customer has no phone. */
  phoneMasked: string | null;
  email: string | null;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  bookingCount: number;
}

type PrismaLike = Pick<typeof defaultPrisma, 'customer' | 'booking'>;

export async function getCustomerDetail(
  customerId: string,
  prisma: PrismaLike = defaultPrisma
): Promise<CustomerDetail | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      displayName: true,
      phone: true,
      email: true,
      suspendedAt: true,
      deletedAt: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  if (!customer) return null;

  const bookingCount = await prisma.booking.count({ where: { customerId } });

  const status: UserStatus =
    customer.deletedAt !== null ? 'deleted' : customer.suspendedAt !== null ? 'suspended' : 'active';

  return {
    id: customer.id,
    name: customer.displayName ?? '—',
    phoneMasked: customer.phone ? redactPhone(customer.phone) : null,
    email: customer.email,
    status,
    createdAt: customer.createdAt,
    lastLoginAt: customer.lastLoginAt,
    bookingCount,
  };
}
