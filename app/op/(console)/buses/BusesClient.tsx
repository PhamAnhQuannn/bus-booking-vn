'use client';

/**
 * BusesClient — client island for operator fleet management (Issue 011).
 *
 * Mutations go through lib/api/busesClient.ts (CSRF double-submit). The client
 * throws { status, data } on failure; this island maps data.error → a localized
 * Vietnamese message (and reads violatingTrips / tripIds / conflictingTrips off
 * data when present).
 *
 * UI: Card add-bus form (Label/Input/Select), Table fleet list with per-row
 * capacity edit + deactivate + maintenance expander + detail-page link. Every
 * data-testid preserved (sandbox-gated e2e keys off them).
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  listBusesApi,
  getBusApi,
  createBusApi,
  patchCapacityApi,
  deactivateBusApi,
  addMaintenanceApi,
  deleteMaintenanceApi,
  type MaintenanceWindow,
} from '@/lib/api';
import type { OperatorBusListItem } from '@/lib/catalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/op/ConfirmDialog';
import { busTypeLabel } from '@/lib/op/statusLabels';
import type { BusType } from '@prisma/client';

interface Props {
  initialBuses: OperatorBusListItem[];
}

interface ApiError {
  status?: number;
  data?: {
    error?: string;
    violatingTrips?: { tripId: string; occupancy: number }[];
    tripIds?: string[];
  } | null;
}

function translateError(code: string): string {
  switch (code) {
    case 'plate_in_use': return 'Biển số đã tồn tại';
    case 'capacity_reduction_blocked': return 'Không thể giảm sức chứa: có chuyến đã vượt mức';
    case 'future_trips_assigned': return 'Còn chuyến tương lai gắn xe này';
    case 'maintenance_overlap': return 'Khung bảo trì trùng lặp';
    case 'reactivation_not_supported': return 'Không hỗ trợ kích hoạt lại';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function BusesClient({ initialBuses }: Props) {
  const [buses, setBuses] = useState<OperatorBusListItem[]>(initialBuses);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [isError, setIsError] = useState(false);
  // PR 3: ConfirmDialog replaces window.confirm for destructive actions.
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);
  const [pendingMaintDelete, setPendingMaintDelete] = useState<{ busId: string; mid: string } | null>(null);

  // Add-bus form state
  const [newPlate, setNewPlate] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(30);
  const [newBusType, setNewBusType] = useState<BusType>('coach');

  // Expanded-bus state for maintenance panel
  const [expandedBusId, setExpandedBusId] = useState<string | null>(null);
  const [maintenanceByBus, setMaintenanceByBus] = useState<Record<string, MaintenanceWindow[]>>({});

  function ok(msg: string) {
    setMessage(msg);
    setIsError(false);
  }
  function fail(msg: string) {
    setMessage(msg);
    setIsError(true);
  }

  async function refreshBuses() {
    try {
      const json = await listBusesApi(true);
      setBuses(json.buses ?? []);
    } catch {
      /* leave existing list on refresh failure */
    }
  }

  async function loadMaintenance(busId: string) {
    try {
      const json = await getBusApi(busId);
      setMaintenanceByBus((s) => ({ ...s, [busId]: json.bus?.maintenances ?? [] }));
    } catch {
      /* ignore */
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await createBusApi({ licensePlate: newPlate, capacity: newCapacity, busType: newBusType });
      ok('Đã thêm xe.');
      setNewPlate('');
      setNewCapacity(30);
      setNewBusType('coach');
      await refreshBuses();
    } catch (e) {
      fail(translateError((e as ApiError).data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchCapacity(busId: string, capacity: number) {
    setBusy(true);
    setMessage('');
    try {
      await patchCapacityApi(busId, capacity);
      ok('Đã cập nhật.');
      await refreshBuses();
    } catch (e) {
      const data = (e as ApiError).data;
      if (data?.error === 'capacity_reduction_blocked' && Array.isArray(data.violatingTrips)) {
        const trips = data.violatingTrips.map((t) => `${t.tripId} (${t.occupancy} chỗ)`).join(', ');
        fail(`Không thể giảm sức chứa: ${trips}`);
      } else {
        fail(translateError(data?.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(busId: string) {
    setBusy(true);
    setMessage('');
    try {
      await deactivateBusApi(busId);
      ok('Đã vô hiệu hoá xe.');
      await refreshBuses();
    } catch (e) {
      const data = (e as ApiError).data;
      if (data?.error === 'future_trips_assigned' && Array.isArray(data.tripIds)) {
        fail(`Còn chuyến tương lai gắn xe này: ${data.tripIds.join(', ')}`);
      } else {
        fail(translateError(data?.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleExpand(busId: string) {
    if (expandedBusId === busId) {
      setExpandedBusId(null);
      return;
    }
    setExpandedBusId(busId);
    if (!maintenanceByBus[busId]) {
      await loadMaintenance(busId);
    }
  }

  async function handleAddMaintenance(busId: string, startAt: string, endAt: string, reason: string) {
    setBusy(true);
    setMessage('');
    try {
      const json = await addMaintenanceApi(busId, {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason || undefined,
      });
      const conflicts = Array.isArray(json.conflictingTrips) ? json.conflictingTrips : [];
      if (conflicts.length > 0) {
        ok(
          `Đã thêm khung bảo trì. Cảnh báo: ${conflicts.length} chuyến chồng lấn (${conflicts.map((c) => c.tripId).join(', ')}).`
        );
      } else {
        ok('Đã thêm khung bảo trì.');
      }
      await loadMaintenance(busId);
    } catch (e) {
      fail(translateError((e as ApiError).data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMaintenance(busId: string, mid: string) {
    setBusy(true);
    setMessage('');
    try {
      await deleteMaintenanceApi(busId, mid);
      ok('Đã xoá khung bảo trì.');
      await loadMaintenance(busId);
    } catch (e) {
      fail(translateError((e as ApiError).data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="fleet-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Add-bus form */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thêm xe mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-plate">Biển số</Label>
              <Input
                id="new-plate"
                type="text"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                required
                minLength={6}
                maxLength={11}
                data-testid="new-plate"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-capacity">Sức chứa</Label>
              <Input
                id="new-capacity"
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(parseInt(e.target.value, 10))}
                min={1}
                max={80}
                required
                data-testid="new-capacity"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Loại xe</Label>
              <Select
                value={newBusType}
                onValueChange={(v: string | null) => v && setNewBusType(v as BusType)}
              >
                <SelectTrigger data-testid="new-bustype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Xe ghế ngồi</SelectItem>
                  <SelectItem value="sleeper">Xe giường nằm</SelectItem>
                  <SelectItem value="limousine">Xe Limousine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button type="submit" disabled={busy} data-testid="add-bus-submit">
                {busy ? 'Đang xử lý...' : 'Thêm xe'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bus list */}
      <Card className="overflow-hidden py-0">
        <CardHeader className="px-4 pt-4">
          <CardTitle as="h2">Danh sách xe ({buses.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {buses.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Chưa có xe nào.</p>
          ) : (
            <Table data-testid="buses-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Biển số</TableHead>
                  <TableHead>Sức chứa</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.map((bus) => (
                  <RowGroup
                    key={bus.id}
                    bus={bus}
                    expanded={expandedBusId === bus.id}
                    maintenance={maintenanceByBus[bus.id] ?? []}
                    onToggle={() => handleToggleExpand(bus.id)}
                    onPatchCapacity={(cap) => handlePatchCapacity(bus.id, cap)}
                    onDeactivate={() => setPendingDeactivate(bus.id)}
                    onAddMaintenance={(s, e, r) => handleAddMaintenance(bus.id, s, e, r)}
                    onDeleteMaintenance={(mid) => setPendingMaintDelete({ busId: bus.id, mid })}
                    disabled={busy}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={async () => {
          const id = pendingDeactivate;
          setPendingDeactivate(null);
          if (id) await handleDeactivate(id);
        }}
        title="Vô hiệu hoá xe?"
        description="Hành động không thể hoàn tác."
        consequences={[
          'Xe sẽ không xuất hiện trong danh sách hoạt động.',
          'Không thể gắn xe vào chuyến mới.',
          'Phải không còn chuyến tương lai gắn xe này (nếu còn, thao tác sẽ bị chặn).',
        ]}
        confirmLabel="Vô hiệu hoá"
        destructive
        busy={busy}
      />

      <ConfirmDialog
        open={pendingMaintDelete !== null}
        onClose={() => setPendingMaintDelete(null)}
        onConfirm={async () => {
          const target = pendingMaintDelete;
          setPendingMaintDelete(null);
          if (target) await handleDeleteMaintenance(target.busId, target.mid);
        }}
        title="Xoá khung bảo trì?"
        description="Khung bảo trì sẽ bị xoá vĩnh viễn."
        confirmLabel="Xoá"
        destructive
        busy={busy}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row sub-component
// ---------------------------------------------------------------------------

interface RowProps {
  bus: OperatorBusListItem;
  expanded: boolean;
  maintenance: MaintenanceWindow[];
  onToggle: () => void;
  onPatchCapacity: (capacity: number) => Promise<void>;
  onDeactivate: () => void;
  onAddMaintenance: (startAt: string, endAt: string, reason: string) => Promise<void>;
  onDeleteMaintenance: (mid: string) => void;
  disabled: boolean;
}

function RowGroup({
  bus,
  expanded,
  maintenance,
  onToggle,
  onPatchCapacity,
  onDeactivate,
  onAddMaintenance,
  onDeleteMaintenance,
  disabled,
}: RowProps) {
  const [editCapacity, setEditCapacity] = useState<number>(bus.capacity);
  const [mStart, setMStart] = useState('');
  const [mEnd, setMEnd] = useState('');
  const [mReason, setMReason] = useState('');

  return (
    <>
      <TableRow data-testid={`bus-row-${bus.id}`}>
        <TableCell data-testid={`bus-plate-${bus.id}`} className="font-medium">
          <Link
            href={`/op/buses/${bus.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {bus.licensePlate}
          </Link>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={editCapacity}
              onChange={(e) => setEditCapacity(parseInt(e.target.value, 10))}
              min={1}
              max={80}
              data-testid={`bus-capacity-${bus.id}`}
              className="w-20"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onPatchCapacity(editCapacity)}
              disabled={disabled || editCapacity === bus.capacity}
              data-testid={`bus-save-${bus.id}`}
            >
              Lưu
            </Button>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="neutral">{busTypeLabel(bus.busType)}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/op/buses/${bus.id}`}
              data-testid={`bus-detail-${bus.id}`}
              className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Chi tiết
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onToggle}
              data-testid={`bus-toggle-${bus.id}`}
              aria-expanded={expanded}
            >
              {expanded ? 'Đóng' : 'Bảo trì'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDeactivate}
              disabled={disabled}
              data-testid={`bus-deactivate-${bus.id}`}
            >
              Vô hiệu hoá
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/40">
            <div className="space-y-3 p-2">
              <h3 className="text-sm font-semibold">Khung bảo trì</h3>
              {maintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có khung bảo trì.</p>
              ) : (
                <ul className="space-y-1.5">
                  {maintenance.map((m) => (
                    <li
                      key={m.id}
                      data-testid={`maintenance-${m.id}`}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="tabular-nums">
                        {new Date(m.startAt).toLocaleString('vi-VN')} →{' '}
                        {new Date(m.endAt).toLocaleString('vi-VN')}
                      </span>
                      {m.reason ? <span className="text-muted-foreground">— {m.reason}</span> : null}
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => onDeleteMaintenance(m.id)}
                        disabled={disabled}
                        data-testid={`maintenance-delete-${m.id}`}
                      >
                        Xoá
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid max-w-md gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor={`maintenance-start-${bus.id}`}>Bắt đầu</Label>
                  <Input
                    id={`maintenance-start-${bus.id}`}
                    type="datetime-local"
                    value={mStart}
                    onChange={(e) => setMStart(e.target.value)}
                    data-testid={`maintenance-start-${bus.id}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`maintenance-end-${bus.id}`}>Kết thúc</Label>
                  <Input
                    id={`maintenance-end-${bus.id}`}
                    type="datetime-local"
                    value={mEnd}
                    onChange={(e) => setMEnd(e.target.value)}
                    data-testid={`maintenance-end-${bus.id}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`maintenance-reason-${bus.id}`}>Lý do</Label>
                  <Input
                    id={`maintenance-reason-${bus.id}`}
                    type="text"
                    value={mReason}
                    onChange={(e) => setMReason(e.target.value)}
                    data-testid={`maintenance-reason-${bus.id}`}
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!mStart || !mEnd) return;
                      await onAddMaintenance(mStart, mEnd, mReason);
                      setMStart('');
                      setMEnd('');
                      setMReason('');
                    }}
                    disabled={disabled || !mStart || !mEnd}
                    data-testid={`maintenance-add-${bus.id}`}
                  >
                    Thêm khung
                  </Button>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
