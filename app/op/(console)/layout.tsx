/**
 * /op/(console) layout — authenticated operator console shell.
 *
 * Route group `(console)` scopes this shell to the authenticated pages only;
 * /op/login, /op/first-login, and /op/staff/dashboard live OUTSIDE the group
 * and render without the sidebar (nav-pattern-pick.md).
 *
 * Server component: gates auth in-process (getOperatorSession — never self-fetch).
 * Renders the skip-link, OperatorNav sidebar/drawer, a single <main id="main">,
 * and the toast surface (ToastProvider mounted high so any console page can enqueue).
 *
 * The "N mới" unviewed-paid badge is DISPLAY-ONLY here. /op/dashboard owns the
 * touchLastViewed reset — the layout must not touch it, or the badge would clear
 * before the dashboard renders.
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getUnviewedPaidCount } from '@/lib/booking/getUnviewedPaidCount';
import { OperatorNav } from '@/components/op/OperatorNav';
import { ToastProvider, Toaster } from '@/components/ui/toast';

export default async function OperatorConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }
  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const unviewedCount = await getUnviewedPaidCount(
    session.operatorUserId,
    session.operatorId
  );

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60]"
      >
        Bỏ qua điều hướng
      </a>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <OperatorNav role={session.role} unviewedCount={unviewedCount} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
