/**
 * conv-sim runner — lái UI THẬT của trợ lý du lịch (/tro-ly-du-lich) bằng Playwright cho từng kịch bản
 * trong catalog (trip-planner/scripts/conv-sim/build-scenarios.ts). User-simulator LLM (qua eval-proxy)
 * nói theo stated_plan; chip trả lời theo luật tất định. KHÔNG chạy trong CI (config riêng).
 *
 * Chuẩn bị (3 cửa sổ, từ repo root — server phải có tourism-kb/export):
 *   1. pnpm tsx trip-planner/scripts/conv-sim/eval-proxy.ts --cap 95
 *   2. pnpm tsx trip-planner/scripts/conv-sim/serve.ts   (đúng env eval; --stub = $0; --primary gemini|groq)
 *   3. EVAL_RUN=pilot-1 EVAL_SET=pilot pnpm playwright test -c playwright.eval.config.ts
 * Biến: EVAL_CATALOG (jsonl), EVAL_SET pilot|golden|all|ids:a,b, EVAL_LIMIT, EVAL_DRY=1 ($0, cùng
 * PLANNER_LLM_STUB=true trên server), SIM_PROVIDER claude|groq. Resume: id đã có kết quả ≠ error → bỏ qua.
 * Đầu ra (gitignored): trip-planner/.eval-data/conv-sim/runs/<EVAL_RUN>/{results.jsonl,turn1.jsonl,shots/}.
 * Chỉ lưu TÊN/vai trò điểm trong lịch (không địa chỉ/SĐT/giờ) — KB chứa SĐT doanh nghiệp thật.
 */

import { test, expect, type Page, type Response } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { simTurn } from '../trip-planner/scripts/conv-sim/simClient';
import { chooseChip, perturb } from '../trip-planner/scripts/conv-sim/simLib';
import type { Scenario } from '../trip-planner/scripts/conv-sim/types';

const DATA = 'trip-planner/.eval-data/conv-sim';
const RUN = process.env.EVAL_RUN ?? 'dev';
const RUN_DIR = path.join(DATA, 'runs', RUN);
const RESULTS = path.join(RUN_DIR, 'results.jsonl');
// Dùng chung mọi run/provider → replay. Dry-run ghi riêng để không nhiễm cache thật.
const TURN1 = process.env.EVAL_DRY === '1' ? path.join(RUN_DIR, 'turn1.dry.jsonl') : path.join(DATA, 'turn1.jsonl');
const STOP = path.join(DATA, 'STOP');
const CATALOG = process.env.EVAL_CATALOG ?? newestCatalog();

function newestCatalog(): string {
  const f = fs.existsSync(DATA) ? fs.readdirSync(DATA).filter((x) => x.startsWith('scenarios-v2-') && x.endsWith('.jsonl')).sort() : [];
  if (!f.length) throw new Error('chưa có catalog — chạy build-scenarios.ts');
  return path.join(DATA, f[f.length - 1]);
}
const readJsonl = <T,>(p: string): T[] => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : []);

function selectScenarios(): Scenario[] {
  const all = readJsonl<Scenario>(CATALOG);
  const set = process.env.EVAL_SET ?? 'pilot';
  let list =
    set === 'all' ? all
    : set === 'pilot' ? all.filter((s) => s.pilot)
    : set === 'golden' ? all.filter((s) => Number(s.id.slice(3)) % 6 === 0) // ~203, cố định
    : set.startsWith('ids:') ? all.filter((s) => set.slice(4).split(',').includes(s.id))
    : [];
  const done = new Set(readJsonl<{ id: string; status: string }>(RESULTS).filter((r) => r.status !== 'error' && r.status !== 'stopped').map((r) => r.id));
  list = list.filter((s) => !done.has(s.id));
  const lim = Number(process.env.EVAL_LIMIT ?? '0');
  return lim > 0 ? list.slice(0, lim) : list;
}

