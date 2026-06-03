'use client';

/**
 * ManifestRefresh — client island for manifest page (Issue 014 AC7).
 *
 * Handles manual refresh button: calls GET /api/op/manifest/:tripId and
 * updates the "Last updated" timestamp (AC7).
 * AC6: renders manifest table WITHOUT seat-number column.
 *
 * Online-only (Issue 039): the per-row picked-up / cash-collected action
 * buttons were removed along with their mutation routes. The manifest is now a
 * read-only roster.
 *
 * Issue 073: boarding state surfaced — a "Lên xe" (boarding) badge column shows
 * checked-in / no-show / not-boarded, and a token-entry scan box plus per-row
 * Check-in / No-show buttons drive POST /api/op/scan, /check-in, /no-show. Full
 * camera-QR scanning is DEFERRED; manual token entry satisfies the endpoint AC.
 *
 * Design-system surface: Table list, Badge contact/payment status, Alert on
 * load failure, Button refresh. Every data-testid is preserved.
 */

import { useState } from 'react';
import type { ManifestRow } from '@/lib/manifest/getManifest';
import type { BookingStatus } from '@prisma/client';
import { bookingStatusDisplay, contactStatusDisplay } from '@/lib/op/statusLabels';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  tripId: string;
  initialGeneratedAt: string;
  initialRows: ManifestRow[];
}

export default function ManifestRefresh({ tripId, initialGeneratedAt, initialRows }: Props) {
  const [rows, setRows] = useState<ManifestRow[]>(initialRows);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanToken, setScanToken] = useState('');
  const [scanMsg, setScanMsg] = useState('');
  const [scanError, setScanError] = useState('');
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/op/manifest/${tripId}`, { credentials: 'same-origin' });
      if (!res.ok) {
        setError('Lỗi tải manifest. Vui lòng thử lại.');
        return;
      }
      const json = await res.json();
      setRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  // Issue 073: resolve a scanned/pasted ticket token to a booking, then check in.
  async function handleScan() {
    const token = scanToken.trim();
    if (!token) return;
    setScanMsg('');
    setScanError('');
    setBusyBookingId('scan');
    try {
      const res = await fetch('/api/op/scan', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ token }),
      });
      if (res.status === 404) {
        setScanError('Vé không hợp lệ hoặc không thuộc chuyến của bạn.');
        return;
      }
      if (res.status === 422) {
        setScanError('Vé chưa thanh toán — không thể lên xe.');
        return;
      }
      if (!res.ok) {
        setScanError('Lỗi quét vé. Vui lòng thử lại.');
        return;
      }
      const { booking } = await res.json();
      setScanMsg(`Tìm thấy vé ${booking.bookingRef} (${booking.buyerName}). Đang lên xe…`);
      await handleCheckIn(booking.id);
      setScanToken('');
    } finally {
      setBusyBookingId(null);
    }
  }

  async function handleCheckIn(bookingId: string) {
    setScanError('');
    setBusyBookingId(bookingId);
    try {
      const res = await fetch(`/api/op/bookings/${bookingId}/check-in`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (!res.ok) {
        setScanError('Không thể xác nhận lên xe.');
        return;
      }
      const json = await res.json();
      setScanMsg(json.alreadyCheckedIn ? 'Hành khách đã lên xe trước đó.' : 'Đã xác nhận lên xe.');
      await handleRefresh();
    } finally {
      setBusyBookingId(null);
    }
  }

  async function handleNoShow(bookingId: string) {
    setScanError('');
    setBusyBookingId(bookingId);
    try {
      const res = await fetch(`/api/op/bookings/${bookingId}/no-show`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (res.status === 422) {
        setScanError('Hành khách đã lên xe — không thể đánh dấu vắng mặt.');
        return;
      }
      if (!res.ok) {
        setScanError('Không thể đánh dấu vắng mặt.');
        return;
      }
      setScanMsg('Đã đánh dấu vắng mặt.');
      await handleRefresh();
    } finally {
      setBusyBookingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          data-testid="manifest-refresh-btn"
        >
          {loading ? 'Đang tải…' : 'Làm mới'}
        </Button>
        <span data-testid="manifest-last-updated" className="text-sm text-muted-foreground">
          Cập nhật lần cuối: {new Date(generatedAt).toLocaleString('vi-VN')}
        </span>
      </div>

      {/* Issue 073: token-entry scan box → resolve + check-in. Camera QR deferred. */}
      <Card className="space-y-2 p-4">
        <label htmlFor="scan-token" className="text-sm font-medium">
          Quét vé (dán mã token)
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="scan-token"
            value={scanToken}
            onChange={(e) => setScanToken(e.target.value)}
            placeholder="Dán mã vé đã quét…"
            data-testid="scan-token-input"
            className="max-w-md flex-1"
          />
          <Button
            type="button"
            onClick={handleScan}
            disabled={busyBookingId !== null || scanToken.trim().length === 0}
            data-testid="scan-submit-btn"
          >
            Lên xe
          </Button>
        </div>
        {scanMsg && (
          <p className="text-sm text-success" data-testid="scan-message">{scanMsg}</p>
        )}
        {scanError && (
          <Alert variant="error" data-testid="scan-error">
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        )}
      </Card>

      {error && (
        <Alert variant="error" data-testid="manifest-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Không có hành khách nào.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          {/* AC6: NO seat-number column */}
          <Table data-testid="manifest-table">
            <TableHeader>
              <TableRow>
                <TableHead>Mã đặt</TableHead>
                <TableHead>Hành khách</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Vé</TableHead>
                <TableHead>Điểm đón</TableHead>
                <TableHead>Liên lạc</TableHead>
                <TableHead>TT thanh toán</TableHead>
                <TableHead>Lên xe</TableHead>
                <TableHead>Boarding</TableHead>
                <TableHead>Cờ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const contact = contactStatusDisplay(row.contactStatus);
                const payment = bookingStatusDisplay(row.paymentStatus as BookingStatus);
                return (
                  <TableRow
                    key={row.bookingId}
                    data-testid={`manifest-row-${row.bookingId}`}
                    className={row.escalatedAt ? 'bg-warning/10' : undefined}
                  >
                    <TableCell className="font-mono text-xs">{row.bookingRef}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="tabular-nums">{row.phone}</TableCell>
                    <TableCell className="tabular-nums">{row.ticketCount}</TableCell>
                    <TableCell>{row.pickupPointName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={contact.variant}>{contact.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.variant}>{payment.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.pickedUpAt ? '✓' : '—'}</TableCell>
                    <TableCell data-testid={`manifest-boarding-${row.bookingId}`}>
                      {row.checkedInAt ? (
                        <Badge variant="success">Đã lên xe</Badge>
                      ) : row.noShowAt ? (
                        <Badge variant="danger">Vắng mặt</Badge>
                      ) : (
                        <span className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyBookingId !== null}
                            onClick={() => handleCheckIn(row.bookingId)}
                            data-testid={`manifest-checkin-${row.bookingId}`}
                          >
                            Lên xe
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busyBookingId !== null}
                            onClick={() => handleNoShow(row.bookingId)}
                            data-testid={`manifest-noshow-${row.bookingId}`}
                          >
                            Vắng
                          </Button>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex gap-1">
                        {row.manualFlag && <span aria-label="Thủ công" title="Thủ công">✏</span>}
                        {row.cashFlag && <span aria-label="Tiền mặt" title="Tiền mặt">💵</span>}
                        {row.escalatedAt && (
                          <span aria-label="Cần xử lý" title="Cần xử lý">⚠</span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
