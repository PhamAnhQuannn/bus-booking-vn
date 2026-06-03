/**
 * Known FeatureFlag keys (Issue 060, AC2).
 *
 * Callers use these constants — never magic strings — so a typo'd flag key
 * surfaces at compile time, not as a silently-default-false runtime gate.
 *
 * These are the runtime feature gates representable as DB flags:
 *   - payment-rail toggles: enable/disable a specific online-payment rail.
 *   - kill-switches:        emergency disable of a whole flow (booking/search).
 *
 * NOT flags (documented in flags.ts module header): env `*_STUB` infra toggles
 * (PAYMENTS_STUB / NOTIFY_STUB / STORAGE_STUB) and FeeConfig (Issue 048).
 */
export const FLAG_KEYS = {
  /** Payment-rail toggle — MoMo online rail available at checkout. */
  RAIL_MOMO_ENABLED: 'rail.momo.enabled',
  /** Payment-rail toggle — ZaloPay online rail available at checkout. */
  RAIL_ZALOPAY_ENABLED: 'rail.zalopay.enabled',
  /** Payment-rail toggle — card online rail available at checkout. */
  RAIL_CARD_ENABLED: 'rail.card.enabled',
  /** Kill-switch — when enabled, the booking flow is hard-disabled. */
  KILLSWITCH_BOOKING: 'killswitch.booking',
  /** Kill-switch — when enabled, the search flow is hard-disabled. */
  KILLSWITCH_SEARCH: 'killswitch.search',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];
