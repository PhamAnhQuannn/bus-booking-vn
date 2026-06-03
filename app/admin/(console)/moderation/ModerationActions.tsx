'use client';

/**
 * ModerationActions — client island for the admin Moderation tab (Issue 069, Part F).
 *
 * Three privileged-but-NOT-step-up surfaces (moderation is lower-priv per AC — no
 * TOTP step-up loop, unlike OperatorActions). Every non-safe /api/* call carries the
 * X-CSRF-Token double-submit header (readCsrfToken — AGENTS.md Issue 002/003) and
 * router.refresh()es the RSC on success so the queue + disabled lists re-render.
 *
 *   - ResolveReportButton(reportId)            → POST reports/<id>/resolve
 *   - DisableByIdForm                          → POST trips|routes/<id>/disable { reason }
 *   - EnableButton(kind, id)                   → POST trips|routes/<id>/enable
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BASE = '/api/admin/moderation';

type Kind = 'trips' | 'routes';

async function postModeration(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      const res = await postModeration(`reports/${reportId}/resolve`);
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
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        onClick={resolve}
        disabled={busy}
        data-testid={`resolve-report-${reportId}`}
      >
        {busy ? 'Working…' : 'Resolve'}
      </Button>
      {error ? (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function DisableByIdForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('trips');
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = id.trim();
    if (!target) {
      setError('Enter a trip or route id.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postModeration(
        `${kind}/${encodeURIComponent(target)}/disable`,
        reason.trim() ? { reason: reason.trim() } : {}
      );
      if (!res.ok) {
        setError(res.status === 404 ? 'No such trip or route.' : `Action failed (${res.status}).`);
        return;
      }
      setId('');
      setReason('');
      router.refresh();
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="disable-by-id-form">
      {error ? (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="moderation-kind">Type</Label>
          <select
            id="moderation-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            data-testid="disable-kind"
          >
            <option value="trips">Trip</option>
            <option value="routes">Route</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="moderation-id">Id</Label>
          <Input
            id="moderation-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="max-w-72"
            data-testid="disable-id"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="moderation-reason">Reason (optional)</Label>
        <Input
          id="moderation-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-md"
          data-testid="disable-reason"
        />
      </div>

      <Button type="submit" variant="destructive" disabled={busy} data-testid="disable-submit">
        {busy ? 'Working…' : 'Disable'}
      </Button>
    </form>
  );
}

export function EnableButton({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const res = await postModeration(`${kind}/${encodeURIComponent(id)}/enable`, {});
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
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        onClick={enable}
        disabled={busy}
        data-testid={`enable-${kind}-${id}`}
      >
        {busy ? 'Working…' : 'Enable'}
      </Button>
      {error ? (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
