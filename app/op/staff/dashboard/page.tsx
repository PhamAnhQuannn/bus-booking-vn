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
import { getStaffDashboard } from '@/lib/op';
import { PageHeader } from '@/components/op/PageHeader';
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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PageHeader
        title="Chuyến của tôi"
        subtitle={
          view.assignedTripId === null
            ? 'Chưa được gán chuyến nào.'
            : 'Theo dõi hàng đợi đặt vé + manifest cho chuyến được phân công.'
        }
      />

      {view.assignedTripId === null ? (
        <div
          data-testid="staff-empty-state"
          className="space-y-1 rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground"
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
