'use client';

/**
 * /tro-ly-du-lich — trợ lý hội thoại + BẢN ĐỒ (redesign v4).
 *
 * Bố cục FULL-WIDTH 3 vùng (không gutter 2 lề như trang khác):
 *   [PlannerSidebar lịch sử/brand-intro]  ·  [ENTRY hero || chat SSE]  ·  [PlannerPane map]
 * Entry (chưa có tin) = mock "Bạn muốn đi đâu hôm nay?"; gửi 1 tin → active-chat + map.
 *
 * Lịch sử BỀN VỮNG: authed → API /api/planner/conversations; guest → localStorage
 * (conversationsClient hợp nhất 2 nguồn). LLM KHÔNG chọn/bịa địa điểm — mọi place từ KB qua engine.
 * SSE cần POST + CSRF nên dùng fetch+reader. Deep-import client-safe: csrfClient, clientSession,
 * PlannerPane (dynamic ssr:false), các component planner, kiểu DTO.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { useAuthStatus } from '@/lib/auth/clientSession';
import { TripReceipt } from '@/trip-planner/components/TripReceipt';
import { SuggestionCards } from '@/trip-planner/components/SuggestionCards';
import { PlannerSidebar } from '@/trip-planner/components/PlannerSidebar';
import { PlannerEntry } from '@/trip-planner/components/PlannerEntry';
import { PlannerComposer } from '@/trip-planner/components/PlannerComposer';
import { PlanSkeleton } from '@/trip-planner/components/PlanSkeleton';
import { SlotSummaryCard } from '@/trip-planner/components/SlotSummaryCard';
import { ProgressStages } from '@/trip-planner/components/ProgressStages';
import { RouteBus } from '@/trip-planner/components/RouteBus';
import {
  type StoredMsg,
  type ConversationMeta,
  listConversations,
  getConversation,
  createConversation,
  saveMessages,
  renameConversation,
  deleteConversation,
  clearAllConversations,
  deriveTitle,
} from '@/trip-planner/lib/planner/conversationsClient';
// Deep-import client-safe: máy trạng thái slot tất định (chip = $0, không Gemini).
import { type Slots, type Ask, nextAsk, optionalAsk, applyChip, complete, mergeIntent, slotsToParams, budgetAsk, transportAsk, foodAsk, extractFromText, applyExtracted, missingRequired } from '@/trip-planner/lib/planner/slots';
import { deriveLayoutPhase, type LayoutPhase } from '@/trip-planner/lib/planner/layoutPhase';
import { deriveGenPhase } from '@/trip-planner/lib/planner/genPhase';
import { CITIES } from '@/trip-planner/lib/planner/cities';
import { useIsWide } from '@/trip-planner/components/useIsWide';
// KIỂU only (erased lúc build → không kéo graph server vào client). Qua barrel = entry-point hợp lệ.
import type { PlannerDto, ParsedIntent, DestinationSuggestion } from '@/trip-planner/lib/planner';

// PlannerPane gộp Leaflet → dynamic ssr:false. Chứa DayTabBar + map (aspect-lock) + itinerary card.
const PlannerPane = dynamic(() => import('@/trip-planner/components/PlannerPane'), { ssr: false });
// ≥1280 pha planning: bản đồ ở đầu cột trái (gộp Leaflet → ssr:false).
const PlannerMapColumn = dynamic(() => import('@/trip-planner/components/PlannerMapColumn'), { ssr: false });

type Options = { slot: string; options: string[]; allowCustom: boolean };

// Slug có tile map thật (đồng bộ PlannerMap.TILED_SLUGS) — client-safe, KHÔNG import PlannerMap (kéo Leaflet).
const TILED = new Set(['da-lat', 'da-nang', 'nha-trang']);

// Giờ HH:mm theo TZ VN — gọi trong HANDLER (không phải render body) nên không phạm RSC-purity.
function nowHHMM(): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(Date.now());
}

type Msg =
  | { role: 'user'; text: string; time?: string }
  | {
      role: 'bot';
      text: string;
      time?: string;
      options?: Options;
      dto?: PlannerDto;
      href?: string;
      error?: boolean;
      retry?: boolean; // lỗi/timeout có thể thử lại (giữ nguyên slot/text)
      fallback?: boolean; // chat lỗi → có luồng thủ công không-AI (Mục C): hiện nút "Tự chọn lịch trình"
      planning?: boolean;
      suggestions?: DestinationSuggestion[]; // mode vibe-discovery: điểm-đến có tên (KB)
      suggestCity?: string; // slug thành phố của gợi ý (để anchor/lên lịch)
      suggestVibe?: string; // mã vibe (nhãn header)
      sig?: string; // HMAC tag server ký prose lượt này — echo lại để server verify (chống injection)
    };

// Msg[] (UI, có field tạm) ↔ StoredMsg[] (bền vững, chỉ role/text/dto).
function toStored(msgs: Msg[]): StoredMsg[] {
  return msgs
    .filter((m) => (m.text && m.text.trim()) || (m.role === 'bot' && m.dto))
    .map((m) => (m.role === 'user' ? { role: 'user', text: m.text } : { role: 'bot', text: m.text, dto: m.dto ?? null }));
}
function fromStored(list: StoredMsg[]): Msg[] {
  return list.map((s) => (s.role === 'user' ? { role: 'user', text: s.text } : { role: 'bot', text: s.text, dto: s.dto ?? undefined }));
}

export default function TroLyDuLichPage() {
  const authStatus = useAuthStatus();
  const locale = useLocale(); // P3b: forwarded to /api/planner/chat so Gemini replies in the UI language
  const t = useTranslations('planner');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slots>({}); // ràng buộc tích luỹ — chip điền TẤT ĐỊNH (không Gemini)
  const [pendingDestination, setPendingDestination] = useState<string | null>(null); // slug điểm đến bóc SỚM (đang stream) → bung 2 cột trước khi đủ slot
  const [pendingEdit, setPendingEdit] = useState<Slots | null>(null); // sửa slot SAU khi có dto → chờ xác nhận dựng lại
  const [slotCardCollapsed, setSlotCardCollapsed] = useState<boolean | null>(null); // null=mặc định theo hasDto; true/false=user override
  const abortRef = useRef<AbortController | null>(null); // hủy chat/itinerary đang chạy (edit slot mid-build / timeout / unmount)
  // Việc cần thử lại khi lỗi/timeout (giữ nguyên slot/text — không bắt gõ lại).
  const retryRef = useRef<{ kind: 'send'; text: string } | { kind: 'build'; slots: Slots } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── lịch sử hội thoại (bền vững: authed→API, guest→localStorage) ──
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reloadConversations = useCallback(() => {
    listConversations().then(setConversations).catch(() => {});
  }, []);

  // ── trạng thái đồng bộ chat ↔ map ──
  const [dto, setDto] = useState<PlannerDto | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [hoveredOrder, setHoveredOrder] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ day: number; order: number } | null>(null);
  const [resultFull, setResultFull] = useState(false);
  const [pulseKey, setPulseKey] = useState(0); // tăng → nháy ring pane phải (receipt click)
  const [lastHref, setLastHref] = useState('/lich-trinh');

  // ── resize ngang: kéo splitter chat ↔ pane plan (desktop lg) ──
  const mainRef = useRef<HTMLElement>(null);
  const chatSecRef = useRef<HTMLElement>(null);
  const [chatW, setChatW] = useState<number | null>(null); // px do user kéo; null = mặc định 37%
  const dragXRef = useRef(false);

  const isEntry = messages.length === 0; // màn mở đầu (hero) vs active-chat

  // ── pha bố cục (idle | collecting | planning) — flow 3-pha ≥1280 ──────────
  const isWide = useIsWide(); // ≥1280 → áp flow 3-pha mới; <1280 giữ bố cục cũ
  const [transitioning, setTransitioning] = useState(false); // slide collecting→planning (1 lần/phiên)
  const [composerFocused, setComposerFocused] = useState(false); // focus input → auto-thu map
  const skipTransitionRef = useRef(false); // reopen convo có plan → vào thẳng split, không animate
  const transitionDoneRef = useRef(false); // one-shot guard: slide chỉ chạy 1 lần/phiên
  const prevPhaseRef = useRef<LayoutPhase>('idle'); // phát hiện cạnh collecting→planning

  // Sticky planning KHÔNG cần latch riêng: tin bot mang dto tồn tại mãi trong mảng → hasDto sticky;
  // isGenerating phủ khoảng trống lần dựng đầu (trước khi dto về). Regenerate: dto cũ vẫn trong mảng.
  const hasDto = useMemo(() => messages.some((m) => m.role === 'bot' && !!m.dto), [messages]);
  const isGenerating = loading && messages.some((m) => m.role === 'bot' && m.planning);
  // Đã biết điểm đến (chip đặt slots.dia_diem HOẶC stream bóc sớm pendingDestination) → bung 2 cột sớm,
  // KHÔNG đợi đủ slot (quyết định early-flip). destKnown OR vào `planned` của layoutPhase.
  const destKnown = !!slots.dia_diem || !!pendingDestination;
  const anySlot = destKnown || !!slots.days || !!slots.budget || !!slots.interests?.length || !!slots.nhom;
  const lastBotErr = (() => { for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'bot') return !!(messages[i] as Extract<Msg, { role: 'bot' }>).error; } return false; })();
  // building = đang hướng tới kế hoạch: engine dựng (isGenerating) HOẶC đang chờ Gemini và đã biết điểm đến
  // (pha chờ dài THẬT là Gemini) → skeleton + progress phủ cả khoảng đó, không để pane phải trống.
  // building (→ skeleton) CHỈ khi đủ slot (client biết) hoặc engine đang dựng; thiếu slot + đang chờ → funnelPane.
  const building = !hasDto && (isGenerating || (loading && destKnown && complete(slots)));
  const genPhase = deriveGenPhase({ messageCount: messages.length, building, hasDto, hasError: lastBotErr, anySlot });
  const buildingView = genPhase === 'building';
  const layoutPhase = deriveLayoutPhase({ messageCount: messages.length, hasDto, isGenerating, planned: hasDto || destKnown });
  const useWideLayout = isWide && (layoutPhase === 'collecting' || layoutPhase === 'planning');
  const shrinkMap = isWide && layoutPhase === 'planning' && (composerFocused || loading); // Phần 6 wiring (auto-thu)

  // Slide split chạy ĐÚNG 1 lần/phiên khi lần đầu vào planning (bỏ qua nếu skipTransition / <1280).
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = layoutPhase;
    if (prev === 'collecting' && layoutPhase === 'planning' && isWide && !skipTransitionRef.current && !transitionDoneRef.current) {
      transitionDoneRef.current = true;
      setTransitioning(true);
      const id = setTimeout(() => setTransitioning(false), 360);
      return () => clearTimeout(id);
    }
    skipTransitionRef.current = false; // consume 1 lần khi đã tới planning
  }, [layoutPhase, isWide]);

  // Hủy request đang chạy khi rời trang → không leak fetch/reader.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Kéo splitter dọc: đổi độ rộng cột chat; pane plan (flex-1) tự co. Chỉ lg (splitter hidden <lg).
  function onSplitMove(e: React.PointerEvent) {
    if (!dragXRef.current) return;
    const sec = chatSecRef.current, main = mainRef.current;
    if (!sec || !main) return;
    const left = sec.getBoundingClientRect().left;
    const right = main.getBoundingClientRect().right;
    const w = Math.max(360, Math.min(e.clientX - left, right - left - 380)); // chat ≥360, plan ≥380
    setChatW(w);
  }
  function onSplitDown(e: React.PointerEvent) {
    dragXRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onSplitUp(e: React.PointerEvent) {
    dragXRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Ép chatW về biên khi cửa sổ đổi / mở-đóng sidebar → chat không tràn khi hẹp lại.
  useEffect(() => {
    const main = mainRef.current, sec = chatSecRef.current;
    if (!main || !sec) return;
    const ro = new ResizeObserver(() => {
      setChatW((prev) => {
        if (prev == null) return prev;
        const left = sec.getBoundingClientRect().left;
        const right = main.getBoundingClientRect().right;
        return Math.max(360, Math.min(prev, right - left - 380));
      });
    });
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  // Nạp danh sách hội thoại sau khi auth resolve (đổi guest↔authed → nạp lại đúng nguồn).
  useEffect(() => {
    if (authStatus !== 'unknown') reloadConversations();
  }, [authStatus, reloadConversations]);

  // Lưu bền vững khi 1 lượt lời settle (không lưu giữa lúc stream). Không đụng messages state → không loop.
  // lastSavedRef giữ chữ ký đã lưu → bỏ qua nếu không đổi (chặn re-save thừa lúc mở conversation cũ,
  // tránh updatedAt nhảy lên "bây giờ").
  const lastSavedRef = useRef<string>('');
  useEffect(() => {
    if (!conversationId || loading || messages.length === 0) return;
    const stored = toStored(messages);
    const sig = conversationId + '|' + JSON.stringify(stored);
    if (sig === lastSavedRef.current) return;
    lastSavedRef.current = sig;
    saveMessages(conversationId, stored).then(reloadConversations).catch(() => {});
  }, [messages, loading, conversationId, reloadConversations]);

  // Receipt/click artifact: mobile mở overlay; desktop nháy pane + cuộn card lên đầu.
  function activateArtifact() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width:1023px)').matches) {
      setResultFull(true);
    } else {
      setPulseKey((k) => k + 1);
      document.querySelector('main [data-map-pane] [class*="overflow-y-auto"]')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    setMessages((prev) => [...prev, { role: 'bot', text: a.prompt, time: nowHHMM(), options: { slot: a.slot, options: a.options, allowCustom: a.allowCustom } }]);
  }

  // Sau khi cập nhật slot: thiếu bắt buộc → hỏi (chip); đủ nhưng chưa hỏi sở thích → hỏi 1 lần; đủ → dựng.
  function advance(s: Slots) {
    setSlots(s);
    if (!complete(s)) { const a = nextAsk(s); if (a) pushAsk(a); return; }
    if (s.interests === undefined) { const a = optionalAsk(s); if (a) { pushAsk(a); return; } }
    void buildFromSlots(s);
  }

  // Filter chip (mock active) → mở picker slot tương ứng dưới dạng câu hỏi bot (chip trả lời).
  function openFilter(kind: 'so_thich' | 'ngan_sach' | 'phuong_tien' | 'an_uong') {
    if (loading) return;
    const ask = kind === 'so_thich' ? optionalAsk({}) : kind === 'ngan_sach' ? budgetAsk() : kind === 'phuong_tien' ? transportAsk() : foodAsk();
    if (ask) pushAsk(ask);
  }

  // Dựng lịch qua engine deterministic ($0, KHÔNG Gemini). Route trả PlannerDto (không lộ phone).
  // Hiện lỗi có nút Thử lại — giữ nguyên slot/text (không bắt gõ lại). Offline → thông điệp riêng.
  function showError(kind: 'send' | 'build', payload: { text?: string; slots?: Slots }, reqId: string, e: unknown) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    console.error(`[planner] ${kind} failed`, reqId, e);
    retryRef.current = kind === 'send' ? { kind, text: payload.text ?? '' } : { kind, slots: payload.slots ?? {} };
    patchBot((m) => ({ ...m, planning: false, text: m.text || t(offline ? 'assistant.offline' : 'assistant.timeoutOrBusy'), error: true, retry: true, fallback: true }));
  }

  // Thử lại từ bong bóng lỗi HOẶC empty-state panel — chạy lại đúng việc dang dở, không cần gõ lại.
  function doRetry() {
    const r = retryRef.current;
    if (!r) return;
    retryRef.current = null;
    patchBot((m) => ({ ...m, error: false, retry: false, fallback: false })); // gỡ cờ lỗi khỏi bong bóng cũ
    if (r.kind === 'build') void buildFromSlots(r.slots);
    else void send(r.text);
  }

  // Fallback không-AI (Mục C): chat lỗi → mở luồng chip TẤT ĐỊNH (không gọi /api/planner/chat).
  // Giữ slot đã bóc được từ tin user cuối; advance() hỏi phần còn thiếu bằng chip → buildFromSlots
  // → /api/planner/itinerary ($0, không Gemini, không getEnv — sống kể cả khi chat 500).
  function enterManual() {
    if (loading) return;
    const lastUser = [...messages].reverse().find((m): m is Extract<Msg, { role: 'user' }> => m.role === 'user');
    const base = lastUser ? applyExtracted(slots, extractFromText(lastUser.text)) : slots;
    retryRef.current = null;
    patchBot((m) => ({ ...m, error: false, retry: false, fallback: false })); // gỡ trạng thái lỗi
    advance(base); // thiếu slot → chip hỏi; đủ → dựng luôn qua engine
  }

  async function buildFromSlots(s: Slots) {
    abortRef.current?.abort(); // hủy request cũ trước khi tạo mới (edit slot mid-build → dựng lại)
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort('timeout'), 45000); // 45s không phản hồi → hủy → lỗi
    const reqId = 'build-' + nowHHMM();
    setMessages((prev) => [...prev, { role: 'bot', text: '', planning: true, time: nowHHMM() }]);
    setLoading(true);
    try {
      const res = await fetch('/api/planner/itinerary?' + slotsToParams(s), { headers: { 'X-CSRF-Token': readCsrfToken() }, signal: ctrl.signal });
      if (!res.ok) throw new Error('build ' + res.status);
      const data = (await res.json()) as { dto: PlannerDto; href: string };
      setDto(data.dto); setActiveDay(1); setSelected(null); setLastHref(data.href);
      patchBot((m) => ({ ...m, planning: false, text: t('assistant.buildSuccess'), dto: data.dto, href: data.href }));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        if (ctrl.signal.reason === 'timeout') showError('build', { slots: s }, reqId, e); // timeout → lỗi; user-abort → im lặng
        return;
      }
      showError('build', { slots: s }, reqId, e);
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === ctrl) { abortRef.current = null; setLoading(false); } // chỉ request HIỆN TẠI mới được hạ loading (chống clobber khi đã có request mới)
    }
  }

  // Sửa 1 slot từ SlotSummaryCard → cập nhật slots; nếu đủ slot → dựng lại (buildFromSlots tự abort
  // request cũ). Sửa lúc đang dựng = huỷ dở + dựng bản mới.
  function applyEdit(next: Slots) {
    setSlots(next);
    if (next.dia_diem) setPendingDestination(next.dia_diem);
    if (complete(next)) void buildFromSlots(next);
  }
  // Sửa slot: phễu/building → áp ngay (abort request cũ trong buildFromSlots). Sau khi có kế hoạch (dto)
  // → hỏi xác nhận trước khi dựng lại (tránh regenerate ngoài ý muốn).
  function onEditSlot(next: Slots) {
    if (hasDto) { setPendingEdit(next); return; }
    applyEdit(next);
  }

  // Click chip → điền slot TẤT ĐỊNH (KHÔNG gọi /chat/Gemini) → advance.
  function onChip(slot: string, label: string) {
    if (loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: label, time: nowHHMM() }]);
    advance(applyChip(slots, slot as Ask['slot'], label));
  }

  // Mode vibe: "Thêm vào lịch" 1 card → tích anchor + đặt thành phố (KHÔNG dựng ngay; cho chọn nhiều).
  function onAddAnchor(city: string, id: string, name: string) {
    if (loading || !city || !id) return; // city rỗng (backend thiếu dia_diem) -> no-op, không phá build
    setMessages((prev) => [...prev, { role: 'user', text: t('assistant.addAnchor', { name }), time: nowHHMM() }]);
    setSlots((s) => ({ ...s, dia_diem: city, anchor: [...new Set([...(s.anchor ?? []), id])] }));
  }

  // Mode vibe: "Lên lịch trình" → tiếp tục flow (hỏi ngày/số người nếu thiếu, rồi dựng với anchor đã tích).
  function onPlanVibe(city: string) {
    if (loading || !city) return; // city rỗng -> no-op (tránh slots.dia_diem="")
    setMessages((prev) => [...prev, { role: 'user', text: t('assistant.planTrip'), time: nowHHMM() }]);
    advance({ ...slots, dia_diem: city });
  }

  // Tạo hội thoại mới khi bắt đầu 1 phiên rỗng (title từ tin đầu). Trả conversationId hiện dùng.
  async function ensureConversation(firstText: string): Promise<void> {
    if (conversationId) return;
    try {
      const c = await createConversation(deriveTitle(firstText), []);
      setConversationId(c.id);
      reloadConversations();
    } catch (e) {
      // Lưu thất bại vẫn cho chat tiếp (không chặn hội thoại) — nhưng KHÔNG nuốt im: log để chẩn
      // đoán vì conversationId null nghĩa là phiên này không được persist (mất khi reload). (#528)
      console.warn('ensureConversation: tạo hội thoại thất bại — chat tiếp, không đồng bộ', e);
    }
  }

  // Free-text → 1 Gemini call TRÍCH ràng buộc (stream prose + slots) → merge → advance.
  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    setInput('');
    setDrawerOpen(false);
    // Mock 3: vào active-chat → thu gọn sidebar (chat thành cột trái ~37%). User vẫn toggle được.
    if (messages.length === 0) setSidebarCollapsed(true);
    await ensureConversation(text);

    const history = [...messages, { role: 'user' as const, text }]
      .map((m) =>
        m.role === 'user'
          ? { role: 'user', text: m.text }
          : { role: 'model', text: m.text, sig: m.sig }, // echo chữ ký để server verify model-turn
      )
      .filter((m) => m.text);

    setMessages((prev) => [...prev, { role: 'user', text, time: nowHHMM() }, { role: 'bot', text: '', time: nowHHMM() }]);
    // OPTIMISTIC: bóc slot client NGAY (trước round-trip) → mount shell 2 cột + skeleton/funnel ≤400ms.
    const det0 = extractFromText(text);
    if (det0.dia_diem) setPendingDestination(det0.dia_diem);
    if (Object.keys(det0).length) setSlots((prev) => applyExtracted(prev, det0));
    abortRef.current?.abort(); // hủy request cũ trước khi tạo mới
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort('timeout'), 45000); // 45s không phản hồi → hủy → lỗi
    const reqId = 'chat-' + nowHHMM();
    setLoading(true);
    let partial: Partial<ParsedIntent> = {};
    let suggested = false; // mode vibe-discovery: có gợi ý → KHÔNG auto-advance (CTA lo bước kế)
    let failed = false; // stream lỗi giữa chừng → đã hiện bong bóng lỗi, KHÔNG advance (tránh 2 tin trái nhau)

    try {
      const res = await fetch('/api/planner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ history, locale }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        retryRef.current = { kind: 'send', text };
        patchBot((m) => ({ ...m, text: m.text || t('assistant.busy'), error: true, retry: true, fallback: true }));
        failed = true;
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
          const r = handleFrame(frame);
          if (r?.partial) {
            partial = { ...partial, ...r.partial };
            if (typeof partial.dia_diem === 'string' && partial.dia_diem) setPendingDestination(partial.dia_diem); // biết điểm đến sớm → bung 2 cột ngay
          }
          if (r?.suggested) suggested = true;
          if (r?.failed) failed = true; // SSE error frame → chặn advance() bên dưới (#528)
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        if (ctrl.signal.reason === 'timeout') showError('send', { text }, reqId, e); // timeout → lỗi + Thử lại
        failed = true;
        return; // user-abort (edit slot/unmount) → im lặng
      }
      showError('send', { text }, reqId, e);
      failed = true;
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === ctrl) { abortRef.current = null; setLoading(false); } // chỉ request HIỆN TẠI mới hạ loading
    }
    // Lỗi SSE-frame giữa chừng (server catch) đã hiện bong bóng lỗi nhưng chưa gắn Thử lại → gắn ở đây.
    if (failed && !retryRef.current) { retryRef.current = { kind: 'send', text }; patchBot((m) => ({ ...m, retry: true })); }
    // Lỗi giữa chừng đã hiện bong bóng lỗi rồi — advance() ở đây sẽ thêm tin bot thứ 2 trái ngược
    // trong cùng lượt, nên chỉ advance khi KHÔNG lỗi và KHÔNG phải mode gợi ý. (#528)
    // tất định: Gemini partial + bóc client (budget-số + nhóm) → hỏi thêm bằng chip hoặc dựng — KHÔNG thêm Gemini
    if (!suggested && !failed) advance(applyExtracted(mergeIntent(slots, partial), extractFromText(text)));
  }

  // Parse 1 SSE frame. token → patchBot; slots → trả {partial}; suggestions → gắn cards + báo suggested; error → patchBot + báo failed.
  function handleFrame(frame: string): { partial?: Partial<ParsedIntent>; suggested?: boolean; failed?: boolean } | null {
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
      case 'sig':
        patchBot((m) => ({ ...m, sig: String(payload.tag ?? '') }));
        return null;
      case 'slots': {
        const pt = payload.partial as Partial<ParsedIntent> | undefined;
        return pt ? { partial: pt } : null;
      }
      case 'suggestions': {
        const items = Array.isArray(payload.items) ? (payload.items as DestinationSuggestion[]) : [];
        patchBot((m) => ({ ...m, suggestions: items, suggestCity: String(payload.dia_diem ?? ''), suggestVibe: String(payload.vibe ?? '') }));
        return { suggested: true };
      }
      case 'error':
        // SSE error frame (server catch: Gemini quota/no_key/timeout/5xx) — bong bóng lỗi ĐÃ hiện.
        // Báo failed để send() KHÔNG advance() sau đó (2 tin trái nhau). Đây là đường lỗi PHỔ BIẾN,
        // khác đường network-exception ở ngoài catch của send(). (#528)
        patchBot((m) => ({ ...m, planning: false, text: m.text || String(payload.message ?? t('assistant.genericError')), error: true, fallback: typeof payload.fallbackHref === 'string' && !!payload.fallbackHref }));
        return { failed: true };
      default:
        return null;
    }
  }

  // click pin trên map → chọn ngày + sáng hàng + cuộn card tới hàng đó.
  // useCallback: identity ổn định → không re-fire effect fitBounds trong PlannerMap (deps có onPinClick)
  // mỗi lần page re-render (hover/typing/stream) → map không tự zoom out sau khi kéo resize nhỏ.
  const onPinClick = useCallback((day: number, order: number) => {
    setActiveDay(day);
    setSelected({ day, order });
    setTimeout(() => document.getElementById(`row-${day}-${order}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 70);
  }, []);

  // ── điều khiển sidebar ──────────────────────────────────────────────────
  async function openConversation(id: string) {
    const c = await getConversation(id);
    if (!c) return;
    const msgs = fromStored(c.messages);
    let lastDto: PlannerDto | null = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'bot' && m.dto) { lastDto = m.dto; break; }
    }
    // Reset cờ transition TRƯỚC setMessages: có plan → vào thẳng split, KHÔNG replay slide.
    skipTransitionRef.current = !!lastDto;
    transitionDoneRef.current = false;
    prevPhaseRef.current = lastDto ? 'planning' : 'idle';
    // Đặt chữ ký = đúng cái effect sẽ tính → lần lưu ngay sau khi load bị skip (không bump updatedAt).
    lastSavedRef.current = id + '|' + JSON.stringify(toStored(msgs));
    setMessages(msgs);
    setConversationId(id);
    setDto(lastDto); setActiveDay(1); setSelected(null); setHoveredOrder(null); setSlots({}); setPendingDestination(null); setPendingEdit(null); setSlotCardCollapsed(null);
    setDrawerOpen(false); setSidebarCollapsed(true); // active → thu gọn sidebar (mock 3)
  }
  function newConversation() {
    // Reset cờ transition cùng nhau TRƯỚC setMessages → phiên mới ở idle, slide sẵn sàng chạy lại.
    skipTransitionRef.current = false; transitionDoneRef.current = false; prevPhaseRef.current = 'idle';
    setSlots({}); setPendingDestination(null); setPendingEdit(null); setSlotCardCollapsed(null); setMessages([]); setDto(null); setSelected(null); setActiveDay(1);
    setHoveredOrder(null); setResultFull(false); setInput(''); setConversationId(null); setDrawerOpen(false);
    setSidebarCollapsed(false); // về entry → mở lại sidebar
  }
  function onRename(id: string, title: string) { renameConversation(id, title).then(reloadConversations).catch(() => {}); }
  function onDelete(id: string) {
    deleteConversation(id).then(() => { if (id === conversationId) newConversation(); reloadConversations(); }).catch(() => {});
  }
  function onClearAll() { clearAllConversations().then(() => { newConversation(); reloadConversations(); }).catch(() => {}); }

  // Hành động dưới bong bóng lỗi: Thử lại (chạy lại việc dang dở) + Tự chọn lịch trình (luồng thủ công
  // không-AI, Mục C). Dùng chung cho cả 2 bố cục (wide/narrow) để không lệch nhau.
  const renderErrorActions = (m: Extract<Msg, { role: 'bot' }>) =>
    m.error ? (
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {m.retry ? (
            <button type="button" onClick={doRetry}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-[13px] font-semibold text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/60">
              ↻ {t('assistant.retry')}
            </button>
          ) : null}
          {m.fallback ? (
            <button type="button" onClick={enterManual}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] font-semibold text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60">
              {t('assistant.manualFallback')}
            </button>
          ) : null}
        </div>
        {m.fallback ? (
          <p className="text-[13px] text-muted-foreground">{t('assistant.manualFallbackHint')}</p>
        ) : !m.retry ? (
          <p className="text-[13px] text-muted-foreground">{t('assistant.tryAgain')}</p>
        ) : null}
      </div>
    ) : null;

  // Pane phải (right-split): PlannerPane tự tính tier + mapH (aspect-lock). Dùng cho cột phải desktop
  // (inline) LẪN overlay fullscreen (overlay). variant đổi cách xử SHORT-tier.
  const emptyState = (
    <div className="grid h-full w-full place-items-center bg-white p-6 text-center">
      <div>
        <div className="text-4xl">🗺️</div>
        <p className="mx-auto mt-3 max-w-[230px] text-sm font-semibold text-muted-foreground">
          {t('assistant.emptyState')}
        </p>
      </div>
    </div>
  );
  // Empty-state panel khi lượt cuối lỗi/timeout — icon + tiêu đề + Thử lại (chạy lại việc dang dở).
  const errorPane = (
    <div className="grid h-full w-full place-items-center bg-white p-6 text-center">
      <div>
        <div className="text-4xl" aria-hidden>🗺️</div>
        <p className="mx-auto mt-3 max-w-[240px] text-sm font-semibold text-muted-foreground">{t('assistant.panelErrorTitle')}</p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <button type="button" onClick={doRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60">
            ↻ {t('assistant.retry')}
          </button>
          <button type="button" onClick={enterManual}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60">
            {t('assistant.manualFallback')}
          </button>
        </div>
      </div>
    </div>
  );
  // Panel pha PHỄU (đã có ≥1 slot, chưa build, chưa dto) — hướng người dùng vào việc còn thiếu.
  const missing = missingRequired(slots);
  const funnelPane = (
    <div className="grid h-full w-full place-items-center bg-white p-6 text-center">
      <div>
        <div className="text-4xl" aria-hidden>💬</div>
        <p className="mx-auto mt-3 max-w-[250px] text-sm font-semibold text-muted-foreground">
          {t(missing > 0 ? 'assistant.funnelHint' : 'assistant.funnelHintReady', { n: missing })}
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
        hrefPdf={lastHref}
      />
    ) : buildingView ? (
      buildingPane
    ) : lastBotErr ? (
      errorPane
    ) : anySlot ? (
      funnelPane
    ) : (
      emptyState
    );

  // Suggestion zone: options ĐANG hỏi (slot-filling) hoặc hành động sau khi có lịch.
  const lastMsg = messages[messages.length - 1];
  const activeAsk = lastMsg?.role === 'bot' && lastMsg.options?.options?.length ? lastMsg.options : null;
  const ACTIONS: [string, string][] = [
    [t('assistant.actionChangeLunchLabel'), t('assistant.actionChangeLunchPrompt')],
    [t('assistant.actionAddDayLabel'), t('assistant.actionAddDayPrompt')],
    [t('assistant.actionCheaperLabel'), t('assistant.actionCheaperPrompt')],
  ];

  const sidebarProps = {
    authStatus,
    conversations,
    activeId: conversationId,
    onNew: newConversation,
    onOpen: openConversation,
    onRename,
    onDelete,
    onClearAll,
  };

  // ── mảnh chat dùng chung (narrow + wide) ─────────────────────────────────
  const chatTopBar = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E4D8C9] px-4 py-2.5">
      <button type="button" onClick={() => setDrawerOpen(true)} aria-label={t('assistant.historyAria')}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold lg:hidden">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        {t('assistant.history')}
      </button>
      <span className="hidden text-sm font-semibold text-muted-foreground lg:inline">{isEntry ? '' : t('assistant.assistantName')}</span>
      {!isEntry ? (
        <button type="button" onClick={newConversation}
          className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/5">
          {t('assistant.newConversation')}
        </button>
      ) : <span />}
    </div>
  );

  // Card tóm tắt slot (state Understood) — thay statusLine + PlannerStepper. Hiện khi đã có ≥1 slot.
  // Chip LUÔN bấm được (kể cả đang dựng) → sửa mid-build = huỷ + dựng lại (onEditSlot).
  const destSlug = slots.dia_diem ?? pendingDestination ?? undefined;
  const destName = CITIES.find((c) => c.slug === destSlug)?.ten ?? '';
  const tiledPending = !dto && !!destSlug && TILED.has(destSlug); // building + điểm đến có tile → map thật (overlay)
  // Slot card GHIM (sticky) đầu vùng cuộn — không trôi mất khi chat dài. Sau reveal thu gọn 1 dòng.
  // Confirm bar nêu RÕ thay đổi: diff slots↔pendingEdit → "Đổi Nhóm → "Cặp đôi", ...".
  const KNOWN_INTEREST = ['ngam-canh', 'tam-linh', 'lich-su-van-hoa', 'thien-nhien-mao-hiem', 'mua-sam', 'nong-nghiep-sinh-thai', 'bien-dao', 'suoi-nuoc-nong', 'song-ao-chup-hinh', 'thu-gian-yen-tinh', 'lang-man', 'ca-phe', 'am-thuc'];
  const iLabel = (c: string) => (KNOWN_INTEREST.includes(c) ? t(`slotCard.interest.${c}`) : c.charAt(0).toUpperCase() + c.slice(1));
  const budShort = (vnd: number) => { const m = Math.round(vnd / 100_000) / 10; return vnd >= 1_000_000 ? t('slotCard.budgetPerPerson', { amount: m % 1 === 0 ? String(m) : m.toFixed(1) }) : t('slotCard.budgetPerPersonK', { amount: Math.round(vnd / 1000) }); };
  const describeChanges = (o: Slots, n: Slots): string => {
    const items: string[] = [];
    const push = (slotKey: string, val: string) => items.push(t('slotCard.changeItem', { slot: t(`slotCard.${slotKey}`), value: val }));
    if (n.dia_diem !== o.dia_diem && n.dia_diem) push('destination', CITIES.find((c) => c.slug === n.dia_diem)?.ten ?? n.dia_diem);
    if (n.days !== o.days && n.days) push('days', t('slotCard.dayUnit', { n: n.days }));
    if (n.nhom !== o.nhom && n.nhom) push('groupPlaceholder', t(`slotCard.group.${n.nhom}`));
    const budN = n.budgetPerPerson ? `n${n.budgetPerPerson}` : n.budget ?? '', budO = o.budgetPerPerson ? `n${o.budgetPerPerson}` : o.budget ?? '';
    if (budN !== budO && (n.budgetPerPerson || n.budget)) push('budget', n.budgetPerPerson ? budShort(n.budgetPerPerson) : t(`slotCard.budgetLabel.${n.budget}`));
    if ((n.interests ?? []).join(',') !== (o.interests ?? []).join(',')) push('interests', (n.interests ?? []).map(iLabel).join(', '));
    return items.join(', ');
  };
  const isCollapsed = slotCardCollapsed === null ? hasDto : slotCardCollapsed;
  const slotCard = anySlot ? (
    <div className="sticky top-0 z-raised -mx-4 mb-1 bg-white/95 px-4 pt-2 backdrop-blur-sm">
      {isCollapsed ? (
        <button type="button" onClick={() => setSlotCardCollapsed(false)}
          className="flex w-full items-center gap-2 rounded-xl border border-[#F0EAE2] bg-white px-3 py-2 text-[13px] shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <span aria-hidden>📍</span>
          <span className="font-semibold text-foreground">{destName || '—'}</span>
          {slots.days ? <span className="text-muted-foreground">· {t('slotCard.dayUnit', { n: slots.days })}</span> : null}
          <span className="ml-auto font-semibold text-primary">{t('slotCard.editShort')} ▾</span>
        </button>
      ) : (
        <>
          <SlotSummaryCard slots={slots} onEdit={onEditSlot} />
          {hasDto ? (
            <button type="button" onClick={() => setSlotCardCollapsed(true)}
              className="mt-0.5 px-1 text-[12px] font-semibold text-muted-foreground outline-none hover:text-primary focus-visible:text-primary">
              {t('slotCard.collapse')} ▴
            </button>
          ) : null}
        </>
      )}
      {pendingEdit ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
          <span className="font-medium text-foreground">{describeChanges(slots, pendingEdit) ? t('slotCard.confirmChange', { changes: describeChanges(slots, pendingEdit) }) : t('slotCard.confirmRebuild')}</span>
          <button type="button" onClick={() => { applyEdit(pendingEdit); setPendingEdit(null); setSlotCardCollapsed(false); }}
            className="ml-auto rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60">
            {t('slotCard.rebuild')}
          </button>
          <button type="button" onClick={() => setPendingEdit(null)}
            className="rounded-full border border-border px-3 py-1 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60">
            {t('slotCard.cancel')}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;
  const progressBlock = buildingView ? <ProgressStages active={buildingView} settled={false} destination={destName} /> : null;

  const messagesBlock = (
    <div className="mt-3 flex flex-col">
      {messages.map((m, idx) => {
        const mt = idx === 0 ? 0 : messages[idx - 1].role === m.role ? 8 : 16;
        return m.role === 'user' ? (
          <div key={idx} style={{ marginTop: mt }} className="max-w-[min(78%,460px)] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">
            {m.text}
            {m.time ? <span className="mt-0.5 block text-right text-[10px] text-primary-foreground/70">{m.time} ✓✓</span> : null}
          </div>
        ) : (
          <div key={idx} style={{ marginTop: mt }} className="flex w-full gap-2.5 self-start">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-base" aria-hidden>🤖</span>
            <div className="min-w-0 max-w-[min(90%,560px)] flex-1">
              <div className="rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-6 text-foreground" style={{ background: '#FEFCF7', borderColor: '#F0EAE2' }}>
                {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : <p className="text-muted-foreground">{t('assistant.typing')}</p>}
                {m.planning ? <p className="mt-2 text-xs text-muted-foreground">{t('assistant.planningFromData')}</p> : null}
                {m.options && m.options.options.length && messages[idx + 1]?.role === 'user' ? (
                  <p className="mt-2 text-xs" style={{ color: '#9AA0AC' }}>{t('assistant.selected', { choice: (messages[idx + 1] as { text: string }).text })}</p>
                ) : null}
                {renderErrorActions(m)}
              </div>
              {m.time ? <span className="mt-0.5 block px-1 text-[10px] text-muted-foreground">{m.time}</span> : null}
              {m.dto ? <TripReceipt dto={m.dto} onActivate={activateArtifact} onSelectDay={setActiveDay} /> : null}
              {m.suggestions ? (
                <SuggestionCards
                  items={m.suggestions}
                  vibe={m.suggestVibe ?? ''}
                  onAdd={(id, name) => onAddAnchor(m.suggestCity ?? '', id, name)}
                  onPlan={() => onPlanVibe(m.suggestCity ?? '')}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  const askBlock = activeAsk ? (
    <div className="mt-3 flex gap-2.5">
      <span className="h-8 w-8 shrink-0" aria-hidden />
      <div className="rounded-2xl border border-[#F0EAE2] bg-white p-3.5 shadow-e1">
        <div className="flex flex-wrap gap-2">
          {activeAsk.options.map((opt, i) => (
            <button key={opt} type="button" onClick={() => onChip(activeAsk.slot, opt)} disabled={loading}
              className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
                i === 0 ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border border-[#F0EAE2] text-foreground hover:border-primary hover:bg-primary/5'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  const composerZone = (maxW: string) => (
    <div className={`mx-auto w-full shrink-0 px-4 pb-5 pt-3 ${maxW}`}>
      {!isEntry && dto && !activeAsk ? (
        <p className="mb-2 px-1 text-xs leading-relaxed" style={{ color: '#9AA0AC' }}>
          {t.rich('assistant.tip', { b: (chunks) => <b className="font-semibold">{chunks}</b> })}
        </p>
      ) : null}
      {!isEntry && dto && !activeAsk ? (
        <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
          {ACTIONS.map(([label, prompt]) => (
            <button key={label} type="button" onClick={() => send(prompt)} disabled={loading}
              className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" style={{ borderColor: '#F5A98A' }}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {!isEntry && !activeAsk ? (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {([[t('assistant.filterInterests'), 'so_thich'], [t('assistant.filterTransport'), 'phuong_tien'], [t('assistant.filterFood'), 'an_uong']] as [string, 'so_thich' | 'phuong_tien' | 'an_uong'][]).map(
            ([label, kind]) => (
              <button key={kind} type="button" onClick={() => openFilter(kind)} disabled={loading}
                className="flex items-center gap-1.5 rounded-full border border-[#F0EAE2] bg-white px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-40">
                {label}
              </button>
            ),
          )}
        </div>
      ) : null}
      <PlannerComposer value={input} onChange={setInput} onSubmit={() => send(input)} disabled={loading} busy={loading} />
      {isEntry ? (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden>🔒</span> {t('assistant.privacy')}
        </p>
      ) : null}
    </div>
  );

  // Skeleton pha `building` — anatomy đúng card lịch trình (xem PlanSkeleton), chống reflow khi reveal.
  const planSkeleton = <PlanSkeleton />;
  // Placeholder giữ chỗ map cột trái khi đã bung 2 cột nhưng CHƯA có dto (map thật cần dto) →
  // map thật mount vào KHÔNG đẩy chat xuống (chống CLS lần 2). Cao ~40% cột khớp PlannerMapColumn.
  const mapReserve = (
    <div className="shrink-0" aria-hidden>
      <div className="relative overflow-hidden border border-border" style={{ height: '40%', minHeight: 180, background: 'var(--bg-cream, #FBF2E7)' }}>
        <RouteBus />
      </div>
      <div className="h-3" />
    </div>
  );
  // Pha building trong pane phải = skeleton + mirror progress thu gọn ở đáy (bản chính ở khung chat).
  const buildingPane = (
    <div className="flex h-full flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-hidden">{planSkeleton}</div>
      <div className="shrink-0 border-t border-[#F0EAE2] px-3">
        <ProgressStages active={buildingView} settled={false} destination={destName} mirror />
      </div>
    </div>
  );

  // ── CORE 3-pha (≥1280): collecting full-width || planning split ──────────
  const wideCore =
    layoutPhase === 'collecting' ? (
      <section className="bb-scene-in flex min-h-0 w-full flex-1 flex-col">
        {chatTopBar}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col px-4 pb-2 pt-3">
            {slotCard}
            {messagesBlock}
            {askBlock}
            {progressBlock}
          </div>
        </div>
        {composerZone('max-w-[780px]')}
      </section>
    ) : (
      <div className="bb-scene-in grid min-h-0 w-full flex-1" style={{ gridTemplateColumns: 'minmax(420px,42%) 1fr' }}>
        <style>{`@keyframes v4PaneIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}.v4-pane-in{animation:v4PaneIn .35s ease-out}@media (prefers-reduced-motion: reduce){.v4-pane-in{animation:none}}`}</style>
        {/* CỘT TRÁI — bản đồ (trên) + chat (dưới) */}
        <div className="flex min-h-0 flex-col border-r border-[#E4D8C9]">
          {dto || tiledPending ? (
            <PlannerMapColumn
              dto={dto ?? undefined}
              pendingSlug={destSlug}
              activeDay={activeDay}
              hoveredOrder={hoveredOrder}
              selected={selected}
              onPinClick={onPinClick}
              onCloseSheet={() => setSelected(null)}
              shrink={shrinkMap}
            />
          ) : mapReserve}
          <div onFocusCapture={() => setComposerFocused(true)} onBlurCapture={() => setComposerFocused(false)} className="flex min-h-0 flex-1 flex-col">
            {chatTopBar}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex w-full flex-1 flex-col px-4 pb-2 pt-3">
                {slotCard}
                {messagesBlock}
                {askBlock}
                {progressBlock}
              </div>
            </div>
            {composerZone('max-w-none')}
          </div>
        </div>
        {/* CỘT PHẢI — kế hoạch full-height (map đã ở cột trái → hideMap) */}
        <section data-map-pane aria-busy={buildingView || undefined} className={`flex min-h-0 flex-col ${transitioning ? 'v4-pane-in' : ''}`}>
          {dto ? (
            <div key="reveal" className="bb-fade-in flex min-h-0 flex-1 flex-col">
              <PlannerPane
                dto={dto}
                activeDay={activeDay}
                hoveredOrder={hoveredOrder}
                selected={selected}
                onPinClick={onPinClick}
                onCloseSheet={() => setSelected(null)}
                onSelectDay={setActiveDay}
                onHoverItem={setHoveredOrder}
                variant="inline"
                onOpenFull={() => setResultFull(true)}
                pulseKey={pulseKey}
                hrefPdf={lastHref}
                hideMap
                onActiveDayChange={setActiveDay}
              />
            </div>
          ) : buildingView ? (
            buildingPane
          ) : lastBotErr ? (
            errorPane
          ) : anySlot ? (
            funnelPane
          ) : (
            emptyState
          )}
        </section>
      </div>
    );

  return (
    <main ref={mainRef} className="flex h-[calc(100dvh-56px)] w-full flex-col overflow-hidden bg-white lg:h-[calc(100dvh-64px)] lg:flex-row">
      {/* SIDEBAR desktop — lịch sử / brand-intro. Rộng ~26%W (đo từ mock) + clamp → bền tỉ lệ. */}
      <div className={`hidden lg:flex lg:h-full lg:shrink-0 ${sidebarCollapsed ? '' : 'lg:w-[26%] lg:min-w-[264px] lg:max-w-[360px]'}`}>
        <PlannerSidebar {...sidebarProps} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      </div>

      {/* SIDEBAR mobile — drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-overlay-backdrop bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute left-0 top-0 z-overlay-panel h-full w-[86%] max-w-[340px]" onClick={(e) => e.stopPropagation()}>
            <PlannerSidebar {...sidebarProps} collapsed={false} onToggleCollapse={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* ≥1280 pha collecting/planning → CORE 3-pha mới; else (idle hoặc <1280) → bố cục cũ */}
      {useWideLayout ? wideCore : (<>
      {/* CỘT GIỮA — entry hero (rộng) || active chat (mặc định ~37%W; kéo splitter đổi rộng qua --chat-w) */}
      <section ref={chatSecRef}
        style={{ '--chat-w': chatW == null ? '37%' : chatW + 'px' } as React.CSSProperties}
        className={`flex min-h-0 w-full flex-col lg:min-w-0 ${isEntry ? 'lg:flex-1' : 'lg:w-[var(--chat-w,37%)] lg:shrink-0'}`}>
        {/* Top bar mảnh: nút mở lịch sử (mobile) + nút "mới" khi đang chat */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E4D8C9] px-4 py-2.5">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label={t('assistant.historyAria')}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold lg:hidden">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            {t('assistant.history')}
          </button>
          <span className="hidden text-sm font-semibold text-muted-foreground lg:inline">{isEntry ? '' : t('assistant.assistantName')}</span>
          {!isEntry ? (
            <button type="button" onClick={newConversation}
              className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/5">
              {t('assistant.newConversation')}
            </button>
          ) : <span />}
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isEntry ? (
            <PlannerEntry onPick={send} disabled={loading} />
          ) : (
            <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-4 pb-2 pt-3">
              {slotCard}
              <div className="mt-3 flex flex-col">
                {messages.map((m, idx) => {
                  // proximity: cùng người 8px, khác người 16px → thấy lượt-lời tức thì (Gestalt)
                  const mt = idx === 0 ? 0 : messages[idx - 1].role === m.role ? 8 : 16;
                  return m.role === 'user' ? (
                    <div key={idx} style={{ marginTop: mt }} className="max-w-[min(78%,460px)] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">
                      {m.text}
                      {m.time ? <span className="mt-0.5 block text-right text-[10px] text-primary-foreground/70">{m.time} ✓✓</span> : null}
                    </div>
                  ) : (
                    <div key={idx} style={{ marginTop: mt }} className="flex w-full gap-2.5 self-start">
                      {/* Avatar bot (mock: robot tròn nền cam nhạt) */}
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-base" aria-hidden>🤖</span>
                      <div className="min-w-0 max-w-[min(90%,560px)] flex-1">
                        {/* Bubble bot — nền #FEFCF7 + viền hairline #F0EAE2 (đo từ mock) */}
                        <div className="rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-6 text-foreground" style={{ background: '#FEFCF7', borderColor: '#F0EAE2' }}>
                          {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : <p className="text-muted-foreground">{t('assistant.typing')}</p>}
                          {m.planning ? <p className="mt-2 text-xs text-muted-foreground">{t('assistant.planningFromData')}</p> : null}
                          {m.options && m.options.options.length && messages[idx + 1]?.role === 'user' ? (
                            <p className="mt-2 text-xs" style={{ color: '#9AA0AC' }}>{t('assistant.selected', { choice: (messages[idx + 1] as { text: string }).text })}</p>
                          ) : null}
                          {renderErrorActions(m)}
                        </div>
                        {m.time ? <span className="mt-0.5 block px-1 text-[10px] text-muted-foreground">{m.time}</span> : null}

                        {m.dto ? <TripReceipt dto={m.dto} onActivate={activateArtifact} onSelectDay={setActiveDay} /> : null}
                        {m.suggestions ? (
                          <SuggestionCards
                            items={m.suggestions}
                            vibe={m.suggestVibe ?? ''}
                            onAdd={(id, name) => onAddAnchor(m.suggestCity ?? '', id, name)}
                            onPlan={() => onPlanVibe(m.suggestCity ?? '')}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline ask-card (mock: "Bạn đi theo nhóm nào?" — pill trong card, chip đầu highlight cam) */}
              {activeAsk ? (
                <div className="mt-3 flex gap-2.5">
                  <span className="h-8 w-8 shrink-0" aria-hidden />
                  <div className="rounded-2xl border border-[#F0EAE2] bg-white p-3.5 shadow-e1">
                    <div className="flex flex-wrap gap-2">
                      {activeAsk.options.map((opt, i) => (
                        <button key={opt} type="button" onClick={() => onChip(activeAsk.slot, opt)} disabled={loading}
                          className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
                            i === 0 ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border border-[#F0EAE2] text-foreground hover:border-primary hover:bg-primary/5'
                          }`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {progressBlock}
            </div>
          )}
        </div>

        {/* BOTTOM INTERACTION ZONE: chips (active) + composer (dùng chung entry + active).
            Entry rộng ~800px khớp khối card; active hẹp hơn (45rem) cho dễ đọc chat. */}
        <div className={`mx-auto w-full shrink-0 px-4 pb-5 pt-3 ${isEntry ? 'max-w-[800px]' : 'max-w-[45rem]'}`}>
          {!isEntry && dto && !activeAsk ? (
            <p className="mb-2 px-1 text-xs leading-relaxed" style={{ color: '#9AA0AC' }}>
              {t.rich('assistant.tip', { b: (chunks) => <b className="font-semibold">{chunks}</b> })}
            </p>
          ) : null}
          {/* Chip hành động sau khi có lịch (ask ĐANG hỏi render inline trong luồng chat, không ở đây) */}
          {!isEntry && dto && !activeAsk ? (
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
              {ACTIONS.map(([label, prompt]) => (
                <button key={label} type="button" onClick={() => send(prompt)} disabled={loading}
                  className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" style={{ borderColor: '#F5A98A' }}>
                  {label}
                </button>
              ))}
              {/* Ẩn tạm: chip "📄 Xuất PDF" — phát triển sau. Bật lại: bỏ comment dòng dưới.
                  (lastHref vẫn dùng cho hrefPdf của PlannerPane → không thành biến thừa.) */}
              {/* <a href={lastHref} className="flex h-[34px] shrink-0 items-center rounded-full border bg-background px-3 text-[13px] font-semibold text-primary hover:bg-primary/10" style={{ borderColor: '#F5A98A' }}>📄 Xuất PDF</a> */}
            </div>
          ) : null}
          {/* Hàng filter chip (mock active) — mở picker slot Sở thích/Ngân sách/Phương tiện/Ăn uống */}
          {!isEntry && !activeAsk ? (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {([[t('assistant.filterInterests'), 'so_thich'], [t('assistant.filterTransport'), 'phuong_tien'], [t('assistant.filterFood'), 'an_uong']] as [string, 'so_thich' | 'phuong_tien' | 'an_uong'][]).map(
                ([label, kind]) => (
                  <button key={kind} type="button" onClick={() => openFilter(kind)} disabled={loading}
                    className="flex items-center gap-1.5 rounded-full border border-[#F0EAE2] bg-white px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-40">
                    {label}
                  </button>
                ),
              )}
            </div>
          ) : null}
          <PlannerComposer value={input} onChange={setInput} onSubmit={() => send(input)} disabled={loading} busy={loading} />
          {isEntry ? (
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <span aria-hidden>🔒</span> {t('assistant.privacy')}
            </p>
          ) : null}
        </div>
      </section>

      {/* SPLITTER dọc — kéo đổi rộng chat ↔ plan (chỉ active + lg). */}
      {!isEntry ? (
        <div role="separator" aria-orientation="vertical" aria-label={t('assistant.splitterAria')}
          onPointerDown={onSplitDown} onPointerMove={onSplitMove} onPointerUp={onSplitUp} onLostPointerCapture={onSplitUp}
          className="group hidden w-2 shrink-0 cursor-col-resize touch-none items-center justify-center lg:flex">
          <span className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>
      ) : null}

      {/* CỘT PHẢI — map + lịch trình (chỉ active, phần còn lại). Ẩn <lg (mở qua overlay/launcher). */}
      {!isEntry ? (
        <section data-map-pane aria-busy={buildingView || undefined} className="hidden lg:flex lg:h-full lg:flex-1 lg:min-w-0 lg:flex-col lg:border-l lg:border-[#E4D8C9]">
          {paneFor('inline')}
        </section>
      ) : null}
      </>)}

      {/* Overlay fullscreen [tabs + map + card] — dùng mọi width (mobile FAB + desktop-short launcher). */}
      {resultFull ? (
        <div className="fixed inset-0 z-overlay-panel flex flex-col bg-background">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="text-sm font-semibold">{t('assistant.itineraryAndMap')}</span>
            <button type="button" onClick={() => setResultFull(false)} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold">
              {t('assistant.backToChat')}
            </button>
          </div>
          <div className="min-h-0 flex-1">{paneFor('overlay')}</div>
        </div>
      ) : null}

      {/* FAB mở overlay kết quả trên mobile (desktop dùng launcher trong pane) */}
      {dto && !resultFull ? (
        <button type="button" onClick={() => setResultFull(true)}
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
          className="fixed z-raised rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg lg:hidden">
          {t('assistant.openMapFab')}
        </button>
      ) : null}
    </main>
  );
}
