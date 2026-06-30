import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { BankTransferClient } from '../BankTransferClient';

const PROPS = {
  bookingRef: 'BB-2026-abcd-ef12',
  confirmationToken: 'tok-abc',
  redirectUrl: '/booking/confirmation/tok-abc',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BankTransferClient', () => {
  it('renders polling state initially', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'awaiting_payment' }),
    });

    render(<BankTransferClient {...PROPS} />);
    expect(screen.getByText(/Đang chờ xác nhận thanh toán/)).toBeDefined();
  });

  it('redirects when payment status is paid', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'paid' }),
    });

    render(<BankTransferClient {...PROPS} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockReplace).toHaveBeenCalledWith(PROPS.redirectUrl);
  });

  it('shows timeout UI after MAX_REFRESHES polls', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'awaiting_payment' }),
    });

    render(<BankTransferClient {...PROPS} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120 * 5000);
    });

    expect(screen.getByText(/Chưa nhận được thanh toán/)).toBeDefined();
    expect(screen.getByText('Thử lại')).toBeDefined();
  });

  it('resets polling on retry button click', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'awaiting_payment' }),
    });

    render(<BankTransferClient {...PROPS} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120 * 5000);
    });

    expect(screen.getByText(/Chưa nhận được thanh toán/)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText('Thử lại'));
    });

    expect(screen.getByText(/Đang chờ xác nhận thanh toán/)).toBeDefined();
  });
});
