'use client';

/**
 * TripsClient — client island for operator trip list (Issue 013).
 *
 * CSRF double-submit: X-CSRF-Token on all non-GET requests via tripsClient.ts.
 * Design-system surface: Card + Table list, Badge trip status (statusLabels),
 * Alert messages, Dialog-based cancel (≥10-char reason) via CancelTripDialog.
 * Every data-testid is preserved (sandbox-gated e2e keys off them).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TripDto } from '@/lib/trips/tripDto';
import type { TripStatus } from '@prisma/client';
import { cancelTripApi, salesToggleApi, listTripsApi } from '@/lib/api/tripsClient';
import { tripStatusDisplay } from '@/lib/op/statusLabels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import CancelTripDialog from './CancelTripDialog';

interface Props {
  initialTrips: TripDto[];
}

function translateError(code: string): string {
  switch (code) {
    case 'bus_deactivated':
      return 'Xe đã bị vô hiệu hoá';
    case 'bus_in_maintenance':
      return 'Xe đang bảo trì';
    case 'already_cancelled':
      return 'Chuyến đã bị huỷ';
    case 'not_found':
      return 'Không tìm thấy';
    case 'invalid_input':
      return 'Dữ liệu không hợp lệ';
    default:
      return 'Đã xảy ra lỗi';
  }
}

export default function TripsClient({ initialTrips }: Props) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripDto[]>(initialTrips);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [cancelTripId, setCancelTripId] = useState<string | null>(null);

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(err: unknown) {
    const data = (err as { data?: { error?: string } }).data;
    setMessage(translateError(data?.error ?? ''));
    setIsError(true);
  }

  async function refreshTrips() {
    const { trips: next } = await listTripsApi();
    setTrips(next);
  }

  async function handleSalesToggle(tripId: string, salesClosed: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await salesToggleApi(tripId, salesClosed);
      ok(salesClosed ? 'Đã đóng bán vé.' : 'Đã mở bán vé.');
      await refreshTrips();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm(reason: string) {
    if (!cancelTripId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await cancelTripApi(cancelTripId, reason);
      ok(
        `Đã huỷ chuyến. Đặt vé bị huỷ: ${result.cancelledBookings}. Giữ chỗ bị huỷ: ${result.cancelledHolds}. SMS: ${result.notificationsEnqueued}.`
      );
      setCancelTripId(null);
      await refreshTrips();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="trips-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => router.push('/op/trips/new')} data-testid="create-trip-btn">
          Tạo chuyến mới
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/op/trip-templates')}
          data-testid="templates-link"
        >
          Quản lý lịch cố định
        </Button>
      </div>

      {cancelTripId && (
        <CancelTripDialog
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTripId(null)}
          disabled={busy}
        />
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có chuyến nào.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table data-testid="trips-table">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Khởi hành</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghế còn</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => {
                const status = tripStatusDisplay(trip.status as TripStatus, trip.salesClosed);
                return (
                  <TableRow key={trip.id} data-testid={`trip-row-${trip.id}`}>
                    <TableCell className="font-mono text-xs">
                      <a
                        href={`/op/trips/${trip.id}`}
                        data-testid={`trip-detail-link-${trip.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {trip.id.slice(0, 8)}…
                      </a>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Date(trip.departureAt).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {trip.price?.toLocaleString('vi-VN')}đ
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums" data-testid={`trip-available-${trip.id}`}>
                      {trip.availableSeats}
                    </TableCell>
                    <TableCell>
                      {trip.status !== 'cancelled' && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleSalesToggle(trip.id, !trip.salesClosed)}
                            disabled={busy}
                            data-testid={`trip-toggle-sales-${trip.id}`}
                          >
                            {trip.salesClosed ? 'Mở bán' : 'Đóng bán'}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setCancelTripId(trip.id)}
                            disabled={busy}
                            data-testid={`trip-cancel-${trip.id}`}
                          >
                            Huỷ
                          </Button>
                        </div>
                      )}
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
