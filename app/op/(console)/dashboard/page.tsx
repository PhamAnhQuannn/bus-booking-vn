/**
 * /op/dashboard — Operator Booking Queue (Issue 014).
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
import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { Badge } from '@/components/ui/badge';
import DashboardClient from './DashboardClient';

export default async function OpDashboardPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  // Need operatorUserId for badge tracking — re-derive from cookie
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;
  let operatorUserId: string | null = null;
  if (token) {
    const payload = await verifyOperatorAccess(token);
    if (payload?.sub) {
      operatorUserId = payload.sub;
    }
  }

  // Read unviewed count BEFORE touching (so badge shows what was new on load)
  const unviewedCount = operatorUserId
    ? await getUnviewedPaidCount(operatorUserId, session.operatorId)
    : 0;

  // Touch last viewed — badge resets from now on next load
  if (operatorUserId) {
    await touchLastViewed(operatorUserId);
  }

  // Load initial booking queue (no filters, default limit)
  const initial = await listOperatorBookings(session.operatorId, {});

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <h1 className="mb-6 flex items-center gap-3 text-2xl font-semibold tracking-tight">
        Hàng đợi đặt vé
        {unviewedCount > 0 && (
          <Badge variant="count" data-testid="booking-badge">
            {unviewedCount} mới
          </Badge>
        )}
      </h1>
      <DashboardClient
        initialRows={initial.rows}
        initialNextCursor={initial.nextCursor}
        operatorId={session.operatorId}
      />
    </div>
  );
}
