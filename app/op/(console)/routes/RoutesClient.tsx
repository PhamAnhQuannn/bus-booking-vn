'use client';

/**
 * RoutesClient — client island for operator route management (Issue 012).
 *
 * Handles all mutations against /api/op/routes** with CSRF double-submit
 * (X-CSRF-Token header read from bb_csrf cookie via readCsrfToken()).
 *
 * UI surface:
 *   - List of routes (initialRoutes from RSC; refresh after each mutation).
 *   - Create route form (POST /api/op/routes).
 *   - Per-row Edit (PATCH) + Deactivate (POST /[id]/deactivate).
 *   - Per-row Pickup Points panel (subview).
 */

import { useState } from 'react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import RouteEditDialog from './RouteEditDialog';
import PickupPointsPanel from './PickupPointsPanel';

export interface RouteItem {
  id: string;
  operatorId: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  initialRoutes: RouteItem[];
}

function csrfHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'X-CSRF-Token': readCsrfToken(), ...extra };
}

function jsonHeaders(): HeadersInit {
  return csrfHeaders({ 'Content-Type': 'application/json' });
}

function translateError(code: string): string {
  switch (code) {
    case 'reactivation_not_supported': return 'Không hỗ trợ kích hoạt lại tuyến đã bị vô hiệu hoá';
    case 'already_deactivated': return 'Tuyến đã bị vô hiệu hoá trước đó';
    case 'not_found': return 'Không tìm thấy tuyến';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    case 'bad_request': return 'Yêu cầu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function RoutesClient({ initialRoutes }: Props) {
  const [routes, setRoutes] = useState<RouteItem[]>(initialRoutes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  async function refreshRoutes() {
    const res = await fetch('/api/op/routes', { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      setRoutes(json.routes ?? []);
    }
  }

  async function handleCreate(origin: string, destination: string, durationMinutes: number) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/op/routes', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ origin, destination, durationMinutes }),
      });
      if (res.status === 201) {
        setMessage('Đã tạo tuyến mới.');
        setShowCreateDialog(false);
        await refreshRoutes();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(routeId: string, origin: string, destination: string, durationMinutes: number) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/routes/${routeId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ origin, destination, durationMinutes }),
      });
      if (res.ok) {
        setMessage('Đã cập nhật tuyến.');
        setEditingRoute(null);
        await refreshRoutes();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(routeId: string) {
    if (!confirm('Vô hiệu hoá tuyến này? Hành động không thể hoàn tác.')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/routes/${routeId}/deactivate`, {
        method: 'POST',
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setMessage('Đã vô hiệu hoá tuyến.');
        await refreshRoutes();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <div
          data-testid="routes-message"
          style={{ padding: 12, marginBottom: 16, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      <section style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          disabled={busy}
          data-testid="create-route-btn"
        >
          Thêm tuyến mới
        </button>
      </section>

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

      <section>
        <h2>Danh sách tuyến ({routes.length})</h2>
        {routes.length === 0 ? (
          <p>Chưa có tuyến nào.</p>
        ) : (
          <table
            style={{ width: '100%', borderCollapse: 'collapse' }}
            data-testid="routes-table"
          >
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Điểm đi</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Điểm đến</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Thời gian (phút)</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Trạng thái</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <>
                  <tr key={route.id} data-testid={`route-row-${route.id}`}>
                    <td style={{ padding: 8 }} data-testid={`route-origin-${route.id}`}>
                      {route.origin}
                    </td>
                    <td style={{ padding: 8 }} data-testid={`route-destination-${route.id}`}>
                      {route.destination}
                    </td>
                    <td style={{ padding: 8 }}>{route.durationMinutes}</td>
                    <td style={{ padding: 8 }}>
                      {route.deactivatedAt ? (
                        <span style={{ color: 'red' }}>Vô hiệu hoá</span>
                      ) : (
                        <span style={{ color: 'green' }}>Hoạt động</span>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {!route.deactivatedAt && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingRoute(route)}
                            disabled={busy}
                            data-testid={`route-edit-${route.id}`}
                          >
                            Sửa
                          </button>{' '}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRouteId(expandedRouteId === route.id ? null : route.id)
                            }
                            data-testid={`route-pickup-toggle-${route.id}`}
                          >
                            {expandedRouteId === route.id ? 'Đóng điểm đón' : 'Điểm đón'}
                          </button>{' '}
                          <button
                            type="button"
                            onClick={() => handleDeactivate(route.id)}
                            disabled={busy}
                            data-testid={`route-deactivate-${route.id}`}
                            style={{ color: 'red' }}
                          >
                            Vô hiệu hoá
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expandedRouteId === route.id && (
                    <tr key={`${route.id}-pickup`}>
                      <td colSpan={5} style={{ background: '#fafafa', padding: 16 }}>
                        <PickupPointsPanel routeId={route.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
