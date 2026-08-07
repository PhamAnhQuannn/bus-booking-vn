/**
 * Unit tests for lib/auth/linkGoogleAccount.ts — resolveGoogleLogin (DS-033 §3).
 * Prisma + backfill are mocked; checkCustomerActive/asProvenEmail run for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockBackfill } = vi.hoisted(() => ({
  mockPrisma: {
    account: { findUnique: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockBackfill: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/booking', () => ({ backfillGuestBookingsByEmail: mockBackfill }));

import { resolveGoogleLogin } from '../linkGoogleAccount';

const IDENTITY = { sub: 'google-sub-1', email: 'Trip@Example.com', emailVerified: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma));
  mockBackfill.mockResolvedValue(undefined);
});

describe('resolveGoogleLogin', () => {
  it('L1: returns the linked customer for a known active link', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      customer: { id: 'cust-1', suspendedAt: null, deletedAt: null },
    });
    const res = await resolveGoogleLogin(IDENTITY);
    expect(res).toEqual({ ok: true, customerId: 'cust-1', created: false });
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
  });

  it('L1: rejects a known link whose customer is deleted/suspended (inactive)', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      customer: { id: 'cust-1', suspendedAt: null, deletedAt: new Date() },
    });
    expect(await resolveGoogleLogin(IDENTITY)).toEqual({ ok: false, reason: 'inactive' });
  });

  it('L2: links a verified Google email to an existing customer', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-2', emailVerifiedAt: null, suspendedAt: null });

    const res = await resolveGoogleLogin({ ...IDENTITY, emailVerified: true });

    expect(res).toEqual({ ok: true, customerId: 'cust-2', created: false });
    // linked with a lowercased email; emailVerifiedAt stamped (was null)
    expect(mockPrisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: 'cust-2', provider: 'google', email: 'trip@example.com' }),
      })
    );
    expect(mockPrisma.customer.update).toHaveBeenCalled();
  });

  it("L2': refuses to link an UNVERIFIED Google email to an existing account (no takeover)", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-2', emailVerifiedAt: null, suspendedAt: null });

    const res = await resolveGoogleLogin({ ...IDENTITY, emailVerified: false });

    expect(res).toEqual({ ok: false, reason: 'email_conflict' });
    expect(mockPrisma.account.create).not.toHaveBeenCalled();
  });

  it('L2: rejects a SUSPENDED customer — no session via Google (H1)', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'cust-susp',
      emailVerifiedAt: new Date(),
      suspendedAt: new Date(),
    });

    const res = await resolveGoogleLogin({ ...IDENTITY, emailVerified: true });

    expect(res).toEqual({ ok: false, reason: 'inactive' });
    expect(mockPrisma.account.create).not.toHaveBeenCalled();
  });

  it('L3: creates a new customer + account + backfills guest bookings', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'cust-new', email: 'trip@example.com' });

    const res = await resolveGoogleLogin({ ...IDENTITY, emailVerified: true });

    expect(res).toEqual({ ok: true, customerId: 'cust-new', created: true });
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'trip@example.com', passwordHash: null }),
      })
    );
    expect(mockPrisma.account.create).toHaveBeenCalled();
    expect(mockBackfill).toHaveBeenCalledWith(mockPrisma, 'cust-new', 'trip@example.com');
  });

  it('L3: a new customer from an UNVERIFIED Google email gets a null emailVerifiedAt', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'cust-new', email: 'trip@example.com' });

    await resolveGoogleLogin({ ...IDENTITY, emailVerified: false });

    const createArg = mockPrisma.customer.create.mock.calls[0][0] as { data: { emailVerifiedAt: unknown } };
    expect(createArg.data.emailVerifiedAt).toBeNull();
  });

  it('L3: an UNVERIFIED Google email does NOT inherit guest bookings (H2 — ProvenEmail IDOR guard)', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'cust-new', email: 'trip@example.com' });

    const res = await resolveGoogleLogin({ ...IDENTITY, emailVerified: false });

    expect(res).toEqual({ ok: true, customerId: 'cust-new', created: true });
    expect(mockPrisma.account.create).toHaveBeenCalled(); // account still created
    expect(mockBackfill).not.toHaveBeenCalled(); // but no guest-booking claim
  });
});
