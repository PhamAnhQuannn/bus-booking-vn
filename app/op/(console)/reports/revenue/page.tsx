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
import { getDefaultDateRange } from '@/lib/op/dateRanges';
import { PageHeader } from '@/components/op/PageHeader';
import RevenueClient from './RevenueClient';

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
  const { from: defaultDateFrom, to: defaultDateTo } = getDefaultDateRange(30);

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[{ label: 'Báo cáo' }, { label: 'Doanh thu' }]}
        title="Báo cáo doanh thu"
        subtitle="Doanh thu từ vé đã thanh toán của các chuyến xe trong khoảng thời gian đã chọn."
      />
      <RevenueClient
        initialRows={rows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        routeId={routeId}
      />
    </div>
  );
}
