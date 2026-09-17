/**
 * The Groq daily-budget knob (PR-4) as a lib/core primitive — song song plannerGeminiBudget.ts.
 *
 * `lib/ratelimit` đọc lúc module-load để size `plannerGroqDailyBudget`. Sống trong lib/core với chỉ
 * dependency `zod` → mock `@/lib/config` không đụng được (xem lý do trong plannerGeminiBudget.ts).
 * `env.ts` import `plannerGroqDailyMaxSchema` cho field schema của nó → 1 rule dùng chung, không drift.
 */

import { z } from 'zod';

// Groq free: ~14,400 RPD nhưng 6,000 TPM (burst bị throttle TPM trước RPD). Default 200/ngày = trần an
// toàn ban đầu cho canary A+C (fail-closed như Gemini); nâng qua env PLANNER_GROQ_DAILY_MAX khi đo đủ.
// z.coerce.number().int().positive(): 0/âm/không-phải-số FAIL (không âm thầm về giá trị cũ).
export const plannerGroqDailyMaxSchema = z.coerce.number().int().positive().default(200);

/**
 * Read PLANNER_GROQ_DAILY_MAX standalone — NOT via getEnv() — an toàn gọi lúc module-load + unit test
 * trước khi env đầy đủ được populate.
 */
export function readPlannerGroqDailyMax(): number {
  return plannerGroqDailyMaxSchema.parse(process.env.PLANNER_GROQ_DAILY_MAX);
}
