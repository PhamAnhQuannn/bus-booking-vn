'use client';

/**
 * UserActions — client island for the admin User detail page (Issue 066).
 *
 * Suspend / Reinstate a customer. Each POST sends the X-CSRF-Token header
 * (double-submit) read from the bb_csrf cookie via readCsrfToken() (AGENTS.md
 * Issue 002/003 — CSRF on every non-safe /api/* call). On success we
 * router.refresh() so the RSC re-renders with the new status.
 *
 * STEP-UP: suspend/reinstate are moderate-privilege actions already gated behind a
 * TOTP-verified admin session at the route layer; this slice does NOT require the
 * fresh step-up token (contrast the Approvals approve/payout actions which do). If
 * the policy tightens later, mirror ApprovalActions' STEP_UP_REQUIRED retry loop.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  customerId: string;
  /** Current status — drives which action button is shown. */
  suspended: boolean;
}

export function UserActions({ customerId, suspended }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'suspend' | 'reinstate') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/${action}`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (!res.ok) {
        setError(`Action failed (${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid={`user-actions-${customerId}`}>
      {error ? (
        <Alert variant="error" data-testid="user-action-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {suspended ? (
        <Button
          type="button"
          onClick={() => run('reinstate')}
          disabled={busy}
          data-testid="action-reinstate"
        >
          {busy ? 'Working…' : 'Reinstate account'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          onClick={() => run('suspend')}
          disabled={busy}
          data-testid="action-suspend"
        >
          {busy ? 'Working…' : 'Suspend account'}
        </Button>
      )}
    </div>
  );
}
