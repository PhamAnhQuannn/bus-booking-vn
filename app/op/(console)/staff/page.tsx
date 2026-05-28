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
import { getOperatorStaff } from '@/lib/op/getOperatorStaff';
import { PageHeader } from '@/components/op/PageHeader';
import StaffClient from './StaffClient';

export default async function OpStaffPage() {
  const view = await getOperatorStaff();

  if (!view) {
    redirect('/op/login');
  }

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
