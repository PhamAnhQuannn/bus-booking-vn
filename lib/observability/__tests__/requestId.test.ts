/**
 * Unit tests for request-id helpers (Issue 061, AC2/AC3).
 */

import { describe, it, expect, vi } from 'vitest';

const childMock = vi.fn((bindings: unknown) => ({ bindings }));
vi.mock('@/lib/logger', () => ({
  logger: { child: (b: unknown) => childMock(b) },
}));

import {
  REQUEST_ID_HEADER,
  getOrCreateRequestId,
  loggerForRequest,
} from '../requestId';

describe('getOrCreateRequestId', () => {
  it('returns the existing x-request-id header when present', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'rid-123' });
    expect(getOrCreateRequestId(headers)).toBe('rid-123');
  });

  it('mints a UUID when the header is absent', () => {
    const rid = getOrCreateRequestId(new Headers());
    expect(rid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('mints a UUID when the header is blank/whitespace', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: '   ' });
    const rid = getOrCreateRequestId(headers);
    expect(rid).not.toBe('   ');
    expect(rid.length).toBeGreaterThan(0);
  });

  it('REQUEST_ID_HEADER is the lowercase canonical name', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});

describe('loggerForRequest', () => {
  it('binds requestId on a pino child logger', () => {
    loggerForRequest('rid-abc');
    expect(childMock).toHaveBeenCalledWith({ requestId: 'rid-abc' });
  });
});
