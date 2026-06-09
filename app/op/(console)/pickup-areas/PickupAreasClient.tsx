'use client';

/**
 * PickupAreasClient — operator pickup-area menu management (Issue 105).
 *
 * Add an area via the cascading AdminUnitPicker (huyện/xã); list shows active +
 * deactivated entries. Mutations go through lib/api/pickupAreasClient.ts (CSRF
 * double-submit). Soft-deactivate only (historical bookings keep their snapshot).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listPickupAreasApi,
  createPickupAreaApi,
  deactivatePickupAreaApi,
  type PickupAreaItem,
} from '@/lib/api';
import { AdminUnitPicker, type AdminUnitValue } from '@/components/geo/AdminUnitPicker';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_area: 'Khu vực không hợp lệ. Vui lòng chọn lại.',
  duplicate_area: 'Khu vực này đã có trong danh sách.',
  invalid_input: 'Vui lòng chọn đầy đủ tỉnh, huyện, xã.',
  not_found: 'Không tìm thấy khu vực.',
  already_inactive: 'Khu vực đã được vô hiệu hoá.',
};

function errorText(e: unknown): string {
  const code = (e as { data?: { error?: string } })?.data?.error;
  return (code && ERROR_MESSAGES[code]) || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function PickupAreasClient({ initialAreas }: { initialAreas: PickupAreaItem[] }) {
  const router = useRouter();
  const [areas, setAreas] = useState<PickupAreaItem[]>(initialAreas);
  const [sel, setSel] = useState<AdminUnitValue>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { areas: fresh } = await listPickupAreasApi();
    setAreas(fresh);
  }

  async function handleAdd() {
    if (!sel.provinceCode || !sel.districtCode || !sel.wardCode) {
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
      });
      setSel({});
      await refresh();
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
            Thêm khu vực đón
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AdminUnitPicker value={sel} onChange={(v) => setSel(v)} level="ward" disabled={busy} />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={busy || !sel.wardCode}
            data-testid="pickup-area-add"
            className="self-start"
          >
            {busy ? 'Đang lưu...' : 'Thêm khu vực'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Danh sách khu vực ({areas.filter((a) => a.isActive).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có khu vực nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khu vực</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((a) => (
                  <TableRow key={a.id} data-testid={`pickup-area-row-${a.id}`}>
                    <TableCell>{a.label}</TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? 'success' : 'neutral'}>
                        {a.isActive ? 'Đang dùng' : 'Đã tắt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.isActive && (
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
