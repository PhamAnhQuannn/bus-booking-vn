/**
 * HD-009 (#765) — financial-integrity guard: no float money math in the ledger.
 *
 * Currency in this system is BigInt minor units (Issue 016). A `Math.round(minorUnit *
 * rate)` or `parseFloat` in the money core is exactly the class of bug that silently
 * pays out the wrong VND until someone reconciles a real payout. This is a pure
 * source-scan (no DB) so it runs in the normal unit suite and fails the build the moment
 * an un-justified float op lands in `lib/ledger`.
 *
 * The escape hatch is deliberate and auditable: a genuinely-safe rounding (e.g. scaling a
 * fractional RATE to an integer basis before the BigInt multiply) carries a
 * `bigint-exempt:` marker on the same line or in the comment directly above it. Every hit
 * must be justified; the scan asserts ZERO unjustified hits.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Float-domain money ops that must never touch currency without justification. */
const FLOAT_OP = /Math\.round\s*\(|parseFloat\s*\(/;
const EXEMPT = /bigint-exempt/;
/** Lines that are pure comments — prose mentioning `Math.round` is not a code hit. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scanLedgerFloatOps(): Hit[] {
  const files = readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = readFileSync(join(LEDGER_DIR, file), 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (COMMENT_LINE.test(text)) return; // prose, not code
      if (!FLOAT_OP.test(text)) return;
      // Justified if the marker is on this line or in the two lines directly above it.
      const context = [text, lines[i - 1] ?? '', lines[i - 2] ?? ''].join('\n');
      if (!EXEMPT.test(context)) hits.push({ file, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

describe('HD-009 — no unjustified float money math in lib/ledger', () => {
  it('every Math.round/parseFloat in lib/ledger carries a bigint-exempt justification', () => {
    const hits = scanLedgerFloatOps();
    expect(hits, `Unjustified float money ops (add a bigint-exempt marker or rewrite in BigInt):\n${hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n')}`).toEqual([]);
  });

  it('the scanner actually inspects ledger source (guards against a no-op glob)', () => {
    // A green result is only meaningful if the scan saw the real files.
    const files = readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(files).toContain('calcPayout.ts');
    expect(files).toContain('ledgerRepo.ts');
  });
});
