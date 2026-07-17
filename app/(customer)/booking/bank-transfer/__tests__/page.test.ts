/**
 * Unit tests for /booking/bank-transfer page (RSC).
 * Covers open-redirect guard, missing params, invalid amount.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

class NotFoundError extends Error {
  constructor() {
    super('NEXT_NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new NotFoundError();
  }),
}));

vi.mock('@/lib/booking', () => ({
  getBookingByRef: vi.fn(),
  getBookingByConfirmationToken: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  getEnv: vi.fn(() => ({
    VIETQR_BANK_BIN: '970405',
    VIETQR_ACCOUNT_NUMBER: '1234567890',
    VIETQR_ACCOUNT_NAME: 'BBVN',
    VIETQR_TEMPLATE: 'compact2',
  })),
}));

vi.mock('../BankTransferClient', () => ({
  BankTransferClient: () => null,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
  CardContent: ({ children }: { children: React.ReactNode }) => children,
  CardHeader: ({ children }: { children: React.ReactNode }) => children,
  CardTitle: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/booking/BookingSummaryRail', () => ({
  BookingSummaryRail: () => null,
}));

import BankTransferPage from '../page';
import { notFound } from 'next/navigation';
import { getBookingByRef, getBookingByConfirmationToken } from '@/lib/booking';

const MOCK_BOOKING = {
  id: 'booking-1',
  confirmationToken: 'tok-abc',
  bookingRef: 'BB-2026-abcd-ef12',
};

function makeProps(params: Record<string, string | undefined>) {
  return {
    searchParams: Promise.resolve(params as Record<string, string>),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBookingByRef).mockResolvedValue(MOCK_BOOKING as never);
  // Order-summary rail is optional (rendered only when this resolves) — tests
  // here cover routing/guard behavior, not the summary card itself.
  vi.mocked(getBookingByConfirmationToken).mockResolvedValue(undefined as never);
});

describe('BankTransferPage', () => {
  it('calls notFound for absolute redirect URL (open-redirect guard)', async () => {
    await expect(
      BankTransferPage(makeProps({
        bookingRef: 'BB-2026-abcd-ef12',
        amount: '90000',
        redirectUrl: 'https://evil.com',
      }))
    ).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound for protocol-relative redirect URL', async () => {
    await expect(
      BankTransferPage(makeProps({
        bookingRef: 'BB-2026-abcd-ef12',
        amount: '90000',
        redirectUrl: '//evil.com',
      }))
    ).rejects.toThrow(NotFoundError);
  });

  it('allows relative redirect URL starting with /', async () => {
    const result = await BankTransferPage(makeProps({
      bookingRef: 'BB-2026-abcd-ef12',
      amount: '90000',
      redirectUrl: '/booking/confirmation/abc',
    }));
    expect(result).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('allows absent redirect URL', async () => {
    const result = await BankTransferPage(makeProps({
      bookingRef: 'BB-2026-abcd-ef12',
      amount: '90000',
    }));
    expect(result).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound when bookingRef is missing', async () => {
    await expect(
      BankTransferPage(makeProps({ amount: '90000' }))
    ).rejects.toThrow(NotFoundError);
  });

  it('calls notFound when amount is 0', async () => {
    await expect(
      BankTransferPage(makeProps({
        bookingRef: 'BB-2026-abcd-ef12',
        amount: '0',
      }))
    ).rejects.toThrow(NotFoundError);
  });

  it('calls notFound when amount is negative', async () => {
    await expect(
      BankTransferPage(makeProps({
        bookingRef: 'BB-2026-abcd-ef12',
        amount: '-100',
      }))
    ).rejects.toThrow(NotFoundError);
  });
});
