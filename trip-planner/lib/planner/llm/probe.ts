// Planner LLM drift probe (PR-10) — phát hiện model-404 (catalog churn: ladder llama cũ đã CHẾT 404;
// alias gemini-flash-latest từng roll sang thinking-model) + dead-provider TRƯỚC khi chạm traffic prod.
// Gọi endpoint METADATA models (0 token generation — KHÔNG tốn quota generateContent, không phải 1 lượt
// chat thật) → catch chính xác "model biến mất" mà chi phí ~0. Cron gọi qua barrel (boundary-safe).
//
// Prod SHIP DARK: GROQ_API_KEY chưa set → probeGroq trả 'skipped_no_key' (KHÔNG alert). Gemini có key
// prod → probe LIVE ngay (gemini là provider prod hiện tại). Fail-soft: lỗi mạng → 'down', không throw.

import { resolveGroqModel, resolveGroqBaseUrl } from "./openaiCompatAdapter";
import { resolveGeminiModel } from "./geminiAdapter";
import type { ProviderId } from "./types";

export type ProbeStatus = "ok" | "model_404" | "auth" | "down" | "skipped_no_key";
export interface ProbeResult {
  provider: ProviderId;
  model: string;
  status: ProbeStatus;
  httpStatus?: number;
  detail?: string;
}

const PROBE_TIMEOUT_MS = 8000;

// GET có timeout; abort → ném → caller map 'down'.
async function timedGet(url: string, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Groq: GET /openai/v1/models → { data: [{id}] }. Model pin không có trong danh mục = model_404 (drift).
async function probeGroq(): Promise<ProbeResult> {
  const model = resolveGroqModel();
  const key = process.env.GROQ_API_KEY;
  if (!key) return { provider: "groq", model, status: "skipped_no_key" };
  try {
    const res = await timedGet(`${resolveGroqBaseUrl()}/openai/v1/models`, { Authorization: `Bearer ${key}` });
    if (res.status === 401 || res.status === 403) return { provider: "groq", model, status: "auth", httpStatus: res.status };
    if (!res.ok) return { provider: "groq", model, status: "down", httpStatus: res.status };
    const body = (await res.json()) as { data?: { id?: string }[] };
    const ids = new Set((body.data ?? []).map((m) => m.id));
    return ids.has(model)
      ? { provider: "groq", model, status: "ok", httpStatus: res.status }
      : { provider: "groq", model, status: "model_404", httpStatus: res.status, detail: "model không có trong /v1/models" };
  } catch (err) {
    return { provider: "groq", model, status: "down", detail: String(err) };
  }
}

// Gemini: GET /v1beta/models/{model} (metadata). 404 = model biến mất/đổi tên (drift). Metadata KHÔNG
// tính vào quota generateContent 20/ngày → probe 1/ngày gần như free. Key ở HEADER `x-goog-api-key`
// (KHÔNG phải ?key= query như adapter) → key không bao giờ nằm trong URL → không rò qua String(err)/log
// dù lỗi mạng (repo PUBLIC, đây là key prod). detail chỉ chứa message lỗi, không URL.
async function probeGemini(): Promise<ProbeResult> {
  const model = resolveGeminiModel();
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { provider: "gemini", model, status: "skipped_no_key" };
  try {
    const res = await timedGet(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { "x-goog-api-key": key });
    if (res.status === 404) return { provider: "gemini", model, status: "model_404", httpStatus: 404 };
    if (res.status === 401 || res.status === 403) return { provider: "gemini", model, status: "auth", httpStatus: res.status };
    if (!res.ok) return { provider: "gemini", model, status: "down", httpStatus: res.status };
    return { provider: "gemini", model, status: "ok", httpStatus: res.status };
  } catch (err) {
    return { provider: "gemini", model, status: "down", detail: String(err) };
  }
}

const PROBES: Record<ProviderId, () => Promise<ProbeResult>> = { groq: probeGroq, gemini: probeGemini };

// Probe song song; mỗi probe tự fail-soft nên Promise.all không reject.
export async function probePlannerProviders(providers: ProviderId[]): Promise<ProbeResult[]> {
  return Promise.all(providers.map((p) => PROBES[p]()));
}
