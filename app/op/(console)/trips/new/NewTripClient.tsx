'use client';

/**
 * NewTripClient — form island for creating a one-off trip.
 *
 * POSTs via createTripApi (lib/api/tripsClient.ts, CSRF double-submit). On success
 * redirects to the new trip's detail page. Maps server error codes from
 * app/api/op/trips/route.ts to localized Vietnamese messages.
 *
 * Route + bus options are passed from the server page (no client fetch).
 */

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTripApi } from '@/lib/api';
// lib/geo is pure + client-safe (static JSON; no server-only/pg) — see lib/geo/index.ts.
import { getProvince } from '@/lib/geo';
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

interface RouteOption {
  id: string;
  origin: string;
  destination: string;
}

interface BusOption {
  id: string;
  licensePlate: string;
  capacity: number;
}

interface PickupAreaOption {
  id: string;
  label: string;
  kind: 'station' | 'pickup';
  provinceCode: string;
}

/** Issue 112: distinct provinces in the menu, resolved to names for the filter dropdown. */
function distinctProvinces(areas: PickupAreaOption[]): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const a of areas) {
    if (!seen.has(a.provinceCode)) {
      seen.set(a.provinceCode, getProvince(a.provinceCode)?.name ?? a.provinceCode);
    }
  }
  return [...seen].map(([code, name]) => ({ code, name }));
}

const PROVINCE_ALL = '__all__';

/** Issue 110: picker grouping — Bến xe (station) first, then Đón tận nơi (pickup). */
const PICKUP_KIND_GROUPS: { kind: 'station' | 'pickup'; label: string }[] = [
  { kind: 'station', label: 'Bến xe' },
  { kind: 'pickup', label: 'Đón tận nơi' },
];

interface Props {
  routes: RouteOption[];
  buses: BusOption[];
  pickupAreas: PickupAreaOption[];
  /** Issue 112: routeId → pickup-area ids from the most recent prior trip on that route. */
  routePickupMemory: Record<string, string[]>;
}

interface ApiError {
  status?: number;
  data?: { error?: string } | null;
}

function translateError(code: string): string {
  switch (code) {
    case 'bus_in_maintenance': return 'Xe đang trong khung bảo trì tại thời điểm này';
    case 'bus_deactivated': return 'Xe đã ngừng hoạt động';
    case 'not_found': return 'Không tìm thấy tuyến hoặc xe';
    case 'validation_failed':
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi khi tạo chuyến';
  }
}

