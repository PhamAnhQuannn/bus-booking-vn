import { readFileSync } from 'fs';
import { resolve } from 'path';

export function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};

  try {
    const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) env[key] = value;
    }
  } catch {
    // CI injects env vars directly; local tests read from .env.local.
  }

  return env;
}
