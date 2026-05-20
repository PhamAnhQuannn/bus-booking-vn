'use client';

/**
 * TemplatesClient — client island for recurring trip template management (Issue 013).
 *
 * CSRF double-submit: X-CSRF-Token via tripsClient.ts on all mutations.
 *
 * daysOfMask bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (1-127).
 *
 * Design-system surface: Card create form (Label/Input + Checkbox day bits via
 * onCheckedChange), Table list, Badge active state, Alert messages, Button
 * actions. Every data-testid is preserved (sandbox-gated e2e keys off them).
 */

import { useState } from 'react';
import type { TemplateDto } from '@/lib/trips/tripDto';
import { createTemplateApi, patchTemplateApi } from '@/lib/api/tripsClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [isError, setIsError] = useState(false);

  // Create form
  const [routeId, setRouteId] = useState('');
  const [busId, setBusId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [depTime, setDepTime] = useState('08:00');
  const [daysMask, setDaysMask] = useState<number>(31); // Mon-Fri default
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(err: unknown) {
    const data = (err as { data?: { error?: string } }).data;
    setMessage(translateError(data?.error ?? ''));
    setIsError(true);
  }

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
      setIsError(true);
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
      ok('Đã tạo lịch cố định.');
      setRouteId('');
      setBusId('');
      setPrice(0);
      setDepTime('08:00');
      setDaysMask(31);
      setValidFrom('');
      setValidUntil('');
      await refreshTemplates();
    } catch (err) {
      fail(err);
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
      ok('Đã vô hiệu hoá lịch.');
      await refreshTemplates();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(bit: number) {
    setDaysMask((m) => (m & bit ? m & ~bit : m | bit));
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="templates-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Tạo lịch mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-route">ID tuyến</Label>
              <Input
                id="new-template-route"
                type="text"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                required
                data-testid="new-template-route"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-bus">ID xe</Label>
              <Input
                id="new-template-bus"
                type="text"
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                required
                data-testid="new-template-bus"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-price">Giá (VND)</Label>
              <Input
                id="new-template-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value, 10))}
                min={0}
                required
                data-testid="new-template-price"
                className="w-40"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-deptime">Giờ khởi hành (HH:MM)</Label>
              <Input
                id="new-template-deptime"
                type="time"
                value={depTime}
                onChange={(e) => setDepTime(e.target.value)}
                required
                data-testid="new-template-deptime"
                className="w-40"
              />
            </div>
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium">Ngày trong tuần</legend>
              <div className="flex flex-wrap gap-4">
                {DAY_LABELS.map((d) => (
                  <Label key={d.bit} className="flex items-center gap-2 font-normal">
                    {/* base-ui Checkbox: onCheckedChange, NOT onChange. */}
                    <Checkbox
                      checked={Boolean(daysMask & d.bit)}
                      onCheckedChange={() => toggleDay(d.bit)}
                      data-testid={`day-bit-${d.bit}`}
                    />
                    {d.label}
                  </Label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-validfrom">Hiệu lực từ</Label>
              <Input
                id="new-template-validfrom"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
                data-testid="new-template-validfrom"
                className="w-48"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-template-validuntil">Hiệu lực đến</Label>
              <Input
                id="new-template-validuntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
                data-testid="new-template-validuntil"
                className="w-48"
              />
            </div>
            <div>
              <Button type="submit" disabled={busy} data-testid="create-template-submit">
                {busy ? 'Đang xử lý...' : 'Tạo lịch'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Template list */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Danh sách lịch ({templates.length})</h2>
        {templates.length === 0 ? (
          <Card>
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Chưa có lịch nào.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden py-0">
            <Table data-testid="templates-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tuyến</TableHead>
                  <TableHead>Xe</TableHead>
                  <TableHead>Giờ</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Hiệu lực</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                    <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs">{t.routeId}</TableCell>
                    <TableCell className="font-mono text-xs">{t.busId}</TableCell>
                    <TableCell className="tabular-nums">{t.departureLocalTime}</TableCell>
                    <TableCell>{maskToLabel(t.daysOfMask)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {t.validFrom} → {t.validUntil}
                      {t.deactivatedAt && (
                        <Badge variant="danger" className="ml-2">
                          Vô hiệu
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!t.deactivatedAt && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeactivate(t.id)}
                          disabled={busy}
                          data-testid={`template-deactivate-${t.id}`}
                        >
                          Vô hiệu hoá
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
