'use client';

/**
 * RouteEditDialog — modal for creating or editing a route (Issue 012).
 *
 * Props:
 *   mode="create" → empty form, title "Thêm tuyến mới"
 *   mode="edit"   → pre-filled from `route`, title "Sửa tuyến"
 *
 * onSave(origin, destination, durationMinutes) is called on valid submit.
 * onClose is called on cancel or backdrop click.
 */

import { useState } from 'react';
import type { RouteItem } from './RoutesClient';

interface CreateProps {
  mode: 'create';
  onSave: (origin: string, destination: string, durationMinutes: number) => Promise<void>;
  onClose: () => void;
  disabled: boolean;
}

interface EditProps {
  mode: 'edit';
  route: RouteItem;
  onSave: (origin: string, destination: string, durationMinutes: number) => Promise<void>;
  onClose: () => void;
  disabled: boolean;
}

type Props = CreateProps | EditProps;

export default function RouteEditDialog(props: Props) {
  const { mode, onSave, onClose, disabled } = props;
  const initial = mode === 'edit' ? props.route : null;

  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [durationMinutes, setDurationMinutes] = useState<number>(initial?.durationMinutes ?? 60);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSave(origin.trim(), destination.trim(), durationMinutes);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="route-edit-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          padding: 24,
          minWidth: 340,
          maxWidth: 480,
          width: '100%',
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {mode === 'create' ? 'Thêm tuyến mới' : 'Sửa tuyến'}
        </h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Điểm đi
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              disabled={disabled}
              data-testid="route-dialog-origin"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Điểm đến
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              disabled={disabled}
              data-testid="route-dialog-destination"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 16 }}>
            Thời gian (phút)
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
              required
              min={1}
              max={7200}
              disabled={disabled}
              data-testid="route-dialog-duration"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              data-testid="route-dialog-cancel"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={disabled || !origin.trim() || !destination.trim()}
              data-testid="route-dialog-save"
            >
              {disabled ? 'Đang xử lý...' : mode === 'create' ? 'Tạo' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
