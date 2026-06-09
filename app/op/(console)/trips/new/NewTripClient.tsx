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
}

interface Props {
  routes: RouteOption[];
  buses: BusOption[];
  pickupAreas: PickupAreaOption[];
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

export default function NewTripClient({ routes, buses, pickupAreas }: Props) {
  const router = useRouter();
  const [routeId, setRouteId] = useState('');
  const [busId, setBusId] = useState('');
  const [departureLocal, setDepartureLocal] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const missingPrereq = routes.length === 0 || buses.length === 0;

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
            <Select value={routeId} onValueChange={(v: string | null) => setRouteId(v ?? '')}>
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
              <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                {pickupAreas.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedAreaIds.includes(a.id)}
                      onChange={(e) =>
                        setSelectedAreaIds((prev) =>
                          e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                        )
                      }
                      data-testid={`new-trip-area-${a.id}`}
                    />
                    {a.label}
                  </label>
                ))}
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
