/**
 * /op/manifest — manifest index (Issue 080). Server component.
 *
 * The manifest is per-trip (/op/manifest/:tripId). This index gives a sensible
 * DEFAULT entry point: it resolves the operator's NEXT departure (soonest upcoming
 * scheduled/departed trip) and redirects to its manifest — instead of an arbitrary
 * or empty default.
 *
 * listUpcomingForOperator already filters departureAt >= now and sorts ASC, so
 * trips[0] is the next departure. When the operator has no upcoming trips we send
 * them to the Trips list rather than a dead end.
 *
 * In-process read (no self-fetch — AGENTS.md 002/003). Pure render: the redirect
 * is driven only by the DB read (no Date.now() in the render body — the "now"
 * filter lives inside listUpcomingForOperator).
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listUpcomingForOperator } from '@/lib/trips/listUpcomingForOperator';

export default async function ManifestIndexPage() {
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');

  const upcoming = await listUpcomingForOperator(session.operatorId, { limit: 1 });
  const next = upcoming.trips[0];

  if (next) {
    redirect(`/op/manifest/${next.id}`);
  }

  // No upcoming departures — fall back to the Trips list (not a dead end).
  redirect('/op/trips');
}
