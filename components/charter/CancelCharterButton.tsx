'use client';

/**
 * CancelCharterButton — customer cancel for a pre-ACCEPT charter request (Issue 082).
 *
 * Shown on the public status page only when the status is customer-cancellable
 * (the server decides; this component just renders the action). POSTs to the
 * ref-keyed cancel route with the CSRF double-submit header, then router.refresh()
 * so the RSC re-reads the now-CANCELLED status. A 422 (already accepted/terminal,
 * e.g. a race) surfaces an inline message and still refreshes to show live state.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { readCsrfToken } from '@/lib/auth/csrfClient';

export function CancelCharterButton({ charterRef }: { charterRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/charter/${encodeURIComponent(charterRef)}/cancel`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      if (res.status === 422) {
        setError('Yêu cầu đã được nhà xe nhận hoặc đã kết thúc — không thể hủy.');
        router.refresh();
        return;
      }
      setError('Hủy yêu cầu thất bại. Vui lòng thử lại.');
    } catch {
      setError('Có lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={handleCancel} className="gap-2">
        <XCircle className="size-4" aria-hidden="true" />
        {busy ? 'Đang hủy…' : 'Hủy yêu cầu'}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
