/**
 * Date-range helpers for the operator dashboard.
 *
 * Module-scope, not invoked inside an RSC render body (Issue 016 rule).
 *
 * VN-local date strings (YYYY-MM-DD) — operator pages assume Asia/Ho_Chi_Minh
 * for all business-day computations.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

function vnLocalDate(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

/** Today's range in VN-local date strings: [todayStart, todayEnd]. */
export function getDefaultTodayRange(): { from: string; to: string } {
  const today = vnLocalDate(new Date())
  return { from: today, to: today }
}

/** Last N-day range ending today (inclusive). Default 30 days. */
export function getDefaultDateRange(days = 30): { from: string; to: string } {
  const now = new Date()
  const to = vnLocalDate(now)
  const from = vnLocalDate(new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000))
  return { from, to }
}

/** Current epoch ms. Lives in a module-scope helper so RSC render bodies stay
 *  pure (Issue 016 rule + react-hooks/purity). Call sites read this rather than
 *  `Date.now()` inline. */
export function serverNow(): number {
  return Date.now()
}
