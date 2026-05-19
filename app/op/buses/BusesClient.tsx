'use client';

/**
 * BusesClient — client island for operator fleet management (Issue 011).
 *
 * Handles all mutations against /api/op/buses* with CSRF double-submit
 * (X-CSRF-Token header read from bb_csrf cookie via readCsrfToken()).
 *
 * UI surface:
 *   - List of buses (initialBuses from RSC; refresh after each mutation).
 *   - Add Bus form (POST /api/op/buses).
 *   - Per-row Edit (PATCH) + Deactivate (POST /[id]/deactivate).
 *   - Per-row Maintenance windows panel: list + add + delete.
 *
 * Error mapping (user-visible Vietnamese strings):
 *   plate_in_use                 → "Biển số đã tồn tại"
 *   capacity_reduction_blocked   → "Không thể giảm sức chứa: có chuyến đã vượt mức"
 *   future_trips_assigned        → "Còn chuyến tương lai gắn xe này"
 *   maintenance_overlap          → "Khung bảo trì trùng lặp"
 *   reactivation_not_supported   → "Không hỗ trợ kích hoạt lại"
 *   not_found                    → "Không tìm thấy"
 */

import { useState } from 'react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { OperatorBusListItem } from '@/lib/buses/listOperatorBuses';

type BusType = 'coach' | 'sleeper' | 'limousine';

interface MaintenanceWindow {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

interface Props {
  initialBuses: OperatorBusListItem[];
}

function csrfHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'X-CSRF-Token': readCsrfToken(), ...extra };
}

