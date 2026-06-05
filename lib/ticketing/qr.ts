/**
 * Ticket QR encoder (Issue 071) — embedded pure-JS, NO npm dependency.
 *
 * This is a faithful port of Kazuhiko Arase's well-known public-domain
 * `qrcode-generator` algorithm (MIT licensed), restricted to:
 *   - BYTE mode (mode indicator 0b0100),
 *   - error-correction level M,
 *   - automatic version sizing (1..40) for the input length,
 *   - the standard finder / separator / timing / alignment / format / version
 *     patterns,
 *   - Reed–Solomon error correction over GF(256) (primitive 0x11D),
 *   - all 8 mask patterns + penalty scoring to pick the best.
 *
 * The module matrix is rendered to an SVG <rect> grid (black modules on white,
 * shape-rendering="crispEdges"). ticketQrDataUrl wraps it as a base64 data URL.
 *
 * The token (lib/ticketing/ticketToken.ts) is the real Issue-071 AC; this
 * encoder is the secondary deliverable. It is deterministic: identical input
 * (token + opts) yields an identical SVG string.
 *
 * Reference: https://github.com/kazuhikoarase/qrcode-generator (MIT).
 */

// ---------------------------------------------------------------------------
// GF(256) math for Reed–Solomon (primitive polynomial 0x11D, generator 2).
// ---------------------------------------------------------------------------

const EXP_TABLE = new Array<number>(256);
const LOG_TABLE = new Array<number>(256);
(function initGaloisTables() {
  for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    EXP_TABLE[i] =
      EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;
})();

function gfExp(n: number): number {
  let x = n;
  while (x < 0) x += 255;
  while (x >= 256) x -= 255;
  return EXP_TABLE[x];
}

function gfLog(n: number): number {
  if (n < 1) throw new Error(`gfLog(${n})`);
  return LOG_TABLE[n];
}

/** Polynomial over GF(256), most-significant coefficient first. */
class Polynomial {
  readonly num: number[];
  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array<number>(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  get(index: number): number {
    return this.num[index];
  }
  get length(): number {
    return this.num.length;
  }
  multiply(e: Polynomial): Polynomial {
    const out = new Array<number>(this.length + e.length - 1).fill(0);
    for (let i = 0; i < this.length; i++) {
      for (let j = 0; j < e.length; j++) {
        out[i + j] ^= gfExp(gfLog(this.get(i)) + gfLog(e.get(j)));
      }
    }
    return new Polynomial(out);
  }
  mod(e: Polynomial): Polynomial {
    if (this.length - e.length < 0) return this;
    const ratio = gfLog(this.get(0)) - gfLog(e.get(0));
    const out = this.num.slice();
    for (let i = 0; i < e.length; i++) {
      out[i] ^= gfExp(gfLog(e.get(i)) + ratio);
    }
    return new Polynomial(out).mod(e);
  }
}

/** Build the Reed–Solomon generator polynomial for `ecLength` EC codewords. */
function rsGenerator(ecLength: number): Polynomial {
  let poly = new Polynomial([1]);
  for (let i = 0; i < ecLength; i++) {
    poly = poly.multiply(new Polynomial([1, gfExp(i)]));
  }
  return poly;
}

// ---------------------------------------------------------------------------
// Bit buffer
// ---------------------------------------------------------------------------

class BitBuffer {
  private buffer: number[] = [];
  length = 0;
  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    this.length++;
  }
  getBuffer(): number[] {
    return this.buffer;
  }
}

// ---------------------------------------------------------------------------
// RS block layout + EC codeword counts for ECC level M, versions 1..40.
// Each entry: [ totalBlockCount, [count, totalCount, dataCount] ... ] is too
// verbose; we instead store the canonical Arase RS_BLOCK_TABLE rows for level M.
// Row format per version (level M): repeated triples [count, totalCount, dataCount].
// ---------------------------------------------------------------------------

