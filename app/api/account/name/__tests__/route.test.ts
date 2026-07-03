import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_CID = 'cust-001';
const { mockUpdateName, UpdateNameError } = vi.hoisted(() => {
  class UpdateNameError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'UpdateNameError';
    }
  }
  return { mockUpdateName: vi.fn(), UpdateNameError };
});

vi.mock('@/lib/account', () => ({
  updateName: mockUpdateName,
  UpdateNameError,
}));
vi.mock('@/lib/auth', () => ({
  requireCustomerAuth:
    () =>
    (handler: CallableFunction) =>
    (req: Request) =>
      handler(req, { customerId: TEST_CID }),
}));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { PATCH } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/name', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateName.mockResolvedValue({ displayName: 'New Name' });
});

describe('PATCH /api/account/name', () => {
  it('returns 200 with displayName on success', async () => {
    const res = await PATCH(makeRequest({ displayName: 'New Name' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.displayName).toBe('New Name');
    expect(mockUpdateName).toHaveBeenCalledWith(TEST_CID, 'New Name');
  });

  it('returns 422 on UpdateNameError', async () => {
    mockUpdateName.mockRejectedValue(new UpdateNameError('DISPLAY_NAME_TOO_SHORT'));
    const res = await PATCH(makeRequest({ displayName: 'A' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('DISPLAY_NAME_TOO_SHORT');
  });

  it('returns 400 INVALID on missing displayName', async () => {
    const res = await PATCH(makeRequest({}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 400 INVALID on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/account/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad',
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
