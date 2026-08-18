/**
 * Unit tests for /admin Overview (RSC) — money-flow tile RBAC (#371 / #393.1).
 *
 * The orphan-payment ("Giao dịch chưa khớp") and failed-payout ("Chi trả thất bại")
 * tiles live inside the page's `canSeeFinance` ternary so a SUPPORT-role admin never
 * sees money-flow failures. That ternary is the page's ENTIRE RBAC (requireAdminPage
 * enforces auth/TOTP but takes no role), yet #393 flagged it as untested — inverting
 * or deleting it broke nothing. These tests pin it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/auth', () => ({ requireAdminPage: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ getAdminMetrics: vi.fn() }));
vi.mock('@/lib/admin', () => ({
  getActionQueue: vi.fn(),
  getFailureAlerts: vi.fn(),
  redactErrorText: vi.fn((s: string) => s),
}));
vi.mock('@/lib/op', () => ({
  getDefaultDateRange: vi.fn(() => ({ from: '2026-01-01', to: '2026-01-30' })),
}));

import AdminOverviewPage from '../page';
import { requireAdminPage } from '@/lib/auth';
import { getAdminMetrics } from '@/lib/analytics';
import { getActionQueue, getFailureAlerts } from '@/lib/admin';

// Vietnamese labels that render ONLY inside the canSeeFinance ternary (page.tsx:251-264).
const ORPHAN_TILE = 'Giao dịch chưa khớp';
const FAILED_PAYOUT_TILE = 'Chi trả thất bại';

const METRICS = {
  customers: 10,
  operators: { total: 3, approved: 2 },
  bookings: 42,
  gmvVnd: 1_000_000,
  revenueVnd: 100_000,
};
const QUEUE = {
  pendingApprovals: 0,
  pendingCharters: 0,
  openDisputes: 0,
  failedPayouts: 3,
};
const FAILURES = {
  deadNotifications: 0,
  retryingNotifications: 0,
  orphanPayments: 5,
  failedPayouts: 3,
  recent: [],
};

function mockRole(role: 'SUPER_ADMIN' | 'FINANCE' | 'SUPPORT') {
  vi.mocked(requireAdminPage).mockResolvedValue({
    adminId: 'a1',
    role,
    totpVerified: true,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminMetrics).mockResolvedValue(METRICS as never);
  vi.mocked(getActionQueue).mockResolvedValue(QUEUE as never);
  vi.mocked(getFailureAlerts).mockResolvedValue(FAILURES as never);
});

describe('AdminOverviewPage — canSeeFinance money-flow tile gating (#393.1)', () => {
  it('hides orphan-payment + failed-payout tiles from SUPPORT', async () => {
    mockRole('SUPPORT');
    const html = renderToStaticMarkup(await AdminOverviewPage());
    expect(html).not.toContain(ORPHAN_TILE);
    expect(html).not.toContain(FAILED_PAYOUT_TILE);
  });

  it('shows the money-flow tiles to FINANCE', async () => {
    mockRole('FINANCE');
    const html = renderToStaticMarkup(await AdminOverviewPage());
    expect(html).toContain(ORPHAN_TILE);
    expect(html).toContain(FAILED_PAYOUT_TILE);
  });

  it('shows the money-flow tiles to SUPER_ADMIN', async () => {
    mockRole('SUPER_ADMIN');
    const html = renderToStaticMarkup(await AdminOverviewPage());
    expect(html).toContain(ORPHAN_TILE);
    expect(html).toContain(FAILED_PAYOUT_TILE);
  });
});
