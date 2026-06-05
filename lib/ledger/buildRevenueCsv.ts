/**
 * buildRevenueCsv — produces a UTF-8 BOM CSV for operator revenue reports.
 *
 * Output spec:
 *  - UTF-8 BOM prefix (0xEF 0xBB 0xBF) for Excel compatibility.
 *  - Vietnamese header row.
 *  - CRLF line endings.
 *  - Comma-separated fields.
 *  - Formula injection prevention: fields starting with =, +, -, @, \t, \r are quoted with a
 *    leading single-quote ' (Excel-safe). This applies to routeName in particular.
 *  - Phone columns: none in this CSV. Convention: if added in future, wrap in double-quotes
 *    to prevent phone-number-as-formula injection (e.g. "+642...").
 *  - VND numeric values: raw integers, no decimals, no thousands separator.
 *  - Dates formatted as YYYY-MM-DD HH:mm in Asia/Ho_Chi_Minh timezone.
 *  - Null payoutStatus renders as empty string.
 *
 * I7-exempt: this lib is used exclusively from operator-side reporting routes.
 */

const UTF8_BOM = '﻿'; // 0xEF 0xBB 0xBF when encoded as UTF-8

const HEADER =
  'Mã chuyến,Khởi hành,Tuyến,Số ghế,Doanh thu (VND),Phí nền tảng (VND),Thanh toán ròng (VND),Trạng thái';

// Characters at the start of a field that could be interpreted as formula operators by Excel.
const FORMULA_INJECTION_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** Escape a CSV field value. Applies formula-injection prefix guard. */
function escapeField(value: string): string {
  if (value.length > 0 && FORMULA_INJECTION_CHARS.has(value[0])) {
    // Prefix with a single-quote to neutralise the formula attempt in Excel.
    return `'${value}`;
  }
  // Wrap in double quotes if the field contains a comma, double-quote, or newline.
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Format a Date as YYYY-MM-DD HH:mm in Asia/Ho_Chi_Minh timezone. */
function formatVnDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // en-CA locale produces YYYY-MM-DD for the date part; we reconstruct the full string.
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export interface RevenueRow {
  tripId: string;
  departureAt: Date;
  routeName: string;
  seatsSold: number;
  grossRevenueVnd: number;
  platformFeeVnd: number;
  netPayoutVnd: number;
  payoutStatus: 'requested' | 'processing' | 'paid' | 'failed' | null;
}

/**
 * Build a revenue CSV string from an array of RevenueRow objects.
 *
 * @param rows  Array of revenue rows (may be empty — returns header-only CSV with BOM).
 * @returns     UTF-8 BOM + header + data rows, CRLF-separated.
 */
export function buildRevenueCsv(rows: RevenueRow[]): string {
  const lines: string[] = [HEADER];

  for (const row of rows) {
    const fields = [
      escapeField(row.tripId),
      escapeField(formatVnDate(row.departureAt)),
      escapeField(row.routeName),
      String(row.seatsSold),
      String(row.grossRevenueVnd),
      String(row.platformFeeVnd),
      String(row.netPayoutVnd),
      escapeField(row.payoutStatus ?? ''),
    ];
    lines.push(fields.join(','));
  }

  return UTF8_BOM + lines.join('\r\n');
}
