'use client';

/**
 * Issue 084: client island for claiming a PUBLISHED public-pool charter lead.
 *
 * First-accept-wins. POST /api/op/charter/<id>/claim with the X-CSRF-Token header
 * (double-submit, read from bb_csrf via readCsrfToken — AGENTS.md 002/003). No
 * step-up (operator action — unlike admin privileged actions).
 *
 * On 200 → router.refresh(): the won lead moves out of the pool and into the
 * "accepted contracts" section (now showing customer contact). On 409 → another
 * operator already claimed it (or it expired); show the already-claimed message
 * and STILL refresh so the stale pool card drops out.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  charterId: string;
}

export function ClaimButton({ charterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/op/charter/${charterId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
      });

      if (res.status === 200) {
        router.refresh();
        return;
      }

      if (res.status === 409) {
        // Already claimed by another operator (or expired). Surface the message
        // AND refresh so the now-stale pool card disappears.
        setError('Yêu cầu đã được nhà xe khác nhận.');
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (data.error === 'NOT_APPROVED') {
        setError('Tính năng thuê xe khả dụng sau khi tài khoản được duyệt.');
      } else if (data.error === 'not_found') {
        setError('Không tìm thấy yêu cầu.');
      } else {
        setError(`Thao tác thất bại (${res.status}).`);
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid={`charter-claim-actions-${charterId}`}>
      {error ? (
        <Alert variant="error" data-testid="charter-claim-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={claim}
        disabled={busy}
        data-testid="charter-claim"
      >
        {busy ? 'Đang nhận…' : 'Nhận yêu cầu'}
      </Button>
    </div>
  );
}
