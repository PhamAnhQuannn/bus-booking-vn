/**
 * Unit tests for sweepSessions (#474 operator/admin session pruning, #475 OtpAttempt retention).
 * tx.$queryRaw is mocked; each of the 4 batched deletes returns its own RETURNING rows.
 */
import { describe, it, expect, vi } from 'vitest';
import { sweepSessions } from '../sweepSessions';

function idRows(n: number): { id: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));
}

// Extract the static SQL fragments of a Prisma.Sql (table names embedded via Prisma.raw
// land here) so we can assert which tables a given delete targeted.
function sqlText(arg: unknown): string {
  const strings = (arg as { strings?: string[] })?.strings;
  return Array.isArray(strings) ? strings.join(' ') : String(arg);
}

describe('sweepSessions', () => {
  it('prunes all three session tables + OtpAttempt and sums rowsAffected', async () => {
    const calls: string[] = [];
    const returns = [idRows(2), idRows(1), idRows(0), idRows(3)]; // Session, Operator, Admin, Otp
    let i = 0;
    const $queryRaw = vi.fn().mockImplementation((arg: unknown) => {
      calls.push(sqlText(arg));
      return Promise.resolve(returns[i++] ?? idRows(0));
    });

    const result = await sweepSessions({ $queryRaw } as never, undefined);

    expect(result).toEqual({ rowsAffected: 6, status: 'success' });
    expect($queryRaw).toHaveBeenCalledTimes(4);

    const allSql = calls.join(' || ');
    expect(allSql).toContain('OperatorSession'); // #474
    expect(allSql).toContain('AdminSession'); // #474
    expect(allSql).toContain('OtpAttempt'); // #475
  });

  it('returns 0 when every table is already clean', async () => {
    const $queryRaw = vi.fn().mockResolvedValue(idRows(0));
    const result = await sweepSessions({ $queryRaw } as never, undefined);
    expect(result).toEqual({ rowsAffected: 0, status: 'success' });
    expect($queryRaw).toHaveBeenCalledTimes(4);
  });
});
