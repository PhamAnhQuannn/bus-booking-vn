/**
 * /op/buses — Operator Fleet Management (server component, Issue 011).
 *
 * Loads fleet in-process via lib/op/getOperatorFleet.ts.
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Otherwise → render server-rendered list + client island for mutations
 */

import { redirect } from 'next/navigation';
import { getOperatorFleet } from '@/lib/op/getOperatorFleet';
import BusesClient from './BusesClient';

export default async function OpBusesPage() {
  const fleet = await getOperatorFleet({ activeOnly: true });

  if (!fleet) {
    redirect('/op/login');
  }

  if (fleet.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <h1 className="text-2xl font-bold">Quản lý phương tiện</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Danh sách xe đang hoạt động. Mỗi nhà xe chỉ thấy phương tiện của riêng mình.
      </p>
      <div className="mt-6">
        <BusesClient initialBuses={fleet.buses} />
      </div>
    </div>
  );
}
