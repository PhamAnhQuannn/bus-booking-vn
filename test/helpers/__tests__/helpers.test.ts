import { describe, expect, it } from 'vitest';

import { hexMock } from '../hexMock';
import { vnLocalDate } from '../vnDate';
import { expectNoForbiddenFields } from '../responseShape';

describe('test helpers', () => {
  it('hexMock returns valid SHA-256-length hex', () => {
    const value = hexMock('a');
    expect(value).toHaveLength(64);
    expect(value).toMatch(/^[0-9a-f]+$/);
  });

  it('vnLocalDate matches Asia/Ho_Chi_Minh date boundaries', () => {
    expect(vnLocalDate('2026-06-27T00:30:00.000Z')).toBe('2026-06-27');
    expect(vnLocalDate('2026-06-26T18:30:00.000Z')).toBe('2026-06-27');
  });

  it('expectNoForbiddenFields rejects exposed sensitive keys', () => {
    expect(() =>
      expectNoForbiddenFields({ safe: true, nested: { passwordHash: 'x' } }),
    ).toThrow();
  });
});
