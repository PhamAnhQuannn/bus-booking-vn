/**
 * Unit tests for lib/account/customerOtp.ts channel routing (P16) + dispatch-failure
 * logging (P20). DB + rate-limit + dispatch are mocked — the point is that the PHONE
 * channel sends an SMS (not an email) and that a send failure is surfaced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendSms, mockSendEmail, mockStash, mockLogFail, mockLimit, mockExecuteRaw, mockQueryRaw } =
  vi.hoisted(() => ({
    mockSendSms: vi.fn(),
    mockSendEmail: vi.fn(),
    mockStash: vi.fn(),
    mockLogFail: vi.fn(),
    mockLimit: vi.fn(),
    mockExecuteRaw: vi.fn(),
    mockQueryRaw: vi.fn(),
  }));

vi.mock('@/lib/notification', () => ({
  sendSms: mockSendSms,
  sendEmail: mockSendEmail,
  stashTestOtp: mockStash,
  logNotificationDispatchFailure: mockLogFail,
}));
vi.mock('@/lib/ratelimit', () => ({ createRatelimit: () => ({ limit: mockLimit }) }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { $executeRaw: mockExecuteRaw, $queryRaw: mockQueryRaw },
}));
vi.mock('@/lib/auth', () => ({
  generateCode: () => '123456',
  generateSalt: () => 'salt',
  hashCode: () => 'a'.repeat(64),
}));

import { sendCustomerAccountOtp } from '../customerOtp';

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
  mockQueryRaw.mockResolvedValue([]); // no lockout sentinel
  mockExecuteRaw.mockResolvedValue(1);
  mockSendSms.mockResolvedValue({ ok: true });
  mockSendEmail.mockResolvedValue({ ok: true });
});

describe('sendCustomerAccountOtp — channel routing (P16)', () => {
  it('phone channel dispatches an SMS to the normalized phone, never an email', async () => {
    const res = await sendCustomerAccountOtp('+84901234567', 'phone');
    expect(res).toEqual({ ok: true });
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendSms.mock.calls[0][0]).toMatchObject({ to: '+84901234567', template: 'otpCode' });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockStash).toHaveBeenCalledWith('+84901234567', '123456');
  });

  it('email channel (default) dispatches an email, never an SMS', async () => {
    const res = await sendCustomerAccountOtp('User@Example.com');
    expect(res).toEqual({ ok: true });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({ to: 'user@example.com', template: 'otpCode' });
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('logs a dispatch failure but still returns ok (enumeration-safety) — P20', async () => {
    mockSendSms.mockResolvedValue({ ok: false, error: 'esms rejected' });
    const res = await sendCustomerAccountOtp('+84901234567', 'phone');
    expect(res).toEqual({ ok: true });
    expect(mockLogFail).toHaveBeenCalledWith('customer_otp_phone', { ok: false, error: 'esms rejected' });
  });

  it('does not dispatch when rate-limited', async () => {
    mockLimit.mockResolvedValue({ allowed: false, retryAfter: 42 });
    const res = await sendCustomerAccountOtp('+84901234567', 'phone');
    expect(res).toEqual({ ok: false, reason: 'rate_limited', retryAfter: 42 });
    expect(mockSendSms).not.toHaveBeenCalled();
  });
});
