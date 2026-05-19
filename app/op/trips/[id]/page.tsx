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
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getTrip } from '@/lib/trips/getTrip';
import TripDetailClient from './TripDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function OpTripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const trip = await getTrip(session.operatorId, id);
  if (!trip) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <h1>Chi tiết chuyến xe</h1>
      <TripDetailClient trip={trip} />
    </main>
  );
}
