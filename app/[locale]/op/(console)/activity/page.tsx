/**
 * /op/activity — Operator Activity Feed (full page; PR 8).
 *
 * Server component: hydrates initial events via in-process getActivityFeed.
 * Client island polls /api/op/activity every 30s, paused on document hide.
 */

import { redirect } from "next/navigation"

import { getOperatorSession } from "@/lib/op"
import { getActivityFeed } from "@/lib/op"
import { PageHeader } from "@/components/op/PageHeader"
import { ActivityFeed } from "@/components/op/ActivityFeed"

export default async function OpActivityPage() {
  const session = await getOperatorSession()
  if (!session) redirect("/op/login")
  if (session.requiresPasswordChange) redirect("/op/first-login")

  const events = await getActivityFeed({
    operatorId: session.operatorId,
    limit: 50,
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <PageHeader
        title="Hoạt động"
        subtitle="Đơn mới, escalation, và sự kiện chuyến trong 7 ngày qua."
      />
      <ActivityFeed initialEvents={events} variant="page" />
    </div>
  )
}
