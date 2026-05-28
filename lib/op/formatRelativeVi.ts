/**
 * Vietnamese relative-time formatter for the today's-trips strip.
 *
 *   "Khởi hành sau 2g15p"      — future (>1 min)
 *   "Khởi hành ngay"           — within ±1 minute
 *   "Đã khởi hành 12 phút trước" — past
 *
 * Pure function — safe inside RSC bodies. `now` is injected for testability.
 */

export function formatRelativeVi(
  target: Date | string,
  now: Date | number = Date.now()
): string {
  const targetMs = typeof target === "string" ? Date.parse(target) : target.getTime()
  const nowMs = typeof now === "number" ? now : now.getTime()
  const diffMs = targetMs - nowMs
  const absMs = Math.abs(diffMs)

  if (absMs < 60_000) return "Khởi hành ngay"

  const minutes = Math.floor(absMs / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let body: string
  if (days >= 1) {
    const remHours = hours - days * 24
    body = remHours > 0 ? `${days} ngày ${remHours}g` : `${days} ngày`
  } else if (hours >= 1) {
    const remMin = minutes - hours * 60
    body = remMin > 0 ? `${hours}g${remMin.toString().padStart(2, "0")}p` : `${hours}g`
  } else {
    body = `${minutes} phút`
  }

  return diffMs >= 0 ? `Khởi hành sau ${body}` : `Đã khởi hành ${body} trước`
}
