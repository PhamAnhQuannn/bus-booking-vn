/**
 * Unit tests for getGatewayFor — the online-method → PaymentGateway selector.
 *
 * Mocks getEnv, getMomoAdapter, getStubAdapter so no real env / adapter init runs.
 *
 * Routing contract:
 *   momo    + PAYMENTS_STUB=false → real MoMo adapter
 *   momo    + PAYMENTS_STUB=true  → stub adapter
 *   zalopay → stub adapter (always, both env states)
 *   card    → stub adapter (always, both env states)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  getEnv: vi.fn(),
}));

vi.mock('../adapters/momo', () => ({
  getMomoAdapter: vi.fn(),
}));

vi.mock('../adapters/stub', () => ({
  getStubAdapter: vi.fn(),
}));

import { getGatewayFor } from '../select';
import { getEnv } from '@/lib/config/env';
import { getMomoAdapter } from '../adapters/momo';
import { getStubAdapter } from '../adapters/stub';

const BASE_URL = 'https://example.com';
const MOMO_GW = { id: 'momo' } as never;
const STUB_GW = { id: 'stub' } as never;

function setStub(stubbed: boolean) {
  vi.mocked(getEnv).mockReturnValue({ PAYMENTS_STUB: stubbed } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMomoAdapter).mockReturnValue(MOMO_GW);
  vi.mocked(getStubAdapter).mockReturnValue(STUB_GW);
});

describe('getGatewayFor — PAYMENTS_STUB=false', () => {
  beforeEach(() => setStub(false));

  it('routes momo to the real MoMo adapter', () => {
    expect(getGatewayFor('momo', BASE_URL)).toBe(MOMO_GW);
    expect(getMomoAdapter).toHaveBeenCalledOnce();
    expect(getStubAdapter).not.toHaveBeenCalled();
  });

  it('routes zalopay to the stub adapter', () => {
    expect(getGatewayFor('zalopay', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('zalopay', BASE_URL);
    expect(getMomoAdapter).not.toHaveBeenCalled();
  });

  it('routes card to the stub adapter', () => {
    expect(getGatewayFor('card', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('card', BASE_URL);
  });
});

describe('getGatewayFor — PAYMENTS_STUB=true', () => {
  beforeEach(() => setStub(true));

  it('routes momo to the stub adapter when stubbed', () => {
    expect(getGatewayFor('momo', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('momo', BASE_URL);
    expect(getMomoAdapter).not.toHaveBeenCalled();
  });

  it('routes zalopay to the stub adapter', () => {
    expect(getGatewayFor('zalopay', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('zalopay', BASE_URL);
  });
});
