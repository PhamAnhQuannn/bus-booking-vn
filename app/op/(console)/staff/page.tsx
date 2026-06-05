/**
 * /op/staff — Operator Staff Management (server component, Issue 017).
 *
 * Loads the staff roster in-process via lib/op/getOperatorStaff.ts.
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Otherwise → render server-rendered roster + client island for mutations
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { getOperatorStaff } from '@/lib/op';
import { PageHeader } from '@/components/op/PageHeader';
import StaffClient from './StaffClient';

export default async function OpStaffPage() {
  // Issue 026: explicit role check at the page so a logged-in staff user lands
  // on /op/bookings instead of being bounced to /op/login (where they'd loop).
  // getOperatorStaff also enforces the role gate at the lib layer (defense in depth).
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');
  if (session.role !== 'admin') redirect('/op/bookings');

  const view = await getOperatorStaff();
  if (!view) redirect('/op/login'); // safety net — lib should have returned a view by here

  if (view.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <PageHeader
        title="Quản lý nhân viên"
        subtitle="Danh sách nhân viên của nhà xe. Tạo tài khoản nhân viên sẽ gửi mật khẩu tạm thời qua SMS."
      />
      <StaffClient initialStaff={view.staff} isAdmin={view.isAdmin} />
    </div>
  );
}
