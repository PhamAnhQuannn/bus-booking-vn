'use client';

/**
 * RoutePickupAreaDialog — assign the operator's pickup-area menu to a route (Issue 113).
 *
 * On open, loads the operator's full active menu (listPickupAreasApi) and the route's
 * current assignments (getRoutePickupAreasApi), pre-checks the current set, and PUTs the
 * full replacement on Save. Pickup areas are route-scoped, so this controls exactly which
 * areas the new-trip picker offers for this route.
 *
 * Mirrors the new-trip picker's grouping (Bến xe / Đón tận nơi) + province filter.
 */

import { useEffect, useState } from 'react';
import {
  listPickupAreasApi,
  getRoutePickupAreasApi,
  setRoutePickupAreasApi,
  type PickupAreaItem,
} from '@/lib/api';
// lib/geo is pure + client-safe (static JSON; no server-only/pg).
import { getProvince } from '@/lib/geo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PROVINCE_ALL = '__all__';

const PICKUP_KIND_GROUPS: { kind: 'station' | 'pickup'; label: string }[] = [
  { kind: 'station', label: 'Bến xe' },
  { kind: 'pickup', label: 'Đón tận nơi' },
];

function distinctProvinces(areas: PickupAreaItem[]): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const a of areas) {
    if (!seen.has(a.provinceCode)) {
      seen.set(a.provinceCode, getProvince(a.provinceCode)?.name ?? a.provinceCode);
    }
  }
  return [...seen].map(([code, name]) => ({ code, name }));
}

function areaLabel(a: PickupAreaItem): string {
  const addr = a.addressLine?.trim();
  return addr ? `${a.name} — ${addr}` : a.name;
}

interface Props {
  routeId: string;
  routeLabel: string;
  onClose: () => void;
  onSaved: (count: number) => void;
}

export default function RoutePickupAreaDialog({ routeId, routeLabel, onClose, onSaved }: Props) {
  const [menu, setMenu] = useState<PickupAreaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [provinceFilter, setProvinceFilter] = useState(PROVINCE_ALL);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ areas: all }, { areas: assigned }] = await Promise.all([
          listPickupAreasApi(),
          getRoutePickupAreasApi(routeId),
        ]);
        if (cancelled) return;
        setMenu(all.filter((a) => a.isActive));
        setSelected(assigned.map((a) => a.id));
      } catch {
        if (!cancelled) setError('Không tải được danh sách khu vực đón.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const provinces = distinctProvinces(menu);
  const showProvinceFilter = provinces.length > 1;
  const filtered =
    showProvinceFilter && provinceFilter !== PROVINCE_ALL
      ? menu.filter((a) => a.provinceCode === provinceFilter)
      : menu;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      const { areas } = await setRoutePickupAreasApi(routeId, selected);
      onSaved(areas.length);
    } catch {
      setError('Lưu thất bại. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="route-pickup-dialog">
        <DialogHeader>
          <DialogTitle>Khu vực đón · {routeLabel}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="error" className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Đang tải...</p>
        ) : menu.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có khu vực đón nào trong danh mục. Thêm tại trang Khu vực đón.
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Chọn các khu vực đón áp dụng cho tuyến này. Chỉ những khu vực được chọn mới hiện khi
              tạo chuyến trên tuyến.
            </p>
            {showProvinceFilter && (
              <Select
                value={provinceFilter}
                onValueChange={(v: string | null) => setProvinceFilter(v ?? PROVINCE_ALL)}
              >
                <SelectTrigger data-testid="route-pickup-province-filter" className="max-w-xs">
                  <SelectValue>
                    {(v: string) =>
                      v === PROVINCE_ALL
                        ? 'Tất cả tỉnh/thành'
                        : (provinces.find((p) => p.code === v)?.name ?? 'Tất cả tỉnh/thành')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROVINCE_ALL}>Tất cả tỉnh/thành</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex max-h-80 flex-col gap-4 overflow-y-auto rounded-md border border-input p-3">
              {PICKUP_KIND_GROUPS.map((group) => {
                const items = filtered.filter((a) => a.kind === group.kind);
                if (items.length === 0) return null;
                return (
                  <div key={group.kind} className="flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </div>
                    {items.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(a.id)}
                          onChange={(e) => toggle(a.id, e.target.checked)}
                          data-testid={`route-pickup-area-${a.id}`}
                        />
                        {areaLabel(a)}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            data-testid="route-pickup-cancel"
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || busy}
            data-testid="route-pickup-save"
          >
            {busy ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
