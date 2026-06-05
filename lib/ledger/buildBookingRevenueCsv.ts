/**
 * buildBookingRevenueCsv — produces a UTF-8 BOM CSV for the per-booking revenue export.
 *
 * Serves PRD story 57 — per-booking rows with 9 columns:
 *   bookingRef, route, departure, buyerName, buyerPhone, ticketCount, total, paymentMethod, status
 *
 * Output spec:
 *  - UTF-8 BOM prefix (0xEF 0xBB 0xBF) for Excel compatibility.
 *  - English header row (verbatim PRD story 57 column names).
 *  - CRLF line endings.
 *  - Comma-separated fields.
 *  - Formula injection prevention: fields starting with =, +, -, @, \t, \r are prefixed with
 *    a single-quote ' (Excel-safe). This covers buyerName (free-text user input) and routeName.
 *    EXCEPTION: buyerPhone uses intentional ="..." wrapping — NOT prefixed (see below).
 *  - buyerPhone column: wrapped as ="<phone>" (e.g. ="+84901234567") to preserve the leading +
 *    and force Excel to treat the cell as text. The leading = is intentional and required.
 *  - VND numeric values: raw integers, no decimals, no thousands separator.
 *  - Dates formatted as YYYY-MM-DD HH:mm in Asia/Ho_Chi_Minh timezone.
 *
 * Distinct from buildRevenueCsv.ts (per-trip aggregated rows, story 56). Both may coexist.
 *
 * I7-exempt: this lib is used exclusively from operator-side reporting routes.
 */

import type { BookingRevenueRow } from './getBookingRevenueRows';

export type { BookingRevenueRow };

const UTF8_BOM = '﻿'; // 0xEF 0xBB 0xBF when encoded as UTF-8

// PRD story 57 verbatim column names.
const HEADER =
  'bookingRef,route,departure,buyerName,buyerPhone,ticketCount,total,paymentMethod,status';

// Characters at the start of a field that could be interpreted as formula operators by Excel.
const FORMULA_INJECTION_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Escape a standard CSV field value.
 * Applies formula-injection prefix guard (single-quote prefix for dangerous leading chars).
 * Does NOT handle buyerPhone — that field uses special ="..." wrapping instead.
 */
function escapeField(value: string): string {
  if (value.length > 0 && FORMULA_INJECTION_CHARS.has(value[0])) {
    // Prefix with a single-quote to neutralise the formula attempt in Excel.
    // The field is now plain text from Excel's perspective.
    value = `'${value}`;
  }
  // Wrap in double quotes if the field contains a comma, double-quote, or newline char.
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Wrap a phone number in Excel text-formula form: ="<phone>".
 * This preserves the leading + and prevents Excel from interpreting the cell as a number.
 * The leading = is intentional — NOT a formula-injection risk because the ="..." form
 * forces text evaluation, not arbitrary formula execution.
 *
 * Rule (Issue 016): the phone field is the ONLY field exempt from single-quote injection
 * prefixing; all other fields starting with = must get the single-quote prefix.
 */
function wrapPhone(phone: string): string {
  // Escape any embedded double-quotes inside the phone value (defensive; phone values
  // should never contain " in practice, but the guard costs nothing).
  const escaped = phone.replace(/"/g, '""');
  return `="${escaped}"`;
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

/**
 * Build a per-booking revenue CSV string.
 *
 * @param rows  Array of BookingRevenueRow objects (may be empty — returns header-only CSV with BOM).
 * @returns     UTF-8 BOM + header + data rows, CRLF-separated.
 */
export function buildBookingRevenueCsv(rows: BookingRevenueRow[]): string {
  const lines: string[] = [HEADER];

  for (const row of rows) {
    const fields = [
      escapeField(row.bookingRef),
      escapeField(row.routeName),
      escapeField(formatVnDate(row.departureAt)),
      escapeField(row.buyerName),
      wrapPhone(row.buyerPhone),
      String(row.ticketCount),
      String(row.totalVnd),
      escapeField(row.paymentMethod),
      escapeField(row.status),
    ];
    lines.push(fields.join(','));
  }

  return UTF8_BOM + lines.join('\r\n');
}
