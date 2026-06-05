/**
 * searchUsers — admin "Users" tab search over customers OR operators (Issue 066).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003).
 *
 * PAGINATION CHOICE: per-kind tabs. The Users tab is rendered as two independent
 * lists ('customer' | 'operator') each selected by the `kind` param and each
 * cursor/seek-paginated by (createdAt DESC, id DESC). A unified merged-cursor list
 * over two heterogeneous tables needs a composite cursor whose decode has to know
 * which table the last row came from and re-seek both — fiddly and slower. Per-kind
 * tabs give a stable single-table seek cursor (mirrors listCustomerBookings's
 * id-tiebreaker seek) and a clean UI affordance. The page defaults to the customer
 * tab; an operator tab link flips `kind`.
 *
 * The cursor is the opaque row id of the last item on the page (single-table seek,
 * Prisma `cursor: { id }` + `skip: 1`). createdAt is the primary sort with id as a
 * stable tiebreaker so two rows sharing a createdAt never duplicate/skip across pages.
 *
 * Contact (phone) is masked via redactPhone() before leaving the DB — the admin
 * needs a glanceable contact, not raw PII. Email is shown in full.
 */

import type { OperatorStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { redactPhone } from '@/lib/audit';

export type UserKind = 'customer' | 'operator';

/** Derived display status. Customers: active/suspended/deleted; operators: OperatorStatus. */
export type UserStatus = 'active' | 'suspended' | 'deleted' | OperatorStatus;

export interface UserListItem {
  kind: UserKind;
  id: string;
  /** Customer displayName (or '—') / operator legalName. */
  name: string;
  /** Masked phone (redactPhone) OR email, whichever identifies the row best. */
  contactMasked: string;
  status: UserStatus;
  createdAt: Date;
}

export interface SearchUsersParams {
  /** Free-text match on name/phone/email (customer) or legalName/contactEmail/contactPhone (operator). */
  q?: string;
  /** Which list to page. Defaults to 'customer'. */
  kind?: UserKind;
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface SearchUsersResult {
  items: UserListItem[];
  nextCursor: string | null;
}

/** Minimal prisma surface — lets unit tests inject findMany stubs. */
type PrismaLike = Pick<typeof defaultPrisma, 'customer' | 'operator'>;

/** Mask the phone when present; otherwise fall back to the email for identification. */
function customerContact(phone: string | null, email: string | null): string {
  if (phone) return redactPhone(phone);
  return email ?? '—';
}

function customerStatus(suspendedAt: Date | null, deletedAt: Date | null): UserStatus {
  if (deletedAt !== null) return 'deleted';
  if (suspendedAt !== null) return 'suspended';
  return 'active';
}

export async function searchUsers(
  params: SearchUsersParams,
  prisma: PrismaLike = defaultPrisma
): Promise<SearchUsersResult> {
  const kind: UserKind = params.kind ?? 'customer';
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const q = params.q?.trim();
  const cursor = params.cursor;

  if (kind === 'operator') {
    const where: Prisma.OperatorWhereInput = q
      ? {
          OR: [
            { legalName: { contains: q, mode: 'insensitive' } },
            { contactEmail: { contains: q, mode: 'insensitive' } },
            { contactPhone: { contains: q } },
          ],
        }
      : {};

    const rows = await prisma.operator.findMany({
      where,
      select: { id: true, legalName: true, contactEmail: true, contactPhone: true, status: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: UserListItem[] = page.map((row) => ({
      kind: 'operator',
      id: row.id,
      name: row.legalName,
      contactMasked: redactPhone(row.contactPhone),
      status: row.status,
      createdAt: row.createdAt,
    }));
    return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
  }

  // kind === 'customer'
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const rows = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      displayName: true,
      phone: true,
      email: true,
      suspendedAt: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items: UserListItem[] = page.map((row) => ({
    kind: 'customer',
    id: row.id,
    name: row.displayName ?? '—',
    contactMasked: customerContact(row.phone, row.email),
    status: customerStatus(row.suspendedAt, row.deletedAt),
    createdAt: row.createdAt,
  }));
  return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
}
