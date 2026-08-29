// Planner liveness cho smoke ALERT-ONLY sau deploy. KHÁC http-asserts (thuần GET): mục #2 dưới đây
// làm 1 lượt /api/planner/chat THẬT (1 Gemini call + tốn rate-limit budget) — nên KHÔNG import vào
// smoke:local mặc định; chỉ smoke:prod (alert-only) gọi. Mục #1 (itinerary) vẫn thuần GET, $0.
//
// Vì sao cần: /api/planner/chat gọi getEnv() — thiếu env prod-required = lỗi (Mục B: SSE error frame,
// KHÔNG còn 500). /api/health + itinerary KHÔNG gọi getEnv nên không bắt được. Check này đọc khung SSE
// đầu: `event: error` = hỏng (env_config/upstream/kill-switch/rate-limit).
import type { Check } from './http-asserts.mjs';

const CHAT_TIMEOUT_MS = 40_000;

// Đọc stream tới khi thấy tín hiệu quyết định (error | slots | done) hoặc hết ~8KB, rồi hủy.
async function readFirstFrames(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (buf.length < 8192) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (/event:\s*(error|slots|done)/.test(buf)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return buf;
}

export async function plannerCheck(baseUrl: string): Promise<Check[]> {
  const out: Check[] = [];

  // 1. Engine liveness (thuần GET, $0): dựng lịch tất định từ KB — bắt lỗi data/R2/engine.
  let dtoOk = false, itinStatus = 0;
  try {
    const itin = await fetch(`${baseUrl}/api/planner/itinerary?slug=da-lat&days=3&adults=2`, { headers: { Accept: 'application/json' } });
    itinStatus = itin.status;
    const j = (await itin.json().catch(() => null)) as { dto?: unknown } | null;
    dtoOk = itin.status === 200 && !!j?.dto;
  } catch (e) {
    out.push({ name: 'planner itinerary (engine)', ok: false, detail: `threw: ${(e as Error).message}` });
    return out;
  }
  out.push({ name: 'planner itinerary (engine) 200 + dto', ok: dtoOk, detail: `status=${itinStatus}` });

  // 2. Chat liveness: 1 lượt Gemini thật. CSRF double-submit: lấy bb_csrf từ 1 GET rồi echo header+cookie.
  const pre = await fetch(`${baseUrl}/tro-ly-du-lich`);
  const cookieLines = pre.headers.getSetCookie?.() ?? [pre.headers.get('set-cookie') ?? ''];
  let csrf: string | undefined;
  for (const line of cookieLines) {
    const m = /(?:^|;\s*)bb_csrf=([^;]+)/.exec(line);
    if (m) { csrf = m[1]; break; }
  }
  if (!csrf) {
    // Không lấy được CSRF = không kết luận được chat → optional (WARN, không fail suite).
    out.push({ name: 'planner chat live', ok: false, optional: true, detail: 'no bb_csrf cookie' });
    return out;
  }

  // Retry 1 lần: chat free-tier + thinking model đôi khi 503/timeout THOÁNG QUA → 1 blip không nên báo
  // động. Env-break (getEnv) là PERSISTENT nên hỏng cả 2 lần → vẫn fail. attempt() trả detail để log.
  const attempt = async (): Promise<{ ok: boolean; detail: string }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort('timeout'), CHAT_TIMEOUT_MS);
    try {
      const chat = await fetch(`${baseUrl}/api/planner/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf!), Cookie: `bb_csrf=${csrf}` },
        body: JSON.stringify({ history: [{ role: 'user', text: 'đi đà lạt 3 ngày 2 người' }], locale: 'vi' }),
        signal: ctrl.signal,
      });
      const ok200 = chat.status === 200;
      const firstErr = ok200 && !!chat.body && /event:\s*error/.test(await readFirstFrames(chat.body));
      return { ok: ok200 && !firstErr, detail: ok200 ? (firstErr ? 'error frame' : 'ok') : `status=${chat.status}` };
    } catch (e) {
      const timedOut = (e as Error)?.name === 'AbortError';
      return { ok: false, detail: timedOut ? `timeout >${CHAT_TIMEOUT_MS}ms` : `threw: ${(e as Error).message}` };
    } finally {
      clearTimeout(timer);
    }
  };

  let r = await attempt();
  if (!r.ok) {
    await new Promise((res) => setTimeout(res, 2000)); // 1 blip qua đi
    const r2 = await attempt();
    r = { ok: r2.ok, detail: `${r.detail} → retry ${r2.detail}` };
  }
  out.push({ name: 'planner chat live (200 + no error frame)', ok: r.ok, detail: r.detail });
  return out;
}
