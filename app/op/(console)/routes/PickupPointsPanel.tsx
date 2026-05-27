'use client';

/**
 * PickupPointsPanel — inline subview for managing pickup points on a route (Issue 012).
 *
 * Loads pickup points via routesClient on mount. Supports:
 *   - Add new pickup point (POST).
 *   - Arrow-button reorder (ChevronUp / ChevronDown). Each click recomputes
 *     orderedIds and PATCHes the full ordered array.
 *   - Deactivate (POST /[ppId]/deactivate).
 *
 * CSRF: all state-changing requests carry X-CSRF-Token via routesClient.
 */

import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  listPickupPointsApi,
  createPickupPointApi,
  reorderPickupPointsApi,
  deactivatePickupPointApi,
  type PickupPoint,
} from '@/lib/api/routesClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Props {
  routeId: string;
}

interface ApiError {
  status?: number;
  data?: { error?: string } | null;
}

function translateError(code: string): string {
  switch (code) {
    case 'not_found':
      return 'Không tìm thấy';
    case 'too_many_pickup_points':
      return 'Đã đạt tối đa 50 điểm đón';
    case 'already_deactivated':
      return 'Điểm đón đã bị vô hiệu hoá';
    case 'unknown_pickup_points':
      return 'Danh sách thứ tự chứa điểm đón không xác định';
    case 'incomplete_reorder':
      return 'Danh sách thứ tự không đầy đủ';
    case 'invalid_input':
      return 'Dữ liệu không hợp lệ';
    default:
      return 'Đã xảy ra lỗi';
  }
}

export default function PickupPointsPanel({ routeId }: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  // Start true; loadPoints() flips to false after first fetch. The panel
  // unmounts when the row collapses, so no reset on routeId change needed.
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Add-form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  function fail(e: unknown) {
    setMessage(translateError((e as ApiError).data?.error ?? ''));
    setIsError(true);
  }

  async function loadPoints() {
    try {
      const { pickupPoints } = await listPickupPointsApi(routeId);
      // Active points sorted by displayOrder.
      setPoints(
        pickupPoints
          .filter((p) => p.deactivatedAt === null)
          .sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } catch {
      // Leave list empty on load failure; user can retry by reopening.
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await createPickupPointApi(routeId, { name: newName.trim(), address: newAddress.trim() });
      setMessage('Đã thêm điểm đón.');
      setIsError(false);
      setNewName('');
      setNewAddress('');
      await loadPoints();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function sendReorder(orderedIds: string[]) {
    setBusy(true);
    setMessage('');
    try {
      await reorderPickupPointsApi(routeId, orderedIds);
      await loadPoints();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...points];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    void sendReorder(next.map((p) => p.id));
  }

  function moveDown(index: number) {
    if (index === points.length - 1) return;
    const next = [...points];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    void sendReorder(next.map((p) => p.id));
  }

  async function handleDeactivate(ppId: string) {
    if (!confirm('Vô hiệu hoá điểm đón này?')) return;
    setBusy(true);
    setMessage('');
    try {
      await deactivatePickupPointApi(routeId, ppId);
      setMessage('Đã vô hiệu hoá điểm đón.');
      setIsError(false);
      await loadPoints();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  return (
    <div data-testid={`pickup-panel-${routeId}`} className="space-y-3">
      <h3 className="text-sm font-semibold">Điểm đón ({points.length})</h3>

      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="pickup-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có điểm đón nào.</p>
      ) : (
        <Table data-testid={`pickup-table-${routeId}`}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((pp, idx) => (
              <TableRow key={pp.id} data-testid={`pickup-row-${pp.id}`}>
                <TableCell className="tabular-nums">{idx + 1}</TableCell>
                <TableCell data-testid={`pickup-name-${pp.id}`}>{pp.name}</TableCell>
                <TableCell>{pp.address}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveUp(idx)}
                      disabled={busy || idx === 0}
                      data-testid={`pickup-up-${pp.id}`}
                      aria-label="Lên"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveDown(idx)}
                      disabled={busy || idx === points.length - 1}
                      data-testid={`pickup-down-${pp.id}`}
                      aria-label="Xuống"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeactivate(pp.id)}
                      disabled={busy}
                      data-testid={`pickup-deactivate-${pp.id}`}
                    >
                      Xoá
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add pickup point form */}
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`pickup-new-name-${routeId}`}>Tên điểm đón</Label>
          <Input
            id={`pickup-new-name-${routeId}`}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            maxLength={120}
            disabled={busy}
            data-testid={`pickup-new-name-${routeId}`}
            className="w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`pickup-new-address-${routeId}`}>Địa chỉ</Label>
          <Input
            id={`pickup-new-address-${routeId}`}
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            required
            maxLength={500}
            disabled={busy}
            data-testid={`pickup-new-address-${routeId}`}
            className="w-64"
          />
        </div>
        <Button
          type="submit"
          disabled={busy || !newName.trim() || !newAddress.trim()}
          data-testid={`pickup-add-${routeId}`}
        >
          {busy ? 'Đang xử lý...' : 'Thêm điểm đón'}
        </Button>
      </form>
    </div>
  );
}