// RS block table for ERROR CORRECT LEVEL M only (versions 1..40).
// Source: qrcode-generator QRRSBlock.RS_BLOCK_TABLE (the index-1 rows, level M).
const RS_BLOCK_TABLE_M: number[][] = [
  [1, 26, 16], // 1
  [1, 44, 28], // 2
  [1, 70, 44], // 3
  [2, 50, 32], // 4
  [2, 67, 43], // 5
  [4, 43, 27], // 6
  [4, 49, 31], // 7
  [2, 60, 38, 2, 61, 39], // 8
  [3, 58, 36, 2, 59, 37], // 9
  [4, 69, 43, 1, 70, 44], // 10
  [1, 80, 50, 4, 81, 51], // 11
  [6, 58, 36, 2, 59, 37], // 12
  [8, 59, 37, 1, 60, 38], // 13
  [4, 64, 40, 5, 65, 41], // 14
  [5, 65, 41, 5, 66, 42], // 15
  [7, 73, 45, 3, 74, 46], // 16
  [10, 74, 46, 1, 75, 47], // 17
  [9, 69, 43, 4, 70, 44], // 18
  [3, 70, 44, 11, 71, 45], // 19
  [3, 67, 41, 13, 68, 42], // 20
  [17, 68, 42], // 21
  [17, 74, 46], // 22
  [4, 75, 47, 14, 76, 48], // 23
  [6, 73, 45, 14, 74, 46], // 24
  [8, 75, 47, 13, 76, 48], // 25
  [19, 74, 46, 4, 75, 47], // 26
  [22, 73, 45, 3, 74, 46], // 27
  [3, 73, 45, 23, 74, 46], // 28
  [21, 73, 45, 7, 74, 46], // 29
  [19, 75, 47, 10, 76, 48], // 30
  [2, 74, 46, 29, 75, 47], // 31
  [10, 74, 46, 23, 75, 47], // 32
  [14, 74, 46, 21, 75, 47], // 33
  [14, 74, 46, 23, 75, 47], // 34
  [12, 75, 47, 26, 76, 48], // 35
  [6, 75, 47, 34, 76, 48], // 36
  [29, 74, 46, 14, 75, 47], // 37
  [13, 74, 46, 32, 75, 47], // 38
  [40, 75, 47, 7, 76, 48], // 39
  [18, 75, 47, 31, 76, 48], // 40
];

interface RSBlock {
  totalCount: number;
  dataCount: number;
}

