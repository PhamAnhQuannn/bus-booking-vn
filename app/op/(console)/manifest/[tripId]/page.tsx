/**
 * /op/manifest/:tripId — Boarding manifest page (Issue 014 AC6, AC7).
 *
 * Server component: reads getManifest in-process.
 * MUST NOT self-fetch own API (Issue 002/003 hardened rule).
 * Client island handles refresh button + "Last updated" timestamp (AC7).
 * AC6: NO seat-number column.
 */

import { redirect } from 'next/navigation';
import { Bus } from 'lucide-react';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getManifest } from '@/lib/manifest/getManifest';
import { PageHeader } from '@/components/op/PageHeader';
import { EmptyState } from '@/components/op/EmptyState';
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
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <PageHeader
          breadcrumb={[{ label: 'Chuyến đi', href: '/op/trips' }, { label: 'Manifest' }]}
          title="Manifest"
        />
        <EmptyState
          icon={<Bus />}
          variant="card"
          title="Không tìm thấy chuyến xe."
          description="Chuyến đã bị xoá hoặc không thuộc nhà xe của bạn."
          action={{ label: 'Quay lại danh sách chuyến', href: '/op/trips' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[
          { label: 'Chuyến đi', href: '/op/trips' },
          { label: `Chuyến ${tripId.slice(0, 8)}…`, href: `/op/trips/${tripId}` },
          { label: 'Manifest' },
        ]}
        title={`Manifest chuyến ${tripId.slice(0, 8)}…`}
      />

      {/* AC7: ManifestRefresh handles refresh button + Last updated timestamp */}
      <ManifestRefresh
        tripId={tripId}
        initialGeneratedAt={manifest.generatedAt}
        initialRows={manifest.rows}
      />
    </div>
  );
}
