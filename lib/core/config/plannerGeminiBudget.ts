/**
 * The Gemini daily-budget knob (#551) as a lib/core primitive — deliberately NOT behind the
 * `@/lib/config` barrel.
 *
 * `lib/ratelimit` reads this at module load to size `plannerDailyBudget`. If it imported the reader
 * from `@/lib/config`, any test doing a PARTIAL `vi.mock('@/lib/config', () => ({ getEnv }))` would
 * resolve the symbol to `undefined` and the module-load call would throw before the test could run
 * (this is exactly the trap the `resolveRatelimitBackend` comment in env.ts documents — it broke
 * `app/api/op/charter/[id]/decline/__tests__/route.test.ts`). Living in lib/core with only a `zod`
 * dependency, this module is immune: mocking `@/lib/config` cannot touch it, and lib/core is
 * deep-importable by every domain.
 *
 * `env.ts` imports `plannerGeminiDailyMaxSchema` from here for its own schema field, so the boot-time
 * validation and this standalone read share ONE rule and never drift.
 */

import { z } from 'zod';

// z.coerce.number().int().positive() kills the old `Number()||1000` footgun: 0, negative, or
// non-numeric now fail instead of silently collapsing. Default = 20 to MATCH the measured free-tier
// ceiling (2026-09-10: gemini-3.5-flash = 5 req/min + 20 req/DAY). The old default of 1000 was 50×
// looser than reality, so requests 21-1000/day sailed past this fail-closed gate into raw upstream
// 429s instead of a controlled degrade. When paid billing is enabled, set PLANNER_GEMINI_DAILY_MAX
// to the real (higher) budget via env — this default only guards an unset env at the free ceiling.
export const plannerGeminiDailyMaxSchema = z.coerce.number().int().positive().default(20);

/**
 * Read PLANNER_GEMINI_DAILY_MAX standalone — NOT via getEnv() — so importing it does not trigger the
 * full env-schema validation. Safe to call at module load and in unit tests before the rest of the
 * env is populated.
 */
export function readPlannerGeminiDailyMax(): number {
  return plannerGeminiDailyMaxSchema.parse(process.env.PLANNER_GEMINI_DAILY_MAX);
}
