'use client';

/**
 * SystemActions — client island for the admin System tab (Issue 070).
 *
 * One module, several action components (the page mounts the right one per row /
 * section):
 *   - FlagToggle        → POST /api/admin/system/flags { key, enabled }
 *   - InviteAdminForm    → POST /api/admin/admins { email, role } (shows tempPassword ONCE)
 *   - RevokeAdminButton  → POST /api/admin/system/admins/<id>/revoke
 *   - ChangeRoleControl  → POST /api/admin/system/admins/<id>/role { role }
 *
 * EVERY POST goes through the step-up loop (mirrors FinanceActions, Issue 068):
 * POST the action → if 403 STEP_UP_REQUIRED reveal a TOTP prompt → POST
 * /api/admin/auth/step-up { code } → on 200 the bb_admin_stepup cookie is set →
 * re-POST the original action. CSRF via readCsrfToken on every non-safe call
 * (Issue 002/003). On success router.refresh() so the RSC re-renders.
 *
 * The Invite flow is special-cased: its success path surfaces the returned
 * tempPassword ONCE (the only place a temp password is ever shown) rather than
 * refreshing immediately — the caller dismisses it, then the table re-reads.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminRole } from '@prisma/client';

import { readCsrfToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ROLES: AdminRole[] = ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'];

/** A pending request awaiting a step-up retry: the path + the JSON body to re-POST. */
interface PendingReq {
  path: string;
  body: unknown;
}

/**
 * Shared step-up POST machinery. `onSuccess` receives the parsed JSON of the final
 * successful response so the Invite flow can pull the tempPassword out; other
 * callers ignore it and refresh.
 */
function useStepUpAction(onSuccess: (json: unknown) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReq | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function rawPost(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function run(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await rawPost(path, body);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'STEP_UP_REQUIRED') {
          setPending({ path, body });
          return;
        }
      }
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      onSuccess(await res.json().catch(() => ({})));
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

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
        setError('Invalid or expired code. Please try again.');
        return;
      }
      const res = await rawPost(pending.path, pending.body);
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      setPending(null);
      setTotpCode('');
      onSuccess(await res.json().catch(() => ({})));
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    setError,
    pending,
    totpCode,
    setTotpCode,
    run,
    submitStepUp,
    cancelStepUp: () => {
      setPending(null);
      setTotpCode('');
    },
  };
}

