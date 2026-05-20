'use client';

/**
 * TemplatesClient — client island for recurring trip template management (Issue 013).
 *
 * CSRF double-submit: X-CSRF-Token via tripsClient.ts on all mutations.
 *
 * daysOfMask bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (1-127).
 */

import { useState } from 'react';
import type { TemplateDto } from '@/lib/trips/tripDto';
import { createTemplateApi, patchTemplateApi } from '@/lib/api/tripsClient';

interface Props {
  initialTemplates: TemplateDto[];
}

const DAY_LABELS: Array<{ label: string; bit: number }> = [
  { label: 'T2', bit: 1 },
  { label: 'T3', bit: 2 },
  { label: 'T4', bit: 4 },
  { label: 'T5', bit: 8 },
  { label: 'T6', bit: 16 },
  { label: 'T7', bit: 32 },
  { label: 'CN', bit: 64 },
];

function maskToLabel(mask: number): string {
  return DAY_LABELS.filter((d) => mask & d.bit).map((d) => d.label).join(', ');
}

function translateError(code: string): string {
  switch (code) {
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function TemplatesClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<TemplateDto[]>(initialTemplates);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Create form
  const [routeId, setRouteId] = useState('');
  const [busId, setBusId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [depTime, setDepTime] = useState('08:00');
  const [daysMask, setDaysMask] = useState<number>(31); // Mon-Fri default
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  async function refreshTemplates() {
    const res = await fetch('/api/op/trip-templates', { credentials: 'same-origin' });
    if (res.ok) {
      const json = await res.json();
      setTemplates(json.templates ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (daysMask < 1 || daysMask > 127) {
      setMessage('Chọn ít nhất một ngày trong tuần.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await createTemplateApi({
        routeId: routeId.trim(),
        busId: busId.trim(),
        price,
        departureLocalTime: depTime,
        daysOfMask: daysMask,
        validFrom,
        validUntil,
      });
      setMessage('Đã tạo lịch cố định.');
      setRouteId('');
      setBusId('');
      setPrice(0);
      setDepTime('08:00');
      setDaysMask(31);
      setValidFrom('');
      setValidUntil('');
      await refreshTemplates();
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(templateId: string) {
    if (!confirm('Vô hiệu hoá lịch này?')) return;
    setBusy(true);
    setMessage('');
    try {
      await patchTemplateApi(templateId, { deactivatedAt: new Date().toISOString() });
      setMessage('Đã vô hiệu hoá lịch.');
      await refreshTemplates();
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(bit: number) {
    setDaysMask((m) => (m & bit ? m & ~bit : m | bit));
  }

  return (
    <div>
      {message && (
        <div
          data-testid="templates-message"
          style={{ padding: 12, marginBottom: 16, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      {/* Create form */}
      <section style={{ marginBottom: 32, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2 style={{ marginTop: 0 }}>Tạo lịch mới</h2>
        <form onSubmit={handleCreate}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            ID tuyến
            <input
              type="text"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              required
              data-testid="new-template-route"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            ID xe
            <input
              type="text"
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              required
              data-testid="new-template-bus"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Giá (VND)
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value, 10))}
              min={0}
              required
              data-testid="new-template-price"
              style={{ display: 'block', width: 160, marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Giờ khởi hành (HH:MM)
            <input
              type="time"
              value={depTime}
              onChange={(e) => setDepTime(e.target.value)}
              required
              data-testid="new-template-deptime"
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <fieldset style={{ marginBottom: 8, border: '1px solid #ccc', borderRadius: 4, padding: 8 }}>
            <legend>Ngày trong tuần</legend>
            <div style={{ display: 'flex', gap: 12 }}>
              {DAY_LABELS.map((d) => (
                <label key={d.bit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(daysMask & d.bit)}
                    onChange={() => toggleDay(d.bit)}
                    data-testid={`day-bit-${d.bit}`}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Hiệu lực từ
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              required
              data-testid="new-template-validfrom"
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Hiệu lực đến
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              required
              data-testid="new-template-validuntil"
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <button type="submit" disabled={busy} data-testid="create-template-submit">
            {busy ? 'Đang xử lý...' : 'Tạo lịch'}
          </button>
        </form>
      </section>

      {/* Template list */}
      <section>
        <h2>Danh sách lịch ({templates.length})</h2>
        {templates.length === 0 ? (
          <p>Chưa có lịch nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="templates-table">
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>ID</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Tuyến</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Xe</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Giờ</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Ngày</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Hiệu lực</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} data-testid={`template-row-${t.id}`}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                    {t.id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: 8 }}>{t.routeId}</td>
                  <td style={{ padding: 8 }}>{t.busId}</td>
                  <td style={{ padding: 8 }}>{t.departureLocalTime}</td>
                  <td style={{ padding: 8 }}>{maskToLabel(t.daysOfMask)}</td>
                  <td style={{ padding: 8 }}>
                    {t.validFrom} → {t.validUntil}
                    {t.deactivatedAt ? ' (vô hiệu)' : ''}
                  </td>
                  <td style={{ padding: 8 }}>
                    {!t.deactivatedAt && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(t.id)}
                        disabled={busy}
                        data-testid={`template-deactivate-${t.id}`}
                        style={{ color: 'red' }}
                      >
                        Vô hiệu hoá
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