fs.mkdirSync(path.join(RUN_DIR, 'shots'), { recursive: true });
const turn1Cache = new Map(readJsonl<{ id: string; text: string; uttered_fields: string[] }>(TURN1).map((r) => [r.id, r]));

// PRNG nhỏ cho perturb (tất định theo id).
const rngFor = (id: string) => { let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); };

interface ChatFrameSummary { provider?: string; model?: string; isFallback?: boolean; slots?: unknown[]; noop: boolean; error?: string; suggestions: number; ttfbMs: number | null; ms: number | null }
function summarizeSse(body: string, res: Response): ChatFrameSummary {
  const out: ChatFrameSummary = { noop: false, suggestions: 0, slots: [], ttfbMs: null, ms: null };
  for (const block of body.split('\n\n')) {
    const ev = block.match(/^event: (\S+)/m)?.[1];
    const data = block.match(/^data: (.*)$/m)?.[1];
    if (!ev) continue;
    let d: Record<string, unknown> = {};
    try { d = data ? JSON.parse(data) : {}; } catch { /* bỏ */ }
    if (ev === 'provider') { out.provider = String(d.id ?? ''); out.model = String(d.model ?? ''); out.isFallback = !!d.isFallback; }
    if (ev === 'slots') out.slots!.push(d.partial ?? d);
    if (ev === 'noop') out.noop = true;
    if (ev === 'error') out.error = String(d.message ?? 'error');
    if (ev === 'suggestions') out.suggestions = Array.isArray(d.items) ? d.items.length : 1;
  }
  const t = res.request().timing();
  out.ttfbMs = t.responseStart >= 0 ? Math.round(t.responseStart) : null;
  out.ms = t.responseEnd >= 0 ? Math.round(t.responseEnd) : null;
  return out;
}

const input = (p: Page) => p.locator('[data-testid="planner-input"]:visible');
const sendBtn = (p: Page) => p.locator('[data-testid="planner-send"]:visible');

