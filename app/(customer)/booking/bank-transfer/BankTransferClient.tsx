'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface BankTransferClientProps {
  bookingRef: string;
  confirmationToken: string;
  redirectUrl?: string;
  /** ISO deadline for completing the transfer (booking createdAt + payment window). */
  deadlineIso?: string;
}

export const MAX_REFRESHES = 180; // 15 min at a 5s interval — covers the full payment window
const POLL_INTERVAL_MS = 5000;

/** Remaining ms → "M:SS". */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BankTransferClient({
  bookingRef,
  confirmationToken,
  redirectUrl,
  deadlineIso,
}: BankTransferClientProps) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const pollCount = useRef(0);

  // Poll booking status; redirect to confirmation once paid. The 5s cadence is an
  // internal detail — surfaced to the user only as the countdown below.
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

  // Live countdown to the transfer deadline (M:SS). Stays null until mounted to
  // avoid an SSR/client hydration mismatch (server instant vs hydration instant).
  useEffect(() => {
    if (!deadlineIso) return;
    const deadline = new Date(deadlineIso).getTime();
    if (Number.isNaN(deadline)) return;
    function tick() {
      setRemainingMs(deadline - Date.now());
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadlineIso]);

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

  const expired = remainingMs !== null && remainingMs <= 0;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted p-4 text-center">
      <Loader2 className="size-6 motion-safe:animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Đang chờ xác nhận thanh toán...</p>
      {remainingMs !== null &&
        (expired ? (
          <p className="text-sm font-medium text-destructive" role="status" aria-live="polite">
            Đã hết thời gian thanh toán. Nếu bạn đã chuyển khoản, vui lòng đợi trong giây
            lát hoặc liên hệ hỗ trợ.
          </p>
        ) : (
          <p className="text-sm font-semibold text-warning-foreground" role="status" aria-live="polite">
            Vui lòng hoàn tất chuyển khoản trong vòng 15 phút — còn {formatCountdown(remainingMs)}
          </p>
        ))}
    </div>
  );
}
