import { describe, it, expect } from 'vitest';
import { searchParamsSchema } from '../search';

describe('searchParamsSchema', () => {
  it('valid happy path passes', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ticketCount).toBe(2);
    }
  });

  it('origin exceeding 50 chars fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'A'.repeat(51),
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('origin');
    }
  });

  it('destination exceeding 50 chars fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'B'.repeat(51),
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('destination');
    }
  });

  it('ticketCount < 1 fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '0',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('ticketCount');
    }
  });

  it('ticketCount > 10 fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '11',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('ticketCount');
    }
  });

  it('malformed date fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'TP.HCM',
      date: '06/01/2026',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('date');
    }
  });

  it('missing origin fails', () => {
    const result = searchParamsSchema.safeParse({
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
  });

  it('missing destination fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
  });

  it('empty origin string fails', () => {
    const result = searchParamsSchema.safeParse({
      origin: '',
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '2',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => String(i.path[0]));
      expect(keys).toContain('origin');
    }
  });

  it('ticketCount coerced from string to number', () => {
    const result = searchParamsSchema.safeParse({
      origin: 'Hà Nội',
      destination: 'TP.HCM',
      date: '2026-06-01',
      ticketCount: '5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.ticketCount).toBe('number');
      expect(result.data.ticketCount).toBe(5);
    }
  });
});