export default function NewTripClient({ routes, buses, pickupAreas, routePickupMemory }: Props) {
  const router = useRouter();
  const [routeId, setRouteId] = useState('');
  // Issue 112: true once the per-route memory default was applied (drives the reuse hint/button).
  const [memoryApplied, setMemoryApplied] = useState(false);
  const [busId, setBusId] = useState('');
  const [departureLocal, setDepartureLocal] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  // Issue 112: province filter — display-only; selection still writes the chosen ids.
  const [provinceFilter, setProvinceFilter] = useState<string>(PROVINCE_ALL);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const missingPrereq = routes.length === 0 || buses.length === 0;

  // Issue 112: ids of the chosen route's most-recent prior trip (defensively intersected with the menu).
  const memoryIds = (routePickupMemory[routeId] ?? []).filter((id) =>
    pickupAreas.some((a) => a.id === id)
  );
  const hasMemory = memoryIds.length > 0;

  function applyMemory(ids: string[]) {
    setSelectedAreaIds(ids);
    setMemoryApplied(true);
  }

  function handleRouteChange(next: string) {
    setRouteId(next);
    // Default the pickup set from the most recent prior trip on this route (per-route memory).
    const remembered = (routePickupMemory[next] ?? []).filter((id) =>
      pickupAreas.some((a) => a.id === id)
    );
    if (remembered.length > 0) {
      setSelectedAreaIds(remembered);
      setMemoryApplied(true);
    } else {
      setSelectedAreaIds([]);
      setMemoryApplied(false);
    }
  }

  // Issue 112: count-gate the province filter — only useful when the menu spans >1 province.
  const provinces = distinctProvinces(pickupAreas);
  const showProvinceFilter = provinces.length > 1;
  const filteredAreas =
    showProvinceFilter && provinceFilter !== PROVINCE_ALL
      ? pickupAreas.filter((a) => a.provinceCode === provinceFilter)
      : pickupAreas;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!routeId || !busId || !departureLocal) return;
    setBusy(true);
    setMessage('');
    try {
      const { trip } = await createTripApi({
        routeId,
        busId,
        // datetime-local has no timezone — interpret as local, send full ISO-8601.
        departureAt: new Date(departureLocal).toISOString(),
        price,
        pickupAreaIds: selectedAreaIds.length > 0 ? selectedAreaIds : undefined,
      });
      router.push(`/op/trips/${trip.id}`);
    } catch (err) {
      setIsError(true);
      setMessage(translateError((err as ApiError).data?.error ?? ''));
      setBusy(false);
    }
  }

  if (missingPrereq) {
    return (
      <Alert variant="error" data-testid="new-trip-prereq">
        <AlertDescription>
          Cần có ít nhất một{' '}
          <Link href="/op/routes" className="text-primary underline-offset-4 hover:underline">
            tuyến đường
          </Link>{' '}
          và một{' '}
          <Link href="/op/buses" className="text-primary underline-offset-4 hover:underline">
            xe
          </Link>{' '}
          đang hoạt động trước khi tạo chuyến.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Thông tin chuyến</CardTitle>
      </CardHeader>
      <CardContent>
        {message && (
          <Alert variant={isError ? 'error' : 'success'} data-testid="new-trip-message" className="mb-4">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
          <div className="grid gap-1.5">
            <Label>Tuyến đường</Label>
            {/* base-ui Select: onValueChange, NOT onChange. */}
            <Select value={routeId} onValueChange={(v: string | null) => handleRouteChange(v ?? '')}>
              <SelectTrigger data-testid="new-trip-route">
                <SelectValue placeholder="— Chọn tuyến —" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.origin} → {r.destination}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Xe</Label>
            <Select value={busId} onValueChange={(v: string | null) => setBusId(v ?? '')}>
              <SelectTrigger data-testid="new-trip-bus">
                <SelectValue placeholder="— Chọn xe —" />
              </SelectTrigger>
              <SelectContent>
                {buses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.licensePlate} · {b.capacity} chỗ
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-trip-departure">Khởi hành</Label>
            <Input
              id="new-trip-departure"
              type="datetime-local"
              value={departureLocal}
              onChange={(e) => setDepartureLocal(e.target.value)}
              required
              data-testid="new-trip-departure"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-trip-price">Giá vé (VND)</Label>
            <Input
              id="new-trip-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
              min={0}
              step={1000}
              required
              data-testid="new-trip-price"
            />
          </div>

          {pickupAreas.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Khu vực đón khách (tuỳ chọn)</Label>
              <p className="text-sm text-muted-foreground">
                Khách có thể chọn một trong các khu vực này để được đón tận nơi.
              </p>
              {hasMemory && (
                <div
                  className="flex flex-wrap items-center gap-2 text-sm"
                  data-testid="new-trip-reuse-memory"
                >
                  {memoryApplied ? (
                    <span className="text-muted-foreground">
                      Đã áp dụng điểm đón của chuyến gần nhất trên tuyến này.
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyMemory(memoryIds)}
                    data-testid="new-trip-reuse-memory-btn"
                  >
                    Dùng lại điểm đón chuyến trước
                  </Button>
                </div>
              )}
              {showProvinceFilter && (
                <Select
                  value={provinceFilter}
                  onValueChange={(v: string | null) => setProvinceFilter(v ?? PROVINCE_ALL)}
                >
                  <SelectTrigger data-testid="new-trip-province-filter" className="max-w-xs">
                    <SelectValue />
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
              <div className="flex flex-col gap-4 rounded-md border border-input p-3">
                {PICKUP_KIND_GROUPS.map((group) => {
                  const items = filteredAreas.filter((a) => a.kind === group.kind);
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
                            checked={selectedAreaIds.includes(a.id)}
                            onChange={(e) =>
                              setSelectedAreaIds((prev) =>
                                e.target.checked
                                  ? [...prev, a.id]
                                  : prev.filter((id) => id !== a.id)
                              )
                            }
                            data-testid={`new-trip-area-${a.id}`}
                          />
                          {a.label}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Button
              type="submit"
              disabled={busy || !routeId || !busId || !departureLocal}
              data-testid="new-trip-submit"
            >
              {busy ? 'Đang tạo...' : 'Tạo chuyến'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
