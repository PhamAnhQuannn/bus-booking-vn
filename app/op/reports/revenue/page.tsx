/**
 * /op/reports/revenue — Operator Revenue Report (server component, Issue 016).
 *
 * Reads searchParams for dateFrom/dateTo/routeId. Defaults: last 30 days in VN tz.
 * Calls getRevenueReport in-process (NOT via fetch — Issue 003 hardened rule).
 * Renders table server-side for initial paint; client island (RevenueClient) handles
 * date-range refilter via form submit → router.push with new searchParams.
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getRevenueReport } from '@/lib/payouts/getRevenueReport';
import RevenueClient from './RevenueClient';

/** Format a Date as YYYY-MM-DD in Asia/Ho_Chi_Minh tz. */
function toVnDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Compute the default date range (last 30 days) in VN tz. Called once per request. */
function getDefaultDateRange(): { defaultDateFrom: string; defaultDateTo: string } {
  const now = Date.now();
  return {
    defaultDateTo: toVnDateString(new Date(now)),
    defaultDateFrom: toVnDateString(new Date(now - 30 * 24 * 3600 * 1000)),
  };
}

interface SearchParams {
  dateFrom?: string;
  dateTo?: string;
  routeId?: string;
}

export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const params = await searchParams;

  // Default date range: last 30 days in VN tz
  const { defaultDateFrom, defaultDateTo } = getDefaultDateRange();

  const dateFrom = params.dateFrom ?? defaultDateFrom;
  const dateTo = params.dateTo ?? defaultDateTo;
  const routeId = params.routeId;

  const rows = await getRevenueReport({
    operatorId: session.operatorId,
    dateFrom,
    dateTo,
    routeId,
  });

  return (
    <main style={{ maxWidth: 1200, margin: '40px auto', padding: '0 16px' }}>
      <h1>Báo cáo doanh thu</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Doanh thu từ vé đã thanh toán của các chuyến xe trong khoảng thời gian đã chọn.
      </p>
      <RevenueClient
        initialRows={rows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        routeId={routeId}
      />
    </main>
  );
}
