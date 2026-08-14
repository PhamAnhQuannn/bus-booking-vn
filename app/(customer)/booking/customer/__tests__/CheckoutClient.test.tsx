import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// --- mocks ------------------------------------------------------------------
const callOrder: string[] = [];

const mockCreateHold = vi.fn();
vi.mock('@/lib/api', () => ({
  createHoldRequest: (...args: unknown[]) => {
    callOrder.push('hold');
    return mockCreateHold(...args);
  },
}));

const mockAuthFetch = vi.fn();
vi.mock('@/lib/auth/clientSession', () => ({
  authFetch: (...args: unknown[]) => {
    callOrder.push('initiate');
    return mockAuthFetch(...args);
  },
  getDisplayName: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { CheckoutClient } from '../CheckoutClient';

const PROPS = {
  tripId: 'trip-1',
  ticketCount: 1,
  boardingPoint: 'Chợ Tân Khai' as string | null,
  boardingTime: '03:00' as string | null,
  trip: {
    routeOrigin: 'Sài Gòn',
    routeDestination: 'Thanh Hóa',
    departureAt: '2026-08-12T06:00:00+07:00',
    operatorLegalName: 'BBVN',
    vehicleLabel: 'Limousine 32 chỗ',
  },
  pspWindowMinutes: 20,
  vietqr: {
    bankBin: '970403',
    accountNumber: '030027766656',
    accountName: 'CTNHH MINH QUAN',
    bankName: 'Sacombank',
    template: 'compact2',
  },
};

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), { target: { value: 'Nguyen Van Test' } });
  fireEvent.change(screen.getByPlaceholderText('VD: 0912 345 678'), { target: { value: '0912345678' } });
  fireEvent.change(screen.getByPlaceholderText('Nhập email để nhận vé'), {
    target: { value: 'test@example.com' },
  });
}

async function tickBothConsents() {
  const boxes = screen.getAllByRole('checkbox');
  await act(async () => {
    fireEvent.click(boxes[0]);
  });
  await act(async () => {
    fireEvent.click(boxes[1]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'awaiting_payment' }) });
});

afterEach(() => {
  cleanup();
});

describe('CheckoutClient', () => {
  it('keeps consent disabled until the info is valid, then enables it', () => {
    render(<CheckoutClient {...PROPS} />);
    let boxes = screen.getAllByRole('checkbox');
    expect((boxes[0] as HTMLInputElement).disabled).toBe(true);

    fillValidForm();
    boxes = screen.getAllByRole('checkbox');
    expect((boxes[0] as HTMLInputElement).disabled).toBe(false);
    expect((boxes[1] as HTMLInputElement).disabled).toBe(false);
  });

  it('does not offer VNPay and shows a QR placeholder before consent', () => {
    render(<CheckoutClient {...PROPS} />);
    expect(screen.queryByText(/vnpay/i)).toBeNull();
    expect(screen.getByText(/Chuyển khoản ngân hàng \(VietQR\)/)).toBeDefined();
    // No confirm button anywhere.
    expect(screen.queryByRole('button', { name: /xác nhận thanh toán/i })).toBeNull();
    expect(screen.getByText(/hiển thị mã QR/i)).toBeDefined();
  });

  it('auto-fires hold → initiate (in order) and reveals the VietQR details once both consents are ticked', async () => {
    mockCreateHold.mockResolvedValue({
      ok: true,
      holdId: 'hold-1',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      boardingPoint: 'Chợ Tân Khai',
      boardingTime: '03:00',
    });
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        payUrl:
          '/booking/bank-transfer?bookingRef=BB-2026-abcd-ef12&amount=850000&redirectUrl=/booking/result/tok-1',
      }),
    });

    render(<CheckoutClient {...PROPS} />);
    fillValidForm();
    await tickBothConsents();

    expect(mockCreateHold).toHaveBeenCalledTimes(1);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['hold', 'initiate']);
    expect(mockAuthFetch.mock.calls[0][0]).toBe('/api/bookings/initiate');

    expect(await screen.findByText(/thông tin chuyển khoản/i)).toBeDefined();
    expect(screen.getByText('BB-2026-abcd-ef12')).toBeDefined();
  });

  it('does not fire while only one consent is ticked', async () => {
    render(<CheckoutClient {...PROPS} />);
    fillValidForm();
    const boxes = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(boxes[0]);
    });
    expect(mockCreateHold).not.toHaveBeenCalled();
  });

  it('does NOT reveal the QR and shows a retry button when initiate fails', async () => {
    mockCreateHold.mockResolvedValue({
      ok: true,
      holdId: 'hold-1',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      boardingPoint: null,
      boardingTime: null,
    });
    mockAuthFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'HOLD_EXPIRED' }),
    });

    render(<CheckoutClient {...PROPS} />);
    fillValidForm();
    await tickBothConsents();

    expect(await screen.findByText(/hết thời gian giữ chỗ/i)).toBeDefined();
    expect(screen.queryByText(/thông tin chuyển khoản/i)).toBeNull();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeDefined();
  });

  it('#586 retry after a typo-override re-fires with the override, not the gate', async () => {
    mockCreateHold.mockResolvedValue({ ok: false, code: 'SOLD_OUT' });

    render(<CheckoutClient {...PROPS} />);
    fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), { target: { value: 'Nguyen Van Test' } });
    fireEvent.change(screen.getByPlaceholderText('VD: 0912 345 678'), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập email để nhận vé'), { target: { value: 'test@gmial.com' } });
    await tickBothConsents();

    // Domain typo → the soft-gate blocks the auto-fire: no hold yet.
    expect(mockCreateHold).not.toHaveBeenCalled();

    // Override ("keep this email") fires the hold; it returns a transient SOLD_OUT.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /vẫn dùng email này/i }));
    });
    expect(mockCreateHold).toHaveBeenCalledTimes(1);
    expect((mockCreateHold.mock.calls[0][0] as { buyerEmail: string }).buyerEmail).toBe('test@gmial.com');

    // Retry must re-fire the overridden email — NOT silently re-enter the typo gate (#586).
    const retryBtn = await screen.findByRole('button', { name: /thử lại/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(mockCreateHold).toHaveBeenCalledTimes(2);
    expect((mockCreateHold.mock.calls[1][0] as { buyerEmail: string }).buyerEmail).toBe('test@gmial.com');
  });
});
