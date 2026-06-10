'use client';

/**
 * PickupAreasClient — operator pickup-point menu management (Issue 105 + named points).
 *
 * A pickup point = a named stop (name + optional address line) inside a ward chosen via the
 * cascading AdminUnitPicker. Create, edit (name/address), and soft-deactivate. Mutations go
 * through lib/api/pickupAreasClient.ts (CSRF double-submit). Historical bookings keep their
 * snapshot, so deactivate (never hard-delete) and edits do not rewrite past snapshots.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listPickupAreasApi,
  createPickupAreaApi,
  updatePickupAreaApi,
  deactivatePickupAreaApi,
  type PickupAreaItem,
} from '@/lib/api';
import { AdminUnitPicker, type AdminUnitValue } from '@/components/geo/AdminUnitPicker';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

type PickupKindValue = 'station' | 'pickup';

const KIND_LABELS: Record<PickupKindValue, string> = {
  station: 'Bến xe',
  pickup: 'Đón tận nơi',
};

const KIND_BADGE_VARIANT: Record<PickupKindValue, 'success' | 'pending'> = {
  station: 'success',
  pickup: 'pending',
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_area: 'Khu vực không hợp lệ. Vui lòng chọn lại.',
  duplicate_area: 'Điểm đón trùng tên trong khu vực này.',
  invalid_input: 'Vui lòng nhập tên điểm và chọn đầy đủ tỉnh, huyện, xã.',
  not_found: 'Không tìm thấy điểm đón.',
  already_inactive: 'Điểm đón đã được vô hiệu hoá.',
};

function errorText(e: unknown): string {
  const code = (e as { data?: { error?: string } })?.data?.error;
  return (code && ERROR_MESSAGES[code]) || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function PickupAreasClient({ initialAreas }: { initialAreas: PickupAreaItem[] }) {
  const router = useRouter();
  const [areas, setAreas] = useState<PickupAreaItem[]>(initialAreas);
  const [sel, setSel] = useState<AdminUnitValue>({});
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  // Issue 110: default to station — most VN menu entries are bến xe (QA P3.1).
  const [kind, setKind] = useState<PickupKindValue>('station');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editKind, setEditKind] = useState<PickupKindValue>('station');

  async function refresh() {
    const { areas: fresh } = await listPickupAreasApi();
    setAreas(fresh);
  }

  async function handleAdd() {
    if (!sel.provinceCode || !sel.districtCode || !sel.wardCode || name.trim().length < 2) {
      setError(ERROR_MESSAGES.invalid_input);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPickupAreaApi({
        provinceCode: sel.provinceCode,
        districtCode: sel.districtCode,
        wardCode: sel.wardCode,
        name: name.trim(),
        addressLine: addressLine.trim() || undefined,
        kind,
      });
      setSel({});
      setName('');
      setAddressLine('');
      setKind('station');
      await refresh();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(a: PickupAreaItem) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditAddress(a.addressLine ?? '');
    setEditKind(a.kind);
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editingId || editName.trim().length < 2) {
      setError(ERROR_MESSAGES.invalid_input);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { area } = await updatePickupAreaApi(editingId, {
        name: editName.trim(),
        addressLine: editAddress.trim() || undefined,
        kind: editKind,
      });
      setAreas((prev) => prev.map((a) => (a.id === area.id ? area : a)));
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deactivatePickupAreaApi(id);
      setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: false } : a)));
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="error" data-testid="pickup-area-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Thêm điểm đón
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pickup-name">Tên điểm đón</Label>
            <Input
              id="pickup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Bến xe Mỹ Đình, Văn phòng Cầu Giấy"
              disabled={busy}
              data-testid="pickup-area-name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pickup-address">Địa chỉ / mốc (tuỳ chọn)</Label>
            <Input
              id="pickup-address"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="VD: 12 Phạm Hùng, cạnh cây xăng"
              disabled={busy}
              data-testid="pickup-area-address"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pickup-kind">Loại điểm đón</Label>
            <Select
              value={kind}
              onValueChange={(v: string | null) => setKind((v as PickupKindValue) ?? 'station')}
            >
              <SelectTrigger id="pickup-kind" data-testid="pickup-area-kind" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="station">Bến xe</SelectItem>
                <SelectItem value="pickup">Đón tận nơi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Bến xe: khách tự ra bến. Đón tận nơi: xe ghé đón.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Khu vực (tỉnh / huyện / xã)</Label>
            <AdminUnitPicker value={sel} onChange={(v) => setSel(v)} level="ward" disabled={busy} />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={busy || !sel.wardCode || name.trim().length < 2}
            data-testid="pickup-area-add"
            className="self-start"
          >
            {busy ? 'Đang lưu...' : 'Thêm điểm đón'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Danh sách điểm đón ({areas.filter((a) => a.isActive).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có điểm đón nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Điểm đón</TableHead>
                  <TableHead>Khu vực</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((a) => (
                  <TableRow key={a.id} data-testid={`pickup-area-row-${a.id}`}>
                    <TableCell>
                      {editingId === a.id ? (
                        <div className="flex flex-col gap-1.5">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={busy}
                            data-testid={`pickup-area-edit-name-${a.id}`}
                          />
                          <Input
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            placeholder="Địa chỉ / mốc (tuỳ chọn)"
                            disabled={busy}
                            data-testid={`pickup-area-edit-address-${a.id}`}
                          />
                          <Select
                            value={editKind}
                            onValueChange={(v: string | null) =>
                              setEditKind((v as PickupKindValue) ?? 'station')
                            }
                          >
                            <SelectTrigger
                              data-testid={`pickup-area-edit-kind-${a.id}`}
                              className="max-w-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="station">Bến xe</SelectItem>
                              <SelectItem value="pickup">Đón tận nơi</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.name}</span>
                            <Badge
                              variant={KIND_BADGE_VARIANT[a.kind]}
                              data-testid={`pickup-area-kind-badge-${a.id}`}
                            >
                              {KIND_LABELS[a.kind]}
                            </Badge>
                          </div>
                          {a.addressLine && (
                            <div className="text-sm text-muted-foreground">{a.addressLine}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.label}</TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? 'success' : 'neutral'}>
                        {a.isActive ? 'Đang dùng' : 'Đã tắt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === a.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={busy}
                            data-testid={`pickup-area-save-${a.id}`}
                          >
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            disabled={busy}
                          >
                            Huỷ
                          </Button>
                        </div>
                      ) : (
                        a.isActive && (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(a)}
                              disabled={busy}
                              data-testid={`pickup-area-edit-${a.id}`}
                            >
                              Sửa
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeactivate(a.id)}
                              disabled={busy}
                              data-testid={`pickup-area-deactivate-${a.id}`}
                            >
                              Vô hiệu hoá
                            </Button>
                          </div>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
