/**
 * calcPayout — platform-fee computation for operator revenue reports.
 *
 * Uses half-even (banker's) rounding to avoid systematic float drift on .5 midpoints.
 * The `gross` value is the total VND collected from paid bookings on a trip.
 *
 * I7-exempt: this lib is used exclusively from operator-side routes/reports.
 */

const DEFAULT_PLATFORM_FEE_PCT = 0.06;

/**
 * Half-even (banker's) rounding.
 * For exactly-0.5 fractional part: rounds to the nearest even integer.
 * For all other cases: standard Math.round behaviour.
 *
 * Examples:
 *   halfEvenRound(0.5)  → 0   (0 is even)
 *   halfEvenRound(1.5)  → 2   (2 is even)
 *   halfEvenRound(2.5)  → 2   (2 is even)
 *   halfEvenRound(3.5)  → 4   (4 is even)
 *   halfEvenRound(50.5) → 50  (50 is even)
 *   halfEvenRound(51.5) → 52  (52 is even)
 */
export function halfEvenRound(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  // Check for exact 0.5 midpoint (within float epsilon)
  if (Math.abs(frac - 0.5) < Number.EPSILON) {
    // Round to nearest even
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

export interface CalcPayoutInput {
  grossPaidBookings: number;
  platformFeePct?: number;
}

export interface CalcPayoutResult {
  gross: number;
  platformFee: number;
  net: number;
}

/**
 * Compute platform fee and net payout for a trip.
 *
 * Uses BigInt arithmetic for the multiplication step to avoid float drift on large VND amounts.
 * platformFeePct is converted to a BigInt ratio (numerator/PRECISION) where PRECISION = 1e10,
 * capturing up to 10 decimal places of the percentage without floating-point multiplication.
 *
 * @param input.grossPaidBookings  Total VND from paid+confirmed bookings (integer).
 * @param input.platformFeePct     Platform fee rate (default 0.06 = 6%).
 * @returns { gross, platformFee, net } — all integers in VND.
 */
export function calcPayout(input: CalcPayoutInput): CalcPayoutResult {
  const { grossPaidBookings, platformFeePct = DEFAULT_PLATFORM_FEE_PCT } = input;
  const gross = grossPaidBookings;

  // Convert platformFeePct to a BigInt ratio to avoid float multiplication.
  // PRECISION = 1e10 captures up to 10 decimal places of the fee percentage.
  const PRECISION = BigInt(10_000_000_000);
  const numerator = BigInt(Math.round(platformFeePct * 10_000_000_000));
  const grossBig = BigInt(gross);

  // Compute (gross * numerator) / PRECISION with half-even rounding on the remainder.
  const product = grossBig * numerator;
  const quotient = product / PRECISION;
  const remainder = product % PRECISION;

  // Half-even round: compare remainder*2 to PRECISION (the denominator).
  const doubled = remainder * BigInt(2);
  let rounded: bigint;
  if (doubled < PRECISION) {
    rounded = quotient;
  } else if (doubled > PRECISION) {
    rounded = quotient + BigInt(1);
  } else {
    // Exact tie — round to even
    rounded = quotient % BigInt(2) === BigInt(0) ? quotient : quotient + BigInt(1);
  }

  const platformFee = Number(rounded);
  const net = gross - platformFee;
  return { gross, platformFee, net };
}
