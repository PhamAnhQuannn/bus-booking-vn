import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHoldRequest } from '../holdsClient';

const VALID_BODY = {
  tripId: 'clxyz1234567890abcdef',
  ticketCount: 2,
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  buyerEmail: 'buyer@example.com',
};

function mockFetch(response: { status?: number; headers?: Record<string, string>; jsonBody?: unknown }): void {
  const { status = 200, headers = {}, jsonBody } = response;
  global.fetch = vi.fn().mockResolvedValueOnce({
    status,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    json: async () => jsonBody,
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createHoldRequest', () => {
  it('returns ok=true with holdId and expiresAt on 200', async () => {
    mockFetch({
      status: 200,
      jsonBody: { holdId: 'hold-123', expiresAt: '2026-05-17T13:00:00.000Z' },
    });

    const result = await createHoldRequest(VALID_BODY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.holdId).toBe('hold-123');
      expect(result.expiresAt).toBe('2026-05-17T13:00:00.000Z');
    }
  });

  it('returns ok=false with code=SOLD_OUT on 409', async () => {
    mockFetch({ status: 409, jsonBody: { error: 'SOLD_OUT' } });
    const result = await createHoldRequest(VALID_BODY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SOLD_OUT');
    }
  });

  it('returns ok=false with code=TOO_MANY_REQUESTS and retryAfter on 429', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 429,
      headers: {
        get: (key: string) => (key === 'Retry-After' ? '30' : null),
      },
      json: async () => ({ error: 'TOO_MANY_REQUESTS' }),
    } as unknown as Response);

    const result = await createHoldRequest(VALID_BODY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TOO_MANY_REQUESTS');
      expect(result.retryAfter).toBe(30);
    }
  });

  it('returns ok=false with code=INVALID on 400', async () => {
    mockFetch({ status: 400, jsonBody: { error: 'INVALID' } });
    const result = await createHoldRequest(VALID_BODY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID');
    }
  });

  it('returns ok=false with code=NETWORK_ERROR on fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network failure'));
    const result = await createHoldRequest(VALID_BODY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NETWORK_ERROR');
    }
  });

  it('sends POST with correct Content-Type and body', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      status: 200,
      headers: { get: () => null },
      json: async () => ({ holdId: 'h', expiresAt: '2026-05-17T12:00:00.000Z' }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await createHoldRequest(VALID_BODY);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/holds',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(VALID_BODY),
      })
    );
  });
});
