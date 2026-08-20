'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface BankTransferClientProps {
  bookingRef: string;
  confirmationToken: string;
  redirectUrl?: string;
  /** ISO deadline for completing the transfer (booking createdAt + payment window). */
  deadlineIso?: string;
  /** Payment window in minutes — the true capacity/expiry bound (PSP_WINDOW_MINUTES),
   *  passed from the server page so this client component never imports the server-only
   *  holdRepo. Drives both the poll cap and the countdown copy so they can't drift. */
  windowMinutes: number;
}

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
  windowMinutes,
}: BankTransferClientProps) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const pollCount = useRef(0);
  // Poll cap = the payment window at the 5s cadence; derived from the prop so it stays
  // in step with the countdown and the backend expiry bound.
  const maxRefreshes = (windowMinutes * 60_000) / POLL_INTERVAL_MS;

  // Poll booking status; redirect to confirmation once paid. The 5s cadence is an
  // internal detail — surfaced to the user only as the countdown below.
  useEffect(() => {
    if (isTimeout || paid || failed) return;

    const controller = new AbortController();
    const timer = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current >= maxRefreshes) {
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
          } else if (data.status === 'payment_failed_expired' || data.status === 'refunded') {
            // Terminal failure — the booking will never become paid. Stop the "still
            // waiting" loop and show an honest dead-end + a way forward (mirrors the
            // /booking/result page's isFailed branch).
            setFailed(true);
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
  }, [bookingRef, confirmationToken, redirectUrl, isTimeout, paid, failed, maxRefreshes, router]);

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

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
        <XCircle className="size-8 text-destructive" />
        <p className="text-sm text-destructive">
          Giao dịch chưa hoàn tất hoặc đã bị hủy. Vui lòng thử lại với chuyến xe khác.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Tìm chuyến khác
        </Link>
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
            Vui lòng hoàn tất chuyển khoản trong vòng {windowMinutes} phút — còn {formatCountdown(remainingMs)}
          </p>
        ))}
    </div>
  );
}
