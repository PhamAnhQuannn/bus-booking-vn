/**
 * /op/trip-templates — Operator Recurring Templates (server component, Issue 013).
 *
 * Loads templates in-process via lib/trips/generateFromTemplate.ts (listTemplates).
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { listTemplates } from '@/lib/trips';
import { listOperatorPickupAreas } from '@/lib/catalog';
import { PageHeader } from '@/components/op/PageHeader';
import TemplatesClient from './TemplatesClient';

export default async function OpTripTemplatesPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const [templates, areas] = await Promise.all([
    listTemplates(session.operatorId),
    listOperatorPickupAreas({ operatorId: session.operatorId }),
  ]);
  const activeAreas = areas.filter((a) => a.isActive).map((a) => ({ id: a.id, label: a.label }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        title="Lịch chạy cố định"
        subtitle="Tạo lịch tự động sinh chuyến hàng ngày theo mặt nạ ngày trong tuần."
      />
      <TemplatesClient initialTemplates={templates} pickupAreas={activeAreas} />
    </div>
  );
}
