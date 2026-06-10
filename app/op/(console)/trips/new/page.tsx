/**
 * /op/trips/new — Create a one-off trip (server component).
 *
 * Loads route + bus options in-process (AGENTS.md: server components MUST NOT
 * self-fetch their own API), then hands them to the NewTripClient form island.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 *
 * Closes the 404 where the "Tạo chuyến mới" button (TripsClient.tsx) pushed to
 * /op/trips/new with no page present — the URL fell through to trips/[id] and
 * notFound()'d on id="new".
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { listRoutes } from '@/lib/catalog';
import { listOperatorBuses } from '@/lib/catalog';
import { listOperatorPickupAreas, composePickupLabel } from '@/lib/catalog';
import { PageHeader } from '@/components/op/PageHeader';
import NewTripClient from './NewTripClient';

export default async function OpNewTripPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const [routes, buses, areas] = await Promise.all([
    listRoutes({ operatorId: session.operatorId }),
    listOperatorBuses(session.operatorId, { activeOnly: true }),
    listOperatorPickupAreas({ operatorId: session.operatorId }),
  ]);

  const activeRoutes = routes
    .filter((r) => r.deactivatedAt === null)
    .map((r) => ({ id: r.id, origin: r.origin, destination: r.destination }));
  const activeBuses = buses.map((b) => ({
    id: b.id,
    licensePlate: b.licensePlate,
    capacity: b.capacity,
  }));
  const activeAreas = areas
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, label: composePickupLabel(a), kind: a.kind }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[
          { label: 'Chuyến đi', href: '/op/trips' },
          { label: 'Tạo chuyến mới' },
        ]}
        title="Tạo chuyến xe mới"
        backHref="/op/trips"
      />
      <NewTripClient routes={activeRoutes} buses={activeBuses} pickupAreas={activeAreas} />
    </div>
  );
}
