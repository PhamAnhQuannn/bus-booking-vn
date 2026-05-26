'use client';

/**
 * BookingDetailClient — client island for /op/dashboard/[id] (Issue 014).
 *
 * Story 46: booking detail summary.
 * Story 47: record call outcome (reached/no_answer/callback). Pickup-point
 *           dropdown when the route has active points, free-text note otherwise.
 * Story 49: flag for escalation with a free-text note.
 *
 * Mutations carry X-CSRF-Token via bookingsClient.ts. base-ui Select uses
 * onValueChange, NOT onChange. Every data-testid is preserved (e2e keys off them).
 */

import { useState } from 'react';
import type { BookingDto } from '@/lib/booking/bookingDto';
import type { PickupPointOption } from '@/lib/booking/getBookingDetailPage';
import { recordCallOutcomeApi, recordEscalationApi } from '@/lib/api/bookingsClient';
import { bookingStatusDisplay } from '@/lib/op/statusLabels';
import type { BookingStatus } from '@prisma/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

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

const OUTCOME_OPTIONS = [
  { value: 'reached', label: 'Đã liên lạc' },
  { value: 'no_answer', label: 'Không bắt máy' },
  { value: 'callback', label: 'Gọi lại sau' },
] as const;

function translateError(code: string): string {
  switch (code) {
    case 'not_found': return 'Không tìm thấy đặt vé';
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    case 'validation_failed': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function BookingDetailClient({ booking: initial, pickupPoints }: Props) {
  const [booking, setBooking] = useState<BookingDto>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Call outcome
  const [outcome, setOutcome] = useState<'reached' | 'no_answer' | 'callback'>('reached');
  const [pickupPointId, setPickupPointId] = useState('');
  const [pickupNote, setPickupNote] = useState('');

  // Escalation
  const [escalationNote, setEscalationNote] = useState('');

  const hasPickupPoints = pickupPoints.length > 0;

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(err: unknown) {
    const data = (err as { data?: { error?: string } }).data;
    setMessage(translateError(data?.error ?? ''));
    setIsError(true);
  }

  async function handleCallOutcome() {
    setBusy(true);
    setMessage('');
    try {
      const body: {
        outcome: 'reached' | 'no_answer' | 'callback';
        pickupPointId?: string;
        pickupNote?: string;
      } = { outcome };
      if (hasPickupPoints) {
        if (pickupPointId) body.pickupPointId = pickupPointId;
      } else if (pickupNote.trim()) {
        body.pickupNote = pickupNote.trim();
      }
      const res = await recordCallOutcomeApi(booking.id, body);
      setBooking(res.booking);
      ok('Đã ghi nhận kết quả liên lạc.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleEscalate() {
    if (!escalationNote.trim()) {
      setMessage('Nhập nội dung cần xử lý.');
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await recordEscalationApi(booking.id, escalationNote.trim());
      setBooking(res.booking);
      setEscalationNote('');
      ok('Đã gắn cờ cần xử lý.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const pay = bookingStatusDisplay(booking.status as BookingStatus);

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="booking-detail-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

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

      {/* Record call outcome — story 47 */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Ghi nhận liên lạc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-sm gap-4">
            <div className="grid gap-1.5">
              <Label>Kết quả</Label>
              <Select
                value={outcome}
                onValueChange={(v: string | null) =>
                  setOutcome((v as 'reached' | 'no_answer' | 'callback') ?? 'reached')
                }
              >
                <SelectTrigger data-testid="call-outcome-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasPickupPoints ? (
              <div className="grid gap-1.5">
                <Label>Điểm đón</Label>
                <Select
                  value={pickupPointId === '' ? '__none__' : pickupPointId}
                  onValueChange={(v: string | null) =>
                    setPickupPointId(v === '__none__' || v == null ? '' : v)
                  }
                >
                  <SelectTrigger data-testid="pickup-point-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Chưa chọn —</SelectItem>
                    {pickupPoints.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="pickup-note-input">Ghi chú điểm đón</Label>
                <Input
                  id="pickup-note-input"
                  type="text"
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                  placeholder="Điểm đón (nhập tự do)"
                  maxLength={500}
                  data-testid="pickup-note-input"
                />
              </div>
            )}

            <div>
              <Button
                type="button"
                onClick={handleCallOutcome}
                disabled={busy}
                data-testid="call-outcome-submit"
              >
                Lưu kết quả
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escalation — story 49 */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle as="h2" className="text-destructive">Gắn cờ cần xử lý</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-sm gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="escalation-note-input">Nội dung</Label>
              <textarea
                id="escalation-note-input"
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Mô tả vấn đề cần xử lý"
                data-testid="escalation-note-input"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <Button
                type="button"
                variant="destructive"
                onClick={handleEscalate}
                disabled={busy}
                data-testid="escalation-submit"
              >
                Gắn cờ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
