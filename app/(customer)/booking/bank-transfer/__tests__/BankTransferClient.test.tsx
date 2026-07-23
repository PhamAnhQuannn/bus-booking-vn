import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { BankTransferClient, MAX_REFRESHES } from '../BankTransferClient';

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
      await vi.advanceTimersByTimeAsync(MAX_REFRESHES * 5000);
    });

    expect(screen.getByText(/Chưa nhận được thanh toán/)).toBeDefined();
    expect(screen.getByText('Thử lại')).toBeDefined();
  });

  it('shows a live transfer countdown when a deadline is provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'awaiting_payment' }),
    });

    const deadlineIso = new Date(Date.now() + 15 * 60_000).toISOString();
    render(<BankTransferClient {...PROPS} deadlineIso={deadlineIso} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Countdown copy shown, not the "auto-check every 5s" phrasing.
    expect(screen.getByText(/còn \d+:\d{2}/)).toBeDefined();
    expect(screen.queryByText(/mỗi 5 giây/)).toBeNull();
  });

  it('resets polling on retry button click', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'awaiting_payment' }),
    });

    render(<BankTransferClient {...PROPS} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_REFRESHES * 5000);
    });

    expect(screen.getByText(/Chưa nhận được thanh toán/)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText('Thử lại'));
    });

    expect(screen.getByText(/Đang chờ xác nhận thanh toán/)).toBeDefined();
  });
});
