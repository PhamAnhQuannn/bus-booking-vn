/**
 * /op/bookings — Operator Booking Queue (Issue 014; moved from /op/dashboard in PR 2).
 *
 * Server component: reads listOperatorBookings + getUnviewedPaidCount + touchLastViewed
 * in-process via lib functions. MUST NOT self-fetch own API (Issue 002/003 hardened rule).
 *
 * Badge count shown in heading, resets on load via touchLastViewed.
 * Client island renders queue + filters.
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listOperatorBookings } from '@/lib/booking/listOperatorBookings';
import { getUnviewedPaidCount } from '@/lib/booking/getUnviewedPaidCount';
import { touchLastViewed } from '@/lib/booking/touchLastViewed';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/op/PageHeader';
import DashboardClient from './DashboardClient';

export default async function OpBookingsPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  // Read unviewed count BEFORE touching (so badge shows what was new on load).
  const unviewedCount = await getUnviewedPaidCount(
    session.operatorUserId,
    session.operatorId
  );
  await touchLastViewed(session.operatorUserId);

  // Load initial booking queue (no filters, default limit).
  const initial = await listOperatorBookings(session.operatorId, {});

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PageHeader
        title="Hàng đợi đặt vé"
        subtitle="Đơn đã thanh toán đang chờ xử lý. Lọc theo xe, ngày, tuyến, hoặc trạng thái liên lạc."
        badge={
          unviewedCount > 0 ? (
            <Badge variant="count" data-testid="booking-badge">
              {unviewedCount} mới
            </Badge>
          ) : null
        }
      />
      <DashboardClient
        initialRows={initial.rows}
        initialNextCursor={initial.nextCursor}
        operatorId={session.operatorId}
      />
    </div>
  );
}
