/**
 * Issue 071 — ticket QR encoder tests.
 *
 * The token (ticketToken.test.ts) is the real AC; the QR is secondary. These
 * tests assert: determinism, well-formed non-empty SVG, the data-URL wrapper,
 * a known-vector ('HELLO' → version-1 21x21 matrix with correct finder
 * patterns), AND a self-decode round-trip that proves the encoder is CORRECT
 * (not merely stable) by reading the format info + data codewords back out of
 * the rendered matrix and recovering the original bytes.
 */

import { describe, it, expect } from 'vitest';
import { ticketQrSvg, ticketQrDataUrl, ticketQrMatrix } from '../qr';

const SAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InRpY2tldCIsInJlZiI6IkJCLTIwMjYtYWIxMi1jZDM0IiwiY3QiOiJjb25mX3Rva18wMTIzNDU2Nzg5YWJjZGVmIn0.ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd';

describe('ticketQrSvg', () => {
  it('returns a non-empty SVG string', () => {
    const svg = ticketQrSvg(SAMPLE_TOKEN);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.includes('</svg>')).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect');
    expect(svg.length).toBeGreaterThan(100);
  });

  it('is deterministic for a given token', () => {
    expect(ticketQrSvg(SAMPLE_TOKEN)).toBe(ticketQrSvg(SAMPLE_TOKEN));
  });

  it('honors the size option in width/height', () => {
    const svg = ticketQrSvg(SAMPLE_TOKEN, { size: 320 });
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="320"');
  });

  it('ticketQrDataUrl wraps the SVG as base64 and decodes back', () => {
    const url = ticketQrDataUrl(SAMPLE_TOKEN);
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const b64 = url.slice('data:image/svg+xml;base64,'.length);
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    expect(decoded).toBe(ticketQrSvg(SAMPLE_TOKEN));
  });
});

describe('ticketQrMatrix — known vector "HELLO"', () => {
  const matrix = ticketQrMatrix('HELLO');

  it('chooses version 1 (21x21) for a 5-byte input', () => {
    expect(matrix.length).toBe(21);
    expect(matrix.every((row) => row.length === 21)).toBe(true);
  });

  it('has the three finder patterns (7x7 dark border, dark 3x3 core)', () => {
    const corners: [number, number][] = [
      [0, 0],
      [0, 14],
      [14, 0],
    ];
    for (const [r0, c0] of corners) {
      // top + bottom border rows all dark
      for (let c = 0; c < 7; c++) {
        expect(matrix[r0][c0 + c]).toBe(true);
        expect(matrix[r0 + 6][c0 + c]).toBe(true);
      }
      // left + right border cols all dark
      for (let r = 0; r < 7; r++) {
        expect(matrix[r0 + r][c0]).toBe(true);
        expect(matrix[r0 + r][c0 + 6]).toBe(true);
      }
      // inner ring (row 1 / row 5, cols 1..5) must be light except — actually
      // the 1-module separator is INSIDE: row1 col1 is light.
      expect(matrix[r0 + 1][c0 + 1]).toBe(false);
      // 3x3 dark core
      for (let r = 2; r <= 4; r++) {
        for (let c = 2; c <= 4; c++) {
          expect(matrix[r0 + r][c0 + c]).toBe(true);
        }
      }
    }
  });

  it('has timing patterns alternating on row 6 and column 6', () => {
    for (let c = 8; c <= 12; c++) {
      expect(matrix[6][c]).toBe(c % 2 === 0);
    }
    for (let r = 8; r <= 12; r++) {
      expect(matrix[r][6]).toBe(r % 2 === 0);
    }
  });

  it('has the fixed dark module at (4*V+9, 8) = (13, 8)', () => {
    expect(matrix[13][8]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Self-decode round-trip — proves CORRECTNESS, not just stability.
// We re-read the format info (mask) and the data region out of the rendered
// matrix, undo the mask, reassemble the data codewords, strip the RS interleave
// (trivial for single-block versions), and parse the byte-mode segment back to
// the original string. This exercises the full encode path end-to-end.
// ---------------------------------------------------------------------------

function maskFn(p: number, i: number, j: number): boolean {
  switch (p) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    default:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
  }
}

/** Decode a single-block (version 1) byte-mode QR matrix back to its string. */
function decodeV1ByteMode(matrix: boolean[][]): string {
  const n = matrix.length; // 21
  // Read format info bits 0..5 from column 8, rows 0..5 (Arase placement).
  // Easiest: read the mask from the 15-bit format string we wrote.
  // Reconstruct format bits from the vertical strip at column 8.
  const fmt: number[] = [];
  for (let i = 0; i < 15; i++) {
    let row: number;
    if (i < 6) row = i;
    else if (i < 8) row = i + 1;
    else row = n - 15 + i;
    fmt[i] = matrix[row][8] ? 1 : 0;
  }
  // Unmask with the format mask 0x5412 and extract data (5 bits) → ec(2)|mask(3).
  const G15_MASK = 0x5412;
  let raw = 0;
  for (let i = 0; i < 15; i++) raw |= fmt[i] << i;
  const unmasked = raw ^ G15_MASK;
  // top 5 bits (positions 10..14) hold the data; mask = bits 0..2 of data.
  const dataBits = (unmasked >> 10) & 0x1f;
  const maskPattern = dataBits & 0x7;

  // Build module-availability map by replaying function-pattern reservation.
  const reserved: boolean[][] = Array.from({ length: n }, () =>
    new Array<boolean>(n).fill(false),
  );
  const reserveProbe = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) reserved[rr][cc] = true;
      }
  };
  reserveProbe(0, 0);
  reserveProbe(n - 7, 0);
  reserveProbe(0, n - 7);
  // timing
  for (let i = 0; i < n; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
  }
  // format info strips
  for (let i = 0; i <= 8; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][n - 1 - i] = true;
    reserved[n - 1 - i][8] = true;
  }
  reserved[n - 8][8] = true; // dark module

  // Walk the data placement (same serpentine as the encoder), unmasking.
  const bits: number[] = [];
  let inc = -1;
  let row = n - 1;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!reserved[row][cc]) {
          let dark = matrix[row][cc];
          if (maskFn(maskPattern, row, cc)) dark = !dark;
          bits.push(dark ? 1 : 0);
        }
      }
      row += inc;
      if (row < 0 || row >= n) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }

  // Pack bits → bytes.
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    bytes.push(b);
  }

  // Parse byte-mode segment: 4-bit mode (0b0100) + 8-bit length + data bytes.
  // Re-read at bit granularity.
  let bitPos = 0;
  const readBits = (count: number): number => {
    let v = 0;
    for (let k = 0; k < count; k++) {
      v = (v << 1) | bits[bitPos++];
    }
    return v;
  };
  const mode = readBits(4);
  expect(mode).toBe(0b0100); // byte mode
  const len = readBits(8);
  let out = '';
  for (let i = 0; i < len; i++) out += String.fromCharCode(readBits(8));
  // touch `bytes` so lint doesn't flag it unused while keeping the intermediate.
  void bytes;
  return out;
}

describe('ticketQrMatrix — self-decode correctness round-trip', () => {
  it('decodes "HELLO" back out of the rendered version-1 matrix', () => {
    const matrix = ticketQrMatrix('HELLO');
    expect(decodeV1ByteMode(matrix)).toBe('HELLO');
  });

  it('decodes another short string "TICKET71"', () => {
    const matrix = ticketQrMatrix('TICKET71');
    expect(decodeV1ByteMode(matrix)).toBe('TICKET71');
  });
});
