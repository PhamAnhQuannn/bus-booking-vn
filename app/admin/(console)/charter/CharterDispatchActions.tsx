'use client';

/**
 * CharterDispatchActions — client island for the admin charter dispatch queue
 * (Issue 085). One row of actions per ADMIN_REVIEW charter request:
 *
 *   - Assign trực tiếp  → pick an APPROVED operator → POST assign-direct.
 *   - Đăng pool         → POST publish (enter the public pool).
 *   - Từ chối           → enter a reason → POST reject.
 *
 * Every POST sends the X-CSRF-Token header (double-submit) read from the bb_csrf
 * cookie via readCsrfToken() (AGENTS.md Issue 002/003 — CSRF on every non-safe
 * /api/* call). NO step-up — charter dispatch is an ops action, not a money
 * movement (the routes are role-gated SUPER_ADMIN|SUPPORT + TOTP only).
 *
 * On any successful action we router.refresh() so the RSC queue re-renders and the
 * just-dispatched request drops out of the ADMIN_REVIEW queue.
 *
 * REASSIGN: a request the Issue-086 sweeper routed back here from DECLINED/EXPIRED
 * is just another ADMIN_REVIEW row — these same Assign/Publish/Reject actions
 * re-act on it. There is no separate reassign route; the prior-assignee context
 * (rendered by the page) is informational only.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface OperatorOption {
  id: string;
  legalName: string;
}

interface Props {
  charterId: string;
  operators: OperatorOption[];
}

const BASE = '/api/admin/charter';

export function CharterDispatchActions({ charterId, operators }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [operatorId, setOperatorId] = useState('');
  const [reason, setReason] = useState('');

  async function post(path: string, body?: unknown): Promise<Response> {
    return fetch(`${BASE}/${charterId}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

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

  return (
    <div className="space-y-3" data-testid={`charter-actions-${charterId}`}>
      {error ? (
        <Alert variant="error" data-testid="charter-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Assign trực tiếp — APPROVED operator picker → assign-direct. */}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run('assign-direct', { operatorId });
          }}
        >
          <div className="grid flex-1 gap-1">
            <Label htmlFor={`assign-${charterId}`}>Assign trực tiếp</Label>
            <select
              id={`assign-${charterId}`}
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              data-testid="assign-operator"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <option value="">Chọn nhà xe…</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.legalName}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy || operatorId.length === 0}
            data-testid="action-assign-direct"
          >
            Giao
          </Button>
        </form>

        {/* Đăng pool — publish into the public pool. */}
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => run('publish')}
            disabled={busy}
            data-testid="action-publish"
          >
            Đăng pool
          </Button>
        </div>
      </div>

      {/* Từ chối — reason required → reject. */}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run('reject', { reason });
        }}
      >
        <div className="grid flex-1 gap-1">
          <Label htmlFor={`reject-${charterId}`}>Từ chối (lý do)</Label>
          <Input
            id={`reject-${charterId}`}
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
          Từ chối
        </Button>
      </form>
    </div>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'ILLEGAL_TRANSITION':
      return 'That action is not allowed from the request’s current status.';
    case 'CHARTER_NOT_FOUND':
      return 'Charter request no longer exists.';
    case 'NOT_APPROVED':
      return 'That operator is not approved.';
    case 'INVALID':
      return 'Invalid input.';
    default:
      return `Action failed (${res.status}).`;
  }
}
