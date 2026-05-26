/**
 * /op/upcoming — Upcoming trips list (Issue 014).
 *
 * Server component: reads listUpcomingForOperator in-process.
 * MUST NOT self-fetch own API (Issue 002/003 hardened rule).
 */

import { redirect } from 'next/navigation';
import type { TripStatus } from '@prisma/client';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listUpcomingForOperator } from '@/lib/trips/listUpcomingForOperator';
import { listRoutes } from '@/lib/routes/listRoutes';
import type { TripDto } from '@/lib/trips/tripDto';
import { tripStatusDisplay } from '@/lib/op/statusLabels';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import UpcomingFilter from './UpcomingFilter';

type PageProps = { searchParams: Promise<{ routeId?: string }> };

export default async function OpUpcomingPage({ searchParams }: PageProps) {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const { routeId } = await searchParams;

  const [{ trips }, routes] = await Promise.all([
    listUpcomingForOperator(session.operatorId, routeId ? { routeId } : {}),
    listRoutes({ operatorId: session.operatorId }),
  ]);

  const routeOptions = routes
    .filter((r) => r.deactivatedAt === null)
    .map((r) => ({ id: r.id, origin: r.origin, destination: r.destination }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Chuyến xe sắp khởi hành</h1>
      <UpcomingFilter routes={routeOptions} selected={routeId ?? ''} />
      {trips.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Không có chuyến nào trong thời gian tới.
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table data-testid="upcoming-trips-table">
            <TableHeader>
              <TableRow>
                <TableHead>Khởi hành</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghế còn</TableHead>
                <TableHead>Manifest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip: TripDto) => {
                const status = tripStatusDisplay(trip.status as TripStatus);
                return (
                  <TableRow key={trip.id} data-testid={`upcoming-trip-${trip.id}`}>
                    <TableCell>{new Date(trip.departureAt).toLocaleString('vi-VN')}</TableCell>
                    <TableCell>{trip.price?.toLocaleString('vi-VN')}đ</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{trip.availableSeats}</TableCell>
                    <TableCell>
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={`/op/manifest/${trip.id}`}
                        data-testid={`manifest-link-${trip.id}`}
                      >
                        Xem manifest
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
