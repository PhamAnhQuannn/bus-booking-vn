'use client';

/**
 * ApprovalActions — client island for the admin Approvals queue (Issue 065).
 *
 * One row of action buttons per operator. Every POST sends the X-CSRF-Token header
 * (double-submit) read from the bb_csrf cookie via readCsrfToken() (AGENTS.md
 * Issue 002/003 — CSRF on every non-safe /api/* call).
 *
 * STEP-UP FLOW (AC3) for the privileged Approve + Confirm-Payout actions:
 *   1. POST the action. If the server replies 403 STEP_UP_REQUIRED, reveal a TOTP
 *      prompt instead of completing.
 *   2. The admin enters their TOTP code → POST /api/admin/auth/step-up { code }.
 *      On 200 the server sets the bb_admin_stepup cookie.
 *   3. Re-POST the original action — now the step-up cookie satisfies requireStepUp.
 * Non-privileged actions (Move to Review, Reject, Request Info) POST directly.
 *
 * On any successful action we router.refresh() so the RSC queue re-renders with the
 * new state (the just-actioned operator drops out of, or changes status within, the
 * queue). UX is intentionally minimal but functional.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { OperatorStatus } from '@prisma/client';

interface Props {
  operatorId: string;
  status: OperatorStatus;
}

type PendingAction = 'approve' | 'confirm-payout-account';

const BASE = '/api/admin/operators';

export function ApprovalActions({ operatorId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline inputs for the note-bearing actions.
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  // Step-up: when a privileged action returns 403, we stash which action is
  // pending and show the TOTP prompt.
  const [stepUpFor, setStepUpFor] = useState<PendingAction | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function post(path: string, body?: unknown): Promise<Response> {
    return fetch(`${BASE}/${operatorId}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Run a non-privileged action (no step-up). */
  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await post(path, body);
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  /** Run a privileged action; on 403 STEP_UP_REQUIRED, surface the TOTP prompt. */
  async function runPrivileged(action: PendingAction, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await post(action, body);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'STEP_UP_REQUIRED') {
          setStepUpFor(action);
          return;
        }
      }
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  /** Submit the TOTP code to mint a step-up cookie, then retry the pending action. */
  async function submitStepUp() {
    if (!stepUpFor) return;
    setBusy(true);
    setError(null);
    try {
      const stepRes = await fetch('/api/admin/auth/step-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ code: totpCode }),
      });
      if (!stepRes.ok) {
        setError('Invalid or expired code. Please try again.');
        return;
      }
      // Step-up cookie set — retry the original privileged action.
      const action = stepUpFor;
      const res = await post(action);
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      setStepUpFor(null);
      setTotpCode('');
      router.refresh();
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  const canReview = status === 'PENDING_REVIEW';
  const canDecide = status === 'UNDER_REVIEW';

  return (
    <div className="space-y-3" data-testid={`approval-actions-${operatorId}`}>
      {error ? (
        <Alert variant="error" data-testid="approval-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stepUpFor ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor={`totp-${operatorId}`}>Enter your TOTP code to continue</Label>
          <div className="flex gap-2">
            <Input
              id={`totp-${operatorId}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="max-w-32"
              data-testid="stepup-code"
            />
            <Button type="button" onClick={submitStepUp} disabled={busy || totpCode.length === 0}>
              {busy ? 'Verifying…' : 'Confirm'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStepUpFor(null);
                setTotpCode('');
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          {canReview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => run('under-review')}
              disabled={busy}
              data-testid="action-under-review"
            >
              Move to review
            </Button>
          ) : null}

          {canDecide ? (
            <Button
              type="button"
              size="sm"
              onClick={() => runPrivileged('approve')}
              disabled={busy}
              data-testid="action-approve"
            >
              Approve
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runPrivileged('confirm-payout-account')}
            disabled={busy}
            data-testid="action-confirm-payout"
          >
            Confirm payout account
          </Button>
        </div>
      )}

      {!stepUpFor && canDecide ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run('reject', { reason });
            }}
          >
            <div className="grid flex-1 gap-1">
              <Label htmlFor={`reject-${operatorId}`}>Reject reason</Label>
              <Input
                id={`reject-${operatorId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="reject-reason"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={busy || reason.trim().length === 0}
              data-testid="action-reject"
            >
              Reject
            </Button>
          </form>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run('request-info', { note });
            }}
          >
            <div className="grid flex-1 gap-1">
              <Label htmlFor={`note-${operatorId}`}>Request info note</Label>
              <Input
                id={`note-${operatorId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="request-info-note"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={busy || note.trim().length === 0}
              data-testid="action-request-info"
            >
              Request info
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'ILLEGAL_TRANSITION':
      return 'That action is not allowed from the operator’s current status.';
    case 'OPERATOR_NOT_FOUND':
      return 'Operator no longer exists.';
    case 'STEP_UP_REQUIRED':
      return 'Re-authentication required.';
    case 'INVALID':
      return 'Invalid input.';
    default:
      return `Action failed (${res.status}).`;
  }
}
