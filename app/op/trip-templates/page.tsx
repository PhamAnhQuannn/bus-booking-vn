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
    <main style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px' }}>
      <h1>Lịch chạy cố định</h1>
      <p style={{ color: '#666' }}>
        Tạo lịch tự động sinh chuyến hàng ngày theo mặt nạ ngày trong tuần.
      </p>
      <TemplatesClient initialTemplates={templates} />
    </main>
  );
}
