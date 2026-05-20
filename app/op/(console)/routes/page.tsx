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
import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/client';
import { listRoutes } from '@/lib/routes/listRoutes';
import RoutesClient from './RoutesClient';

export default async function OpRoutesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;

  if (!token) {
    redirect('/op/login');
  }

  const payload = await verifyOperatorAccess(token);
  if (!payload) {
    redirect('/op/login');
  }

  const operator = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: { operatorId: true, requiresPasswordChange: true, disabledAt: true },
  });

  if (!operator || operator.disabledAt !== null) {
    redirect('/op/login');
  }

  if (operator.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const routes = await listRoutes({ operatorId: operator.operatorId });

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <h1>Quản lý tuyến đường</h1>
      <p style={{ color: '#666' }}>
        Danh sách tuyến đường. Mỗi nhà xe chỉ thấy tuyến của riêng mình.
      </p>
      <RoutesClient initialRoutes={routes} />
    </main>
  );
}