function getRSBlocks(version: number): RSBlock[] {
  const row = RS_BLOCK_TABLE_M[version - 1];
  if (!row) throw new Error(`bad version ${version}`);
  const blocks: RSBlock[] = [];
  for (let i = 0; i < row.length; i += 3) {
    const count = row[i];
    const totalCount = row[i + 1];
    const dataCount = row[i + 2];
    for (let j = 0; j < count; j++) blocks.push({ totalCount, dataCount });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// BCH codes for format + version info.
// ---------------------------------------------------------------------------

const G15 =
  (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G18 =
  (1 << 12) |
  (1 << 11) |
  (1 << 10) |
  (1 << 9) |
  (1 << 8) |
  (1 << 5) |
  (1 << 2) |
  (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

function bchDigit(data: number): number {
  let digit = 0;
  let d = data;
  while (d !== 0) {
    digit++;
    d >>>= 1;
  }
  return digit;
}

function bchTypeInfo(data: number): number {
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) {
    d ^= G15 << (bchDigit(d) - bchDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

function bchTypeNumber(data: number): number {
  let d = data << 12;
  while (bchDigit(d) - bchDigit(G18) >= 0) {
    d ^= G18 << (bchDigit(d) - bchDigit(G18));
  }
  return (data << 12) | d;
}

// ---------------------------------------------------------------------------
// Alignment pattern positions per version.
// ---------------------------------------------------------------------------

const PATTERN_POSITION_TABLE: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

// ---------------------------------------------------------------------------
// Mask functions.
// ---------------------------------------------------------------------------

function maskFn(maskPattern: number, i: number, j: number): boolean {
  switch (maskPattern) {
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
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default:
      throw new Error(`bad maskPattern ${maskPattern}`);
  }
}

// ---------------------------------------------------------------------------
// QR model.
// ---------------------------------------------------------------------------

const PAD0 = 0xec;
const PAD1 = 0x11;

class QRCode {
  private moduleCount: number;
  private modules: (boolean | null)[][];

  constructor(private version: number, private dataCache: number[]) {
    this.moduleCount = version * 4 + 17;
    this.modules = Array.from({ length: this.moduleCount }, () =>
      new Array<boolean | null>(this.moduleCount).fill(null),
    );
    this.makeImpl(this.chooseBestMask());
  }

  get count(): number {
    return this.moduleCount;
  }

  isDark(row: number, col: number): boolean {
    return this.modules[row][col] === true;
  }

  private chooseBestMask(): number {
    let minLostPoint = 0;
    let bestPattern = 0;
    for (let pattern = 0; pattern < 8; pattern++) {
      this.makeImpl(pattern);
      const lostPoint = this.lostPoint();
      if (pattern === 0 || lostPoint < minLostPoint) {
        minLostPoint = lostPoint;
        bestPattern = pattern;
      }
    }
    return bestPattern;
  }

  private makeImpl(maskPattern: number): void {
    this.modules = Array.from({ length: this.moduleCount }, () =>
      new Array<boolean | null>(this.moduleCount).fill(null),
    );
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(maskPattern);
    if (this.version >= 7) this.setupTypeNumber();
    this.mapData(this.dataCache, maskPattern);
  }

  private setupPositionProbePattern(row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        this.modules[row + r][col + c] = dark;
      }
    }
  }

  private setupTimingPattern(): void {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  private setupPositionAdjustPattern(): void {
    const pos = PATTERN_POSITION_TABLE[this.version - 1];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] =
              r === -2 ||
              r === 2 ||
              c === -2 ||
              c === 2 ||
              (r === 0 && c === 0);
          }
        }
      }
    }
  }

  private setupTypeNumber(): void {
    const bits = bchTypeNumber(this.version);
    for (let i = 0; i < 18; i++) {
      const mod = ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i++) {
      const mod = ((bits >> i) & 1) === 1;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  private setupTypeInfo(maskPattern: number): void {
    // ECC level M is encoded as 0 in the format bits (Arase QRErrorCorrectLevel.M = 0).
    const data = (0 << 3) | maskPattern;
    const bits = bchTypeInfo(data);
    // vertical / horizontal placement around the top-left finder + others.
    for (let i = 0; i < 15; i++) {
      const mod = ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = true; // dark module
  }

  private mapData(data: number[], maskPattern: number): void {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (maskFn(maskPattern, row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  private lostPoint(): number {
    const n = this.moduleCount;
    let lost = 0;
    // Rule 1: adjacent same-color modules in row/column.
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let sameCount = 0;
        const dark = this.isDark(row, col);
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || n <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || n <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === this.isDark(row + r, col + c)) sameCount++;
          }
        }
        if (sameCount > 5) lost += 3 + sameCount - 5;
      }
    }
    // Rule 2: 2x2 blocks of same color.
    for (let row = 0; row < n - 1; row++) {
      for (let col = 0; col < n - 1; col++) {
        let count = 0;
        if (this.isDark(row, col)) count++;
        if (this.isDark(row + 1, col)) count++;
        if (this.isDark(row, col + 1)) count++;
        if (this.isDark(row + 1, col + 1)) count++;
        if (count === 0 || count === 4) lost += 3;
      }
    }
    // Rule 3: finder-like 1:1:3:1:1 patterns in rows/columns.
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n - 6; col++) {
        if (
          this.isDark(row, col) &&
          !this.isDark(row, col + 1) &&
          this.isDark(row, col + 2) &&
          this.isDark(row, col + 3) &&
          this.isDark(row, col + 4) &&
          !this.isDark(row, col + 5) &&
          this.isDark(row, col + 6)
        ) {
          lost += 40;
        }
      }
    }
    for (let col = 0; col < n; col++) {
      for (let row = 0; row < n - 6; row++) {
        if (
          this.isDark(row, col) &&
          !this.isDark(row + 1, col) &&
          this.isDark(row + 2, col) &&
          this.isDark(row + 3, col) &&
          this.isDark(row + 4, col) &&
          !this.isDark(row + 5, col) &&
          this.isDark(row + 6, col)
        ) {
          lost += 40;
        }
      }
    }
    // Rule 4: proportion of dark modules.
    let darkCount = 0;
    for (let col = 0; col < n; col++) {
      for (let row = 0; row < n; row++) {
        if (this.isDark(row, col)) darkCount++;
      }
    }
    const ratio = Math.abs((100 * darkCount) / n / n - 50) / 5;
    lost += ratio * 10;
    return lost;
  }
}

// ---------------------------------------------------------------------------
// Encoding pipeline: bytes → bit buffer → padded → RS-interleaved codewords.
// ---------------------------------------------------------------------------

/** UTF-8 encode a string to a byte array (avoids Buffer for portability). */
function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      // surrogate pair
      const hi = code;
      const lo = str.charCodeAt(++i);
      code = 0x10000 + ((hi & 0x3ff) << 10) + (lo & 0x3ff);
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

function lengthBits(version: number): number {
  // Byte mode character-count indicator width.
  return version < 10 ? 8 : 16;
}

function totalDataCount(version: number): number {
  const blocks = getRSBlocks(version);
  let total = 0;
  for (const b of blocks) total += b.dataCount;
  return total;
}

