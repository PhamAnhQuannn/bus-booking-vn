// Claude adapter (Anthropic Messages API) — sibling của geminiAdapter/openaiCompatAdapter, cùng contract
// StreamEvent → router swap được. Chọn bằng PLANNER_LLM_PRIMARY=claude (order [claude, gemini]).
//
// Anthropic SSE: `content_block_start` khai block (text | tool_use{name}) theo `index`; `content_block_delta`
// mang `text_delta.text` (prose → stream ngay cho TTFT) hoặc `input_json_delta.partial_json` (tool args THEO
// MẢNH → GOM theo index, JSON.parse SAU vòng đọc; parse fail → DROP im lặng như Groq). Usage: input ở
// `message_start`, output ở `message_delta`. Event `error` giữa stream → upstream.
//
// Key CHỈ ở header `x-api-key` (không query) → không rò qua URL/String(err). ANTHROPIC_BASE_URL BỎ QUA ở
// prod thật (key trong header → base lạ = exfil). Error message chỉ "Claude HTTP <status>" — không body.

import { isRealProduction } from "@/lib/core/config/deployTier";
import { isCitySlug } from "../cities";
import { filterVibes } from "../vibes";
import { signModelTurn } from "../chatSig";
import { systemFor, TRICH_DECL, GOI_Y_DECL, trichEvent } from "./prompt";
import { stubStream } from "./llmStub";
import { ParseIntentError, type AdapterOpts, type ChatTurn, type StreamEvent } from "./types";

export const CLAUDE_MODEL_DEFAULT = "claude-haiku-4-5"; // cheapest-first; override PLANNER_CLAUDE_MODEL
const ANTHROPIC_HOST_DEFAULT = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL_NAME_RE = /^[a-z0-9.-]+$/i;
const MAX_OUTPUT_TOKENS = 2048;
const STREAM_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 529]); // 529 = Anthropic overloaded

export function resolveClaudeModel(): string {
  const raw = process.env.PLANNER_CLAUDE_MODEL?.trim();
  if (!raw) return CLAUDE_MODEL_DEFAULT;
  if (!MODEL_NAME_RE.test(raw)) {
    console.warn(`[planner] PLANNER_CLAUDE_MODEL bị từ chối (${JSON.stringify(raw)}) → dùng ${CLAUDE_MODEL_DEFAULT}`);
    return CLAUDE_MODEL_DEFAULT;
  }
  return raw;
}
// ANTHROPIC_BASE_URL: mock server dev/test. BỎ QUA ở prod thật.
export function resolveAnthropicBaseUrl(): string {
  const raw = process.env.ANTHROPIC_BASE_URL?.trim();
  if (raw && !isRealProduction()) return raw.replace(/\/+$/, "");
  return ANTHROPIC_HOST_DEFAULT;
}

const anthropicTools = () =>
  [TRICH_DECL, GOI_Y_DECL].map((d) => ({ name: d.name, description: d.description, input_schema: d.parameters }));

