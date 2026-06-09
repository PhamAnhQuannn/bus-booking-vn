/**
 * Unit tests for operator username generation (2026-06-06, S05).
 * buildAcronym / last4 / buildUsername are pure; ensureUniqueUsername is tested
 * with a stubbed findMany.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildAcronym, last4, buildUsername, ensureUniqueUsername } from '../operatorUsername';

describe('buildAcronym', () => {
  it('takes the first letter of each word, uppercased', () => {
    expect(buildAcronym('Mai Linh Express')).toBe('MLE');
  });

  it('strips Vietnamese diacritics', () => {
    expect(buildAcronym('Phương Trang')).toBe('PT');
    expect(buildAcronym('Phương Bắc')).toBe('PB');
  });

  it('uses the first 3 letters for a single-word brand', () => {
    expect(buildAcronym('Futa')).toBe('FUT');
  });

  it('treats punctuation/hyphens as word separators and collapses whitespace', () => {
    expect(buildAcronym('  Xe   Khách,  Phương-Bắc ')).toBe('XKPB');
    expect(buildAcronym('Mai-Linh')).toBe('ML');
  });

  it('falls back to OP for an empty/symbol-only brand', () => {
    expect(buildAcronym('   ')).toBe('OP');
    expect(buildAcronym('!!!')).toBe('OP');
  });

  it('caps the acronym at 5 letters', () => {
    expect(buildAcronym('a b c d e f g')).toBe('ABCDE');
  });
});

describe('last4', () => {
  it('returns the last 4 digits, ignoring non-digits', () => {
    expect(last4('+84901230001')).toBe('0001');
    expect(last4('0987654321')).toBe('4321');
  });

  it('pads short numbers with leading zeros', () => {
    expect(last4('12')).toBe('0012');
  });
});

describe('buildUsername', () => {
  it('joins acronym and last4 with a dash', () => {
    expect(buildUsername('Phương Bắc', '+84901230001')).toBe('PB-0001');
    expect(buildUsername('Mai Linh Express', '0987654321')).toBe('MLE-4321');
  });
});

describe('ensureUniqueUsername', () => {
  function client(taken: string[]) {
    return {
      operatorUser: {
        findMany: vi.fn(async () => taken.map((username) => ({ username }))),
      },
    };
  }

  it('returns the base when free', async () => {
    expect(await ensureUniqueUsername(client([]), 'PB-0001')).toBe('PB-0001');
  });

  it('appends -2 on first collision', async () => {
    expect(await ensureUniqueUsername(client(['PB-0001']), 'PB-0001')).toBe('PB-0001-2');
  });

  it('skips to the first free suffix', async () => {
    expect(
      await ensureUniqueUsername(client(['PB-0001', 'PB-0001-2', 'PB-0001-3']), 'PB-0001'),
    ).toBe('PB-0001-4');
  });
});
