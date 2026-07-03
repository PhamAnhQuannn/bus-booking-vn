import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_CID = 'cust-001';
const { mockDeleteAccount } = vi.hoisted(() => ({
  mockDeleteAccount: vi.fn(),
}));

vi.mock('@/lib/account', () => ({ deleteAccount: mockDeleteAccount }));
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

import { DELETE } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/account', {
    method: 'DELETE',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteAccount.mockResolvedValue({ alreadyDeleted: false });
});

describe('DELETE /api/account', () => {
  it('returns 200 with alreadyDeleted: false on first delete', async () => {
    const res = await DELETE(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.alreadyDeleted).toBe(false);
    expect(mockDeleteAccount).toHaveBeenCalledWith(TEST_CID);
  });

  it('returns 200 with alreadyDeleted: true on idempotent call', async () => {
    mockDeleteAccount.mockResolvedValue({ alreadyDeleted: true });
    const res = await DELETE(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.alreadyDeleted).toBe(true);
  });
});