// Messages API: turn đầu PHẢI là user + role xen kẽ. History client có thể mở bằng model turn (lời chào)
// hoặc 2 turn cùng role liền nhau → bỏ model đầu, gộp turn cùng role, bỏ turn rỗng.
export function toAnthropicMessages(history: ChatTurn[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of history) {
    if (!t.text.trim()) continue; // Anthropic 400 trên text rỗng/chỉ-khoảng-trắng → bỏ turn
    const role = t.role === "model" ? "assistant" : "user";
    if (!out.length && role === "assistant") continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${t.text}`;
    else out.push({ role, content: t.text });
  }
  return out;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

interface SseEvent {
  type?: string;
  index?: number;
  content_block?: { type?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
  error?: { type?: string };
}

// Stream 1 lượt Claude. Cùng StreamEvent contract như geminiAdapter.
export async function* streamChat(history: ChatTurn[], locale: 'vi' | 'en' = 'vi', opts: AdapterOpts = {}): AsyncGenerator<StreamEvent> {
  // #748 STUB GATE (mirror các adapter khác) — defense-in-depth cho caller import adapter trực tiếp.
  if (process.env.PLANNER_LLM_STUB === "true") {
    if (isRealProduction()) throw new ParseIntentError("PLANNER_LLM_STUB không được bật ở production", "no_key");
    yield* stubStream(history, locale);
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ParseIntentError("ANTHROPIC_API_KEY chưa cấu hình", "no_key");

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS); };

  const model = resolveClaudeModel();
  const requestBody = JSON.stringify({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Model Claude mới (Sonnet/Opus 5.x, Fable) từ chối temperature khác mặc định → 400 → fallback âm thầm.
    // Chỉ gửi cho Haiku (default); override khác dùng mặc định của model.
    ...(model.startsWith("claude-haiku") ? { temperature: 0.3 } : {}),
    stream: true,
    system: systemFor(locale),
    tools: anthropicTools(),
    tool_choice: { type: "auto" },
    messages: toAnthropicMessages(history),
  });
  const url = `${resolveAnthropicBaseUrl()}/v1/messages`;

  const backoff = async (n: number) => {
    try { await sleep(RETRY_BACKOFF_MS * n, controller.signal); }
    catch { clearTimeout(timer); throw new ParseIntentError("Claude timeout", "upstream"); }
    await opts.onRetry?.(); // #622: attempt vừa hỏng + SẮP thử lại → đếm 1
  };

  let res: Response;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION },
        signal: controller.signal,
        body: requestBody,
      });
    } catch (err) {
      if (controller.signal.aborted) { clearTimeout(timer); throw new ParseIntentError("Claude timeout", "upstream"); }
      if (attempt >= MAX_ATTEMPTS) { clearTimeout(timer); throw new ParseIntentError(`Claude fetch failed: ${String(err)}`, "upstream"); }
      await backoff(attempt);
      continue;
    }
    if (res.ok && res.body) break;
    if (!RETRYABLE_STATUS.has(res.status) || attempt >= MAX_ATTEMPTS) {
      res.body?.cancel();
      clearTimeout(timer);
      throw new ParseIntentError(`Claude HTTP ${res.status}`, "upstream");
    }
    res.body?.cancel();
    await backoff(attempt);
  }

  yield { kind: "provider", id: "claude", model };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accProse = "";
  const toolAcc = new Map<number, { name: string; args: string }>();
  let inputTokens = 0;
  let outputTokens = 0;
  let sawUsage = false;

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
        if (!line.startsWith("data:")) continue; // bỏ dòng `event:` — type có trong payload
        const payload = line.slice(5).trim();
        if (!payload) continue;

        let ev: SseEvent;
        try { ev = JSON.parse(payload); } catch { continue; }

        switch (ev.type) {
          case "message_start":
            if (ev.message?.usage) {
              sawUsage = true;
              inputTokens = ev.message.usage.input_tokens ?? 0;
              outputTokens = ev.message.usage.output_tokens ?? 0;
            }
            break;
          case "content_block_start":
            if (ev.content_block?.type === "tool_use")
              toolAcc.set(ev.index ?? 0, { name: ev.content_block.name ?? "", args: "" });
            break;
          case "content_block_delta":
            if (ev.delta?.type === "text_delta" && ev.delta.text) {
              accProse += ev.delta.text;
              yield { kind: "token", text: ev.delta.text };
            } else if (ev.delta?.type === "input_json_delta" && ev.delta.partial_json) {
              const cur = toolAcc.get(ev.index ?? 0);
              if (cur) cur.args += ev.delta.partial_json;
            }
            break;
          case "message_delta":
            if (ev.usage?.output_tokens !== undefined) { sawUsage = true; outputTokens = ev.usage.output_tokens; }
            break;
          case "error":
            throw new Error(`stream error event ${ev.error?.type ?? "unknown"}`);
        }
      }
    }

    // Finalize SAU vòng đọc (giống Groq): parse fail → DROP im lặng; filter enum lạ.
    for (const [, tc] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
      let args: Record<string, unknown>;
      try { args = JSON.parse(tc.args || "{}"); } catch { continue; }
      if (args === null || typeof args !== "object" || Array.isArray(args)) continue;
      if (tc.name === "trich") {
        yield trichEvent(args);
      } else if (tc.name === "goi_y_vibe") {
        const dia = typeof args.dia_diem === "string" && isCitySlug(args.dia_diem) ? args.dia_diem : null;
        const vibes = filterVibes([String(args.vibe ?? "")]);
        if (dia && vibes.length) yield { kind: "suggest", dia_diem: dia, vibe: vibes[0] };
      }
    }

    if (accProse) yield { kind: "sig", tag: signModelTurn(accProse) };
    if (sawUsage)
      yield { kind: "usage", inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, thoughtsTokens: 0 };
  } catch (err) {
    throw new ParseIntentError(
      controller.signal.aborted ? "Claude timeout" : `Claude stream error: ${String(err)}`,
      "upstream",
    );
  } finally {
    clearTimeout(timer);
  }
}
