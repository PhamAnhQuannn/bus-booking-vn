/**
 * ApprovalBanner — console shell banner shown while the operator is NOT APPROVED
 * (Issue 080 / S09). Server component (pure — renders from the passed status).
 *
 * This banner only INFORMS. The actual sell/publish BLOCK is already enforced
 * upstream (Issue 045 status caps + Issue 046 search gate + the approval gate) —
 * we do NOT re-implement the block here, we message it.
 *
 * Per OperatorStatus:
 *   PENDING_REVIEW / UNDER_REVIEW → "Đang xét duyệt — SLA 2 ngày làm việc. Set up
 *     buses + draft trips now; publishing unlocks on approval." + links to
 *     /op/status (+ /op/kyb to complete documents).
 *   SUSPENDED → "Tài khoản tạm ngưng — danh sách đã ẩn." + link to /op/status.
 *   REJECTED  → rejection reason + resubmit link (/op/status).
 *
 * APPROVED renders nothing (the caller may also skip mounting it).
 *
 * Purity (AGENTS.md Issue 016): no Date.now()/random — pure function of props.
 */

import Link from "next/link"
import type { OperatorStatus } from "@prisma/client"
import { AlertTriangleIcon, ClockIcon, InfoIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ApprovalBannerProps {
  status: OperatorStatus
  /** Rejection reason copy — only rendered in the REJECTED state. */
  rejectionReason?: string | null
}

type Tone = "info" | "warning" | "danger"

const TONE_CLASS: Record<Tone, string> = {
  info: "border-primary/30 bg-primary/5 text-foreground",
  warning: "border-warning-border bg-warning/40 text-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-foreground",
}

const TONE_ICON: Record<Tone, typeof InfoIcon> = {
  info: InfoIcon,
  warning: ClockIcon,
  danger: AlertTriangleIcon,
}

export function ApprovalBanner({ status, rejectionReason }: ApprovalBannerProps) {
  if (status === "APPROVED") return null

  let tone: Tone = "info"
  let title = ""
  let body: React.ReactNode = null
  let links: { label: string; href: string }[] = []

  if (status === "PENDING_REVIEW" || status === "UNDER_REVIEW") {
    tone = "warning"
    title = "Đang xét duyệt — trong vòng 2 ngày làm việc."
    body =
      "Bạn có thể thiết lập xe và nháp chuyến ngay bây giờ; chức năng đăng bán sẽ mở khi hồ sơ được duyệt."
    links = [
      { label: "Xem trạng thái", href: "/op/status" },
      { label: "Hồ sơ KYB", href: "/op/kyb" },
    ]
  } else if (status === "SUSPENDED") {
    tone = "danger"
    title = "Tài khoản tạm ngưng — danh sách chuyến đã bị ẩn."
    body = "Vui lòng liên hệ bộ phận hỗ trợ hoặc xem trạng thái để biết thêm chi tiết."
    links = [{ label: "Xem trạng thái", href: "/op/status" }]
  } else if (status === "REJECTED") {
    tone = "danger"
    title = "Hồ sơ cần bổ sung trước khi được duyệt."
    body = rejectionReason
      ? `Lý do: ${rejectionReason}`
      : "Xem lý do chi tiết và gửi lại hồ sơ ở trang trạng thái."
    links = [{ label: "Xem lý do & gửi lại", href: "/op/status" }]
  }

  const Icon = TONE_ICON[tone]

  return (
    <div
      role="status"
      data-testid="approval-banner"
      data-status={status}
      className={cn(
        "flex flex-col gap-1.5 border-b px-4 py-3 text-sm md:flex-row md:items-center md:gap-3 md:px-6",
        TONE_CLASS[tone]
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <span className="font-semibold">{title}</span>{" "}
          <span className="text-muted-foreground">{body}</span>
        </div>
      </div>
      {links.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 md:ml-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
