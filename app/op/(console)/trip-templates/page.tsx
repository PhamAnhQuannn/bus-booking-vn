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
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listTemplates } from '@/lib/trips/generateFromTemplate';
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

  const templates = await listTemplates(session.operatorId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        title="Lịch chạy cố định"
        subtitle="Tạo lịch tự động sinh chuyến hàng ngày theo mặt nạ ngày trong tuần."
      />
      <TemplatesClient initialTemplates={templates} />
    </div>
  );
}
