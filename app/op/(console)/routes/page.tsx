/**
 * /op/routes — Operator Route Management (server component, Issue 012).
 *
 * Loads routes in-process via listRoutes lib function.
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Otherwise → render server-rendered list + client island for mutations
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listRoutes } from '@/lib/catalog/listRoutes';
import { PageHeader } from '@/components/op/PageHeader';
import RoutesClient from './RoutesClient';

export default async function OpRoutesPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const routes = await listRoutes({ operatorId: session.operatorId });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <PageHeader
        title="Quản lý tuyến đường"
        subtitle="Danh sách tuyến đường. Mỗi nhà xe chỉ thấy tuyến của riêng mình."
      />
      <RoutesClient initialRoutes={routes} />
    </div>
  );
}
