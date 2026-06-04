'use client';

/**
 * TripDetailClient — client island for single trip detail/actions (Issue 013).
 *
 * Actions: reassign bus, sales-toggle, cancel, assign staff (admin),
 * depart/complete lifecycle. All mutations use X-CSRF-Token via tripsClient.ts.
 *
 * Design-system surface: Card sections, Badge trip status (statusLabels),
 * Label/Input/Select/Button forms, Alert messages, Dialog-based cancel
 * (≥10-char reason) via CancelTripDialog. Every data-testid is preserved
 * (sandbox-gated e2e keys off them).
 */

import { useState } from 'react';
import type { TripDto } from '@/lib/trips/tripDto';
import type { StaffDto } from '@/lib/staff';
import type { TripStatus } from '@prisma/client';
import {
  reassignBusApi,
  cancelTripApi,
  salesToggleApi,
  departTripApi,
  completeTripApi,
} from '@/lib/api';
import { assignServiceApi } from '@/lib/api';
import { tripStatusDisplay } from '@/lib/op/statusLabels';
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
import CancelTripDialog from '../CancelTripDialog';

interface Props {
  trip: TripDto;
  staff: StaffDto[];
  isAdmin: boolean;
}

function translateError(code: string): string {
  switch (code) {
    case 'bus_deactivated': return 'Xe đã bị vô hiệu hoá';
    case 'bus_in_maintenance': return 'Xe đang bảo trì';
    case 'already_cancelled': return 'Chuyến đã bị huỷ';
    case 'trip_cancelled': return 'Chuyến đã bị huỷ';
    case 'capacity_too_small': return 'Xe mới không đủ chỗ cho đặt vé hiện tại';
    case 'bus_overlap_with_outbound': return 'Xe bận chuyến khác cùng giờ';
    case 'trip_not_found': return 'Không tìm thấy chuyến';
    case 'trip_not_assignable': return 'Chuyến không thể gán (đã huỷ/khởi hành/hoàn tất)';
    case 'trip_not_bookable': return 'Chuyến không nhận đặt vé';
    case 'sold_out': return 'Hết chỗ';
    case 'feature_disabled': return 'Tính năng tạm tắt';
    case 'validation_failed': return 'Dữ liệu không hợp lệ';
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    case 'ref_collision': return 'Trùng mã đặt, vui lòng thử lại';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function TripDetailClient({ trip: initialTrip, staff: initialStaff, isAdmin }: Props) {
  const [trip, setTrip] = useState<TripDto>(initialTrip);
  const [staff, setStaff] = useState<StaffDto[]>(initialStaff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [isError, setIsError] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Assign staff to this trip
  const [assignStaffId, setAssignStaffId] = useState('');

  // Reassign bus
  const [newBusId, setNewBusId] = useState('');

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(err: unknown) {
    const data = (err as { data?: { error?: string } }).data;
    setMessage(translateError(data?.error ?? ''));
    setIsError(true);
  }

  async function handleReassignBus() {
    if (!newBusId.trim()) {
      setMessage('Nhập ID xe mới.');
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await reassignBusApi(trip.id, newBusId.trim());
      setTrip(res.trip);
      setNewBusId('');
      ok('Đã đổi xe.');
    } catch (err) {
      const data = (err as { data?: { error?: string; required?: number; provided?: number } }).data;
      if (data?.error === 'capacity_too_small') {
        setMessage(`Xe mới không đủ chỗ: cần ${data.required}, xe có ${data.provided}.`);
        setIsError(true);
      } else {
        fail(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSalesToggle() {
    setBusy(true);
    setMessage('');
    try {
      const res = await salesToggleApi(trip.id, !trip.salesClosed);
      setTrip(res.trip);
      ok(res.trip.salesClosed ? 'Đã đóng bán vé.' : 'Đã mở bán vé.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm(reason: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await cancelTripApi(trip.id, reason);
      ok(
        `Đã huỷ chuyến. Đặt vé bị huỷ: ${result.cancelledBookings}. Giữ chỗ bị huỷ: ${result.cancelledHolds}. SMS: ${result.notificationsEnqueued}.`
      );
      setTrip({ ...trip, status: 'cancelled' });
      setShowCancel(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDepart() {
    setBusy(true);
    setMessage('');
    try {
      const res = await departTripApi(trip.id);
      setTrip(res.trip);
      ok(res.alreadyDeparted ? 'Chuyến đã khởi hành trước đó.' : 'Đã đánh dấu khởi hành.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    setMessage('');
    try {
      const res = await completeTripApi(trip.id);
      setTrip(res.trip);
      ok(
        res.alreadyCompleted
          ? 'Chuyến đã hoàn tất trước đó.'
          : `Đã hoàn tất chuyến. Thanh toán xếp lịch: ${res.payoutJobsEnqueued}.`
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignService() {
    if (!assignStaffId) {
      setMessage('Chọn nhân viên để gán.');
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await assignServiceApi(assignStaffId, trip.id);
      setStaff((prev) =>
        prev.map((m) =>
          m.id === res.staff.id
            ? res.staff
            : m.assignedTripId === trip.id
              ? { ...m, assignedTripId: null }
              : m
        )
      );
      ok(`Đã gán ${res.staff.displayName} cho chuyến này.`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const cancelled = trip.status === 'cancelled';
  const canDepart = trip.status === 'scheduled';
  const canComplete = trip.status === 'departed';
  const assignedStaff = staff.find((m) => m.assignedTripId === trip.id);
  const status = tripStatusDisplay(trip.status as TripStatus, trip.salesClosed);

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="trip-detail-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Trip summary */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin chuyến</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">ID</dt>
            <dd data-testid="trip-id" className="font-mono break-all">{trip.id}</dd>
            <dt className="text-muted-foreground">Tuyến</dt>
            <dd className="font-mono">{trip.routeId}</dd>
            <dt className="text-muted-foreground">Xe</dt>
            <dd className="font-mono">{trip.busId}</dd>
            <dt className="text-muted-foreground">Khởi hành</dt>
            <dd className="tabular-nums">{new Date(trip.departureAt).toLocaleString('vi-VN')}</dd>
            <dt className="text-muted-foreground">Giá</dt>
            <dd className="tabular-nums">{trip.price?.toLocaleString('vi-VN')}đ</dd>
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd data-testid="trip-status">
              <Badge variant={status.variant}>{status.label}</Badge>
            </dd>
            <dt className="text-muted-foreground">Đóng bán</dt>
            <dd>{trip.salesClosed ? 'Có' : 'Không'}</dd>
            <dt className="text-muted-foreground">Ghế còn</dt>
            <dd data-testid="trip-available" className="tabular-nums">{trip.availableSeats}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Lifecycle: depart (scheduled) / complete (departed) — stories 53/54 */}
      {(canDepart || canComplete) && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Vòng đời chuyến</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {canDepart && (
                <Button
                  type="button"
                  onClick={handleDepart}
                  disabled={busy}
                  data-testid="depart-trip-btn"
                >
                  Đánh dấu khởi hành
                </Button>
              )}
              {canComplete && (
                <Button
                  type="button"
                  onClick={handleComplete}
                  disabled={busy}
                  data-testid="complete-trip-btn"
                >
                  Đánh dấu hoàn tất
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!cancelled && (
        <>
          {/* Reassign bus */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Đổi xe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="reassign-bus-input">ID xe mới</Label>
                  <Input
                    id="reassign-bus-input"
                    type="text"
                    value={newBusId}
                    onChange={(e) => setNewBusId(e.target.value)}
                    placeholder="ID xe mới"
                    data-testid="reassign-bus-input"
                    className="max-w-xs"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleReassignBus}
                  disabled={busy}
                  data-testid="reassign-bus-submit"
                >
                  Đổi xe
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales toggle */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Bán vé</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={handleSalesToggle}
                disabled={busy}
                data-testid="sales-toggle-btn"
              >
                {trip.salesClosed ? 'Mở bán vé' : 'Đóng bán vé'}
              </Button>
            </CardContent>
          </Card>

          {/* Assign staff to service */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Gán nhân viên phục vụ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Nhân viên hiện tại: {assignedStaff ? assignedStaff.displayName : '—'}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-1.5">
                    <Label>Nhân viên</Label>
                    {/* base-ui Select: onValueChange, NOT onChange. */}
                    <Select
                      value={assignStaffId}
                      onValueChange={(value: string | null) => setAssignStaffId(value ?? '')}
                    >
                      <SelectTrigger
                        data-testid="assign-staff-select"
                        className="min-w-60"
                      >
                        <SelectValue placeholder="— Chọn nhân viên —" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff
                          .filter((m) => !m.disabled)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.displayName}
                              {m.assignedTripId && m.assignedTripId !== trip.id
                                ? ' (đang gán chuyến khác)'
                                : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAssignService}
                    disabled={busy}
                    data-testid="assign-staff-submit"
                  >
                    Gán nhân viên
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancel */}
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle as="h2" className="text-destructive">Huỷ chuyến</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowCancel(true)}
                disabled={busy}
                data-testid="cancel-trip-btn"
              >
                Huỷ chuyến
              </Button>
            </CardContent>
          </Card>

          {showCancel && (
            <CancelTripDialog
              onConfirm={handleCancelConfirm}
              onClose={() => setShowCancel(false)}
              disabled={busy}
            />
          )}
        </>
      )}
    </div>
  );
}
