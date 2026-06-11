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
import { listOperatorPickupAreas, listRoutePickupAreas, composePickupLabel } from '@/lib/catalog';
import { prisma } from '@/lib/core/db/client';
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
    .map((a) => ({ id: a.id, label: composePickupLabel(a), kind: a.kind, provinceCode: a.provinceCode }));

  // Issue 113: pickup areas are route-scoped — load the assigned subset per route so the
  // picker offers only the areas relevant to the chosen route (not the whole operator menu).
  const routeAreaEntries = await Promise.all(
    activeRoutes.map(async (r) => {
      const assigned = await listRoutePickupAreas({ operatorId: session.operatorId, routeId: r.id });
      return [
        r.id,
        assigned.map((a) => ({
          id: a.id,
          label: composePickupLabel(a),
          kind: a.kind,
          provinceCode: a.provinceCode,
        })),
      ] as const;
    })
  );
  const routePickupAreas: Record<string, typeof activeAreas> = Object.fromEntries(routeAreaEntries);

  // Issue 112 (per-route memory, operator P1.3): for each active route, surface the pickup-area set
  // of the MOST RECENT prior trip so the client can offer "dùng lại điểm đón chuyến trước". One query
  // per route (small N — an operator's route list), each ordered by departureAt desc. Only the active
  // menu ids are kept so a since-deactivated area is not re-offered.
  const activeAreaIds = new Set(activeAreas.map((a) => a.id));
  const lastTrips = await Promise.all(
    activeRoutes.map((r) =>
      prisma.trip.findFirst({
        where: { routeId: r.id, operatorId: session.operatorId },
        orderBy: { departureAt: 'desc' },
        select: { pickupAreas: { select: { operatorPickupAreaId: true } } },
      })
    )
  );
  const routePickupMemory: Record<string, string[]> = {};
  activeRoutes.forEach((r, i) => {
    const ids = (lastTrips[i]?.pickupAreas ?? [])
      .map((p) => p.operatorPickupAreaId)
      .filter((id) => activeAreaIds.has(id));
    if (ids.length > 0) routePickupMemory[r.id] = ids;
  });

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
      <NewTripClient
        routes={activeRoutes}
        buses={activeBuses}
        routePickupAreas={routePickupAreas}
        routePickupMemory={routePickupMemory}
      />
    </div>
  );
}
