'use client';

/**
 * StaffClient — client island for operator staff management (Issue 017).
 *
 * Handles all mutations against /api/op/staff* with CSRF double-submit
 * (X-CSRF-Token header read from bb_csrf cookie via readCsrfToken()).
 *
 * UI surface (admin only):
 *   - List of staff (initialStaff from RSC; refresh after each mutation).
 *   - Create-staff dialog (POST /api/op/staff) → temp-password-sent confirmation.
 *   - Per-row Rename (PATCH /[id]).
 *   - Per-row Disable (POST /[id]/disable).
 *
 * Staff (non-admin) callers see the roster read-only — the API enforces
 * adminOnly (403) regardless, this just hides the controls.
 *
 * Error mapping (user-visible Vietnamese strings):
 *   phone_in_use         → "Số điện thoại đã được sử dụng"
 *   not_found            → "Không tìm thấy"
 */

import { useState } from 'react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { StaffDto } from '@/lib/staff/toStaffDto';

interface Props {
  initialStaff: StaffDto[];
  isAdmin: boolean;
}

function csrfHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'X-CSRF-Token': readCsrfToken(), ...extra };
}

function jsonHeaders(): HeadersInit {
  return csrfHeaders({ 'Content-Type': 'application/json' });
}

function translateError(code: string): string {
  switch (code) {
    case 'phone_in_use': return 'Số điện thoại đã được sử dụng';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function StaffClient({ initialStaff, isAdmin }: Props) {
  const [staff, setStaff] = useState<StaffDto[]>(initialStaff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Create-staff form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  async function refreshStaff() {
    const res = await fetch('/api/op/staff', { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      setStaff(json.staff ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/op/staff', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ name: newName, phone: newPhone }),
      });
      if (res.status === 201) {
        setMessage(`Đã tạo nhân viên. Mật khẩu tạm thời đã gửi qua SMS tới ${newPhone}.`);
        setNewName('');
        setNewPhone('');
        await refreshStaff();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(staffId: string, name: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/staff/${staffId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setMessage('Đã cập nhật tên.');
        await refreshStaff();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage(translateError(json.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(staffId: string) {
    if (!confirm('Vô hiệu hoá nhân viên này? Mọi phiên đăng nhập sẽ bị thu hồi.')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/staff/${staffId}/disable`, {
        method: 'POST',
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setMessage('Đã vô hiệu hoá nhân viên.');
        await refreshStaff();
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
          data-testid="staff-message"
          style={{ padding: 12, marginBottom: 16, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      {isAdmin && (
        <section style={{ marginBottom: 32, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
          <h2 style={{ marginTop: 0 }}>Tạo nhân viên mới</h2>
          <form onSubmit={handleCreate}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Tên nhân viên
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                minLength={1}
                maxLength={120}
                data-testid="new-staff-name"
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Số điện thoại
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                data-testid="new-staff-phone"
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <button type="submit" disabled={busy} data-testid="create-staff-submit">
              {busy ? 'Đang xử lý...' : 'Tạo nhân viên'}
            </button>
          </form>
        </section>
      )}

      <section>
        <h2>Danh sách nhân viên ({staff.length})</h2>
        {staff.length === 0 ? (
          <p>Chưa có nhân viên nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="staff-table">
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Tên</th>
                <th style={{ padding: 8, textAlign: 'left' }}>SĐT</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Chuyến gán</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Trạng thái</th>
                {isAdmin && <th style={{ padding: 8, textAlign: 'left' }}>Hành động</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <StaffRow
                  key={member.id}
                  member={member}
                  isAdmin={isAdmin}
                  onRename={(name) => handleRename(member.id, name)}
                  onDisable={() => handleDisable(member.id)}
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
  member: StaffDto;
  isAdmin: boolean;
  onRename: (name: string) => Promise<void>;
  onDisable: () => Promise<void>;
  disabled: boolean;
}

function StaffRow({ member, isAdmin, onRename, onDisable, disabled }: RowProps) {
  const [editName, setEditName] = useState<string>(member.displayName);

  return (
    <tr data-testid={`staff-row-${member.id}`}>
      <td style={{ padding: 8 }}>
        {isAdmin ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={120}
            data-testid={`staff-name-${member.id}`}
            style={{ width: '100%' }}
          />
        ) : (
          <span data-testid={`staff-name-${member.id}`}>{member.displayName}</span>
        )}
      </td>
      <td style={{ padding: 8 }} data-testid={`staff-phone-${member.id}`}>
        {member.phone}
      </td>
      <td style={{ padding: 8 }}>{member.assignedTripId ?? '—'}</td>
      <td style={{ padding: 8 }} data-testid={`staff-status-${member.id}`}>
        {member.disabled ? 'Đã vô hiệu hoá' : 'Hoạt động'}
      </td>
      {isAdmin && (
        <td style={{ padding: 8 }}>
          <button
            type="button"
            onClick={() => onRename(editName)}
            disabled={disabled || editName === member.displayName || editName.trim().length === 0}
            data-testid={`staff-rename-${member.id}`}
          >
            Lưu tên
          </button>{' '}
          <button
            type="button"
            onClick={onDisable}
            disabled={disabled || member.disabled}
            data-testid={`staff-disable-${member.id}`}
            style={{ color: 'red' }}
          >
            Vô hiệu hoá
          </button>
        </td>
      )}
    </tr>
  );
}
