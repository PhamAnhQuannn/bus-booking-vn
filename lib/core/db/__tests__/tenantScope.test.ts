import { describe, it, expect } from 'vitest';
import { withOperatorScope } from '../tenantScope';

describe('withOperatorScope', () => {
  it('injects operatorId when no args are provided', () => {
    const result = withOperatorScope('op-123');
    expect(result).toEqual({ where: { operatorId: 'op-123' } });
  });

  it('injects operatorId when args is undefined', () => {
    const result = withOperatorScope('op-123', undefined);
    expect(result.where.operatorId).toBe('op-123');
  });

  it('injects operatorId into an empty where', () => {
    const result = withOperatorScope('op-123', { where: {} });
    expect(result.where).toEqual({ operatorId: 'op-123' });
  });

  it('preserves existing where keys and adds operatorId', () => {
    const result = withOperatorScope('op-123', {
      where: { deactivatedAt: null, busType: 'coach' },
    });
    expect(result.where).toEqual({
      deactivatedAt: null,
      busType: 'coach',
      operatorId: 'op-123',
    });
  });

  it('preserves sibling query keys (select, orderBy, take)', () => {
    const result = withOperatorScope('op-123', {
      where: { deactivatedAt: null },
      select: { id: true },
      orderBy: { id: 'desc' },
      take: 10,
    });
    expect(result).toEqual({
      where: { deactivatedAt: null, operatorId: 'op-123' },
      select: { id: true },
      orderBy: { id: 'desc' },
      take: 10,
    });
  });

  it('operatorId wins over a colliding where key (tenant filter is authoritative)', () => {
    const result = withOperatorScope('op-authoritative', {
      where: { operatorId: 'op-spoofed' } as Record<string, unknown>,
    });
    expect(result.where.operatorId).toBe('op-authoritative');
  });

  it('does not mutate the caller-supplied args object', () => {
    const args = { where: { deactivatedAt: null } };
    const result = withOperatorScope('op-123', args);
    expect(args).toEqual({ where: { deactivatedAt: null } });
    expect(result).not.toBe(args);
  });
});
