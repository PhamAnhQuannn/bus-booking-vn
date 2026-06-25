'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface BankTransferClientProps {
  bookingRef: string;
  confirmationToken: string;
  redirectUrl?: string;
}

const MAX_REFRESHES = 120;
const POLL_INTERVAL_MS = 5000;

export function BankTransferClient({
  bookingRef,
  confirmationToken,
  redirectUrl,
}: BankTransferClientProps) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (isTimeout || paid) return;

    const controller = new AbortController();
    const timer = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current >= MAX_REFRESHES) {
        setIsTimeout(true);
        return;
      }

      try {
        const res = await fetch(
          `/api/bookings/status?ref=${encodeURIComponent(bookingRef)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'paid' || data.status === 'completed') {
            setPaid(true);
            const target = redirectUrl ?? `/booking/confirmation/${confirmationToken}`;
            router.replace(target);
          }
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [bookingRef, confirmationToken, redirectUrl, isTimeout, paid, router]);

  if (paid) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-success-border bg-success p-4 text-center">
        <CheckCircle2 className="size-8 text-success-foreground" />
        <p className="text-sm font-medium text-success-foreground">
          Thanh toán thành công! Đang chuyển hướng...
        </p>
      </div>
    );
  }

  if (isTimeout) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-warning-border bg-warning p-4">
        <p className="text-sm text-warning-foreground">
          Chưa nhận được thanh toán. Nếu bạn đã chuyển khoản, vui lòng đợi thêm 1-2 phút.
        </p>
        <button
          type="button"
          onClick={() => { pollCount.current = 0; setIsTimeout(false); }}
          className="text-sm font-medium text-primary underline"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted p-4 text-center">
      <Loader2 className="size-6 motion-safe:animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Đang chờ xác nhận thanh toán... Trang tự động kiểm tra mỗi 5 giây.
      </p>
    </div>
  );
}
