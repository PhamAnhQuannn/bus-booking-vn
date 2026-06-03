'use client';

/**
 * DashboardClient — operator booking queue client island (Issue 014 AC2).
 *
 * Reference surface for the design-system migration: Card filter band +
 * Label/Input/Select, Table queue, accessible Badge contact/flag chips,
 * Load-more Button with aria-live status. Every data-testid is preserved
 * (sandbox-gated e2e keys off them).
 *
 * Reads via listBookingsApi (GET, no CSRF token). base-ui Select is controlled
 * with onValueChange, NOT onChange.
 */

import { useState } from 'react';
import Link from 'next/link';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';
import { listBookingsApi } from '@/lib/api/bookingsClient';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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
import { bookingStatusDisplay, contactStatusDisplay } from '@/lib/op/statusLabels';
import type { BookingStatus } from '@prisma/client';

interface Props {
  initialRows: BookingQueueRow[];
  initialNextCursor: string | null;
  operatorId: string;
  /** Default service-date filter (VN-local YYYY-MM-DD) the server pre-filtered on. */
  initialServiceDate?: string;
}

const CONTACT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chưa gọi' },
  { value: 'reached', label: 'Đã liên lạc' },
  { value: 'no_answer', label: 'Không bắt máy' },
  { value: 'callback', label: 'Gọi lại sau' },
];

const ALL = '__all__';

export default function DashboardClient({
  initialRows,
  initialNextCursor,
  initialServiceDate = '',
}: Props) {
  const [rows, setRows] = useState<BookingQueueRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [busId, setBusId] = useState('');
  // Seed from the server's default (today VN-tz) so the visible filter chip matches
  // the pre-filtered rows. Clearing it and re-filtering returns all-time results.
  const [serviceDate, setServiceDate] = useState(initialServiceDate);
  const [routeId, setRouteId] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function fetchBookings(params: Record<string, string>, append = false) {
    setLoading(true);
    setMessage('');
    try {
      const result = await listBookingsApi(params);
      setRows((prev) => (append ? [...prev, ...result.rows] : result.rows));
      setNextCursor(result.nextCursor);
    } catch {
      setMessage('Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    fetchBookings({ busId, serviceDate, routeId, contactStatus });
  }

  function handleLoadMore() {
    if (!nextCursor) return;
    fetchBookings({ busId, serviceDate, routeId, contactStatus, cursor: nextCursor }, true);
  }

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant="error" data-testid="dashboard-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent>
          <form
            onSubmit={handleFilter}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="filter-bus-id">ID xe buýt</Label>
              <Input
                id="filter-bus-id"
                placeholder="ID xe buýt"
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                data-testid="filter-bus-id"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-service-date">Ngày đi</Label>
              <DatePicker
                id="filter-service-date"
                value={serviceDate}
                onValueChange={setServiceDate}
                placeholder="Mọi ngày"
                data-testid="filter-service-date"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-route-id">ID tuyến</Label>
              <Input
                id="filter-route-id"
                placeholder="ID tuyến"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                data-testid="filter-route-id"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Trạng thái liên lạc</Label>
              <Select
                value={contactStatus === '' ? ALL : contactStatus}
                onValueChange={(v: string | null) => setContactStatus(v === ALL || v == null ? '' : v)}
              >
                <SelectTrigger data-testid="filter-contact-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả trạng thái liên lạc</SelectItem>
                  {CONTACT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={loading} data-testid="filter-submit">
                {loading ? 'Đang lọc...' : 'Lọc'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có đặt vé nào.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table data-testid="booking-queue-table">
            <TableHeader>
              <TableRow>
                <TableHead>Mã đặt</TableHead>
                <TableHead>Hành khách</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Vé</TableHead>
                <TableHead>Liên lạc</TableHead>
                <TableHead>Điểm đón</TableHead>
                <TableHead>TT thanh toán</TableHead>
                <TableHead>Khởi hành</TableHead>
                <TableHead>Cờ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const pay = bookingStatusDisplay(row.paymentStatus as BookingStatus);
                return (
                  <TableRow
                    key={row.id}
                    data-testid={`booking-row-${row.id}`}
                    className={row.escalatedAt ? 'bg-warning/40' : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/op/bookings/${row.id}`}
                        data-testid={`booking-detail-${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.bookingRef}
                      </Link>
                    </TableCell>
                    <TableCell>{row.buyerName}</TableCell>
                    <TableCell className="tabular-nums">{row.buyerPhone}</TableCell>
                    <TableCell className="tabular-nums">{row.ticketCount}</TableCell>
                    <TableCell>
                      <Badge variant={contactStatusDisplay(row.contactStatus).variant}>
                        {contactStatusDisplay(row.contactStatus).label}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.pickupPointName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={pay.variant}>{pay.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Date(row.departureAt).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {row.manualFlag && (
                          <Badge variant="neutral" aria-label="Thủ công" title="Thủ công">
                            ✏
                          </Badge>
                        )}
                        {row.escalatedAt && (
                          <Badge variant="danger" aria-label="Cần xử lý" title="Cần xử lý">
                            ⚠
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <div aria-live="polite" className="sr-only">
        {loading ? 'Đang tải đặt vé' : `${rows.length} đặt vé`}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={loading}
            data-testid="load-more-btn"
          >
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </Button>
        </div>
      )}
    </div>
  );
}
