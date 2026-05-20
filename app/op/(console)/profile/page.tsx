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
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
      <h1>Hồ sơ quản trị viên</h1>
      <OpProfileClient profile={profile} />
    </div>
  );
}
