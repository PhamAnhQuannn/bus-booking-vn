/**
 * /op/pickup-areas — Operator pickup-area menu (server component, Issue 105).
 *
 * The operator's reusable list of personal-pickup areas (huyện/xã). Each trip
 * later ticks a subset (issue 106). Loads in-process via listOperatorPickupAreas
 * (AGENTS.md: server components MUST NOT self-fetch their own API).
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { listOperatorPickupAreas } from '@/lib/catalog';
import { PageHeader } from '@/components/op/PageHeader';
import PickupAreasClient from './PickupAreasClient';

export default async function OpPickupAreasPage() {
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');

  const areas = await listOperatorPickupAreas({ operatorId: session.operatorId });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <PageHeader
        title="Khu vực đón khách"
        subtitle="Danh sách điểm đón tận nơi (huyện/xã) khách có thể chọn khi đặt vé. Mỗi chuyến sẽ chọn từ danh sách này."
      />
      <PickupAreasClient initialAreas={areas} />
    </div>
  );
}
