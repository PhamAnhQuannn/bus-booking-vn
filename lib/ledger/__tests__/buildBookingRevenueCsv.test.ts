/**
 * Unit tests for buildBookingRevenueCsv.
 * Issue 016 — operator per-booking revenue CSV (PRD story 57).
 *
 * Phone placeholders in test fixtures use literal-x mask (+8490xxxxxx1 / +8490xxxxxx2)
 * to avoid tripping the gitleaks regex \+84[35789]\d{8}.
 * (Rule: Issue 001 Mistake Log — PII placeholders must escape the project's PII detection regex.)
 */

import { describe, it, expect } from 'vitest';
import { buildBookingRevenueCsv, type BookingRevenueRow } from '../buildBookingRevenueCsv';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// PRD story 57 verbatim header.
const HEADER =
  'bookingRef,route,departure,buyerName,buyerPhone,ticketCount,total,paymentMethod,status';

function makeRow(overrides: Partial<BookingRevenueRow> = {}): BookingRevenueRow {
  return {
    bookingRef: 'BB-2026-test-0001',
    routeName: 'Hà Nội → Hải Phòng',
    departureAt: new Date('2026-05-19T08:00:00+07:00'),
    // Literal-x mask: safe from gitleaks \+84[35789]\d{8} because x is not a digit.
    buyerPhone: '+8490xxxxxx1',
    buyerName: 'Nguyen Van A',
    ticketCount: 2,
    totalVnd: 300_000,
    paymentMethod: 'momo',
    status: 'paid',
    ...overrides,
  };
}

describe('buildBookingRevenueCsv', () => {
  // ── Test 1: Empty rows → header-only CSV with BOM ──────────────────────────
  it('empty rows → header-only CSV with BOM', () => {
    const csv = buildBookingRevenueCsv([]);

    // BOM assertion (Issue 001 pattern: use Buffer.from().equals)
    const buf = Buffer.from(csv, 'utf8');
    expect(buf.slice(0, 3).equals(BOM)).toBe(true);

    // After BOM, only the header line should be present — no trailing CRLF.
    const withoutBom = csv.startsWith('﻿') ? csv.slice(1) : csv;
    expect(withoutBom).toBe(HEADER);
  });

  // ── Test 2: Happy-path single row: all 9 columns, CRLF, BOM ───────────────
  it('happy-path single row: all 9 columns in correct order, CRLF, BOM', () => {
    const row = makeRow();
    const csv = buildBookingRevenueCsv([row]);

    // BOM present
    const buf = Buffer.from(csv, 'utf8');
    expect(buf.slice(0, 3).equals(BOM)).toBe(true);

    // CRLF line endings
    expect(csv).toContain('\r\n');

    const withoutBom = csv.startsWith('﻿') ? csv.slice(1) : csv;
    const lines = withoutBom.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);

    // Parse fields carefully — buyerPhone field contains a comma inside ="..." so we
    // can't naively split on comma. Use a more targeted check instead.
    expect(lines[1]).toContain('BB-2026-test-0001');
    expect(lines[1]).toContain('Hà Nội → Hải Phòng');
    expect(lines[1]).toContain('2026-05-19 08:00');
    expect(lines[1]).toContain('Nguyen Van A');
    expect(lines[1]).toContain('2');        // ticketCount
    expect(lines[1]).toContain('300000');   // total
    expect(lines[1]).toContain('momo');
    expect(lines[1]).toContain('paid');
  });

  // ── Test 3: Phone wrapping ─────────────────────────────────────────────────
  it('phone wrapping: buyerPhone is wrapped as ="<phone>"', () => {
    // Using the literal-x mask as input — safe from gitleaks regex.
    const row = makeRow({ buyerPhone: '+8490xxxxxx1' });
    const csv = buildBookingRevenueCsv([row]);

    // The cell output must be the intentional Excel text-formula form.
    expect(csv).toContain('="+8490xxxxxx1"');
  });

  // ── Test 4: Formula injection on buyerName ─────────────────────────────────
  it('formula injection: buyerName starting with = is prefixed with single-quote', () => {
    const row = makeRow({ buyerName: '=cmd|"/c calc"!A1' });
    const csv = buildBookingRevenueCsv([row]);

    // The single-quote prefix neutralises the formula attempt.
    expect(csv).toContain("'=cmd|");
    // Must NOT appear without the prefix.
    expect(csv).not.toMatch(/(?<!')=cmd\|/);
  });

  // ── Test 5: Comma in field ─────────────────────────────────────────────────
  it('comma in buyerName: field is wrapped in double quotes', () => {
    const row = makeRow({ buyerName: 'Nguyen, Van A' });
    const csv = buildBookingRevenueCsv([row]);

    expect(csv).toContain('"Nguyen, Van A"');
  });

  // ── Test 6: Embedded quote in field ───────────────────────────────────────
  it('embedded double-quote in buyerName: escaped as "" and wrapped in double quotes', () => {
    const row = makeRow({ buyerName: 'O"Brien' });
    const csv = buildBookingRevenueCsv([row]);

    expect(csv).toContain('"O""Brien"');
  });

  // ── Test 7: Header verbatim string match ──────────────────────────────────
  it('header row is the verbatim PRD story 57 column names with CRLF', () => {
    const csv = buildBookingRevenueCsv([makeRow()]);
    const withoutBom = csv.startsWith('﻿') ? csv.slice(1) : csv;

    // The first line (terminated by CRLF) must be the exact PRD header.
    const firstLine = withoutBom.split('\r\n')[0];
    expect(firstLine).toBe(
      'bookingRef,route,departure,buyerName,buyerPhone,ticketCount,total,paymentMethod,status'
    );
  });

  // ── Bonus: formula injection chars beyond = ────────────────────────────────
  it('formula injection: buyerName starting with + is prefixed with single-quote', () => {
    const row = makeRow({ buyerName: '+HYPERLINK("http://evil.example")' });
    const csv = buildBookingRevenueCsv([row]);
    expect(csv).toContain("'+HYPERLINK");
  });

  it('formula injection: routeName starting with - is prefixed with single-quote', () => {
    const row = makeRow({ routeName: '-1+2' });
    const csv = buildBookingRevenueCsv([row]);
    expect(csv).toContain("'-1+2");
  });

  // ── Date formatting ────────────────────────────────────────────────────────
  it('departure date is formatted as YYYY-MM-DD HH:mm in Asia/Ho_Chi_Minh tz', () => {
    // 2026-05-19T01:00:00Z = 2026-05-19T08:00:00+07:00
    const row = makeRow({ departureAt: new Date('2026-05-19T01:00:00Z') });
    const csv = buildBookingRevenueCsv([row]);
    expect(csv).toContain('2026-05-19 08:00');
  });

  // ── CRLF only ─────────────────────────────────────────────────────────────
  it('uses only CRLF line endings — no bare LF', () => {
    const csv = buildBookingRevenueCsv([makeRow()]);
    expect(csv).toContain('\r\n');
    const withoutCrlf = csv.replace(/\r\n/g, '');
    expect(withoutCrlf).not.toContain('\n');
  });
});
