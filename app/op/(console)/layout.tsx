/**
 * /op/(console) layout — authenticated operator console shell (PR 2 redesign).
 *
 * Route group `(console)` scopes this shell to the authenticated pages only;
 * /op/login, /op/first-login, and /op/staff/dashboard live OUTSIDE the group
 * and render without the sidebar.
 *
 * Server component: gates auth in-process (getOperatorSession — never self-fetch).
 *
 * The "N mới" unviewed-paid badge is DISPLAY-ONLY here. /op/dashboard owns the
 * touchLastViewed reset — the layout must not touch it, or the badge would clear
 * before the dashboard renders.
 */

import { redirect } from "next/navigation"

import { getOperatorSession } from "@/lib/op/getOperatorSession"
import { getUnviewedPaidCount } from "@/lib/booking/getUnviewedPaidCount"
import { prisma } from "@/lib/core/db/client"
import { ApprovalBanner } from "@/components/op/ApprovalBanner"
import { CommandPalette } from "@/components/op/CommandPalette"
import { ConsoleHeader } from "@/components/op/ConsoleHeader"
import { OperatorBottomNav } from "@/components/op/OperatorBottomNav"
import { OperatorNav } from "@/components/op/OperatorNav"
import { OperatorNavProvider } from "@/components/op/OperatorNavContext"
import { ToastProvider, Toaster } from "@/components/ui/toast"

export default async function OperatorConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getOperatorSession()

  if (!session) {
    redirect("/op/login")
  }
  if (session.requiresPasswordChange) {
    redirect("/op/first-login")
  }

  const [unviewedCount, operator] = await Promise.all([
    getUnviewedPaidCount(session.operatorUserId, session.operatorId),
    // In-process read of the approval state for the banner (no self-fetch —
    // AGENTS.md 002/003). The banner only INFORMS; the actual sell/publish block
    // is enforced upstream (Issue 045/046 + approval gate).
    prisma.operator.findUnique({
      where: { id: session.operatorId },
      select: { status: true, rejectionReason: true },
    }),
  ])

  return (
    <OperatorNavProvider>
      <ToastProvider>
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60]"
        >
          Bỏ qua điều hướng
        </a>
        <div className="flex min-h-dvh flex-col md:flex-row">
          <OperatorNav role={session.role} unviewedCount={unviewedCount} />
          <div className="flex min-w-0 flex-1 flex-col">
            <ConsoleHeader
              operatorName={session.operatorName}
              role={session.role}
              unreadCount={unviewedCount}
            />
            {operator && operator.status !== "APPROVED" ? (
              <ApprovalBanner
                status={operator.status}
                rejectionReason={operator.rejectionReason}
              />
            ) : null}
            <main id="main" className="flex-1 pb-16 md:pb-0">
              {children}
            </main>
          </div>
        </div>
        <OperatorBottomNav role={session.role} unviewedCount={unviewedCount} />
        <CommandPalette role={session.role} />
        <Toaster />
      </ToastProvider>
    </OperatorNavProvider>
  )
}
