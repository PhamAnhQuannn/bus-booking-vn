'use client';

/**
 * BookingDetailClient — client island for /op/dashboard/[id] (Issue 014).
 *
 * Story 46: booking detail summary (read-only).
 *
 * Online-only (Issue 039): the record-call-outcome (story 47) and escalation
 * (story 49) mutation cards were removed along with their routes. This island
 * is now a read-only detail view; the contact / pickup / escalation fields
 * still render for historical rows.
 *
 * Every data-testid is preserved (e2e keys off them).
 */

import type { BookingDto } from '@/lib/booking';
import type { PickupPointOption } from '@/lib/booking';
import { bookingStatusDisplay } from '@/lib/op';
import type { BookingStatus } from '@prisma/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  booking: BookingDto;
  pickupPoints: PickupPointOption[];
}

const CONTACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Chưa gọi',
  reached: 'Đã liên lạc',
  no_answer: 'Không bắt máy',
  callback: 'Gọi lại sau',
};

export default function BookingDetailClient({ booking, pickupPoints: _pickupPoints }: Props) {
  const pay = bookingStatusDisplay(booking.status as BookingStatus);

  return (
    <div className="space-y-6">
      {/* Booking summary — story 46 */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin đặt vé</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Mã đặt</dt>
            <dd data-testid="booking-ref" className="font-mono">{booking.bookingRef}</dd>
            <dt className="text-muted-foreground">Hành khách</dt>
            <dd>{booking.buyerName}</dd>
            <dt className="text-muted-foreground">SĐT</dt>
            <dd className="tabular-nums">{booking.buyerPhone}</dd>
            <dt className="text-muted-foreground">Tuyến</dt>
            <dd>{booking.trip.route.origin} → {booking.trip.route.destination}</dd>
            <dt className="text-muted-foreground">Xe</dt>
            <dd className="font-mono">{booking.trip.bus.licensePlate}</dd>
            <dt className="text-muted-foreground">Khởi hành</dt>
            <dd className="tabular-nums">{new Date(booking.trip.departureAt).toLocaleString('vi-VN')}</dd>
            <dt className="text-muted-foreground">Vé</dt>
            <dd className="tabular-nums">{booking.ticketCount}</dd>
            <dt className="text-muted-foreground">Tổng tiền</dt>
            <dd className="tabular-nums">{booking.totalVnd.toLocaleString('vi-VN')}đ</dd>
            <dt className="text-muted-foreground">TT thanh toán</dt>
            <dd data-testid="booking-status">
              <Badge variant={pay.variant}>{pay.label}</Badge>
            </dd>
            <dt className="text-muted-foreground">Liên lạc</dt>
            <dd data-testid="booking-contact-status">
              {CONTACT_STATUS_LABELS[booking.contactStatus] ?? booking.contactStatus}
            </dd>
            <dt className="text-muted-foreground">Điểm đón</dt>
            <dd>{booking.pickupPointName ?? booking.pickupNote ?? '—'}</dd>
            {booking.escalatedAt && (
              <>
                <dt className="text-muted-foreground">Cờ xử lý</dt>
                <dd data-testid="booking-escalation">
                  <Badge variant="danger">⚠ {booking.escalationNote}</Badge>
                </dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
