'use client';

/**
 * KybDocLinks — client island that renders an operator's KYB documents with a
 * "View" affordance (Issue 077). Clicking View fetches a FRESH signed GET URL
 * from the per-doc endpoint (which audits the kyb_doc access server-side) then
 * opens it in a new tab. The signed URL is never embedded in the queue HTML — it
 * is minted on demand so it stays short-lived and the access is audit-logged at
 * the moment of viewing, not at queue-render time.
 */

import { useState } from 'react';

const TYPE_LABEL: Record<string, string> = {
  business_license: 'Business license',
  identity: 'Identity',
  payout_account: 'Payout account',
};

export interface KybDocView {
  id: string;
  type: string;
  status: string;
  /** ISO date string (yyyy-mm-dd slice rendered). */
  uploadedAt: string;
}

interface Props {
  operatorId: string;
  docs: KybDocView[];
}

export function KybDocLinks({ operatorId, docs }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(docId: string) {
    setBusyId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/operators/${operatorId}/kyb/${docId}/url`, {
        method: 'GET',
      });
      if (!res.ok) {
        setError(res.status === 404 ? 'Document not found.' : `Could not open document (${res.status}).`);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setBusyId(null);
    }
  }

  if (docs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={`kyb-empty-${operatorId}`}>
        No KYB documents submitted yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid={`kyb-docs-${operatorId}`}>
      {error ? (
        <p className="text-xs text-destructive" data-testid="kyb-doc-error">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-2 text-sm">
        {docs.map((doc) => (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => view(doc.id)}
              disabled={busyId === doc.id}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              data-testid={`kyb-view-${doc.id}`}
            >
              <span className="font-medium">{TYPE_LABEL[doc.type] ?? doc.type}</span>
              <span className="text-muted-foreground">({doc.status})</span>
              <span className="underline underline-offset-2">
                {busyId === doc.id ? 'Opening…' : 'View'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
