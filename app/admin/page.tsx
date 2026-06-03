/**
 * /admin — Admin dashboard placeholder (Issue 056).
 *
 * Server component behind the Layer 1.5 middleware guard: reachable ONLY with a
 * totpVerified admin session (bb_admin_access JWT, scope='admin', totpVerified=true).
 * Unauthenticated / un-TOTP'd / cross-realm sessions are redirected to /admin/login
 * by proxy.ts before this renders. Full dashboard UI lands in Wave 3.
 */

export default function AdminDashboardPage() {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Admin Dashboard (Wave 3)</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Placeholder. The admin console UI is implemented in Wave 3.
      </p>
    </section>
  );
}
