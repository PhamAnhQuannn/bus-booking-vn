/**
 * /op/profile — Operator profile page (server component).
 *
 * Loads operator profile in-process via lib/op/getOperatorProfile.ts.
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * - Not authenticated → redirect to /op/login
 * - requiresPasswordChange → redirect to /op/first-login
 * - Otherwise → renders profile + client-side edit form
 */

import { redirect } from 'next/navigation';
import { getOperatorProfile } from '@/lib/op/getOperatorProfile';
import OpProfileClient from './OpProfileClient';

export default async function OpProfilePage() {
  const profile = await getOperatorProfile();

  if (!profile) {
    redirect('/op/login');
  }

  if (profile.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h1>Hồ sơ quản trị viên</h1>
      <OpProfileClient profile={profile} />
    </main>
  );
}
