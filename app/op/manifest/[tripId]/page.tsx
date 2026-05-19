/**
 * /op/manifest/:tripId — Boarding manifest page (Issue 014 AC6, AC7).
 *
 * Server component: reads getManifest in-process.
 * MUST NOT self-fetch own API (Issue 002/003 hardened rule).
 * Client island handles refresh button + "Last updated" timestamp (AC7).
 * AC6: NO seat-number column.
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getManifest } from '@/lib/manifest/getManifest';
import ManifestRefresh from './ManifestRefresh';

type PageProps = { params: Promise<{ tripId: string }> };

export default async function ManifestPage({ params }: PageProps) {
  const { tripId } = await params;
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const manifest = await getManifest(session.operatorId, tripId);

  if (!manifest) {
    return (
      <main style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px' }}>
        <h1>Manifest</h1>
        <p>Không tìm thấy chuyến xe.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px' }}>
      <h1>Manifest chuyến {tripId.slice(0, 8)}…</h1>

      {/* AC7: ManifestRefresh handles refresh button + Last updated timestamp */}
      <ManifestRefresh
        tripId={tripId}
        initialGeneratedAt={manifest.generatedAt}
        initialRows={manifest.rows}
      />
    </main>
  );
}
