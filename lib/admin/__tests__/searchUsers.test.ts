/**
 * Unit tests for searchUsers (Issue 066). Prisma injected as a stub.
 *
 * Asserts: customer kind maps + masks phone + derives status, operator kind maps +
 * masks contactPhone, the search `q` builds an OR over name/phone/email, and the
 * seek cursor (createdAt+id orderBy, take limit+1) yields nextCursor when more.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: { customer: { findMany: vi.fn() }, operator: { findMany: vi.fn() } },
}));

import { searchUsers } from '../searchUsers';

function makePrisma(customerRows: unknown[], operatorRows: unknown[] = []) {
  const customerFind = vi.fn().mockResolvedValue(customerRows);
  const operatorFind = vi.fn().mockResolvedValue(operatorRows);
  return {
    prisma: { customer: { findMany: customerFind }, operator: { findMany: operatorFind } } as never,
    customerFind,
    operatorFind,
  };
}

const t = (s: string) => new Date(s);

describe('searchUsers — customer kind', () => {
  it('maps + masks phone + derives active/suspended/deleted status', async () => {
    const { prisma } = makePrisma([
      { id: 'c1', displayName: 'Alice', phone: '+84901234567', email: 'a@x.test', suspendedAt: null, deletedAt: null, createdAt: t('2026-05-03') },
      { id: 'c2', displayName: 'Bob', phone: '+84907654321', email: null, suspendedAt: t('2026-05-02'), deletedAt: null, createdAt: t('2026-05-02') },
      { id: 'c3', displayName: null, phone: null, email: 'gone@x.test', suspendedAt: null, deletedAt: t('2026-05-01'), createdAt: t('2026-05-01') },
    ]);

    const { items, nextCursor } = await searchUsers({ kind: 'customer' }, prisma);

    expect(nextCursor).toBeNull();
    expect(items[0]).toEqual({ kind: 'customer', id: 'c1', name: 'Alice', contactMasked: '+xxxxxxx4567', status: 'active', createdAt: t('2026-05-03') });
    expect(items[1].status).toBe('suspended');
    // deleted customer: phone null → falls back to email; status deleted.
    expect(items[2]).toEqual({ kind: 'customer', id: 'c3', name: '—', contactMasked: 'gone@x.test', status: 'deleted', createdAt: t('2026-05-01') });
  });

  it('builds an OR search over displayName/email/phone and seeks by id+createdAt', async () => {
    const { prisma, customerFind } = makePrisma([]);
    await searchUsers({ kind: 'customer', q: 'ali' }, prisma);

    const arg = customerFind.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { displayName: { contains: 'ali', mode: 'insensitive' } },
      { email: { contains: 'ali', mode: 'insensitive' } },
      { phone: { contains: 'ali' } },
    ]);
    expect(arg.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('returns nextCursor (last row id) when there are more than `limit` rows', async () => {
    // limit 2 → request take 3; return 3 → hasMore, page sliced to 2, cursor = page[1].id.
    const rows = [
      { id: 'c1', displayName: 'A', phone: null, email: 'a@x', suspendedAt: null, deletedAt: null, createdAt: t('2026-05-03') },
      { id: 'c2', displayName: 'B', phone: null, email: 'b@x', suspendedAt: null, deletedAt: null, createdAt: t('2026-05-02') },
      { id: 'c3', displayName: 'C', phone: null, email: 'c@x', suspendedAt: null, deletedAt: null, createdAt: t('2026-05-01') },
    ];
    const { prisma, customerFind } = makePrisma(rows);
    const { items, nextCursor } = await searchUsers({ kind: 'customer', limit: 2 }, prisma);

    expect(customerFind.mock.calls[0][0].take).toBe(3);
    expect(items).toHaveLength(2);
    expect(nextCursor).toBe('c2');
  });

  it('threads the cursor into a seek (cursor + skip:1)', async () => {
    const { prisma, customerFind } = makePrisma([]);
    await searchUsers({ kind: 'customer', cursor: 'c9' }, prisma);
    const arg = customerFind.mock.calls[0][0];
    expect(arg.cursor).toEqual({ id: 'c9' });
    expect(arg.skip).toBe(1);
  });
});

describe('searchUsers — operator kind', () => {
  it('maps legalName + masks contactPhone + passes OperatorStatus through', async () => {
    const { prisma, operatorFind, customerFind } = makePrisma(
      [],
      [
        { id: 'o1', legalName: 'Acme Buses', contactEmail: 'ops@acme.test', contactPhone: '+84901112222', status: 'APPROVED', createdAt: t('2026-05-04') },
      ]
    );

    const { items } = await searchUsers({ kind: 'operator', q: 'acme' }, prisma);

    expect(customerFind).not.toHaveBeenCalled();
    expect(items[0]).toEqual({ kind: 'operator', id: 'o1', name: 'Acme Buses', contactMasked: '+xxxxxxx2222', status: 'APPROVED', createdAt: t('2026-05-04') });

    const arg = operatorFind.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { legalName: { contains: 'acme', mode: 'insensitive' } },
      { contactEmail: { contains: 'acme', mode: 'insensitive' } },
      { contactPhone: { contains: 'acme' } },
    ]);
  });
});