async function send(page: Page, text: string): Promise<boolean> {
  try {
    await expect(async () => {
      await input(page).fill(text);
      await expect(sendBtn(page)).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
  } catch { return false; } // vd tin rỗng → nút gửi khoá (hành vi đúng)
  // Enter trên ô nhập (form submit) — click nút gửi bị che khi thẻ hỏi chip đang mở.
  await input(page).first().press('Enter');
  return true;
}
// Lượt xong = không còn request /api/planner/* đang bay VÀ yên ≥1.2s (chat SSE xong rồi itinerary có thể
// nổ tiếp). KHÔNG dùng networkidle: dev server giữ kết nối HMR → không bao giờ idle.
const PLANNER_API = /\/api\/planner\/(chat|itinerary)/;
function trackPlannerNet(page: Page) {
  // Theo dõi theo ĐỐI TƯỢNG request (Set) — xoá khi finished/failed; SSE được xoá khi body đọc xong
  // (handler response). Đếm số nguyên từng kẹt >0 khi Chromium không phát requestfinished cho stream bị huỷ.
  const st = { open: new Set<object>(), last: Date.now(), get inflight() { return this.open.size; } };
  page.on('request', (r) => { if (PLANNER_API.test(r.url())) { st.open.add(r); st.last = Date.now(); } });
  const done = (r: object) => { if (st.open.delete(r)) st.last = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return { st, done };
}
async function settle(page: Page, st: { inflight: number; last: number }) {
  // inflight>0 mà 20s không có hoạt động (stream treo/không bao giờ đóng) → coi như xong. Hoạt động = sự kiện
  // mạng HOẶC bong bóng bot đang lớn (token SSE không phát sự kiện Playwright nào) — lượt LLM chậm >20s
  // (retry 529…) vẫn được chờ trọn.
  const start = Date.now();
  let lastLen = -1;
  await page.waitForTimeout(800);
  while (Date.now() - start < 90_000) {
    const len = await page.evaluate(() => {
      const b = document.querySelectorAll('[data-testid="planner-bot"], [data-testid="planner-error"]');
      return b.length ? (b[b.length - 1] as HTMLElement).innerText.length + b.length * 100000 : 0;
    }).catch(() => lastLen);
    if (len !== lastLen) { lastLen = len; st.last = Date.now(); }
    if (st.inflight === 0 && Date.now() - st.last > 1200) break;
    if (Date.now() - st.last > 20_000) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(200);
}

test.describe.configure({ mode: 'parallel' });

for (const sc of selectScenarios()) {
  test(sc.id, async ({ page }) => {
    test.skip(fs.existsSync(STOP), 'eval cap / STOP');
    const t0 = Date.now();
    const rnd = rngFor(sc.id);
    const turns: Record<string, unknown>[] = [];
    const transcript: { role: 'user' | 'bot'; text: string }[] = [];
    const consoleErrors: string[] = [];
    let chatFrames: ChatFrameSummary[] = [];
    let itinerary: { slug: string; tripDays: number; days: { day: number; items: { name: string; role: string; category: string | null }[] }[] } | null = null;
    let itineraryParams: string | null = null;
    let itineraryAtMs: number | null = null;
    let builds = 0;

    const { st: net, done: netDone } = trackPlannerNet(page);
    // Bỏ nhiễu đã biết: khách chưa đăng nhập → /api/auth/refresh 401.
    page.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
    page.on('response', async (res) => {
      const u = res.url();
      try {
        if (u.includes('/api/planner/chat')) {
          // 429 = server KHÔNG chạy PLANNER_EVAL_MODE (vd `vercel env pull` ghi VERCEL=1) → dừng cả run.
          if (res.status() === 429) fs.writeFileSync(STOP, 'chat 429: server chưa bật PLANNER_EVAL_MODE\n');
          try { chatFrames.push(summarizeSse(await res.text(), res)); } finally { netDone(res.request()); }
        }
        else if (u.includes('/api/planner/itinerary') && res.ok()) {
          let j;
          try { j = await res.json(); } finally { netDone(res.request()); }
          builds++;
          itineraryAtMs = Date.now() - t0;
          itineraryParams = new URL(u).searchParams.toString();
          itinerary = {
            slug: j.dto.slug, tripDays: j.dto.tripDays,
            days: (j.dto.days ?? []).map((d: { day: number; items: { name: string; role: string; category: string | null }[] }) => ({
              day: d.day, items: d.items.map((it) => ({ name: it.name, role: it.role, category: it.category })),
            })),
          };
        }
      } catch { /* body không đọc được (abort) */ }
    });

    // IP giả riêng mỗi kịch bản (chỉ local: clientIp đọc x-real-ip; trên Vercel header này do edge ghi đè) —
    // tránh limiter chung 60 POST/phút/IP của proxy.ts khi 4 worker chạy song song từ 127.0.0.1.
    const n = Number(sc.id.slice(3));
    await page.context().setExtraHTTPHeaders({ 'x-real-ip': `10.77.${(n >> 8) & 255}.${n & 255}` });
    // EVAL_PERF=1: thu số đo kiểu web-vitals ngay trong trang (PerformanceObserver) — INP xấp xỉ = event
    // duration lớn nhất, CLS = tổng layout-shift không do input, long task (>50ms) khi stream token/dựng lịch.
    if (process.env.EVAL_PERF === '1') await page.addInitScript(() => {
      const w = window as unknown as { __perf: { inp: number; cls: number; longN: number; longMs: number; longMax: number } };
      w.__perf = { inp: 0, cls: 0, longN: 0, longMs: 0, longMax: 0 };
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__perf.inp = Math.max(w.__perf.inp, e.duration); })
          .observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
        new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__perf.cls += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) { w.__perf.longN++; w.__perf.longMs += e.duration; w.__perf.longMax = Math.max(w.__perf.longMax, e.duration); } })
          .observe({ type: 'longtask', buffered: true });
      } catch { /* trình duyệt không hỗ trợ entry type */ }
    });
    await page.goto(sc.locale === 'en' ? '/en/tro-ly-du-lich' : '/tro-ly-du-lich');
    await expect(input(page)).toBeVisible({ timeout: 30_000 });

    const uttered = new Set<string>();
    const chipAnswered = new Set<string>();
    const chipSeen: string[] = [];
    let status = 'max_turns';
    let errors = 0;
    let revDone = false;
    let lastBotCount = 0;
    let fieldCursor = 0;

    try {
    for (let turn = 1; turn <= sc.max_turns; turn++) {
      if (fs.existsSync(STOP)) { status = 'stopped'; break; }
      const builtBefore = builds;
      // Chip đang hiện?
      const chips = page.locator('[data-testid="planner-chip"]:visible:not([disabled])');
      const chipCount = turn === 1 ? 0 : await chips.count();
      let action: Record<string, unknown> = {};
      const tSend = Date.now();

      if (chipCount > 0) {
        const slot = (await chips.first().getAttribute('data-slot')) ?? '';
        const options = await chips.allInnerTexts();
        chipSeen.push(slot);
        if (chipSeen.length >= 3 && chipSeen.slice(-3).every((s) => s === slot) && chipAnswered.has(slot)) { status = 'loop'; break; }
        let label = sc.edge === 'go-nhan-chip-khong-ton-tai' && !chipAnswered.size ? null : chooseChip(sc, slot, options.map((o) => o.trim()), chipAnswered);
        // Gõ text 2 lần mà thẻ hỏi vẫn còn → bấm chip gần nhất (hoặc "Bỏ qua"/chip đầu), ghi forced.
        const textTries = turns.filter((t) => t.kind === 'text' && t.for_slot === slot).length;
        let forced = false;
        if (!label && textTries >= 2) { label = options.map((o) => o.trim()).find((o) => o === 'Bỏ qua') ?? options[0].trim(); forced = true; }
        const stepVia = sc.stated_plan.find((s) => fieldOfSlot(slot) === s.field)?.via;
        if (label && (forced || stepVia === 'chip' || sc.style === 'chips-only' || !stepVia)) {
          await chips.filter({ hasText: label }).first().click();
          chipAnswered.add(slot);
          action = { kind: 'chip', slot, label, forced: forced || undefined };
          transcript.push({ role: 'user', text: `[chip] ${label}` });
        } else {
          label = null;
          const text = sc.edge === 'go-nhan-chip-khong-ton-tai' && !chipAnswered.size ? 'Đi phượt' : null;
          const reply = text ? { text, uttered_fields: [], uttered_hooks: [], give_up: false } : await simTurn({ sc, turn, fields: [fieldOfSlot(slot)], transcript });
          if (text) chipAnswered.add(slot);
          if (reply.give_up) { status = 'give_up'; break; }
          reply.uttered_fields.forEach((f) => uttered.add(f));
          const out = perturb(reply.text, sc.perturb, rnd);
          await send(page, out);
          action = { kind: 'text', text: out, for_slot: slot, uttered: reply.uttered_fields };
          transcript.push({ role: 'user', text: out });
        }
      } else {
        // Lượt text: turn-1 frozen (replay mọi provider) hoặc sim theo stated_plan.
        const built = builds > 0;
        const revising = built && !!sc.revision && !revDone;
        let fields = sc.stated_plan.filter((s) => s.turn === turn && s.via === 'text').map((s) => s.field);
        if (!fields.length && !built) { const next = sc.stated_plan.filter((s) => !uttered.has(s.field) && ![...chipAnswered].some((slot) => fieldOfSlot(slot) === s.field))[fieldCursor]; if (next) fields = [next.field]; }
        let reply;
        if (turn === 1 && turn1Cache.has(sc.id)) {
          const c = turn1Cache.get(sc.id)!; reply = { text: c.text, uttered_fields: c.uttered_fields, uttered_hooks: [], give_up: false };
        } else {
          reply = await simTurn({ sc, turn, fields, transcript, revision: revising });
          if (turn === 1) { fs.appendFileSync(TURN1, JSON.stringify({ id: sc.id, text: reply.text, uttered_fields: reply.uttered_fields }) + '\n'); }
        }
        if (reply.give_up) { status = 'give_up'; break; }
        reply.uttered_fields.forEach((f) => uttered.add(f));
        let out = perturb(reply.text, sc.perturb, rnd);
        if (sc.edge === 'tin-rong' && turn === 1) out = '   ';
        if (sc.edge === 'tin-dai-hon-2000' && turn === 1) out = (out + ' ').repeat(Math.ceil(2100 / (out.length + 1))).slice(0, 2100);
        const ok = await send(page, out);
        if (!ok && sc.edge === 'tin-rong') { action = { kind: 'empty-blocked' }; status = 'edge_ok'; turns.push({ turn, ...action }); break; }
        if (!ok) { turns.push({ turn, kind: 'send_failed', text: out.slice(0, 200) }); status = 'send_failed'; break; }
        if (revising) revDone = true;
        action = { kind: 'text', text: out.slice(0, 500), uttered: reply.uttered_fields, revision: revising || undefined };
        transcript.push({ role: 'user', text: out.slice(0, 500) });
        if (!fields.length) fieldCursor++;
      }

      await settle(page, net);
      const bots = page.locator('[data-testid="planner-bot"], [data-testid="planner-error"]');
      const n = await bots.count();
      const newBot = n > lastBotCount ? ((await bots.nth(n - 1).innerText({ timeout: 5000 }).catch(() => '')) || '').slice(0, 600) : '';
      lastBotCount = n;
      if (newBot) transcript.push({ role: 'bot', text: newBot });
      const errNow = await page.locator('[data-testid="planner-error"]:visible').count();
      const frames = chatFrames; chatFrames = [];
      turns.push({ turn, ...action, ms: Date.now() - tSend, bot: newBot, frames, built: builds > builtBefore, error: errNow > 0 || undefined });

      if (frames.some((f) => f.error) || errNow) { errors++; if (errors >= 2) { status = 'error_ui'; break; } }
      if (frames.some((f) => f.error?.includes('eval_cap'))) { status = 'stopped'; break; }
      if (builds > 0 && (!sc.revision || revDone) && builds > builtBefore) { status = 'itinerary'; break; }
    }

    } catch (e) {
      status = String(e).includes('EVAL_CAP_REACHED') ? 'stopped' : 'error';
      turns.push({ harness_error: String(e).slice(0, 300) });
    }
    const perf = process.env.EVAL_PERF === '1' ? await page.evaluate(() => (window as unknown as { __perf?: unknown }).__perf ?? null).catch(() => null) : undefined;
    if (status !== 'itinerary' && status !== 'edge_ok') await page.screenshot({ path: path.join(RUN_DIR, 'shots', `${sc.id}.png`) }).catch(() => {});
    fs.appendFileSync(RESULTS, JSON.stringify({
      id: sc.id, run: RUN, started_at: new Date(t0).toISOString(), ended_at: new Date().toISOString(), status, turns_count: turns.length, ms: Date.now() - t0, itinerary_ms: itineraryAtMs,
      uttered: [...uttered], uttered_text: [...uttered], chip_answered: [...chipAnswered], builds, final_params: itineraryParams, itinerary,
      perf, device: process.env.EVAL_DEVICE ?? 'desktop', console_errors: consoleErrors.length, console_samples: consoleErrors.slice(0, 3), turns,
    }) + '\n');
  });
}

function fieldOfSlot(slot: string): string {
  return ({ dia_diem: 'dia_diem', thoi_luong: 'days', nhom: 'party', so_nguoi: 'party', so_thich: 'interests' } as Record<string, string>)[slot] ?? slot;
}
