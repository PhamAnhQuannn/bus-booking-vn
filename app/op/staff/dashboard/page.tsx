/**
 * /op/staff/dashboard — staff single-trip view (Issue 018).
 *
 * Server component. Loads everything in-process via getStaffDashboard()
 * (AGENTS.md rule: server components MUST NOT self-fetch their own API).
 *
 * Staff see ONLY their assigned trip. The staff-scope guard in
 * requireOperatorAuth constrains the Issue 014 endpoints the client island
 * reads; this page just hydrates the initial queue + manifest.
 *
 * Redirects: not authenticated → /op/login; requiresPasswordChange → /op/first-login;
 * an admin landing here → /op/dashboard (this page is staff-only).
 *
 * No admin nav (Fleet, Routes, Trips, Reports, Staff) is rendered — staff see
 * only their trip.
 */

import { redirect } from 'next/navigation';
import { getStaffDashboard } from '@/lib/op/getStaffDashboard';
import StaffDashboardClient from './StaffDashboardClient';

export default async function StaffDashboardPage() {
  const view = await getStaffDashboard();

  if (!view) {
    redirect('/op/login');
  }

  if (view.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  // This page is staff-only; admins use the full /op/dashboard.
  if (!view.isStaff) {
    redirect('/op/dashboard');
  }

  return (
    <main style={{ maxWidth: 1200, margin: '40px auto', padding: '0 16px' }}>
      <h1>Chuyến của tôi</h1>

      {view.assignedTripId === null ? (
        <div
          data-testid="staff-empty-state"
          style={{ padding: 24, background: '#f4f4f4', borderRadius: 4, marginTop: 16 }}
        >
          <p>Bạn chưa được phân công chuyến nào.</p>
          <p>Vui lòng liên hệ quản trị viên để được phân công chuyến.</p>
        </div>
      ) : (
        <StaffDashboardClient
          tripId={view.assignedTripId}
          trip={view.trip}
          initialQueueRows={view.queueRows}
          initialManifestRows={view.manifestRows}
          initialManifestGeneratedAt={view.manifestGeneratedAt}
        />
      )}
    </main>
  );
}
