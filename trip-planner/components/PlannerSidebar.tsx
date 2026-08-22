'use client';

/**
 * PlannerSidebar — cột trái trợ lý (redesign v4). Hai trạng thái:
 *  - CHƯA có lịch sử → brand-intro (mock 1): Xin chào + năng lực + promo đặt vé.
 *  - CÓ lịch sử      → history list nhóm theo ngày (mock 2) + upsell (guest) + xoá lịch sử.
 * Nguồn dữ liệu do page truyền vào (conversationsClient: authed→API, guest→localStorage) — sidebar
 * không phân biệt nguồn. Collapse (chevron) + drawer mobile. Timestamp theo TZ Asia/Ho_Chi_Minh.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { AuthStatus } from '@/lib/auth/clientSession';
import { PlannerImage } from '@/trip-planner/components/PlannerImage';
import type { ConversationMeta } from '@/trip-planner/lib/planner/conversationsClient';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
const vnDayIdx = (ms: number) => Math.floor((ms + VN_OFFSET_MS) / DAY_MS);
const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, hour: '2-digit', minute: '2-digit' }).format(ms);
const fmtDate = (ms: number) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit' }).format(ms);

type Stamped = ConversationMeta & { stamp: string };
type Group = { key: string; items: Stamped[] };

/** Nhóm hội thoại theo ngày VN: Hôm nay / Hôm qua / 7 ngày trước / Cũ hơn (nhãn do catalog dịch). */
function groupByDate(list: ConversationMeta[], nowMs: number): Group[] {
  const today = vnDayIdx(nowMs);
  const buckets: Record<string, Stamped[]> = { today: [], yest: [], week: [], older: [] };
  for (const c of [...list].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const diff = today - vnDayIdx(c.updatedAt);
    const key = diff <= 0 ? 'today' : diff === 1 ? 'yest' : diff <= 7 ? 'week' : 'older';
    const stamp = diff <= 1 ? fmtTime(c.updatedAt) : fmtDate(c.updatedAt);
    buckets[key].push({ ...c, stamp });
  }
  return [
    { key: 'today', items: buckets.today },
    { key: 'yesterday', items: buckets.yest },
    { key: 'week', items: buckets.week },
    { key: 'older', items: buckets.older },
  ].filter((g) => g.items.length);
}

// Icon cho từng năng lực; nhãn do catalog dịch (sidebar.capability1..5).
const CAPABILITY_ICONS = ['📍', '🗓️', '🚌', '🍜', '⏱️'];