/** Smallest version (1..40) whose level-M data capacity fits `byteLength`. */
function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= 40; version++) {
    const capacityBits = totalDataCount(version) * 8;
    // 4 bits mode + N bits length indicator + 8*byteLength data bits.
    const needed = 4 + lengthBits(version) + byteLength * 8;
    if (needed <= capacityBits) return version;
  }
  throw new Error('data too large for QR (level M, v40)');
}

/** Build the interleaved data+EC codeword stream for the chosen version. */
function createData(version: number, bytes: number[]): number[] {
  const buffer = new BitBuffer();
  buffer.put(4, 4); // byte mode indicator
  buffer.put(bytes.length, lengthBits(version));
  for (const b of bytes) buffer.put(b, 8);

  const blocks = getRSBlocks(version);
  const totalData = totalDataCount(version);

  // Terminator + bit padding to a byte boundary.
  if (buffer.length + 4 <= totalData * 8) buffer.put(0, 4);
  while (buffer.length % 8 !== 0) buffer.putBit(false);

  // Byte padding with alternating PAD0/PAD1.
  for (;;) {
    if (buffer.length >= totalData * 8) break;
    buffer.put(PAD0, 8);
    if (buffer.length >= totalData * 8) break;
    buffer.put(PAD1, 8);
  }

  return createBytes(buffer, blocks);
}

function createBytes(buffer: BitBuffer, rsBlocks: RSBlock[]): number[] {
  let offset = 0;
  let maxDcCount = 0;
  let maxEcCount = 0;
  const dcData: number[][] = [];
  const ecData: number[][] = [];
  const raw = buffer.getBuffer();

  for (let r = 0; r < rsBlocks.length; r++) {
    const dcCount = rsBlocks[r].dataCount;
    const ecCount = rsBlocks[r].totalCount - dcCount;
    maxDcCount = Math.max(maxDcCount, dcCount);
    maxEcCount = Math.max(maxEcCount, ecCount);

    const dc = new Array<number>(dcCount);
    for (let i = 0; i < dcCount; i++) dc[i] = 0xff & (raw[i + offset] ?? 0);
    offset += dcCount;
    dcData[r] = dc;

    const rsPoly = rsGenerator(ecCount);
    const rawPoly = new Polynomial(dc, rsPoly.length - 1);
    const modPoly = rawPoly.mod(rsPoly);
    const ec = new Array<number>(rsPoly.length - 1);
    for (let i = 0; i < ec.length; i++) {
      const modIndex = i + modPoly.length - ec.length;
      ec[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
    ecData[r] = ec;
  }

  let totalCodeCount = 0;
  for (const b of rsBlocks) totalCodeCount += b.totalCount;

  const data = new Array<number>(totalCodeCount);
  let index = 0;
  for (let i = 0; i < maxDcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < dcData[r].length) data[index++] = dcData[r][i];
    }
  }
  for (let i = 0; i < maxEcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < ecData[r].length) data[index++] = ecData[r][i];
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Build the QR module matrix for a string (byte mode, ECC level M, auto-version).
 * Returns a square boolean[][] — true = dark module.
 * Exported for testing (known-vector assertions on module count / pattern).
 */
export function ticketQrMatrix(token: string): boolean[][] {
  const bytes = utf8Bytes(token);
  const version = chooseVersion(bytes.length);
  const data = createData(version, bytes);
  const qr = new QRCode(version, data);
  const n = qr.count;
  const matrix: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    matrix.push(row);
  }
  return matrix;
}

export interface TicketQrOptions {
  /** Target pixel size of the square SVG (default 256). */
  size?: number;
}

/**
 * Render a token to a QR-code SVG string (black modules on white).
 * Deterministic: identical (token, opts) → identical SVG.
 */
export function ticketQrSvg(token: string, opts: TicketQrOptions = {}): string {
  const size = opts.size ?? 256;
  const matrix = ticketQrMatrix(token);
  const count = matrix.length;
  const quiet = 4; // standard quiet-zone width in modules
  const dim = count + quiet * 2;
  // Integer module size for crisp rendering; viewBox handles scaling to `size`.
  const rects: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!matrix[r][c]) continue;
      const x = c + quiet;
      const y = r + quiet;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" ` +
    `role="img" aria-label="Ticket QR code">` +
    `<rect x="0" y="0" width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join('')}</g>` +
    `</svg>`
  );
}

/**
 * Render a token to a base64 SVG data URL for inline <img src=...> embedding.
 * Deterministic for a given (token, opts).
 */
export function ticketQrDataUrl(token: string, opts: TicketQrOptions = {}): string {
  const svg = ticketQrSvg(token, opts);
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}
