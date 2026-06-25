'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface BankTransferClientProps {
  bookingRef: string;
  confirmationToken: string;
  redirectUrl?: string;
}

const MAX_REFRESHES = 120; // ~10 min at 5s interval

export function BankTransferClient({
  bookingRef,
  confirmationToken,
  redirectUrl,
}: BankTransferClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paid, setPaid] = useState(false);

  const refreshCount = parseInt(searchParams.get('r') ?? '0', 10) || 0;
  const isTimeout = refreshCount >= MAX_REFRESHES;

  useEffect(() => {
    if (isTimeout) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
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
            return;
          }
        }
      } catch {
        // Network error — keep polling
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set('r', String(refreshCount + 1));
      router.replace(`/booking/bank-transfer?${params.toString()}`);
    }, 5000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bookingRef, confirmationToken, redirectUrl, refreshCount, isTimeout, router, searchParams]);

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
        <a
          href={`/booking/bank-transfer?${searchParams.toString()}`}
          className="text-sm font-medium text-primary underline"
        >
          Tải lại trang
        </a>
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
