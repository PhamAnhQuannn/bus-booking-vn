/**
 * GET /api/op/activity — synthesized operator activity feed.
 *
 * Tenant-isolated via requireOperatorAuth (operatorId from JWT).
 * Pragmatic — no new schema. See lib/op/getActivityFeed.ts for the source mix.
 */

export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  requireOperatorAuth,
  type OperatorAuthContext,
} from "@/lib/auth"
import { withErrorHandler } from "@/lib/withErrorHandler"
import { getActivityFeed } from "@/lib/op/getActivityFeed"

export async function GET(req: NextRequest): Promise<Response> {
  return withErrorHandler(
    requireOperatorAuth()(async (rawReq: NextRequest, ctx: OperatorAuthContext) => {
      const url = new URL(rawReq.url)
      const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit") ?? "30") || 30, 1),
        100
      )
      const events = await getActivityFeed({ operatorId: ctx.operatorId, limit })
      return NextResponse.json({ events })
    })
  )(req)
}
