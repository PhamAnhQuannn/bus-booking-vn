/**
 * POST /api/planner/chat — trợ lý hội thoại (Phase G, v2 streaming).
 *
 * Body: { history: {role:'user'|'model', text}[] }. Trả SSE:
 *   token   {text}                       — prose model stream dần
 *   options {slot, options[], allowCustom}— hỏi thêm, chips bấm nhanh
 *   status  {phase}                       — 'planning' quanh engine
 *   result  {params, href}               — lịch dựng từ engine, link /lich-trinh
 *   error   {message, fallbackHref}       — 429/quota/no_key -> fallback form
 *   done
 *
 * LLM KHÔNG chọn/bịa địa điểm — mọi place từ KB qua engine. CSRF + rate-limit ở proxy.ts.
 * Key Gemini đọc server-side trong parseIntent, KHÔNG ra client.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest } from 'next/server';
import {
  streamChat,
  sanitizeHistory,
  ParseIntentError,
  getStore,
  pickByVibe,
  CityDataUnavailableError,
  type ChatTurn,
  type DestinationSuggestion,
} from '@/trip-planner/lib/planner';
import {
  plannerChatRatelimit,
  plannerChatAnonRatelimit,
  plannerChatDailyPerIp,
  plannerDailyBudget,
} from '@/lib/ratelimit';
import { clientIp } from '@/lib/core/http/clientIp';
import { sessionIdFromRequest } from '@/lib/analytics';
import { captureException } from '@/lib/observability';
import { getEnv } from '@/lib/config';
import { logger } from '@/lib/logger';

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  // Runtime kill-switch (#549): shut off the paid Gemini chat instantly during a cost/abuse
  // incident without unsetting GEMINI_API_KEY + redeploying. 503 before any work or body parse.
  if (!getEnv().PLANNER_CHAT_ENABLED) {
    return new Response(JSON.stringify({ error: 'PLANNER_CHAT_DISABLED' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    });
  }

  const body = (await req.json().catch(() => null)) as { history?: unknown } | null;
  const raw = Array.isArray(body?.history) ? body.history : [];
  const history: ChatTurn[] = raw
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        ((t as ChatTurn).role === 'user' || (t as ChatTurn).role === 'model') &&
        typeof (t as ChatTurn).text === 'string',
    )
    .slice(-8)
    .map((t) => ({
      role: t.role,
      text: t.text.slice(0, 2000),
      // Chỉ model-turn mang chữ ký; sanitizeHistory sẽ verify + drop turn giả bên dưới.
      ...(t.role === 'model' && typeof t.sig === 'string' ? { sig: t.sig } : {}),
    }));

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response(JSON.stringify({ error: 'Thiếu nội dung tin nhắn' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate-limit BEFORE the (paid, uncapped) Gemini call. The generic 60/min/IP edge
  // limit in proxy.ts is too loose for an LLM stream — tighten per session, then check
  // the global daily Gemini budget so no single caller can exhaust the free-tier quota.
  const ip = clientIp(req.headers);
  const sessionId = sessionIdFromRequest(req);
  const rl = sessionId
    ? await plannerChatRatelimit.limit(`planner-chat:${sessionId}`)
    : await plannerChatAnonRatelimit.limit(`planner-chat-anon:${ip}`);
  // Per-IP DAILY sub-cap (#547) — bb_sid is attacker-mintable, so the per-session throttle
  // above can be rotated away; this caps any single IP at 50/day so no one IP drains the whole
  // global budget. Checked before the global bucket so a drained IP doesn't consume it.
  const perIp = rl.allowed
    ? await plannerChatDailyPerIp.limit(`planner-gemini-ip:${ip}`)
    : null;
  const budget = rl.allowed && perIp?.allowed
    ? await plannerDailyBudget.limit('planner-gemini:global')
    : null;
  if (!rl.allowed || (perIp && !perIp.allowed) || (budget && !budget.allowed)) {
    // Which bucket denied — a distinct line for the GLOBAL budget so quota exhaustion is
    // greppable/alertable, vs the per-session/IP throttles which just mean one caller is noisy.
    const denier = budget && !budget.allowed
      ? 'global-budget'
      : perIp && !perIp.allowed
        ? 'per-ip-daily'
        : sessionId
          ? 'session'
          : 'anon-ip';
    const retryAfter = budget && !budget.allowed
      ? budget.retryAfter
      : perIp && !perIp.allowed
        ? perIp.retryAfter
        : rl.retryAfter;
    logger.warn(
      { denier, retryAfter, ip },
      denier === 'global-budget'
        ? 'planner.chat.denied.budget_exhausted'
        : 'planner.chat.denied.rate_limited',
    );
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // Chống history-injection: chỉ tin model-turn có chữ ký hợp lệ (server đã ký ở lượt trước).
  // Turn `role:'model'` client bịa (không/sai chữ ký) bị DROP trước khi vào Gemini contents.
  const safeHistory = sanitizeHistory(history);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));
      try {
        // Extract-only: chỉ TRÍCH ràng buộc (prose + slots). Client TẤT ĐỊNH lo hỏi thêm + dựng lịch
        // qua /api/planner/itinerary → chip = $0, /chat chỉ chạy cho free-text.
        for await (const ev of streamChat(safeHistory)) {
          if (ev.kind === 'token') {
            send('token', { text: ev.text });
          } else if (ev.kind === 'slots') {
            send('slots', { partial: ev.partial });
          } else if (ev.kind === 'sig') {
            // Chữ ký prose lượt này → client lưu, echo lại lượt sau để server verify.
            send('sig', { tag: ev.tag });
          } else if (ev.kind === 'suggest') {
            // mode discovery: LLM chỉ phát vibe slug — TÊN điểm lấy từ KB server-side (không LLM bịa).
            let items: DestinationSuggestion[] = [];
            try {
              const store = await getStore(ev.dia_diem);
              items = pickByVibe(store, ev.vibe).map((p) => ({
                id: p.id,
                name: p.name,
                vibes: p.vibes ?? [],
                address: p.address,
                map_url: p.map_url,
                region_id: p.region_id ?? null,
              }));
            } catch (e) {
              // city chưa hỗ trợ HOẶC lỗi tạm (S3/network/parse) -> danh sách rỗng, KHÔNG sập stream.
              if (!(e instanceof CityDataUnavailableError)) console.error('planner vibe lookup failed', e);
            }
            send('suggestions', { vibe: ev.vibe, dia_diem: ev.dia_diem, items });
          }
        }
        send('done', {});
      } catch (err) {
        const noKey = err instanceof ParseIntentError && err.code === 'no_key';
        // Surface the failure — this is the one paid upstream (Gemini); without this the
        // route is blind to quota-exhaustion / 5xx storms until users complain.
        captureException(err, { route: 'planner/chat', code: noKey ? 'no_key' : 'upstream' });
        send('error', {
          message: noKey
            ? 'Chưa cấu hình khoá Gemini trên server.'
            : 'Trợ lý đang bận, bạn thử nhắn lại sau nhé.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
