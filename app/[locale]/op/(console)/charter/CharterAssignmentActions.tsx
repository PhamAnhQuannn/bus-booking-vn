'use client';

/**
 * Issue 083: client island for accept/decline of a directly-assigned charter lead.
 *
 * Two actions, no step-up (operator action — unlike the admin privileged actions).
 * Each POST sends the X-CSRF-Token header (double-submit) read from the bb_csrf
 * cookie via readCsrfToken() (AGENTS.md 002/003 — CSRF on every non-safe /api/*).
 *
 * Decline reveals an optional reason field before confirming. On success we
 * router.refresh() so the RSC Charter tab re-renders: an accepted lead moves from
 * the "assigned" section to the "accepted" section; a declined lead drops out.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  charterId: string;
}

const BASE = '/api/op/charter';

export function CharterAssignmentActions({ charterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  async function post(action: 'accept' | 'decline', body?: unknown): Promise<Response> {
    return fetch(`${BASE}/${charterId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function run(action: 'accept' | 'decline', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await post(action, body);
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      router.refresh();
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid={`charter-actions-${charterId}`}>
      {error ? (
        <Alert variant="error" data-testid="charter-action-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {declining ? (
        <form
          className="space-y-2 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run('decline', reason.trim() ? { reason: reason.trim() } : undefined);
          }}
        >
          <Label htmlFor={`decline-reason-${charterId}`}>Lý do từ chối (không bắt buộc)</Label>
          <Input
            id={`decline-reason-${charterId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="charter-decline-reason"
            placeholder="VD: không đủ xe vào ngày đó"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={busy}
              data-testid="charter-decline-confirm"
            >
              {busy ? 'Đang gửi…' : 'Xác nhận từ chối'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDeclining(false);
                setReason('');
              }}
            >
              Hủy
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => run('accept')}
            disabled={busy}
            data-testid="charter-accept"
          >
            {busy ? 'Đang xử lý…' : 'Nhận yêu cầu'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeclining(true)}
            disabled={busy}
            data-testid="charter-decline"
          >
            Từ chối
          </Button>
        </div>
      )}
    </div>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'ILLEGAL_TRANSITION':
      return 'Yêu cầu này không còn ở trạng thái có thể xử lý.';
    case 'NOT_APPROVED':
      return 'Tính năng thuê xe khả dụng sau khi tài khoản được duyệt.';
    case 'not_found':
      return 'Không tìm thấy yêu cầu.';
    default:
      return `Thao tác thất bại (${res.status}).`;
  }
}
