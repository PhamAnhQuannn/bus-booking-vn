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
    <main style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <h1>Quản lý phương tiện</h1>
      <p style={{ color: '#666' }}>
        Danh sách xe đang hoạt động. Mỗi nhà xe chỉ thấy phương tiện của riêng mình.
      </p>
      <BusesClient initialBuses={fleet.buses} />
    </main>
  );
}