function jsonHeaders(): HeadersInit {
  return csrfHeaders({ 'Content-Type': 'application/json' });
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

  // Add-bus form state
  const [newPlate, setNewPlate] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(30);
  const [newBusType, setNewBusType] = useState<BusType>('coach');

  // Expanded-bus state for maintenance panel
  const [expandedBusId, setExpandedBusId] = useState<string | null>(null);
  const [maintenanceByBus, setMaintenanceByBus] = useState<Record<string, MaintenanceWindow[]>>({});

  async function refreshBuses() {
    const res = await fetch('/api/op/buses?activeOnly=1', { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      setBuses(json.buses ?? []);
    }
  }

  async function loadMaintenance(busId: string) {
    const res = await fetch(`/api/op/buses/${busId}`, { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      const windows: MaintenanceWindow[] = (json.bus?.maintenances ?? []).map((m: { id: string; startAt: string; endAt: string; reason: string | null }) => ({
        id: m.id,
        startAt: m.startAt,
        endAt: m.endAt,
        reason: m.reason,
      }));
      setMaintenanceByBus((s) => ({ ...s, [busId]: windows }));
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/op/buses', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          licensePlate: newPlate,
          capacity: newCapacity,
          busType: newBusType,
        }),
      });
      if (res.status === 201) {
        setMessage('Đã thêm xe.');
        setNewPlate('');
        setNewCapacity(30);
        setNewBusType('coach');
        await refreshBuses();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchCapacity(busId: string, capacity: number) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/buses/${busId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ capacity }),
      });
      if (res.ok) {
        setMessage('Đã cập nhật.');
        await refreshBuses();
      } else {
        const json = await res.json().catch(() => ({}));
        if (json.error === 'capacity_reduction_blocked' && Array.isArray(json.violatingTrips)) {
          const trips = (json.violatingTrips as Array<{ tripId: string; occupancy: number }>)
            .map((t) => `${t.tripId} (${t.occupancy} chỗ)`)
            .join(', ');
          setMessage(`Không thể giảm sức chứa: ${trips}`);
        } else {
          setMessage(translateError(json.error ?? ''));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(busId: string) {
    if (!confirm('Vô hiệu hoá xe này? Hành động không thể hoàn tác.')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/buses/${busId}/deactivate`, {
        method: 'POST',
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setMessage('Đã vô hiệu hoá xe.');
        await refreshBuses();
      } else {
        const json = await res.json().catch(() => ({}));
        if (json.error === 'future_trips_assigned' && Array.isArray(json.tripIds)) {
          setMessage(`Còn chuyến tương lai gắn xe này: ${json.tripIds.join(', ')}`);
        } else {
          setMessage(translateError(json.error ?? ''));
        }
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
      const res = await fetch(`/api/op/buses/${busId}/maintenance`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          reason: reason || undefined,
        }),
      });
      if (res.status === 201) {
        const json = await res.json();
        const conflicts = Array.isArray(json.conflictingTrips) ? json.conflictingTrips : [];
        if (conflicts.length > 0) {
          setMessage(
            `Đã thêm khung bảo trì. Cảnh báo: ${conflicts.length} chuyến chồng lấn (${conflicts.map((c: { tripId: string }) => c.tripId).join(', ')}).`
          );
        } else {
          setMessage('Đã thêm khung bảo trì.');
        }
        await loadMaintenance(busId);
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMaintenance(busId: string, mid: string) {
    if (!confirm('Xoá khung bảo trì?')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/buses/${busId}/maintenance/${mid}`, {
        method: 'DELETE',
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setMessage('Đã xoá khung bảo trì.');
        await loadMaintenance(busId);
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
          data-testid="fleet-message"
          style={{ padding: 12, marginBottom: 16, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      {/* Add-bus form */}
      <section style={{ marginBottom: 32, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2 style={{ marginTop: 0 }}>Thêm xe mới</h2>
        <form onSubmit={handleAdd}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Biển số
            <input
              type="text"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value)}
              required
              minLength={6}
              maxLength={11}
              data-testid="new-plate"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Sức chứa
            <input
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(parseInt(e.target.value, 10))}
              min={1}
              max={80}
              required
              data-testid="new-capacity"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Loại xe
            <select
              value={newBusType}
              onChange={(e) => setNewBusType(e.target.value as BusType)}
              data-testid="new-bustype"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              <option value="coach">Coach</option>
              <option value="sleeper">Sleeper</option>
              <option value="limousine">Limousine</option>
            </select>
          </label>
          <button type="submit" disabled={busy} data-testid="add-bus-submit">
            {busy ? 'Đang xử lý...' : 'Thêm xe'}
          </button>
        </form>
      </section>

      {/* Bus list */}
      <section>
        <h2>Danh sách xe ({buses.length})</h2>
        {buses.length === 0 ? (
          <p>Chưa có xe nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="buses-table">
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Biển số</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Sức chứa</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Loại</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <RowGroup
                  key={bus.id}
                  bus={bus}
                  expanded={expandedBusId === bus.id}
                  maintenance={maintenanceByBus[bus.id] ?? []}
                  onToggle={() => handleToggleExpand(bus.id)}
                  onPatchCapacity={(cap) => handlePatchCapacity(bus.id, cap)}
                  onDeactivate={() => handleDeactivate(bus.id)}
                  onAddMaintenance={(s, e, r) => handleAddMaintenance(bus.id, s, e, r)}
                  onDeleteMaintenance={(mid) => handleDeleteMaintenance(bus.id, mid)}
                  disabled={busy}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
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
  onDeactivate: () => Promise<void>;
  onAddMaintenance: (startAt: string, endAt: string, reason: string) => Promise<void>;
  onDeleteMaintenance: (mid: string) => Promise<void>;
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
      <tr data-testid={`bus-row-${bus.id}`}>
        <td style={{ padding: 8 }} data-testid={`bus-plate-${bus.id}`}>
          {bus.licensePlate}
        </td>
        <td style={{ padding: 8 }}>
          <input
            type="number"
            value={editCapacity}
            onChange={(e) => setEditCapacity(parseInt(e.target.value, 10))}
            min={1}
            max={80}
            data-testid={`bus-capacity-${bus.id}`}
            style={{ width: 80 }}
          />
          <button
            type="button"
            onClick={() => onPatchCapacity(editCapacity)}
            disabled={disabled || editCapacity === bus.capacity}
            data-testid={`bus-save-${bus.id}`}
          >
            Lưu
          </button>
        </td>
        <td style={{ padding: 8 }}>{bus.busType}</td>
        <td style={{ padding: 8 }}>
          <button type="button" onClick={onToggle} data-testid={`bus-toggle-${bus.id}`}>
            {expanded ? 'Đóng' : 'Bảo trì'}
          </button>{' '}
          <button
            type="button"
            onClick={onDeactivate}
            disabled={disabled}
            data-testid={`bus-deactivate-${bus.id}`}
            style={{ color: 'red' }}
          >
            Vô hiệu hoá
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ background: '#fafafa', padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Khung bảo trì</h3>
            {maintenance.length === 0 ? (
              <p>Chưa có khung bảo trì.</p>
            ) : (
              <ul>
                {maintenance.map((m) => (
                  <li key={m.id} data-testid={`maintenance-${m.id}`}>
                    {new Date(m.startAt).toLocaleString()} → {new Date(m.endAt).toLocaleString()}
                    {m.reason ? ` — ${m.reason}` : ''}{' '}
                    <button
                      type="button"
                      onClick={() => onDeleteMaintenance(m.id)}
                      disabled={disabled}
                      data-testid={`maintenance-delete-${m.id}`}
                    >
                      Xoá
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>
                Bắt đầu
                <input
                  type="datetime-local"
                  value={mStart}
                  onChange={(e) => setMStart(e.target.value)}
                  data-testid={`maintenance-start-${bus.id}`}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 4 }}>
                Kết thúc
                <input
                  type="datetime-local"
                  value={mEnd}
                  onChange={(e) => setMEnd(e.target.value)}
                  data-testid={`maintenance-end-${bus.id}`}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 4 }}>
                Lý do
                <input
                  type="text"
                  value={mReason}
                  onChange={(e) => setMReason(e.target.value)}
                  data-testid={`maintenance-reason-${bus.id}`}
                />
              </label>
              <button
                type="button"
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
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
