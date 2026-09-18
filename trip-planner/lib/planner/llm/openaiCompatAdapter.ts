// Groq adapter (OpenAI-compat) — PR-7. Sibling của geminiAdapter cho A+C (Groq primary + Gemini fallback).
// Groq /openai/v1/chat/completions stream=true. INERT tới PR-9 (router wire); chưa ai import.
//
// KHÁC Gemini (SSE functionCall trọn 1 frame): OpenAI-compat trả tool-call args THEO MẢNH qua
// `delta.tool_calls[i].function.arguments` nhiều delta → PHẢI GOM theo `index`, JSON.parse khi kết thúc.
// Gom SAI = trich rớt âm thầm → lịch sai. Finalize SAU vòng đọc: parse từng tool-call; parse fail
// (truncate/malformed/JSON dở) → DROP im lặng (0 slots, KHÔNG throw — an toàn hơn lịch rác). prose
// (delta.content) stream ngay cho TTFT + decode(stream:true) giữ UTF-8 tiếng Việt cắt giữa chunk.
//
// Provider-scoped: breaker/budget/usage 'planner-groq' (PR-4) sẽ wire ở route (PR-9). Key/base-url đọc
// process.env raw (như GEMINI_MODEL_OVERRIDE). GROQ_BASE_URL BỎ QUA ở prod (key trong header → base lạ = exfil).

import { isRealProduction } from "@/lib/core/config/deployTier";
import { isCitySlug } from "../cities";
import { filterVibes } from "../vibes";
import { signModelTurn } from "../chatSig";
import { systemFor, TRICH_DECL, GOI_Y_DECL, partialFromArgs, countOutOfEnum } from "./prompt";
import { ParseIntentError, type ChatTurn, type StreamEvent } from "./types";

export const GROQ_MODEL_DEFAULT = "openai/gpt-oss-20b"; // catalog Groq 2026 (llama-3.1-8b bỏ → 404); override PLANNER_GROQ_MODEL
const GROQ_HOST_DEFAULT = "https://api.groq.com";
const MODEL_NAME_RE = /^[a-z0-9./_-]+$/i; // Groq model có namespace `/` (openai/…, qwen/…)
const MAX_OUTPUT_TOKENS = 2048;
const STREAM_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export function resolveGroqModel(): string {
  const raw = process.env.PLANNER_GROQ_MODEL?.trim();
  if (!raw) return GROQ_MODEL_DEFAULT;
  if (!MODEL_NAME_RE.test(raw)) {
    console.warn(`[planner] PLANNER_GROQ_MODEL bị từ chối (${JSON.stringify(raw)}) → dùng ${GROQ_MODEL_DEFAULT}`);
    return GROQ_MODEL_DEFAULT;
  }
  return raw;
}
// GROQ_BASE_URL: mock server dev/test. BỎ QUA ở prod thật (key nằm header Authorization → base lạ = exfil).
export function resolveGroqBaseUrl(): string {
  const raw = process.env.GROQ_BASE_URL?.trim();
  if (raw && !isRealProduction()) return raw.replace(/\/+$/, "");
  return GROQ_HOST_DEFAULT;
}

// Groq validate tool-args server-side theo JSON-schema. gpt-oss điền `null` cho field SỐ chưa rõ →
// 400 "expected integer, got null". Nới null CHỈ field integer/number/boolean; GIỮ enum string/array
// STRICT (dia_diem/vibe/pace/interests) — model null enum → 400 (fail đúng, không "mời" bỏ trống city).
// (Finding PR-0; đồng bộ groqTolerant của harness llm-eval.ts.)
function groqTolerant(decl: typeof TRICH_DECL | typeof GOI_Y_DECL) {
  const d = JSON.parse(JSON.stringify(decl)) as { parameters?: { properties?: Record<string, { type?: unknown }> } };
  const props = d.parameters?.properties ?? {};
  for (const k of Object.keys(props)) {
    const p = props[k];
    const t = Array.isArray(p.type) ? (p.type as string[]) : [p.type as string];
    if (t.some((x) => x === "integer" || x === "number" || x === "boolean")) p.type = [...new Set([...t, "null"])];
  }
  return d;
}
const openaiTools = () => [TRICH_DECL, GOI_Y_DECL].map((d) => ({ type: "function", function: groqTolerant(d) }));

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

