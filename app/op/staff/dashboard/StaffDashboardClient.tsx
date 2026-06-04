'use client';

/**
 * StaffDashboardClient — single-trip client island for the staff dashboard (Issue 018).
 *
 * Staff see ONLY their assigned trip. Renders a Tabs switch between the booking queue
 * and the boarding manifest for that one trip, plus depart/complete actions.
 *
 * All reads target the Issue 014 endpoints (GET /api/op/bookings?tripId=,
 * GET /api/op/manifest/:tripId) which the staff-scope guard constrains to the assigned
 * trip — GET, so no CSRF token. depart/complete POST through tripsClient (X-CSRF-Token).
 *
 * Design-system surface: Tabs (base-ui — onValueChange, NOT onChange), Table queue +
 * manifest, Badge status/contact/payment, Alert message, Button actions. NO operator
 * sidebar shell (this route lives outside the (console) group). Every data-testid is
 * preserved (sandbox-gated e2e keys off them). AC6: manifest has NO seat-number column.
 */

import { useState } from 'react';
import { departTripApi, completeTripApi } from '@/lib/api';
import { bookingStatusDisplay, tripStatusDisplay } from '@/lib/op/statusLabels';
import type { BookingStatus, TripStatus } from '@prisma/client';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';
import type { ManifestRow } from '@/lib/booking/getManifest';
import type { TripDto } from '@/lib/trips/tripDto';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Props {
  tripId: string;
  trip: TripDto | null;
  initialQueueRows: BookingQueueRow[];
  initialManifestRows: ManifestRow[];
  initialManifestGeneratedAt: string | null;
}

type BadgeVariant = 'neutral' | 'success' | 'danger' | 'pending';

const CONTACT_DISPLAY: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Chưa gọi', variant: 'pending' },
  reached: { label: 'Đã liên lạc', variant: 'success' },
  no_answer: { label: 'Không bắt máy', variant: 'danger' },
  callback: { label: 'Gọi lại sau', variant: 'neutral' },
};

function contactDisplay(status: string): { label: string; variant: BadgeVariant } {
  return CONTACT_DISPLAY[status] ?? { label: status, variant: 'neutral' };
}

/** Flag icons (manual / escalated) with accessible labels. */
function FlagIcons({
  manualFlag,
  escalatedAt,
}: {
  manualFlag?: boolean;
  escalatedAt?: Date | string | null;
}) {
  return (
    <span className="inline-flex gap-1">
      {manualFlag && (
        <span role="img" aria-label="Thủ công" title="Thủ công">
          ✏
        </span>
      )}
      {escalatedAt && (
        <span role="img" aria-label="Cần xử lý" title="Cần xử lý">
          ⚠
        </span>
      )}
    </span>
  );
}

