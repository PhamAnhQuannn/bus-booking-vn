import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * vi/en key parity for EVERY message catalog (legalParity.test.ts covers `legal` plus its
 * s6a disclosure check). A key present in one locale but not the other ships a raw key or
 * a runtime MISSING_MESSAGE error on that locale.
 */
const root = join(__dirname, '..');

function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`));
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

const load = (locale: string, file: string) =>
  JSON.parse(readFileSync(join(root, locale, file), 'utf8')) as unknown;

const viFiles = readdirSync(join(root, 'vi')).filter((f) => f.endsWith('.json')).sort();
const enFiles = readdirSync(join(root, 'en')).filter((f) => f.endsWith('.json')).sort();

describe('message catalogs vi/en parity', () => {
  it('both locales ship the same catalog files', () => {
    expect(enFiles).toEqual(viFiles);
  });

  for (const file of viFiles) {
    it(`${file}: identical key trees`, () => {
      const viKeys = new Set(keyPaths(load('vi', file)));
      const enKeys = new Set(keyPaths(load('en', file)));
      const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));
      const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));
      expect({ missingInEn, missingInVi }).toEqual({ missingInEn: [], missingInVi: [] });
    });
  }
});
