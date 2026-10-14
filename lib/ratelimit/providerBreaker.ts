/**
 * Chọn circuit-breaker theo provider LLM primary (#853).
 *
 * Route planner-chat trước đây luôn dùng breaker Gemini (`planner-gemini:*`) cho MỌI provider → khi
 * PLANNER_LLM_PRIMARY=claude, lỗi upstream Claude (trả phí) mở/đếm dưới nhãn Gemini. Ở đây map
 * provider → 1 breaker singleton (module scope — createBreaker gọi 2 lần cùng prefix sẽ fork in-mem state).
 * Gemini = CHÍNH instance alias trong geminiBreaker.ts → key `planner-gemini:fails`/`:open` Y HỆT bản cũ.
 */

import * as gemini from './geminiBreaker';
import { createBreaker, type ProviderBreaker } from './upstreamBreaker';
import type { LlmProvider } from './llmUsage';

const BREAKERS: Record<LlmProvider, ProviderBreaker> = {
  gemini: {
    breakerState: gemini.breakerState,
    recordUpstreamFailure: gemini.recordUpstreamFailure,
    recordUpstreamSuccess: gemini.recordUpstreamSuccess,
  },
  groq: createBreaker('planner-groq'),
  claude: createBreaker('planner-claude'),
};

export function plannerBreakerFor(provider: LlmProvider): ProviderBreaker {
  return BREAKERS[provider];
}
