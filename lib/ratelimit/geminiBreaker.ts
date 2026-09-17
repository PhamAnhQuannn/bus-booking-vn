/**
 * Gemini circuit-breaker (#552) — nay là ALIAS mỏng của createBreaker('planner-gemini') (PR-4).
 *
 * Logic tổng quát đã chuyển vào upstreamBreaker.ts để Groq có breaker riêng (A+C). Ở đây chỉ khởi 1
 * instance prefix 'planner-gemini' → key Redis `planner-gemini:fails`/`planner-gemini:open` Y HỆT bản
 * cũ (deploy KHÔNG reset breaker prod). Giữ tên export cũ để route/test KHÔNG đổi.
 */

import { createBreaker } from './upstreamBreaker';

export { BREAKER_COOLDOWN_SEC, type BreakerState } from './upstreamBreaker';

const gemini = createBreaker('planner-gemini');

export const breakerState = gemini.breakerState;
export const recordUpstreamFailure = gemini.recordUpstreamFailure;
export const recordUpstreamSuccess = gemini.recordUpstreamSuccess;
