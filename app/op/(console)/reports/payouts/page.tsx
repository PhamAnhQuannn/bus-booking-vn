/**
 * /op/reports/payouts — Operator Payout List (server component, Issue 016).
 *
 * Calls getPayoutReport in-process (NOT via fetch — Issue 003 hardened rule).
 * Client island (PayoutsClient) handles the retry button POST → router.refresh().
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getPayoutReport } from '@/lib/payouts/getPayoutReport';
import PayoutsClient from './PayoutsClient';

export default async function PayoutsReportPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const rows = await getPayoutReport({ operatorId: session.operatorId });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <h1>Lịch sử thanh toán</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Danh sách các khoản thanh toán cho nhà xe. Nhấn &quot;Thử lại&quot; để yêu cầu xử lý lại khoản thất bại.
      </p>
      <PayoutsClient initialRows={rows} />
    </div>
  );
}
