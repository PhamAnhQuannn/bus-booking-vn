'use client';

/**
 * CopyButton — copy-to-clipboard affordance for the bank-transfer manual-fallback
 * fields (account number, transfer content, amount). A typo hand-transcribing the
 * transfer content breaks webhook/SePay reconciliation, so this is the highest-value
 * micro-interaction on the page (audit F4).
 *
 * Audit F20: hit area grown to 44×44 (icon stays visually small); `showLabel` adds
 * a visible "Sao chép" text next to the icon for the Nội dung CK row.
 * Audit F22: Clipboard API can be denied (Zalo/FB in-app webviews) — the catch
 * branch now surfaces a visible tooltip instead of failing silently.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CopyButton({
  value,
  label,
  showLabel = false,
}: {
  value: string;
  label: string;
  showLabel?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      // Clipboard API unavailable (permissions/non-secure context/in-app webview)
      // — surface a visible fallback instead of a silent no-op.
      setStatus('failed');
    } finally {
      setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={status === 'copied' ? `Đã sao chép ${label}` : `Sao chép ${label}`}
        className={cn(
          'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'
        )}
      >
        {status === 'copied' ? (
          <Check className="size-4 text-success-foreground" />
        ) : (
          <Copy className="size-4" />
        )}
        {showLabel && <span className="text-xs font-medium">{status === 'copied' ? 'Đã sao chép' : 'Sao chép'}</span>}
      </button>
      {status === 'failed' && (
        <span
          role="status"
          className="absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded-md bg-destructive px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-e2"
        >
          Không sao chép được — vui lòng chọn và sao chép thủ công
        </span>
      )}
    </span>
  );
}
