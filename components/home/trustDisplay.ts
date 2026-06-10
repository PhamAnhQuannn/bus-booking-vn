/**
 * Pure display logic for the home TrustStrip — kept separate from the component
 * so the threshold + rounding rules are unit-testable without rendering.
 *
 * Honesty rules:
 *  - A metric shows its NUMBER only at/above its floor; below → qualitative copy.
 *  - Numbers round DOWN to a friendly band (never up — no inflation).
 */

export const TRUST_FLOOR = { operators: 20, routes: 20, trips: 200 } as const;

/** Round DOWN to a friendly band: <100 exact ("28"); ≥100 floor-to-100 + "+" ("500+", "1.200+"). */
export function band(n: number): string {
  if (n < 100) return String(n);
  const floored = Math.floor(n / 100) * 100;
  return `${floored.toLocaleString('vi-VN')}+`;
}

export interface TrustMetricDisplay {
  /** Bold number band when at/above floor; undefined → qualitative-only. */
  value?: string;
  label: string;
}

/** Above floor → `{ value: band(n), label: unit }`; below → `{ label: fallback }`. */
export function trustMetric(
  value: number,
  floor: number,
  unit: string,
  fallback: string,
): TrustMetricDisplay {
  return value >= floor ? { value: band(value), label: unit } : { label: fallback };
}
