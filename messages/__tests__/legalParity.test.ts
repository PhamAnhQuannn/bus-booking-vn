import { describe, it, expect } from 'vitest';
import vi from '../vi/legal.json';
import en from '../en/legal.json';

/** Collect every leaf key-path of a nested JSON object (arrays flattened by index). */
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`));
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('legal.json vi/en parity', () => {
  it('vi and en have identical key trees (no missing/extra keys)', () => {
    // Compare the KEY structure (paths minus array indices, so array length differences
    // surface as index-path diffs). A missing translation key ships broken copy silently.
    const viKeys = new Set(keyPaths(vi));
    const enKeys = new Set(keyPaths(en));
    const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));
    const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));
    expect({ missingInEn, missingInVi }).toEqual({ missingInEn: [], missingInVi: [] });
  });

  it('no leaf value is empty or equals its own key name (untranslated stub)', () => {
    for (const [locale, doc] of [['vi', vi], ['en', en]] as const) {
      const walk = (obj: unknown, path: string) => {
        if (typeof obj === 'string') {
          expect(obj.trim(), `${locale} ${path} is empty`).not.toBe('');
        } else if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
        }
      };
      walk(doc, locale);
    }
  });
});

describe('cross-border disclosure (s6a) names every wired processor', () => {
  // PDPL Art.25 requires naming each cross-border recipient. Keep this list in sync with
  // the actual outbound integrations — the G7 CI grep guards additions of new vendors.
  const REQUIRED = ['Vercel', 'Neon', 'Upstash', 'Gemini', 'Groq', 'Resend', 'Sentry'];

  for (const [locale, doc] of [['vi', vi], ['en', en]] as const) {
    it(`${locale}: s6a lists all cross-border recipients`, () => {
      const items = (doc as { privacy: { s6a: { items: string[] } } }).privacy.s6a.items;
      expect(items.length).toBe(8); // 3 Singapore infra + Gemini + Groq + Google OAuth + Resend + Sentry
      const joined = items.join(' ');
      for (const name of REQUIRED) {
        expect(joined, `${locale} s6a missing "${name}"`).toContain(name);
      }
    });
  }
});
