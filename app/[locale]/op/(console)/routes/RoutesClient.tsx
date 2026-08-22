'use client';

/**
 * RoutesClient — client island for operator route management (Issue 012).
 *
 * Mutations go through lib/api/routesClient.ts (CSRF double-submit:
 * X-CSRF-Token on every non-GET; GET list sends none). Design-system surface:
 * Card list + Table, Badge active-state, Alert messages, Dialog create/edit.
 *
 * Every data-testid is preserved (sandbox-gated e2e keys off them).
 */

import { useState } from 'react';
import {
  listRoutesApi,
  createRouteApi,
  patchRouteApi,
  deactivateRouteApi,
  type RouteItem,
} from '@/lib/api';
import { routeActiveDisplay } from '@/lib/op/statusLabels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import RouteEditDialog from './RouteEditDialog';
import { ConfirmDialog } from '@/components/op/ConfirmDialog';

// Single source of truth for the route shape is the API client (handles the
// Date|string wire vs server-Date duality). Re-exported so sibling components
// (RouteEditDialog, page) keep importing RouteItem from here.
export type { RouteItem };

interface Props {
  initialRoutes: RouteItem[];
}

interface ApiError {
  status?: number;
  data?: { error?: string } | null;
}

function translateError(code: string): string {
  switch (code) {
    case 'reactivation_not_supported':
      return 'Không hỗ trợ kích hoạt lại tuyến đã bị vô hiệu hoá';
    case 'already_deactivated':
      return 'Tuyến đã bị vô hiệu hoá trước đó';
    case 'not_found':
      return 'Không tìm thấy tuyến';
    case 'invalid_input':
      return 'Dữ liệu không hợp lệ';
    case 'bad_request':
      return 'Yêu cầu không hợp lệ';
    default:
      return 'Đã xảy ra lỗi';
  }
}

function errorMessage(e: unknown): string {
  return translateError((e as ApiError).data?.error ?? '');
}

export default function RoutesClient({ initialRoutes }: Props) {
  const [routes, setRoutes] = useState<RouteItem[]>(initialRoutes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // PR 4: ConfirmDialog replaces window.confirm for deactivation.
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(e: unknown) {
    setMessage(errorMessage(e));
    setIsError(true);
  }

  async function refreshRoutes() {
    const { routes: next } = await listRoutesApi();
    setRoutes(next);
  }

  async function handleCreate(origin: string, destination: string, durationMinutes: number) {
    setBusy(true);
    setMessage('');
    try {
      await createRouteApi({ origin, destination, durationMinutes });
      ok('Đã tạo tuyến mới.');
      setShowCreateDialog(false);
      await refreshRoutes();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(
    routeId: string,
    origin: string,
    destination: string,
    durationMinutes: number
  ) {
    setBusy(true);
    setMessage('');
    try {
      await patchRouteApi(routeId, { origin, destination, durationMinutes });
      ok('Đã cập nhật tuyến.');
      setEditingRoute(null);
      await refreshRoutes();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(routeId: string) {
    setBusy(true);
    setMessage('');
    try {
      await deactivateRouteApi(routeId);
      ok('Đã vô hiệu hoá tuyến.');
      await refreshRoutes();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="routes-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div>
        <Button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          disabled={busy}
          data-testid="create-route-btn"
        >
          Thêm tuyến mới
        </Button>
      </div>

      {showCreateDialog && (
        <RouteEditDialog
          mode="create"
          onSave={handleCreate}
          onClose={() => setShowCreateDialog(false)}
          disabled={busy}
        />
      )}

      {editingRoute && (
        <RouteEditDialog
          mode="edit"
          route={editingRoute}
          onSave={(origin, destination, durationMinutes) =>
            handleEdit(editingRoute.id, origin, destination, durationMinutes)
          }
          onClose={() => setEditingRoute(null)}
          disabled={busy}
        />
      )}

      {routes.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có tuyến nào.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table data-testid="routes-table">
            <TableHeader>
              <TableRow>
                <TableHead>Điểm đi</TableHead>
                <TableHead>Điểm đến</TableHead>
                <TableHead>Thời gian (phút)</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => {
                const active = !route.deactivatedAt;
                const status = routeActiveDisplay(active);
                return (
                    <TableRow key={route.id} data-testid={`route-row-${route.id}`}>
                      <TableCell data-testid={`route-origin-${route.id}`}>{route.origin}</TableCell>
                      <TableCell data-testid={`route-destination-${route.id}`}>
                        {route.destination}
                      </TableCell>
                      <TableCell className="tabular-nums">{route.durationMinutes}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {active && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingRoute(route)}
                              disabled={busy}
                              data-testid={`route-edit-${route.id}`}
                            >
                              Sửa
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setPendingDeactivate(route.id)}
                              disabled={busy}
                              data-testid={`route-deactivate-${route.id}`}
                            >
                              Vô hiệu hoá
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={async () => {
          const id = pendingDeactivate;
          setPendingDeactivate(null);
          if (id) await handleDeactivate(id);
        }}
        title="Vô hiệu hoá tuyến?"
        description="Hành động không thể hoàn tác."
        consequences={[
          'Tuyến sẽ ẩn khỏi danh sách hoạt động.',
          'Khách hàng không thể tìm kiếm tuyến này.',
          'Chuyến đang gắn tuyến vẫn tiếp tục hoạt động cho đến khi hoàn tất.',
        ]}
        confirmLabel="Vô hiệu hoá"
        destructive
        busy={busy}
      />
    </div>
  );
}
