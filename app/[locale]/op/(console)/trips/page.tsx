/**
 * /op/trips — Operator Trip List (server component, Issue 013).
 *
 * Loads trips in-process via lib/trips/getTrip.ts (listTrips).
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Otherwise → render server-rendered trip list + client island for mutations
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { listTrips } from '@/lib/trips';
import { PageHeader } from '@/components/op/PageHeader';
import TripsClient from './TripsClient';

export default async function OpTripsPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const trips = await listTrips(session.operatorId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        title="Quản lý chuyến xe"
        subtitle="Danh sách chuyến xe. Mỗi nhà xe chỉ thấy chuyến của riêng mình."
      />
      <TripsClient initialTrips={trips} />
    </div>
  );
}
