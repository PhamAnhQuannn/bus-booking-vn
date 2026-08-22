/**
 * /admin/(console) layout — authenticated admin console shell (Issue 064).
 *
 * Route group `(console)` scopes this chrome to the authenticated admin pages
 * only. `/admin/login` lives OUTSIDE the group (app/admin/login/page.tsx) so it
 * renders WITHOUT the sidebar — exactly the operator pattern where /op/login sits
 * outside app/op/(console). Route groups do not affect the URL, so /admin and
 * /admin/login are unchanged and the proxy.ts free-list (/admin/login) still matches.
 *
 * Pure presentational SHELL: it does NOT gate auth (per Issue 064 §B "SAFEST"
 * guidance). Each page calls requireAdminPage() itself for its role-aware ctx, and
 * the Layer 1.5 middleware (Issue 056) already blocks unauthenticated/non-TOTP
 * access before any /admin page renders. Keeping the shell auth-free means there is
 * zero risk of it accidentally chroming the login page or double-redirecting.
 *
 * Deliberately does NOT import the public site chrome — the admin console is the
 * separate THIRD auth realm surface.
 */

import { AdminNav } from '@/components/admin/AdminNav';
import { AdminAccountMenu } from '@/components/admin/AdminAccountMenu';
import { requireAdminPage } from '@/lib/auth';
import { prisma } from '@/lib/core/db/client';

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  // Central identity read for the sidebar footer (email + role). requireAdminPage
  // reads the bb_admin_access cookie in-process (never self-fetch — AGENTS.md
  // 002/003) and redirects to /admin/login if the session is missing/non-TOTP;
  // pages still call it themselves for their role-aware ctx (defense-in-depth).
  const ctx = await requireAdminPage();
  const admin = await prisma.adminUser.findUnique({
    where: { id: ctx.adminId },
    select: { email: true },
  });

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#admin-main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60]"
      >
        Chuyển đến nội dung
      </a>

      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-b-0">
        <div className="flex h-14 items-center px-4">
          <span className="text-base font-semibold">Bảng điều khiển</span>
        </div>
        <div className="px-2 py-2">
          <AdminNav />
        </div>
        <div className="mt-auto border-t border-sidebar-border p-2">
          <AdminAccountMenu email={admin?.email ?? ''} role={ctx.role} />
        </div>
      </aside>

      <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 md:px-8">
        {children}
      </main>
    </div>
  );
}
