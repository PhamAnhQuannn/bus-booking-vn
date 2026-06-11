'use client';

/**
 * OperatorActions — client island for the admin Operator detail page (Issue 067).
 *
 * Two privileged surfaces, both step-up gated (AGENTS.md Issue 002/003 — CSRF on
 * every non-safe /api/* call; mirrors ApprovalActions' step-up loop, Issue 065):
 *
 *   1. Suspend / Reinstate (AC1) — APPROVED operators can be suspended; SUSPENDED
 *      operators can be reinstated. Which button shows is driven by `status`.
 *   2. Fee override (AC3/AC4) — a percentage input → ppm (pct * 10000) → POST
 *      fee-override. Shows the current effective rate as a %.
 *
 * STEP-UP FLOW: POST the action → if 403 STEP_UP_REQUIRED, reveal a TOTP prompt →
 * POST /api/admin/auth/step-up { code } → on 200 the bb_admin_stepup cookie is set
 * → re-POST the original action. On success router.refresh() so the RSC re-renders.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OperatorStatus } from '@prisma/client';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  operatorId: string;
  status: OperatorStatus;
  /** Current effective platform fee in ppm (60000 = 6%). */
  currentFeePpm: number;
}

const BASE = '/api/admin/operators';

/** A pending action awaiting a step-up retry. For fee-override we stash the body. */
type Pending =
  | { kind: 'suspend' | 'reinstate' }
  | { kind: 'fee-override'; ratePpm: number };

export function OperatorActions({ operatorId, status, currentFeePpm }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fee-override form: percentage string (e.g. "6" = 6% = 60000 ppm).
  const [feePct, setFeePct] = useState((currentFeePpm / 10000).toString());

  // Step-up: when a privileged action returns 403, stash it and show the TOTP prompt.
  const [pending, setPending] = useState<Pending | null>(null);
  const [totpCode, setTotpCode] = useState('');

  function pathFor(p: Pending): string {
    return p.kind === 'fee-override' ? 'fee-override' : p.kind;
  }

  function bodyFor(p: Pending): unknown {
    return p.kind === 'fee-override' ? { ratePpm: p.ratePpm } : undefined;
  }

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

  /** Run a privileged action; on 403 STEP_UP_REQUIRED, surface the TOTP prompt. */
  async function runPrivileged(p: Pending) {
    setBusy(true);
    setError(null);
    try {
      const res = await post(pathFor(p), bodyFor(p));
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'STEP_UP_REQUIRED') {
          setPending(p);
          return;
        }
      }
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      router.refresh();
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  /** Submit the TOTP code to mint a step-up cookie, then retry the pending action. */
  async function submitStepUp() {
    if (!pending) return;
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
        setError('Mã không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
        return;
      }
      const p = pending;
      const res = await post(pathFor(p), bodyFor(p));
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      setPending(null);
      setTotpCode('');
      router.refresh();
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  function submitFeeOverride(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(feePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 20) {
      setError('Nhập phần trăm phí từ 0 đến 20.');
      return;
    }
    // %→ppm: pct * 10000 (6% → 60000 ppm). Round to an integer ppm.
    const ratePpm = Math.round(pct * 10000);
    runPrivileged({ kind: 'fee-override', ratePpm });
  }

  const canSuspend = status === 'APPROVED';
  const canReinstate = status === 'SUSPENDED';

  return (
    <div className="space-y-4" data-testid={`operator-actions-${operatorId}`}>
      {error ? (
        <Alert variant="error" data-testid="operator-action-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {pending ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor={`totp-${operatorId}`}>Nhập mã TOTP để tiếp tục</Label>
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
              {busy ? 'Đang xác minh…' : 'Xác nhận'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPending(null);
                setTotpCode('');
              }}
              disabled={busy}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {canSuspend ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => runPrivileged({ kind: 'suspend' })}
                disabled={busy}
                data-testid="action-suspend"
              >
                {busy ? 'Đang xử lý…' : 'Tạm ngưng nhà xe'}
              </Button>
            ) : null}
            {canReinstate ? (
              <Button
                type="button"
                onClick={() => runPrivileged({ kind: 'reinstate' })}
                disabled={busy}
                data-testid="action-reinstate"
              >
                {busy ? 'Đang xử lý…' : 'Khôi phục nhà xe'}
              </Button>
            ) : null}
          </div>

          <form className="space-y-2" onSubmit={submitFeeOverride} data-testid="fee-override-form">
            <Label htmlFor={`fee-${operatorId}`}>
              Ghi đè phí nền tảng (hiện tại: {(currentFeePpm / 10000).toString()}%)
            </Label>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-1">
                <Input
                  id={`fee-${operatorId}`}
                  inputMode="decimal"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                  className="max-w-24"
                  data-testid="fee-pct"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button type="submit" variant="outline" disabled={busy} data-testid="action-fee-override">
                {busy ? 'Đang xử lý…' : 'Đặt phí'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'ILLEGAL_TRANSITION':
      return 'Thao tác không được phép từ trạng thái hiện tại của nhà xe.';
    case 'OPERATOR_NOT_FOUND':
      return 'Nhà xe không còn tồn tại.';
    case 'STEP_UP_REQUIRED':
      return 'Cần xác thực lại.';
    case 'INVALID_RATE':
      return 'Tỷ lệ phí không hợp lệ. Nhập phần trăm từ 0 đến 20.';
    case 'INVALID':
      return 'Dữ liệu không hợp lệ.';
    default:
      return `Thao tác thất bại (${res.status}).`;
  }
}
