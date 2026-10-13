// conv-sim / proxyLib — phần thuần (test được) của eval-proxy: đọc env-file, bảng giá, parse usage, đếm PII.

import * as fs from "node:fs";

// Đọc dotenv tối giản. KHÔNG log giá trị.
export function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

// ── giá (USD / 1M token). Model lạ → giá Sonnet (bảo thủ, chống vượt cap). ──
const PRICE: [RegExp, number, number][] = [
  [/^claude-haiku/, 1, 5],
  [/^claude-sonnet/, 3, 15],
  [/^claude-fable/, 10, 50],
  [/^claude-opus/, 5, 25],
  [/^gemini-.*flash-lite/, 0.1, 0.4],
  [/^gemini-.*flash/, 0.3, 2.5],
  [/^(openai\/gpt-oss|qwen|llama)/, 0, 0], // Groq free tier
];
export const priceOf = (model: string): [number, number] => {
  const hit = PRICE.find(([re]) => re.test(model));
  return hit ? [hit[1], hit[2]] : [10, 50]; // model lạ → giá cao nhất đã biết (bảo thủ)
};

// ── usage parse (SSE hoặc JSON) ──
export interface Usage { model: string; input: number; output: number; cacheWrite: number; cacheRead: number }
export function parseUsage(provider: string, body: string, reqModel: string): Usage {
  const u: Usage = { model: reqModel, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const docs: unknown[] = [];
  const t = body.trim();
  if (t.startsWith("{")) { try { docs.push(JSON.parse(t)); } catch { /* bỏ */ } }
  else for (const line of body.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const p = l.slice(5).trim();
    if (!p || p === "[DONE]") continue;
    try { docs.push(JSON.parse(p)); } catch { /* bỏ */ }
  }
  for (const d of docs as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (provider === "anthropic") {
      const mu = d.message?.usage ?? (d.type === "message" ? d.usage : undefined);
      if (d.message?.model || d.model) u.model = d.message?.model ?? d.model;
      if (mu) {
        u.input = mu.input_tokens ?? u.input; u.output = mu.output_tokens ?? u.output;
        u.cacheWrite = mu.cache_creation_input_tokens ?? u.cacheWrite; u.cacheRead = mu.cache_read_input_tokens ?? u.cacheRead;
      }
      if (d.type === "message_delta" && d.usage?.output_tokens !== undefined) u.output = d.usage.output_tokens;
    } else if (provider === "gemini") {
      const m = d.usageMetadata;
      if (m) { u.input = m.promptTokenCount ?? u.input; u.output = (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0); }
      if (d.modelVersion) u.model = d.modelVersion;
    } else if (provider === "groq") {
      if (d.usage) { u.input = d.usage.prompt_tokens ?? u.input; u.output = d.usage.completion_tokens ?? u.output; }
      if (d.model) u.model = d.model;
    }
  }
  return u;
}
export function usdOf(u: Usage): number {
  const [pin, pout] = priceOf(u.model);
  return (u.input * pin + u.cacheWrite * pin * 1.25 + u.cacheRead * pin * 0.1 + u.output * pout) / 1e6;
}

// PII còn sót trong payload planner (sau redact). Chỉ đếm, không lưu chuỗi.
const PHONE_RE = /(\+84|\b0)[\d .-]{8,13}\d/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const SPELLED_RE = /\b(không|một|hai|ba|bốn|năm|sáu|bảy|tám|chín)( (không|một|hai|ba|bốn|năm|sáu|bảy|tám|chín)){8,}\b/gi;
export const piiHits = (s: string) => (s.match(PHONE_RE)?.length ?? 0) + (s.match(EMAIL_RE)?.length ?? 0) + (s.match(SPELLED_RE)?.length ?? 0);

// Stream đứt / không đọc được usage: tính theo cận trên (input ≈ ký tự/3, output = max_tokens của request).
export function conservativeUsage(u: Usage, reqBody: string): Usage {
  let maxOut = 4096;
  try {
    const j = JSON.parse(reqBody);
    maxOut = Number(j.max_tokens ?? j.max_completion_tokens ?? j.generationConfig?.maxOutputTokens) || 4096;
  } catch { /* giữ mặc định */ }
  return { ...u, input: Math.max(u.input, Math.ceil(reqBody.length / 3)), output: Math.max(u.output, maxOut) };
}
