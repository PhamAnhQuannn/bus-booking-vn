/**
 * Unit tests for buildRevenueCsv.
 * Issue 016 — operator revenue reporting.
 */

import { describe, it, expect } from 'vitest';
import { buildRevenueCsv, type RevenueRow } from '../buildRevenueCsv';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const HEADER =
  'Mã chuyến,Khởi hành,Tuyến,Số ghế,Doanh thu (VND),Phí nền tảng (VND),Thanh toán ròng (VND),Trạng thái';

function makeRow(overrides: Partial<RevenueRow> = {}): RevenueRow {
  return {
    tripId: 'trip-001',
    departureAt: new Date('2026-05-19T08:00:00+07:00'),
    routeName: 'Hà Nội → Hải Phòng',
    seatsSold: 30,
    grossRevenueVnd: 1_500_000,
    platformFeeVnd: 90_000,
    netPayoutVnd: 1_410_000,
    payoutStatus: 'paid',
    ...overrides,
  };
}

describe('buildRevenueCsv', () => {
  it('starts with UTF-8 BOM (0xEF 0xBB 0xBF)', () => {
    const csv = buildRevenueCsv([]);
    const buf = Buffer.from(csv, 'utf8');
    expect(buf.slice(0, 3)).toEqual(BOM);
  });

  it('empty rows → header-only CSV with BOM and no data rows', () => {
    const csv = buildRevenueCsv([]);
    // Remove BOM for comparison
    const withoutBom = csv.startsWith('﻿') ? csv.slice(1) : csv;
    expect(withoutBom).toBe(HEADER);
  });

  it('single happy-path row produces correct output', () => {
    const row = makeRow({ payoutStatus: 'paid' });
    const csv = buildRevenueCsv([row]);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    const dataFields = lines[1].split(',');
    expect(dataFields[0]).toBe('trip-001');
    expect(dataFields[2]).toBe('Hà Nội → Hải Phòng');
    expect(dataFields[3]).toBe('30');
    expect(dataFields[4]).toBe('1500000');
    expect(dataFields[5]).toBe('90000');
    expect(dataFields[6]).toBe('1410000');
    expect(dataFields[7]).toBe('paid');
  });

  it('uses CRLF line endings', () => {
    const csv = buildRevenueCsv([makeRow()]);
    // Every line boundary must be CRLF
    expect(csv).toContain('\r\n');
    // Must not have bare LF (except within CRLF pairs)
    const withoutCrlf = csv.replace(/\r\n/g, '');
    expect(withoutCrlf).not.toContain('\n');
  });

  it('formula injection: routeName starting with = is prefixed with single-quote', () => {
    const row = makeRow({ routeName: '=cmd|"/c calc"!A1' });
    const csv = buildRevenueCsv([row]);
    const lines = csv.replace('﻿', '').split('\r\n');
    const routeField = lines[1].split(',')[2];
    expect(routeField).toBe("'=cmd|\"/c calc\"!A1");
  });

  it('formula injection: routeName starting with + is prefixed with single-quote', () => {
    const row = makeRow({ routeName: '+HYPERLINK(...)' });
    const csv = buildRevenueCsv([row]);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1].split(',')[2]).toMatch(/^'[+]/);
  });

  it('all four payoutStatus values render correctly', () => {
    const statuses: Array<RevenueRow['payoutStatus']> = ['requested', 'processing', 'paid', 'failed'];
    for (const status of statuses) {
      const csv = buildRevenueCsv([makeRow({ payoutStatus: status })]);
      const lines = csv.replace('﻿', '').split('\r\n');
      expect(lines[1].split(',')[7]).toBe(status);
    }
  });

  it('null payoutStatus renders as empty string', () => {
    const csv = buildRevenueCsv([makeRow({ payoutStatus: null })]);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1].split(',')[7]).toBe('');
  });

  it('date is formatted as YYYY-MM-DD HH:mm in Asia/Ho_Chi_Minh tz', () => {
    // 2026-05-19T01:00:00Z = 2026-05-19T08:00:00+07:00
    const row = makeRow({ departureAt: new Date('2026-05-19T01:00:00Z') });
    const csv = buildRevenueCsv([row]);
    const lines = csv.replace('﻿', '').split('\r\n');
    const dateField = lines[1].split(',')[1];
    expect(dateField).toBe('2026-05-19 08:00');
  });

  it('numeric VND fields have no decimals or thousand separators', () => {
    const row = makeRow({ grossRevenueVnd: 1_500_000, platformFeeVnd: 90_000, netPayoutVnd: 1_410_000 });
    const csv = buildRevenueCsv([row]);
    const lines = csv.replace('﻿', '').split('\r\n');
    const fields = lines[1].split(',');
    expect(fields[4]).toBe('1500000');
    expect(fields[5]).toBe('90000');
    expect(fields[6]).toBe('1410000');
  });
});
