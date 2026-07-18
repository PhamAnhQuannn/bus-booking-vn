/**
 * Unit tests for getGatewayFor — the online-method → PaymentGateway selector.
 *
 * Mocks getEnv + every adapter factory so no real env / adapter init runs.
 *
 * Routing contract:
 *   bank_transfer                          → real VietQR/SePay adapter (always)
 *   momo    + PAYMENTS_STUB=false          → real MoMo adapter
 *   momo    + PAYMENTS_STUB=true           → stub adapter
 *   vnpay   + VNPAY_ENABLED && !STUB       → real VNPay adapter
 *   vnpay   + !VNPAY_ENABLED               → stub adapter (kill-switch off)
 *   vnpay   + PAYMENTS_STUB=true           → stub adapter
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

vi.mock('../adapters/vnpay', () => ({
  getVnpayAdapter: vi.fn(),
}));

vi.mock('../adapters/bankTransfer', () => ({
  getBankTransferAdapter: vi.fn(),
}));

vi.mock('../adapters/stub', () => ({
  getStubAdapter: vi.fn(),
}));

import { getGatewayFor } from '../select';
import { getEnv } from '@/lib/config';
import { getMomoAdapter } from '../adapters/momo';
import { getVnpayAdapter } from '../adapters/vnpay';
import { getBankTransferAdapter } from '../adapters/bankTransfer';
import { getStubAdapter } from '../adapters/stub';

const BASE_URL = 'https://example.com';
const MOMO_GW = { id: 'momo' } as never;
const VNPAY_GW = { id: 'vnpay' } as never;
const BANK_GW = { id: 'bank' } as never;
const STUB_GW = { id: 'stub' } as never;

function setEnv(env: { stub: boolean; vnpayEnabled?: boolean }) {
  vi.mocked(getEnv).mockReturnValue({
    PAYMENTS_STUB: env.stub,
    VNPAY_ENABLED: env.vnpayEnabled ?? false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMomoAdapter).mockReturnValue(MOMO_GW);
  vi.mocked(getVnpayAdapter).mockReturnValue(VNPAY_GW);
  vi.mocked(getBankTransferAdapter).mockReturnValue(BANK_GW);
  vi.mocked(getStubAdapter).mockReturnValue(STUB_GW);
});

describe('getGatewayFor — PAYMENTS_STUB=false', () => {
  beforeEach(() => setEnv({ stub: false }));

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
  beforeEach(() => setEnv({ stub: true, vnpayEnabled: true }));

  it('routes momo to the stub adapter when stubbed', () => {
    expect(getGatewayFor('momo', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('momo', BASE_URL);
    expect(getMomoAdapter).not.toHaveBeenCalled();
  });

  it('routes zalopay to the stub adapter', () => {
    expect(getGatewayFor('zalopay', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('zalopay', BASE_URL);
  });

  it('routes vnpay to the stub even when VNPAY_ENABLED (stub wins)', () => {
    expect(getGatewayFor('vnpay', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('vnpay', BASE_URL);
    expect(getVnpayAdapter).not.toHaveBeenCalled();
  });
});

describe('getGatewayFor — VNPAY_ENABLED kill-switch', () => {
  it('routes vnpay to the real adapter when VNPAY_ENABLED && !PAYMENTS_STUB', () => {
    setEnv({ stub: false, vnpayEnabled: true });
    expect(getGatewayFor('vnpay', BASE_URL)).toBe(VNPAY_GW);
    expect(getVnpayAdapter).toHaveBeenCalledOnce();
    expect(getStubAdapter).not.toHaveBeenCalled();
  });

  it('routes vnpay to the stub when VNPAY_ENABLED is off (even with PAYMENTS_STUB=false)', () => {
    setEnv({ stub: false, vnpayEnabled: false });
    expect(getGatewayFor('vnpay', BASE_URL)).toBe(STUB_GW);
    expect(getStubAdapter).toHaveBeenCalledWith('vnpay', BASE_URL);
    expect(getVnpayAdapter).not.toHaveBeenCalled();
  });
});

describe('getGatewayFor — bank_transfer', () => {
  it('always routes to the real VietQR/SePay adapter (both stub states)', () => {
    setEnv({ stub: false });
    expect(getGatewayFor('bank_transfer', BASE_URL)).toBe(BANK_GW);
    setEnv({ stub: true });
    expect(getGatewayFor('bank_transfer', BASE_URL)).toBe(BANK_GW);
    expect(getBankTransferAdapter).toHaveBeenCalledTimes(2);
    expect(getStubAdapter).not.toHaveBeenCalled();
  });
});