/** TOTP step-up prompt — rendered when a request returned STEP_UP_REQUIRED. */
function StepUpPrompt({
  id,
  busy,
  totpCode,
  setTotpCode,
  onConfirm,
  onCancel,
}: {
  id: string;
  busy: boolean;
  totpCode: string;
  setTotpCode: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3" data-testid="system-stepup">
      <Label htmlFor={`totp-${id}`}>Enter your TOTP code to continue</Label>
      <div className="flex gap-2">
        <Input
          id={`totp-${id}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          className="max-w-32"
          data-testid="system-stepup-code"
        />
        <Button type="button" onClick={onConfirm} disabled={busy || totpCode.length === 0}>
          {busy ? 'Verifying…' : 'Confirm'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ErrorBlock({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Alert variant="error" data-testid="system-action-error">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

// ── FlagToggle ────────────────────────────────────────────────────────────────

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const router = useRouter();
  const action = useStepUpAction(() => router.refresh());

  return (
    <div className="space-y-2">
      <ErrorBlock error={action.error} />
      {action.pending ? (
        <StepUpPrompt
          id={`flag-${flagKey}`}
          busy={action.busy}
          totpCode={action.totpCode}
          setTotpCode={action.setTotpCode}
          onConfirm={action.submitStepUp}
          onCancel={action.cancelStepUp}
        />
      ) : (
        <Button
          type="button"
          variant={enabled ? 'outline' : 'default'}
          disabled={action.busy}
          onClick={() => action.run('/api/admin/system/flags', { key: flagKey, enabled: !enabled })}
          data-testid={`flag-toggle-${flagKey}`}
        >
          {action.busy ? 'Working…' : enabled ? 'Disable' : 'Enable'}
        </Button>
      )}
    </div>
  );
}

// ── InviteAdminForm ───────────────────────────────────────────────────────────

export function InviteAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('SUPPORT');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const action = useStepUpAction((json) => {
    const tp = (json as { tempPassword?: string } | null)?.tempPassword;
    if (tp) {
      setTempPassword(tp);
      setEmail('');
    }
    router.refresh();
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Enter a valid email address.');
      return;
    }
    action.run('/api/admin/admins', { email: email.trim(), role });
  }

  if (tempPassword) {
    return (
      <Alert data-testid="invite-temp-password">
        <AlertDescription>
          <p className="font-medium">Invite created. Temporary password (shown once):</p>
          <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-sm">
            {tempPassword}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            Convey this to the invitee out-of-band. It will not be shown again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => setTempPassword(null)}
          >
            Done
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form className="space-y-2" onSubmit={submit} data-testid="invite-admin-form">
      <ErrorBlock error={action.error} />
      {localError ? (
        <Alert variant="error">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}
      {action.pending ? (
        <StepUpPrompt
          id="invite"
          busy={action.busy}
          totpCode={action.totpCode}
          setTotpCode={action.setTotpCode}
          onConfirm={action.submitStepUp}
          onCancel={action.cancelStepUp}
        />
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new-admin@example.com"
              className="max-w-64"
              data-testid="invite-email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="min-h-9 rounded-md border border-border px-3 py-1.5 text-sm"
              data-testid="invite-role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={action.busy} data-testid="invite-submit">
            {action.busy ? 'Working…' : 'Invite admin'}
          </Button>
        </div>
      )}
    </form>
  );
}

// ── RevokeAdminButton ─────────────────────────────────────────────────────────

export function RevokeAdminButton({ adminId }: { adminId: string }) {
  const router = useRouter();
  const action = useStepUpAction(() => router.refresh());

  return (
    <div className="space-y-2">
      <ErrorBlock error={action.error} />
      {action.pending ? (
        <StepUpPrompt
          id={`revoke-${adminId}`}
          busy={action.busy}
          totpCode={action.totpCode}
          setTotpCode={action.setTotpCode}
          onConfirm={action.submitStepUp}
          onCancel={action.cancelStepUp}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={action.busy}
          onClick={() => action.run(`/api/admin/system/admins/${adminId}/revoke`, undefined)}
          data-testid={`revoke-admin-${adminId}`}
        >
          {action.busy ? 'Working…' : 'Revoke'}
        </Button>
      )}
    </div>
  );
}

// ── ChangeRoleControl ─────────────────────────────────────────────────────────

export function ChangeRoleControl({ adminId, currentRole }: { adminId: string; currentRole: AdminRole }) {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole>(currentRole);
  const action = useStepUpAction(() => router.refresh());

  return (
    <div className="space-y-2">
      <ErrorBlock error={action.error} />
      {action.pending ? (
        <StepUpPrompt
          id={`role-${adminId}`}
          busy={action.busy}
          totpCode={action.totpCode}
          setTotpCode={action.setTotpCode}
          onConfirm={action.submitStepUp}
          onCancel={action.cancelStepUp}
        />
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="min-h-9 rounded-md border border-border px-2 py-1 text-sm"
            data-testid={`role-select-${adminId}`}
            aria-label="Change role"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={action.busy || role === currentRole}
            onClick={() => action.run(`/api/admin/system/admins/${adminId}/role`, { role })}
            data-testid={`role-apply-${adminId}`}
          >
            {action.busy ? 'Working…' : 'Apply'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── error copy ────────────────────────────────────────────────────────────────

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'STEP_UP_REQUIRED':
      return 'Re-authentication required.';
    case 'UNKNOWN_FLAG':
      return 'Unknown feature flag.';
    case 'EMAIL_IN_USE':
      return 'An admin with that email already exists.';
    case 'NO_SELF_REVOKE':
      return 'You cannot revoke your own account.';
    case 'NO_SELF_ROLE_CHANGE':
      return 'You cannot change your own role.';
    case 'INVALID_ROLE':
      return 'Invalid role.';
    case 'ADMIN_NOT_FOUND':
      return 'That admin no longer exists.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'INVALID':
      return 'Invalid input.';
    default:
      return `Action failed (${res.status}).`;
  }
}
