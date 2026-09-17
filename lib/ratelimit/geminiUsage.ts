/**
 * Gemini token/$ accounting (#553) — nay là ALIAS của recordLlmUsage('gemini', …) (PR-4).
 *
 * Logic + bảng giá tổng quát đã chuyển vào llmUsage.ts (per-provider) để Groq (free = $0) có counter
 * riêng (A+C). Ở đây giữ tên export cũ + key Redis literal `planner-gemini:*` (qua provider 'gemini')
 * → route/test/dashboard KHÔNG đổi.
 */

import { recordLlmUsage, type LlmUsageResult } from './llmUsage';

export type GeminiUsageResult = LlmUsageResult;

export async function recordGeminiUsage(
  inputTokens: number,
  outputTokens: number,
): Promise<GeminiUsageResult> {
  return recordLlmUsage('gemini', inputTokens, outputTokens);
}
