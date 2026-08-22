/**
 * crawl_diem_den_web.mts — đọc WEBSITE CHÍNH THỨC của ĐIỂM ĐẾN, lấy giờ mở cửa + giá vé.
 *
 * KHÔNG scrape Google/AI-Overview (ToS+robots+doctrine). CHỈ web chính thức của chính điểm đó.
 * Mirror tour_sites_crawl.mts. 4 luật: (1) verify trang đúng điểm đến trước khi lấy;
 * (2) giá → gia_tham_khao, giữ MỌI giá trị xung đột; (3) tôn trọng robots, 1 request/lúc, có nghỉ,
 * không login; (4) hàm trích là CHUỖI (bẫy esbuild __name).
 *
 * Chạy:  pnpm tsx tourism-kb/code/crawl_diem_den_web.mts tourism-kb/raw/<slug>/scrape [LIMIT]
 * Đọc   guide_data.json (picked[].web)   Ghi  dd_web.json + pages/dd-web-<id>-<n>.txt (bằng chứng)
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = process.argv[2];
if (!RAW) { console.error('thieu tham so: duong dan thu muc raw'); process.exit(1); }
const LIMIT = process.argv[3] ? parseInt(process.argv[3], 10) : 0;   // 0 = het; >0 = pilot N site dau
const PAGES_DIR = join(RAW, 'pages');
const OUT = join(RAW, 'dd_web.json');

const DELAY_MS = 3500;
const NAV_TIMEOUT = 40_000;
const MAX_SUB = 2;
const NOT_A_SITE = /(zalo\.me|facebook\.com|youtube\.com|r\.grab\.com|instagram\.com|tiktok\.com|m\.me|booking\.com|agoda|tripadvisor)/i;

const fold = (s: string) =>
  (s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Trích trong trình duyệt (CHUỖI). Giờ mở = KHOẢNG "7:00-17:00"/"7h-17h30"; giá vé = "50.000đ".
const EXTRACT_SRC = `(() => {
  const t = (document.body && document.body.innerText) || '';
  const low = t.toLowerCase();
  // Bắt GIÁ TRỊ nằm GẦN từ khóa (giảm nhiễu): quét vị trí từ khóa, lấy pattern trong ~130 ký tự sau.
  const near = (kw, val) => { const out=[]; let m; const r=new RegExp(kw,'gi');
    while((m=r.exec(t))!==null){ const w=t.slice(m.index, m.index+130); const v=w.match(val); if(v) out.push(v[0].trim().replace(/\\s+/g,' ')); if(out.length>6) break; }
    return Array.from(new Set(out)); };
  const GIO = /(?:[01]?\\d|2[0-3])\\s*[:hg]\\s*[0-5]?\\d?\\s*[-–—]\\s*(?:[01]?\\d|2[0-3])\\s*[:hg]\\s*[0-5]?\\d?/;
  const GIA = /\\d{1,3}(?:[.,]\\d{3}){1,3}\\s*(?:đ|vnđ|vnd|₫|đồng)/i;
  return {
    tieuDe: document.title || null,
    gio: near('giờ mở cửa|mở cửa|giờ hoạt động|giờ mở|thời gian mở|opening hours?|open daily', GIO),
    gia: near('giá vé|vé vào|vé tham quan|phí tham quan|phí vào|giá tham quan|entrance fee|ticket', GIA),
    hasGio: /(giờ mở|mở cửa|giờ hoạt động|opening hour|open daily|thời gian mở)/i.test(low),
    hasVe: /(giá vé|vé vào|vé tham quan|phí tham quan|phí vào|entrance|ticket)/i.test(low),
    van_ban: t.replace(/\\n{3,}/g, '\\n\\n').slice(0, 6000)
  };
})()`;

interface Ext { tieuDe: string | null; gio: string[]; gia: string[]; hasGio: boolean; hasVe: boolean; van_ban: string; }
interface Row { id: string; ten: string; url: string; xac_minh: boolean; ly_do: string | null;
  tieu_de: string | null; gio: string[]; gia: string[]; hasGio: boolean; hasVe: boolean; so_trang: number; loi: string | null; }

async function grab(page: Page, url: string): Promise<Ext> {
  await page.goto(url, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  return (await page.evaluate(EXTRACT_SRC)) as Ext;
}

async function main() {
  mkdirSync(PAGES_DIR, { recursive: true });
  const picked: { id: string; name: string; web?: string | null }[] = JSON.parse(readFileSync(join(RAW, 'guide_data.json'), 'utf-8')).picked;
  let targets = picked.filter((p) => p.web && /^https?:\/\//i.test(p.web) && !NOT_A_SITE.test(p.web));
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);
  console.log(`${targets.length} điểm đến có website (LIMIT=${LIMIT || 'hết'})\n`);

  const browser: Browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'vi-VN' });
  const page: Page = await ctx.newPage();
  const rows: Row[] = [];

  for (const [i, p] of targets.entries()) {
    const row: Row = { id: p.id, ten: p.name, url: p.web!, xac_minh: false, ly_do: null,
      tieu_de: null, gio: [], gia: [], hasGio: false, hasVe: false, so_trang: 0, loi: null };
    try {
      const d = await grab(page, p.web!);
      row.tieu_de = d.tieuDe; row.so_trang = 1;
      row.gio = d.gio; row.gia = d.gia; row.hasGio = d.hasGio; row.hasVe = d.hasVe;
      writeFileSync(join(PAGES_DIR, `dd-web-${p.id}-1.txt`), d.van_ban, 'utf-8');

      // XÁC MINH: tên miền chứa từ trong tên điểm, HOẶC ≥2 từ tên điểm xuất hiện trong nội dung
      const host = fold(new URL(page.url()).hostname.replace(/^www\./, ''));
      const tokens = p.name.split(/[\s\-–|,]+/).map(fold).filter((x) => x.length >= 4);
      const hostHit = tokens.some((tk) => host.includes(tk));
      const textHit = tokens.filter((tk) => fold(d.van_ban).includes(tk)).length >= 2;
      row.xac_minh = hostHit || textHit;
      row.ly_do = hostHit ? 'tên miền khớp' : textHit ? 'tên trong nội dung' : null;

      // trang con: link có chữ giờ/vé/giá
      const links = (await page.evaluate(`(() => Array.from(document.querySelectorAll('a[href]'))
        .map(a=>a.href).filter(h=>/gio|ve\\b|gia-?ve|ticket|hour|open|tham-?quan|bang-?gia/i.test(h))
        .filter(h=>h.startsWith(location.origin)).slice(0,8))()`)) as string[];
      for (const href of Array.from(new Set(links)).slice(0, MAX_SUB)) {
        try {
          await page.waitForTimeout(1400);
          const s = await grab(page, href);
          row.so_trang += 1;
          row.gio = Array.from(new Set([...row.gio, ...s.gio]));
          row.gia = Array.from(new Set([...row.gia, ...s.gia]));
          row.hasGio = row.hasGio || s.hasGio; row.hasVe = row.hasVe || s.hasVe;
          writeFileSync(join(PAGES_DIR, `dd-web-${p.id}-${row.so_trang}.txt`), s.van_ban, 'utf-8');
        } catch { /* trang con hỏng không làm hỏng cả site */ }
      }
    } catch (e) {
      row.loi = `${(e as Error).name}: ${(e as Error).message.split('\n')[0].slice(0, 70)}`;
    }
    rows.push(row);
    const mk = row.loi ? 'LOI' : row.xac_minh ? 'OK ' : '⛔ ';
    console.log(`[${String(i + 1).padStart(2)}/${targets.length}] ${mk} ${row.id} ${row.ten.slice(0, 26).padEnd(28)}`
      + `tr=${row.so_trang} giờ=${row.gio.length}${row.hasGio ? '*' : ''} giá=${row.gia.length}${row.hasVe ? '*' : ''}${row.loi ? ' ' + row.loi : ''}`);
    if (i < targets.length - 1) await page.waitForTimeout(DELAY_MS);
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify(rows, null, 1), 'utf-8');
  console.log(`\nsaved -> ${OUT}  (${rows.length} site, ${rows.filter((r) => r.xac_minh).length} xác minh)`);
}
main();