export default function StaffDashboardClient({
  tripId,
  trip,
  initialQueueRows,
  initialManifestRows,
  initialManifestGeneratedAt,
}: Props) {
  const [queueRows, setQueueRows] = useState<BookingQueueRow[]>(initialQueueRows);
  const [manifestRows, setManifestRows] = useState<ManifestRow[]>(initialManifestRows);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialManifestGeneratedAt);
  const [status, setStatus] = useState<TripDto['status'] | null>(trip?.status ?? null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(text: string) {
    setMessage(text);
    setIsError(true);
  }

  async function refreshQueue() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/bookings?tripId=${encodeURIComponent(tripId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        fail('Lỗi tải hàng đợi.');
        return;
      }
      const json = await res.json();
      setQueueRows(json.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshManifest() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/manifest/${tripId}`, { credentials: 'same-origin' });
      if (!res.ok) {
        fail('Lỗi tải manifest.');
        return;
      }
      const json = await res.json();
      setManifestRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  async function handleDepart() {
    setBusy(true);
    setMessage('');
    try {
      const { trip: updated, alreadyDeparted } = await departTripApi(tripId);
      setStatus(updated.status);
      ok(alreadyDeparted ? 'Chuyến đã được đánh dấu khởi hành.' : 'Đã đánh dấu khởi hành.');
    } catch {
      fail('Không thể đánh dấu khởi hành.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    setMessage('');
    try {
      const { trip: updated, alreadyCompleted } = await completeTripApi(tripId);
      setStatus(updated.status);
      ok(alreadyCompleted ? 'Chuyến đã được đánh dấu hoàn thành.' : 'Đã đánh dấu hoàn thành.');
    } catch {
      fail('Không thể đánh dấu hoàn thành.');
    } finally {
      setBusy(false);
    }
  }

  const tripStatus = status ? tripStatusDisplay(status as TripStatus) : null;

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="staff-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div data-testid="trip-status" className="flex items-center gap-2 text-sm text-muted-foreground">
        Trạng thái chuyến:{' '}
        {tripStatus ? <Badge variant={tripStatus.variant}>{tripStatus.label}</Badge> : <span>—</span>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={handleDepart}
          disabled={busy || status === 'departed' || status === 'completed' || status === 'cancelled'}
          data-testid="depart-btn"
        >
          Đánh dấu khởi hành
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleComplete}
          disabled={busy || status === 'completed' || status === 'cancelled'}
          data-testid="complete-btn"
        >
          Đánh dấu hoàn thành
        </Button>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTab value="queue" data-testid="tab-queue">
            Hàng đợi
          </TabsTab>
          <TabsTab value="manifest" data-testid="tab-manifest">
            Manifest
          </TabsTab>
        </TabsList>

        {/* Queue panel */}
        <TabsPanel value="queue" data-testid="queue-panel" className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshQueue}
            disabled={loading}
            data-testid="queue-refresh-btn"
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </Button>
          {queueRows.length === 0 ? (
            <Card>
              <CardContent>
                <p className="py-6 text-center text-sm text-muted-foreground">Không có đặt vé nào.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table data-testid="staff-queue-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đặt</TableHead>
                    <TableHead>Hành khách</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Vé</TableHead>
                    <TableHead>Liên lạc</TableHead>
                    <TableHead>Điểm đón</TableHead>
                    <TableHead>TT thanh toán</TableHead>
                    <TableHead>Cờ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRows.map((row) => {
                    const contact = contactDisplay(row.contactStatus);
                    const payment = bookingStatusDisplay(row.paymentStatus as BookingStatus);
                    return (
                      <TableRow
                        key={row.id}
                        data-testid={`staff-booking-row-${row.id}`}
                        className={row.escalatedAt ? 'bg-warning/10' : undefined}
                      >
                        <TableCell>
                          <a className="text-primary underline-offset-2 hover:underline" href={`/op/bookings/${row.id}`}>
                            {row.bookingRef}
                          </a>
                        </TableCell>
                        <TableCell>{row.buyerName}</TableCell>
                        <TableCell>{row.buyerPhone}</TableCell>
                        <TableCell className="tabular-nums">{row.ticketCount}</TableCell>
                        <TableCell>
                          <Badge variant={contact.variant}>{contact.label}</Badge>
                        </TableCell>
                        <TableCell>{row.pickupPointName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={payment.variant}>{payment.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <FlagIcons
                            manualFlag={row.manualFlag}
                            escalatedAt={row.escalatedAt}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsPanel>

        {/* Manifest panel — AC6: NO seat-number column */}
        <TabsPanel value="manifest" data-testid="manifest-panel" className="space-y-3">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshManifest}
              disabled={loading}
              data-testid="manifest-refresh-btn"
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </Button>
            <span data-testid="manifest-last-updated" className="text-sm text-muted-foreground">
              Cập nhật lần cuối:{' '}
              {generatedAt ? new Date(generatedAt).toLocaleString('vi-VN') : '—'}
            </span>
          </div>
          {manifestRows.length === 0 ? (
            <Card>
              <CardContent>
                <p className="py-6 text-center text-sm text-muted-foreground">Không có hành khách nào.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table data-testid="staff-manifest-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đặt</TableHead>
                    <TableHead>Hành khách</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Vé</TableHead>
                    <TableHead>Điểm đón</TableHead>
                    <TableHead>Liên lạc</TableHead>
                    <TableHead>TT thanh toán</TableHead>
                    <TableHead>Lên xe</TableHead>
                    <TableHead>Cờ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifestRows.map((row) => {
                    const contact = contactDisplay(row.contactStatus);
                    const payment = bookingStatusDisplay(row.paymentStatus as BookingStatus);
                    return (
                      <TableRow
                        key={row.bookingId}
                        data-testid={`staff-manifest-row-${row.bookingId}`}
                        className={row.escalatedAt ? 'bg-warning/10' : undefined}
                      >
                        <TableCell>{row.bookingRef}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell className="tabular-nums">{row.ticketCount}</TableCell>
                        <TableCell>{row.pickupPointName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={contact.variant}>{contact.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.variant}>{payment.label}</Badge>
                        </TableCell>
                        <TableCell>{row.pickedUpAt ? '✓' : '—'}</TableCell>
                        <TableCell>
                          <FlagIcons
                            manualFlag={row.manualFlag}
                            escalatedAt={row.escalatedAt}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsPanel>
      </Tabs>
    </div>
  );
}
