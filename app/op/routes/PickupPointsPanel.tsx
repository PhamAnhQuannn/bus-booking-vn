'use client';

/**
 * PickupPointsPanel — inline subview for managing pickup points on a route (Issue 012).
 *
 * Loads pickup points from GET /api/op/routes/[id]/pickup-points on mount.
 * Supports:
 *   - Add new pickup point (POST).
 *   - Arrow-button reorder (ChevronUp / ChevronDown via lucide-react).
 *     Each click recomputes orderedIds and PATCHes the full array.
 *   - Deactivate (POST /[ppId]/deactivate).
 *
 * CSRF: all state-changing requests include X-CSRF-Token via readCsrfToken().
 */

import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { readCsrfToken } from '@/lib/auth/csrfClient';

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  displayOrder: number;
  deactivatedAt: string | null;
}

interface Props {
  routeId: string;
}

function csrfHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'X-CSRF-Token': readCsrfToken(), ...extra };
}

function jsonHeaders(): HeadersInit {
  return csrfHeaders({ 'Content-Type': 'application/json' });
}

function translateError(code: string): string {
  switch (code) {
    case 'not_found': return 'Không tìm thấy';
    case 'too_many_pickup_points': return 'Đã đạt tối đa 50 điểm đón';
    case 'already_deactivated': return 'Điểm đón đã bị vô hiệu hoá';
    case 'unknown_pickup_points': return 'Danh sách thứ tự chứa điểm đón không xác định';
    case 'incomplete_reorder': return 'Danh sách thứ tự không đầy đủ';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function PickupPointsPanel({ routeId }: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  // Start as true; loadPoints() flips it to false after first fetch.
  // The panel unmounts when the row collapses, so no need to reset on routeId change.
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Add-form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  async function loadPoints() {
    const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      const all: PickupPoint[] = json.pickupPoints ?? [];
      // Show active points sorted by displayOrder
      setPoints(all.filter((p) => p.deactivatedAt === null).sort((a, b) => a.displayOrder - b.displayOrder));
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
      const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ name: newName.trim(), address: newAddress.trim() }),
      });
      if (res.status === 201) {
        setMessage('Đã thêm điểm đón.');
        setNewName('');
        setNewAddress('');
        await loadPoints();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReorder(orderedIds: string[]) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ orderedIds }),
      });
      if (res.ok) {
        await loadPoints();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
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
      const res = await fetch(`/api/op/routes/${routeId}/pickup-points/${ppId}/deactivate`, {
        method: 'POST',
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setMessage('Đã vô hiệu hoá điểm đón.');
        await loadPoints();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Đang tải...</p>;

  return (
    <div data-testid={`pickup-panel-${routeId}`}>
      <h3 style={{ marginTop: 0 }}>Điểm đón ({points.length})</h3>

      {message && (
        <div
          data-testid="pickup-message"
          style={{ padding: 8, marginBottom: 12, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      {points.length === 0 ? (
        <p>Chưa có điểm đón nào.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}
          data-testid={`pickup-table-${routeId}`}
        >
          <thead>
            <tr style={{ background: '#eee' }}>
              <th style={{ padding: 6, textAlign: 'left' }}>#</th>
              <th style={{ padding: 6, textAlign: 'left' }}>Tên</th>
              <th style={{ padding: 6, textAlign: 'left' }}>Địa chỉ</th>
              <th style={{ padding: 6, textAlign: 'left' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {points.map((pp, idx) => (
              <tr key={pp.id} data-testid={`pickup-row-${pp.id}`}>
                <td style={{ padding: 6 }}>{idx + 1}</td>
                <td style={{ padding: 6 }} data-testid={`pickup-name-${pp.id}`}>{pp.name}</td>
                <td style={{ padding: 6 }}>{pp.address}</td>
                <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={busy || idx === 0}
                    data-testid={`pickup-up-${pp.id}`}
                    aria-label="Lên"
                  >
                    <ChevronUp size={16} />
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={busy || idx === points.length - 1}
                    data-testid={`pickup-down-${pp.id}`}
                    aria-label="Xuống"
                  >
                    <ChevronDown size={16} />
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleDeactivate(pp.id)}
                    disabled={busy}
                    data-testid={`pickup-deactivate-${pp.id}`}
                    style={{ color: 'red' }}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add pickup point form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'block' }}>
          Tên điểm đón
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            maxLength={120}
            disabled={busy}
            data-testid={`pickup-new-name-${routeId}`}
            style={{ display: 'block', marginTop: 4, width: 180 }}
          />
        </label>
        <label style={{ display: 'block' }}>
          Địa chỉ
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            required
            maxLength={500}
            disabled={busy}
            data-testid={`pickup-new-address-${routeId}`}
            style={{ display: 'block', marginTop: 4, width: 260 }}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !newName.trim() || !newAddress.trim()}
          data-testid={`pickup-add-${routeId}`}
        >
          {busy ? 'Đang xử lý...' : 'Thêm điểm đón'}
        </button>
      </form>
    </div>
  );
}
