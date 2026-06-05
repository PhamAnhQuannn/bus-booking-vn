/**
 * Unit tests for getAuditLog + auditLogToCsv (Issue 070).
 *
 * Injects a fake prisma.adminAuditLog.findMany. Asserts the optional action
 * filter, the seek-cursor pagination (take = limit+1, nextCursor = last kept row
 * id on overflow), and that auditLogToCsv emits the fixed header and correctly
 * CSV-escapes a field containing both a comma and a double-quote.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { getAuditLog, auditLogToCsv, type AuditLogRow } from '../getAuditLog';

function makeRows(n: number): Array<AuditLogRow> {
  return Array.from({ length: n }, (_, i) => ({
    id: `al_${i}`,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    actor: 'admin:super-1',
    action: 'set-feature-flag',
    target: 'rail.momo.enabled',
    argsRedacted: null,
  }));
}

function fakePrisma(rows: AuditLogRow[], capture?: (args: unknown) => void) {
  return {
    adminAuditLog: {
      findMany: vi.fn(async (args: unknown) => {
        capture?.(args);
        return rows;
      }),
    },
  } as never;
}

describe('getAuditLog', () => {
  it('applies the action filter', async () => {
    let captured: { where?: unknown } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { where?: unknown };
    });
    await getAuditLog({ action: 'revoke-admin' }, prisma);
    expect(captured?.where).toEqual({ action: 'revoke-admin' });
  });

  it('passes an empty where when no action is given', async () => {
    let captured: { where?: unknown } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { where?: unknown };
    });
    await getAuditLog({}, prisma);
    expect(captured?.where).toEqual({});
  });

  it('paginates with take = limit + 1 and returns nextCursor on overflow', async () => {
    let captured: { take?: number } | undefined;
    const prisma = fakePrisma(makeRows(3), (a) => {
      captured = a as { take?: number };
    });
    const res = await getAuditLog({ limit: 2 }, prisma);
    expect(captured?.take).toBe(3);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('al_1');
    expect(res.items[0]).toMatchObject({ id: 'al_0', action: 'set-feature-flag' });
  });

  it('nextCursor is null with no overflow', async () => {
    const prisma = fakePrisma(makeRows(2));
    const res = await getAuditLog({ limit: 5 }, prisma);
    expect(res.nextCursor).toBeNull();
  });
});

describe('auditLogToCsv', () => {
  it('emits the fixed header as the first line', () => {
    const csv = auditLogToCsv([]);
    expect(csv).toBe('id,timestamp,actor,action,target,argsRedacted');
  });

  it('renders the timestamp as an ISO instant and quotes every field', () => {
    const row: AuditLogRow = {
      id: 'al_1',
      timestamp: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
      actor: 'admin:super-1',
      action: 'revoke-admin',
      target: 'target-1',
      argsRedacted: null,
    };
    const csv = auditLogToCsv([row]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '"al_1","2026-01-02T03:04:05.000Z","admin:super-1","revoke-admin","target-1",""'
    );
  });

  it('CSV-escapes a field containing a comma and a double-quote', () => {
    const row: AuditLogRow = {
      id: 'al_2',
      timestamp: new Date(Date.UTC(2026, 0, 1)),
      actor: 'admin:super-1',
      action: 'set-admin-role',
      target: 'target-2',
      argsRedacted: '{"role":"FINANCE","note":"a, b"}',
    };
    const csv = auditLogToCsv([row]);
    const fields = csv.split('\r\n')[1];
    // The args field must be wrapped in quotes with every internal quote doubled,
    // so the embedded comma never splits a column.
    expect(fields).toContain('"{""role"":""FINANCE"",""note"":""a, b""}"');
  });
});
