'use client';

/**
 * PaymentDeadline — live countdown to the 15-minute bank-transfer payment window
 * (lib/jobs/reconcilePayments.ts RECONCILE_THRESHOLD_MINUTES).
 *
 * Audit F21: R1 showed this as a static clock time at the bottom of the page,
 * clipped below the fold at 1440 and buried deep on 390 — the manual-transfer
 * customer (the slow path the deadline exists for) never saw it. Rendered
 * directly under the page subtitle so it's visible on first paint at any
 * viewport, as a live "còn N phút" countdown rather than an absolute clock
 * time (avoids the user having to know/compare the current time).
 *
 * Renders nothing until mount to avoid an SSR/client text mismatch from the
 * server-render instant vs. the hydration instant (same reasoning as HoldTimer).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return minutes > 0 ? `còn ${minutes} phút` : 'đã hết hạn';
}

export function PaymentDeadline({ deadlineIso }: { deadlineIso: string }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(deadlineIso).getTime();
    function tick() {
      setRemainingMs(deadline - Date.now());
    }
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [deadlineIso]);

  if (remainingMs === null) return null;

  const expired = remainingMs <= 0;
  const isWarning = !expired && remainingMs <= 5 * 60_000;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'text-center text-sm font-semibold',
        expired || isWarning ? 'text-destructive' : 'text-warning-foreground'
      )}
    >
      {expired
        ? 'Đã quá thời gian giữ chỗ. Nếu bạn đã chuyển khoản, vui lòng liên hệ hỗ trợ.'
        : `Vui lòng chuyển khoản để giữ chỗ — ${formatRemaining(remainingMs)}.`}
    </p>
  );
}