// OpenAI-compat streaming delta.
interface Delta {
  content?: string;
  tool_calls?: { index?: number; function?: { name?: string; arguments?: string } }[];
}
interface Choice { delta?: Delta; finish_reason?: string | null }
interface Chunk {
  choices?: Choice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// Stream 1 lượt Groq. Cùng StreamEvent contract như geminiAdapter (router swap được).
export async function* streamChat(history: ChatTurn[], locale: 'vi' | 'en' = 'vi'): AsyncGenerator<StreamEvent> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ParseIntentError("GROQ_API_KEY chưa cấu hình", "no_key");

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS); };

  const requestBody = JSON.stringify({
    model: resolveGroqModel(),
    temperature: 0.3,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    stream_options: { include_usage: true }, // usage đến ở chunk cuối
    tool_choice: "auto",
    tools: openaiTools(),
    messages: [
      { role: "system", content: systemFor(locale) },
      ...history.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
    ],
  });
  const url = `${resolveGroqBaseUrl()}/openai/v1/chat/completions`;

  const backoff = async (n: number) => {
    try { await sleep(RETRY_BACKOFF_MS * n, controller.signal); }
    catch { clearTimeout(timer); throw new ParseIntentError("Groq timeout", "upstream"); }
  };

  let res: Response;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal: controller.signal,
        body: requestBody,
      });
    } catch (err) {
      if (controller.signal.aborted) { clearTimeout(timer); throw new ParseIntentError("Groq timeout", "upstream"); }
      if (attempt >= MAX_ATTEMPTS) { clearTimeout(timer); throw new ParseIntentError(`Groq fetch failed: ${String(err)}`, "upstream"); }
      await backoff(attempt);
      continue;
    }
    if (res.ok && res.body) break;
    if (!RETRYABLE_STATUS.has(res.status) || attempt >= MAX_ATTEMPTS) {
      res.body?.cancel();
      clearTimeout(timer);
      throw new ParseIntentError(`Groq HTTP ${res.status}`, "upstream");
    }
    res.body?.cancel();
    await backoff(attempt);
  }

  // PR-8: khai provider TRƯỚC token đầu → route log + client badge biết lịch đến từ Groq (fallback fire).
  yield { kind: "provider", id: "groq", model: resolveGroqModel() };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accProse = "";
  // Gom tool-call args theo INDEX (mảnh qua nhiều delta) — parse SAU khi đọc xong.
  const toolAcc = new Map<number, { name: string; args: string }>();
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      kick();
      buffer += decoder.decode(value, { stream: true }); // UTF-8 cắt giữa chunk → giữ đúng tiếng Việt

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let chunk: Chunk;
        try { chunk = JSON.parse(payload); } catch { continue; } // frame dở → bỏ (hiếm với 1 dòng/frame)

        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          accProse += delta.content;
          yield { kind: "token", text: delta.content };
        }
        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index ?? 0; // gom theo index (KHÔNG theo thứ tự tới) — index-gap/out-of-order an toàn
          const cur = toolAcc.get(idx) ?? { name: "", args: "" };
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolAcc.set(idx, cur);
        }
      }
    }

    // Finalize SAU vòng đọc: parse từng tool-call theo index. Parse fail (truncate/malformed/JSON dở)
    // → DROP im lặng (0 slots, không throw). filterVibes/isCitySlug/partialFromArgs lọc enum lạ.
    for (const [, tc] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
      let args: Record<string, unknown>;
      try { args = JSON.parse(tc.args || "{}"); } catch { continue; }
      if (args === null || typeof args !== "object" || Array.isArray(args)) continue; // JSON hợp lệ nhưng không phải object (null/số/mảng) → drop
      if (tc.name === "trich") {
        yield { kind: "slots", partial: partialFromArgs(args), dropped: countOutOfEnum("trich", args) };
      } else if (tc.name === "goi_y_vibe") {
        const dia = typeof args.dia_diem === "string" && isCitySlug(args.dia_diem) ? args.dia_diem : null;
        const vibes = filterVibes([String(args.vibe ?? "")]);
        if (dia && vibes.length) yield { kind: "suggest", dia_diem: dia, vibe: vibes[0] };
      }
    }

    if (accProse) yield { kind: "sig", tag: signModelTurn(accProse) };
    if (usage)
      yield {
        kind: "usage",
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        thoughtsTokens: 0, // Groq gpt-oss không thinking-model
      };
  } catch (err) {
    throw new ParseIntentError(
      controller.signal.aborted ? "Groq timeout" : `Groq stream error: ${String(err)}`,
      "upstream",
    );
  } finally {
    clearTimeout(timer);
  }
}
