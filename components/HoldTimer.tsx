'use client';

/**
 * HoldTimer — countdown display for the seat hold.
 *
 * Shows MM:SS countdown derived from holdTimerStore.
 * Applies a warning class (text-destructive) when T-2 minutes or less remain.
 */

import { useHoldTimerStore } from '@/lib/state/holdTimerStore';

function formatMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function HoldTimer() {
  const { remainingMs, isWarning, isExpired } = useHoldTimerStore();

  if (isExpired) return null;

  return (
    <div
      className={`flex items-center gap-2 text-sm font-medium ${
        isWarning ? 'text-destructive' : 'text-muted-foreground'
      }`}
      aria-live="polite"
      aria-label={`Thời gian giữ chỗ còn lại: ${formatMs(remainingMs)}`}
    >
      <span>⏱</span>
      <span data-testid="hold-timer-countdown">{formatMs(remainingMs)}</span>
      <span>còn lại</span>
    </div>
  );
}
