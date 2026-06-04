'use client';

/**
 * ResubmitButton — client island for the operator status page (Issue 079).
 *
 * Shown only in the REJECTED state. POSTs /api/op/resubmit with X-CSRF-Token
 * (double-submit per AGENTS.md Issue 007), then router.refresh() so the server
 * component re-reads the now-PENDING_REVIEW status and re-renders the next-steps
 * copy. No optimistic state — the server row is the source of truth.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResubmitButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleResubmit() {
    setSubmitting(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch('/api/op/resubmit', {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setIsError(true);
        setMessage(
          data.error === 'ILLEGAL_TRANSITION'
            ? 'Không thể gửi lại hồ sơ từ trạng thái hiện tại.'
            : `Gửi lại hồ sơ thất bại (${res.status}).`
        );
        return;
      }
      setIsError(false);
      setMessage('Đã gửi lại hồ sơ để xét duyệt.');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <Alert variant={isError ? 'error' : 'success'} data-testid="resubmit-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        onClick={handleResubmit}
        disabled={submitting}
        data-testid="resubmit-button"
      >
        {submitting ? 'Đang gửi…' : 'Gửi lại hồ sơ'}
      </Button>
    </div>
  );
}
