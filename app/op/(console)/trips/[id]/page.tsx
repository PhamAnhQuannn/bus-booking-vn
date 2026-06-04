/**
 * /op/trips/[id] — Operator Trip Detail (server component, Issue 013).
 *
 * Loads trip in-process via lib/trips/getTrip.ts (getTrip).
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Trip not found (cross-op or missing) → 404
 */

import { redirect, notFound } from 'next/navigation';
import { getOperatorStaff } from '@/lib/op/getOperatorStaff';
import { getTrip } from '@/lib/trips';
import { PageHeader } from '@/components/op/PageHeader';
import TripDetailClient from './TripDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function OpTripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const view = await getOperatorStaff();

  if (!view) {
    redirect('/op/login');
  }

  if (view.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const trip = await getTrip(view.operatorId, id);
  if (!trip) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[
          { label: 'Chuyến đi', href: '/op/trips' },
          { label: `Chuyến ${id.slice(0, 8)}…` },
        ]}
        title="Chi tiết chuyến xe"
        backHref="/op/trips"
      />
      <TripDetailClient trip={trip} staff={view.staff} isAdmin={view.isAdmin} />
    </div>
  );
}
