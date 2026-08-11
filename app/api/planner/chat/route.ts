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
  ParseIntentError,
  getStore,
  pickByVibe,
  CityDataUnavailableError,
  type ChatTurn,
  type DestinationSuggestion,
} from '@/trip-planner/lib/planner';

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
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
    .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response(JSON.stringify({ error: 'Thiếu nội dung tin nhắn' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));
      try {
        // Extract-only: chỉ TRÍCH ràng buộc (prose + slots). Client TẤT ĐỊNH lo hỏi thêm + dựng lịch
        // qua /api/planner/itinerary → chip = $0, /chat chỉ chạy cho free-text.
        for await (const ev of streamChat(history)) {
          if (ev.kind === 'token') {
            send('token', { text: ev.text });
          } else if (ev.kind === 'slots') {
            send('slots', { partial: ev.partial });
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
