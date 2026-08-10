'use client';

/**
 * /tro-ly-du-lich — trợ lý hội thoại + BẢN ĐỒ (Phase G, v3).
 *
 * Trái: chat SSE (POST /api/planner/chat). Phải: PlannerMap (Leaflet + PMTiles tự-host).
 * Khi đủ ràng buộc, engine dựng lịch → event `result` mang `dto` → render ItineraryCard TRONG chat
 * + feed map, đồng bộ 2 chiều (hover hàng ↔ pin; click pin ↔ cuộn+sáng hàng + bottom-sheet).
 *
 * LLM KHÔNG chọn/bịa địa điểm — mọi place từ KB qua engine. SSE cần POST + CSRF nên dùng fetch+reader.
 * Deep-import client-safe: csrfClient, PlannerMap (dynamic ssr:false), ItineraryCard, kiểu DTO.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { TripReceipt } from '@/trip-planner/components/TripReceipt';
import { cityName } from '@/trip-planner/lib/planner/cities';
// Deep-import client-safe: máy trạng thái slot tất định (chip = $0, không Gemini).
import { type Slots, type Ask, nextAsk, optionalAsk, applyChip, complete, mergeIntent, slotsToParams } from '@/trip-planner/lib/planner/slots';
// KIỂU only (erased lúc build → không kéo graph server vào client). Qua barrel = entry-point hợp lệ.
import type { PlannerDto, ParsedIntent } from '@/trip-planner/lib/planner';

// PlannerPane gộp Leaflet → dynamic ssr:false. Chứa DayTabBar + map (aspect-lock) + itinerary card.
const PlannerPane = dynamic(() => import('@/trip-planner/components/PlannerPane'), { ssr: false });

type Options = { slot: string; options: string[]; allowCustom: boolean };

type Msg =
  | { role: 'user'; text: string }
  | {
      role: 'bot';
      text: string;
      options?: Options;
      dto?: PlannerDto;
      href?: string;
      error?: boolean;
      planning?: boolean;
    };

const SAMPLES = [
  'Tạo cho tôi chuyến nghỉ dưỡng Đà Lạt 3 ngày',
  'Nha Trang 3 ngày 2 đêm cho 2 vợ chồng',
  'Đà Nẵng cho gia đình có trẻ nhỏ',
];

// Free-text (Gemini) + 3 chip hành động TẠM ẨN cho launch: đường free-text còn bug (lượt đầu 400,
// nhân đôi card, chip "Thêm ngày" co lịch còn 1). Luồng chip tất định vẫn chạy trọn. Bật lại =
// đổi true + vá route (drop leading model) + guard rebuild + wire chip. Xem QA/kế hoạch P1.
const FREE_TEXT_ENABLED = false;

export default function TroLyDuLichPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slots>({}); // ràng buộc tích luỹ — chip điền TẤT ĐỊNH (không Gemini)
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── trạng thái đồng bộ chat ↔ map ──
  const [dto, setDto] = useState<PlannerDto | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [hoveredOrder, setHoveredOrder] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ day: number; order: number } | null>(null);
  const [resultFull, setResultFull] = useState(false);
  const [pulseKey, setPulseKey] = useState(0); // tăng → nháy ring pane phải (receipt click)
  const [lastHref, setLastHref] = useState('/lich-trinh');

  // Receipt/click artifact: mobile mở overlay; desktop nháy pane + cuộn card lên đầu.
  function activateArtifact() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width:1023px)').matches) {
      setResultFull(true);
    } else {
      setPulseKey((k) => k + 1);
      document.querySelector('main > section:nth-child(2) [class*="overflow-y-auto"]')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Chuyến gần đây (client-only, localStorage — chưa auth nên không backend). Nạp sau mount tránh hydrate-mismatch.
  type Recent = { slug: string; tripDays: number; dto: PlannerDto };
  const [recents, setRecents] = useState<Recent[]>([]);
  useEffect(() => {
    let alive = true;
    // defer setState khỏi thân effect (tránh cascading-render lint) + sau mount (không hydrate-mismatch)
    Promise.resolve().then(() => {
      if (!alive) return;
      try {
        const r = JSON.parse(localStorage.getItem('bbvn_recent_trips') || '[]');
        if (Array.isArray(r) && r.length) setRecents(r.slice(0, 3));
      } catch { /* ignore */ }
    });
    return () => { alive = false; };
  }, []);
  function saveRecent(d: PlannerDto) {
    setRecents((prev) => {
      const next = [{ slug: d.slug, tripDays: d.tripDays, dto: d }, ...prev.filter((r) => !(r.slug === d.slug && r.tripDays === d.tripDays))].slice(0, 3);
      try { localStorage.setItem('bbvn_recent_trips', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  function openRecent(r: Recent) {
    setDto(r.dto); setActiveDay(1); setSelected(null); setHoveredOrder(null);
  }

  function patchBot(fn: (m: Extract<Msg, { role: 'bot' }>) => Extract<Msg, { role: 'bot' }>) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'bot') { next[i] = fn(next[i] as Extract<Msg, { role: 'bot' }>); break; }
      }
      return next;
    });
  }

  // Thêm 1 câu hỏi (chip chuẩn tất định) dưới dạng bot message.
  function pushAsk(a: Ask) {
    setMessages((prev) => [...prev, { role: 'bot', text: a.prompt, options: { slot: a.slot, options: a.options, allowCustom: a.allowCustom } }]);
  }

  // Sau khi cập nhật slot: thiếu bắt buộc → hỏi (chip); đủ nhưng chưa hỏi sở thích → hỏi 1 lần; đủ → dựng.
  function advance(s: Slots) {
    setSlots(s);
    if (!complete(s)) { const a = nextAsk(s); if (a) pushAsk(a); return; }
    if (s.interests === undefined) { const a = optionalAsk(s); if (a) { pushAsk(a); return; } }
    void buildFromSlots(s);
  }

  // Dựng lịch qua engine deterministic ($0, KHÔNG Gemini). Route trả PlannerDto (không lộ phone).
  async function buildFromSlots(s: Slots) {
    setMessages((prev) => [...prev, { role: 'bot', text: '', planning: true }]);
    setLoading(true);
    try {
      const res = await fetch('/api/planner/itinerary?' + slotsToParams(s), { headers: { 'X-CSRF-Token': readCsrfToken() } });
      if (!res.ok) throw new Error('build');
      const data = (await res.json()) as { dto: PlannerDto; href: string };
      setDto(data.dto); setActiveDay(1); setSelected(null); saveRecent(data.dto); setLastHref(data.href);
      patchBot((m) => ({ ...m, planning: false, text: 'Đây là lịch trình gợi ý cho bạn 👇', dto: data.dto, href: data.href }));
    } catch {
      patchBot((m) => ({ ...m, planning: false, text: 'Chưa dựng được lịch, bạn thử lại nhé.', error: true }));
    } finally {
      setLoading(false);
    }
  }

  // Click chip → điền slot TẤT ĐỊNH (KHÔNG gọi /chat/Gemini) → advance.
  function onChip(slot: string, label: string) {
    if (loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: label }]);
    advance(applyChip(slots, slot as Ask['slot'], label));
  }

  // Free-text → 1 Gemini call TRÍCH ràng buộc (stream prose + slots) → merge → advance.
  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    setInput('');

    const history = [...messages, { role: 'user' as const, text }]
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }))
      .filter((m) => m.text);

    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'bot', text: '' }]);
    setLoading(true);
    let partial: Partial<ParsedIntent> = {};

    try {
      const res = await fetch('/api/planner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ history }),
      });
      if (!res.ok || !res.body) {
        patchBot((m) => ({ ...m, text: m.text || 'Trợ lý đang bận, thử lại giúp mình nhé.', error: true }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const p = handleFrame(frame);
          if (p) partial = { ...partial, ...p };
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch {
      patchBot((m) => ({ ...m, text: m.text || 'Không kết nối được máy chủ, thử lại giúp mình nhé.', error: true }));
    } finally {
      setLoading(false);
    }
    advance(mergeIntent(slots, partial)); // tất định: hỏi thêm bằng chip hoặc dựng — KHÔNG thêm Gemini
  }

  // Parse 1 SSE frame. token → patchBot; slots → trả partial (caller merge); error → patchBot.
  function handleFrame(frame: string): Partial<ParsedIntent> | null {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return null;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(data); } catch { return null; }

    switch (event) {
      case 'token':
        patchBot((m) => ({ ...m, text: m.text + String(payload.text ?? '') }));
        return null;
      case 'slots':
        return (payload.partial as Partial<ParsedIntent> | undefined) ?? null;
      case 'error':
        patchBot((m) => ({ ...m, planning: false, text: m.text || String(payload.message ?? 'Có lỗi xảy ra.'), error: true }));
        return null;
      default:
        return null;
    }
  }

  // click pin trên map → chọn ngày + sáng hàng + cuộn card tới hàng đó
  function onPinClick(day: number, order: number) {
    setActiveDay(day);
    setSelected({ day, order });
    setTimeout(() => document.getElementById(`row-${day}-${order}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 70);
  }

  function initAsk() {
    const a = nextAsk({});
    return a
      ? [{ role: 'bot' as const, text: FREE_TEXT_ENABLED ? 'Chào bạn! Mô tả chuyến đi bằng câu tự nhiên, hoặc chọn thành phố:' : 'Chào bạn! Chọn thành phố để bắt đầu:', options: { slot: a.slot, options: a.options, allowCustom: a.allowCustom } }]
      : [];
  }
  // Câu hỏi đầu (chip thành phố) khi mount — chip = $0; ô nhập vẫn cho mô tả tự do.
  // defer khỏi thân effect (tránh cascading-render lint), giống effect recents.
  useEffect(() => { Promise.resolve().then(() => setMessages((prev) => (prev.length ? prev : initAsk()))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetTrip() {
    setSlots({}); setMessages(initAsk()); setDto(null); setSelected(null); setActiveDay(1);
    setHoveredOrder(null); setResultFull(false); setInput('');
  }

  // Pane phải (right-split, SPEC v4): PlannerPane tự tính tier + mapH (aspect-lock). Dùng cho cả
  // cột phải desktop (inline) LẪN overlay fullscreen (overlay). variant đổi cách xử SHORT-tier.
  const emptyState = (
    <div className="grid h-full w-full place-items-center bg-[color:var(--bg-cream,#FBF2E7)] p-6 text-center">
      <div>
        <div className="text-4xl">🗺️</div>
        <p className="mx-auto mt-3 max-w-[230px] text-sm font-semibold text-muted-foreground">
          Lịch trình + bản đồ của bạn sẽ hiện ở đây sau khi trợ lý dựng xong.
        </p>
      </div>
    </div>
  );
  const paneFor = (variant: 'inline' | 'overlay') =>
    dto ? (
      <PlannerPane
        dto={dto}
        activeDay={activeDay}
        hoveredOrder={hoveredOrder}
        selected={selected}
        onPinClick={onPinClick}
        onCloseSheet={() => setSelected(null)}
        onSelectDay={setActiveDay}
        onHoverItem={setHoveredOrder}
        variant={variant}
        onOpenFull={() => setResultFull(true)}
        pulseKey={pulseKey}
      />
    ) : (
      emptyState
    );

  // Suggestion zone: options ĐANG hỏi (slot-filling) hoặc hành động sau khi có lịch.
  const lastMsg = messages[messages.length - 1];
  // ask ĐANG mở (lastMsg = bot có chip) — chip bấm gọi onChip (tất định), KHÔNG /chat.
  const activeAsk = lastMsg?.role === 'bot' && lastMsg.options?.options?.length ? lastMsg.options : null;
  const ACTIONS: [string, string][] = [
    ['🔄 Đổi chỗ ăn trưa', 'Đổi giúp mình quán ăn trưa'],
    ['➕ Thêm 1 ngày', 'Thêm 1 ngày nữa vào lịch'],
    ['💸 Tiết kiệm hơn', 'Cho mình phương án tiết kiệm hơn'],
  ];

  return (
    <main className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[1720px] flex-col overflow-hidden lg:h-[calc(100dvh-64px)] lg:flex-row lg:gap-6">
      {/* CHAT — focal: cột lớn flex-1, content cap 720 căn giữa. Gutter 24 = lg:gap-6 (void, không viền). */}
      <section className="flex min-h-0 w-full flex-col lg:flex-1 lg:min-w-0">
        {/* Gap-bias: lg bám divider (mr-8=32) thay vì center → giảm perceived gap chat↔artifact */}
        <div className="mx-auto flex min-h-0 w-full max-w-[45rem] flex-1 flex-col lg:ml-auto lg:mr-8">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Trợ lý du lịch</h1>
              <p className="text-xs text-muted-foreground">
                {FREE_TEXT_ENABLED ? 'Mô tả chuyến đi bằng câu tự nhiên. ' : 'Chọn thành phố rồi trả lời vài câu hỏi nhanh. '}
                Lịch trình từ dữ liệu đã xác minh — không bịa giờ, giá.
              </p>
            </div>
            {messages.length > 0 ? (
              <button type="button" onClick={resetTrip}
                className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/5">
                + Chuyến mới
              </button>
            ) : null}
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-4 pb-2">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                {recents.length ? (
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground">Chuyến gần đây:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recents.map((r, i) => (
                        <button key={i} type="button" onClick={() => openRecent(r)}
                          className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
                          {cityName(r.slug)} · {r.tripDays} ngày
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {FREE_TEXT_ENABLED ? (
                  <>
                    <p className="text-sm text-muted-foreground">Thử bắt đầu với:</p>
                    {SAMPLES.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/5">
                        {s}
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}

            {messages.map((m, idx) => {
              // proximity: cùng người 8px, khác người 16px → thấy lượt-lời tức thì (Gestalt)
              const mt = idx === 0 ? 0 : messages[idx - 1].role === m.role ? 8 : 16;
              return m.role === 'user' ? (
                <div key={idx} style={{ marginTop: mt }} className="max-w-[min(75%,540px)] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">
                  {m.text}
                </div>
              ) : (
                <div key={idx} style={{ marginTop: mt }} className="w-full max-w-[min(92%,640px)] self-start">
                  {/* Bot bubble ấm hơn (#FFFDF9 + viền #E2D5C3) — understated ≠ invisible */}
                  <div className="rounded-2xl rounded-bl-md border px-4 py-3.5 text-[15px] leading-6" style={{ background: '#FFFDF9', borderColor: '#E2D5C3' }}>
                    {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : <p className="text-muted-foreground">Trợ lý đang trả lời…</p>}
                    {m.planning ? <p className="mt-2 text-xs text-muted-foreground">Đang lập kế hoạch từ dữ liệu đã xác minh…</p> : null}
                    {/* Options ĐANG hỏi → hiện ở composer-zone; đã trả lời → thu gọn "Đã chọn" */}
                    {m.options && m.options.options.length && messages[idx + 1]?.role === 'user' ? (
                      <p className="mt-2 text-xs" style={{ color: '#9AA0AC' }}>Đã chọn: {(messages[idx + 1] as { text: string }).text}</p>
                    ) : null}
                    {m.error ? <p className="mt-2 text-xs text-muted-foreground">Bạn thử nhắn lại giúp mình nhé.</p> : null}
                  </div>

                  {m.dto ? <TripReceipt dto={m.dto} onActivate={activateArtifact} onSelectDay={setActiveDay} /> : null}
                </div>
              );
            })}
          </div>

          {/* BOTTOM INTERACTION ZONE (P0-A): hint + suggestion chips + composer-card elevated — giết desert */}
          <div className="shrink-0 px-4 pb-5 pt-3">
            {dto && !activeAsk ? (
              <p className="mb-2 px-1 text-xs leading-relaxed" style={{ color: '#9AA0AC' }}>
                💡 Bấm pin trên bản đồ hoặc chip <b className="font-semibold">N1–N3</b> để xem từng ngày{FREE_TEXT_ENABLED ? ' · gõ câu để chỉnh lịch trình' : ''}.
              </p>
            ) : null}
            {(activeAsk || dto) ? (
              <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
                {activeAsk
                  ? activeAsk.options.map((opt) => (
                      <button key={opt} type="button" onClick={() => onChip(activeAsk.slot, opt)} disabled={loading}
                        className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" style={{ borderColor: '#F5A98A' }}>
                        {opt}
                      </button>
                    ))
                  : (
                    <>
                      {(FREE_TEXT_ENABLED ? ACTIONS : ([] as [string, string][])).map(([label, prompt]) => (
                        <button key={label} type="button" onClick={() => send(prompt)} disabled={loading}
                          className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" style={{ borderColor: '#F5A98A' }}>
                          {label}
                        </button>
                      ))}
                      <a href={lastHref} className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10" style={{ borderColor: '#F5A98A' }}>📄 Xuất PDF</a>
                    </>
                  )}
              </div>
            ) : null}
            {FREE_TEXT_ENABLED ? (
              <form className="flex items-center gap-2.5 rounded-2xl border border-border bg-background py-2 pl-4 pr-2 shadow-[0_4px_16px_rgba(30,36,51,0.08)] transition-shadow focus-within:border-primary focus-within:shadow-[0_4px_20px_rgba(240,86,29,0.14)]"
                onSubmit={(e) => { e.preventDefault(); send(input); }}>
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Vd: nghỉ dưỡng Đà Lạt cuối tuần cho 2 người"
                  className="h-12 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
                <button type="submit" disabled={loading || !input.trim()}
                  className="h-12 min-w-[88px] rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:opacity-90 disabled:bg-primary/40">
                  Gửi
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      {/* RIGHT PANE — PlannerPane (map aspect-lock + itinerary). Ẩn <lg (mở qua overlay/launcher). */}
      <section className="hidden lg:flex lg:h-full lg:w-[clamp(392px,36vw,620px)] lg:shrink-0 lg:flex-col">
        {paneFor('inline')}
      </section>

      {/* Overlay fullscreen [tabs + map + card] — dùng mọi width (mobile FAB + desktop-short launcher). */}
      {resultFull ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="text-sm font-semibold">Lịch trình & bản đồ</span>
            <button type="button" onClick={() => setResultFull(false)} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold">
              ← Về hội thoại
            </button>
          </div>
          <div className="min-h-0 flex-1">{paneFor('overlay')}</div>
        </div>
      ) : null}

      {/* FAB mở overlay kết quả trên mobile (desktop dùng launcher trong pane) */}
      {dto && !resultFull ? (
        <button type="button" onClick={() => setResultFull(true)}
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
          className="fixed z-40 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg lg:hidden">
          🗺 Lịch trình & bản đồ
        </button>
      ) : null}
    </main>
  );
}