type Props = {
  authStatus: AuthStatus;
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function PlannerSidebar(props: Props) {
  const { authStatus, conversations, activeId, onNew, onOpen, onRename, onDelete, onClearAll, collapsed, onToggleCollapse } =
    props;
  const t = useTranslations('planner');
  const [menuId, setMenuId] = useState<string | null>(null);
  const hasHistory = conversations.length > 0;

  if (collapsed) {
    return (
      <div className="hidden shrink-0 flex-col items-center gap-3 border-r border-[#E4D8C9] bg-[#FDFAF7] px-2 py-4 lg:flex">
        <button type="button" onClick={onToggleCollapse} aria-label={t('sidebar.openHistory')}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-primary/5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" onClick={onNew} aria-label={t('sidebar.newConversationShort')}
          className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary hover:bg-primary/15">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-r border-[#E4D8C9] bg-[#FDFAF7]">
      {hasHistory ? (
        <HistoryView
          {...{ authStatus, conversations, activeId, onNew, onOpen, onRename, onDelete, onClearAll, onToggleCollapse, menuId, setMenuId }}
        />
      ) : (
        <BrandIntro />
      )}
    </div>
  );
}

// ── Trạng thái CÓ lịch sử (mock 2) ──────────────────────────────────────────
function HistoryView(props: {
  authStatus: AuthStatus;
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onToggleCollapse: () => void;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
}) {
  const { authStatus, conversations, activeId, onNew, onOpen, onRename, onDelete, onClearAll, onToggleCollapse, menuId, setMenuId } =
    props;
  const t = useTranslations('planner');
  // now qua useState lazy-init (1 lần) — tránh gọi Date.now() trong thân render (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const groups = groupByDate(conversations, now);

  function handleRename(id: string, current: string) {
    setMenuId(null);
    const next = typeof window !== 'undefined' ? window.prompt(t('sidebar.renamePrompt'), current) : null;
    if (next && next.trim() && next.trim() !== current) onRename(id, next.trim());
  }
  function handleDelete(id: string) {
    setMenuId(null);
    if (typeof window !== 'undefined' && window.confirm(t('sidebar.deleteConfirm'))) onDelete(id);
  }
  function handleClearAll() {
    if (typeof window !== 'undefined' && window.confirm(t('sidebar.clearAllConfirm'))) onClearAll();
  }

  return (
    <div className="flex min-h-full flex-col p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>🕐</span> {t('sidebar.historyTitle')}
        </span>
        <button type="button" onClick={onToggleCollapse} aria-label={t('sidebar.collapse')}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-primary/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <button type="button" onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        {t('sidebar.newConversation')}
      </button>

      <div className="mt-3 flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`sidebar.group.${g.key}`)}</p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((c) => (
                <li key={c.id} className="relative">
                  <button type="button" onClick={() => onOpen(c.id)}
                    className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-primary/5 ${activeId === c.id ? 'bg-primary/10' : ''}`}>
                    <span className="shrink-0 text-muted-foreground" aria-hidden>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" stroke="currentColor" strokeWidth="1.7" /></svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{c.stamp}</span>
                    <span onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                      role="button" tabIndex={0} aria-label={t('sidebar.options')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); } }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 hover:bg-primary/10 group-hover:opacity-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                    </span>
                  </button>
                  {menuId === c.id ? (
                    <div className="absolute right-2 top-9 z-popover w-32 overflow-hidden rounded-lg border border-border bg-popover shadow-e3">
                      <button type="button" onClick={() => handleRename(c.id, c.title)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/5">{t('sidebar.rename')}</button>
                      <button type="button" onClick={() => handleDelete(c.id)}
                        className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5">{t('sidebar.delete')}</button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {authStatus === 'guest' ? (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><span aria-hidden>⭐</span> {t('sidebar.upsellTitle')}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {t('sidebar.upsellDesc')}
          </p>
          <Link href="/auth/login" className="mt-3 inline-flex rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {t('sidebar.upsellCta')}
          </Link>
        </div>
      ) : null}

      <button type="button" onClick={handleClearAll}
        className="mt-4 flex items-center gap-2 px-1 py-2 text-xs font-medium text-muted-foreground hover:text-destructive">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {t('sidebar.clearAll')}
      </button>
    </div>
  );
}

// ── Trạng thái CHƯA có lịch sử (mock 1) ─────────────────────────────────────
function BrandIntro() {
  const t = useTranslations('planner');
  return (
    <div className="flex flex-col gap-5 p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
        <span aria-hidden>🧭</span> {t('sidebar.brandEyebrow')}
      </p>
      <h2 className="text-2xl font-bold leading-tight">
        {t('sidebar.brandGreeting')}<br />{t('sidebar.brandIntro')} <span aria-hidden>👋</span>
      </h2>

      <div className="flex items-start gap-3 rounded-2xl border border-[#F0E9E1] bg-white p-3.5 shadow-e1">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-lg" aria-hidden>🤖</span>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t('sidebar.brandBubble')}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold">{t('sidebar.capabilitiesTitle')}</p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {CAPABILITY_ICONS.map((icon, i) => (
            <li key={icon} className="flex items-center gap-2.5 text-[13px]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-xs" aria-hidden>{icon}</span>
              <span className="text-muted-foreground">{t(`sidebar.capability${i + 1}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#F0E9E1] shadow-e1">
        <PlannerImage src="/destinations/sai-gon.jpg" alt={t('sidebar.promoAlt')} fallbackEmoji="🚌" className="aspect-[3/2] w-full" />
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/55 to-transparent p-4">
          <p className="max-w-[75%] text-sm font-bold leading-snug text-white">{t('sidebar.promoTitle')}</p>
          {/* Mock: pill nền trắng mờ + chữ cam (KHÔNG phải nút cam đặc) */}
          <Link href="/" className="inline-flex w-fit rounded-lg bg-white/90 px-3.5 py-2 text-sm font-bold text-[#EA580C] shadow-sm hover:bg-white">
            {t('sidebar.promoCta')}
          </Link>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t('sidebar.brandFooter')}
      </p>
    </div>
  );
}
