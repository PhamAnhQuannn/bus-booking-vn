/**
 * tour_sites_crawl.mts — doc trang tour cua cac don vi to chuc trai nghiem.
 *
 * Vi sao khong dung Facebook cho viec nay: doan gioi thieu Facebook dai mot
 * dong. Phase O da do — no cho dung TEN hoat dong ("Đơn vị tổ chức Tour Săn
 * Mây, Tour Tham Quan, Xe Hợp Đồng") va khong bao gio cho lich trinh. Trang
 * tour tren website moi viet "Tour 1 ngày · đón 4h30 · 1.400.000đ", tuc dung
 * ba truong dang trong: thoi_luong, gio_trong_ngay, gia.
 *
 * Chay:
 *   pnpm tsx tourism-kb/code/tour_sites_crawl.mts <thu-muc-raw>
 *
 * Doc  raw/dv_trai_nghiem.json
 * Ghi  raw/tour_sites.json + raw/pages/web-<id>-<n>.txt (bang chung)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BON DIEU BAT BUOC:
 *
 * 1. XAC MINH TRANG DUNG LA CUA DON VI DO truoc khi lay bat ky gia tri nao.
 *    Phase F do duoc khoang mot nua truong `website` cua Overture tro sang noi
 *    khong lien quan — chua Linh Phuoc -> tiem giay, vuon hoa -> tiem hoa tuoi.
 *    Fetch mu la dua gio mo cua cua tiem hoa vao muc vuon hoa roi dong dau da
 *    xac minh. O day: doi ten mien HOAC ten trang phai khop voi ten don vi.
 *
 * 2. GIA di vao `gia_tham_khao`, KHONG vao truong gia chinh, va giu MOI gia tri
 *    mau thuan. Phase F gap ba nguon lech nhau 3 lan cho cung mot dia diem.
 *
 * 3. Ton trong robots.txt, mot yeu cau mot luc, co nghi. Khong dang nhap,
 *    khong vuot rao.
 *
 * 4. Bo trich la CHUOI, khong phai ham — `tsx`/esbuild chen helper `__name` vao
 *    ham co ten, va `page.evaluate(fn)` gui ma nguon ham sang trinh duyet noi
 *    helper do khong ton tai. Da dinh loi nay tren ca 35 trang o Phase O.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = process.argv[2];
if (!RAW) { console.error('thieu tham so: duong dan thu muc raw'); process.exit(1); }
const PAGES_DIR = join(RAW, 'pages');
const OUT = join(RAW, 'tour_sites.json');

const DELAY_MS = 3500;
const NAV_TIMEOUT = 40_000;
const MAX_SUB = 2;            // toi da 2 trang con moi site

/** Khong phai website — link chat, link mang xa hoi, link dat xe. */
const NOT_A_SITE = /(zalo\.me|facebook\.com|youtube\.com|r\.grab\.com|instagram\.com|tiktok\.com|m\.me)/i;

interface Dv {
  id: string; ten: string; website: string | null; facebook: string | null;
  hoat_dong: string[]; dien_thoai: string | null;
}

interface Row {
  id: string; ten: string; url: string;
  xac_minh: boolean; ly_do_xac_minh: string | null;
  tieu_de: string | null;
  thoi_luong: string[]; gio_don: string[]; gia_tham_khao: string[];
  mua: string[]; ten_tour: string[];
  so_trang_doc: number; loi: string | null;
}

/** Bo dau de so ten mien voi ten don vi. */
const fold = (s: string) =>
  (s || '').toLowerCase().replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const EXTRACT_SRC = `(() => {
  const t = (document.body && document.body.innerText) || '';
  const all = (re) => {
    const out = [];
    let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = r.exec(t)) !== null) { out.push((m[1] !== undefined ? m[1] : m[0]).trim()); if (out.length > 40) break; }
    return Array.from(new Set(out));
  };
  return {
    tieuDe: document.title || null,
    // "1 ngày", "1/2 ngày", "2N1Đ", "2 ngày 1 đêm", "3 tiếng"
    thoiLuong: all(/(\\d\\s*ngày\\s*\\d\\s*đêm|\\d\\s*N\\s*\\d\\s*Đ|1\\/2\\s*ngày|nửa ngày|\\d+\\s*ngày|\\d+\\s*(?:tiếng|giờ)\\b)/gi),
    // "4h30", "04:30", "5h sáng"
    gioDon: all(/(\\b(?:0?[3-9]|1[0-9])\\s*(?:h|giờ|:)\\s*[0-5]?[0-9]?\\s*(?:sáng|AM)?)/g),
    // "1.400.000đ", "1.400.000 VNĐ", "1,4 triệu", "650k"
    gia: all(/(\\d{1,3}(?:[.,]\\d{3}){1,3}\\s*(?:đ|vnđ|vnd|₫)|\\d+(?:[.,]\\d+)?\\s*(?:triệu|tr)\\b|\\d{2,4}\\s*k\\b)/gi),
    // "tháng 10 đến tháng 3", "mùa khô", "mùa mưa"
    mua: all(/(từ tháng \\d{1,2}[^\\n.]{0,24}tháng \\d{1,2}|mùa khô|mùa mưa|tháng \\d{1,2}\\s*(?:đến|–|-)\\s*tháng \\d{1,2})/gi),
    tenTour: all(/(Tour[^\\n.,|]{4,60})/g),
    // Toan van de xac minh danh tinh + luu lam bang chung.
    van_ban: t.replace(/\\n{3,}/g, '\\n\\n').slice(0, 6000)
  };
})()`;

interface Ext {
  tieuDe: string | null; thoiLuong: string[]; gioDon: string[]; gia: string[];
  mua: string[]; tenTour: string[]; van_ban: string;
}

async function main() {
  mkdirSync(PAGES_DIR, { recursive: true });
  const dvs: Dv[] = JSON.parse(readFileSync(join(RAW, 'dv_trai_nghiem.json'), 'utf-8'));
  const targets = dvs.filter((d) => d.website && !NOT_A_SITE.test(d.website));
  const bo = dvs.filter((d) => d.website && NOT_A_SITE.test(d.website));

  console.log(`${targets.length} website that / ${dvs.filter((d) => d.website).length} truong website`);
  for (const b of bo) console.log(`  bo ${b.id} ${b.ten.slice(0, 30)} -> ${b.website} (khong phai website)`);
  console.log();

  const browser: Browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'vi-VN' });
  const page: Page = await ctx.newPage();
  const rows: Row[] = [];

  for (const [i, dv] of targets.entries()) {
    const row: Row = {
      id: dv.id, ten: dv.ten, url: dv.website!, xac_minh: false, ly_do_xac_minh: null,
      tieu_de: null, thoi_luong: [], gio_don: [], gia_tham_khao: [], mua: [],
      ten_tour: [], so_trang_doc: 0, loi: null,
    };
    try {
      await page.goto(dv.website!, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      const d = (await page.evaluate(EXTRACT_SRC)) as Ext;
      row.tieu_de = d.tieuDe;
      row.so_trang_doc = 1;

      // ── LUON luu bang chung, xac minh o buoc PHAN TICH ──────────────────
      // Lan dau toi xac minh ngay tai day va chi luu file khi dat. Bon trang
      // truot (toursanmay.vn, adventuredalat.com...) thanh ra khong co gi de
      // soi lai, va muon sua luat la phai tai lai ca site. Day dung la bai hoc
      // Phase O — TACH TAI KHOI PHAN TICH — ma toi vua pha lai.
      row.thoi_luong = d.thoiLuong; row.gio_don = d.gioDon;
      row.gia_tham_khao = d.gia; row.mua = d.mua;
      row.ten_tour = d.tenTour.slice(0, 12);
      writeFileSync(join(PAGES_DIR, `web-${dv.id}-1.txt`), d.van_ban, 'utf-8');

      // Xac minh so bo (buoc phan tich se tinh lai tu file, khong can tai lai).
      // Token >= 4 ky tu, khong phai 5: "toursanmay.vn" truot lan dau vi ten
      // don vi tach ra chi con "booking" dat do dai 5.
      const host = fold(new URL(page.url()).hostname.replace(/^www\./, ''));
      const tokens = dv.ten.split(/[\s\-–|]+/).map(fold).filter((x) => x.length >= 4);
      const hostHit = tokens.some((tk) => host.includes(tk));
      const textHit = tokens.filter((tk) => fold(d.van_ban).includes(tk)).length >= 2;
      row.xac_minh = hostHit || textHit;
      row.ly_do_xac_minh = hostHit ? 'tên miền chứa từ trong tên đơn vị'
        : textHit ? 'từ trong tên đơn vị xuất hiện trong nội dung trang' : null;

      // Trang con: chi theo link co chu "tour"/"bang gia"/"lich trinh".
      const links: string[] = await page.evaluate(`(() => Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => /tour|bang-?gia|lich-?trinh|san-?may|canyoning|camping|combo|dich-?vu/i.test(h))
        .filter(h => h.startsWith(location.origin))
        .slice(0, 8))()`) as string[];
      for (const href of Array.from(new Set(links)).slice(0, MAX_SUB)) {
        try {
          await page.waitForTimeout(1500);
          await page.goto(href, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1200);
          const s = (await page.evaluate(EXTRACT_SRC)) as Ext;
          row.so_trang_doc += 1;
          row.thoi_luong = Array.from(new Set([...row.thoi_luong, ...s.thoiLuong]));
          row.gio_don = Array.from(new Set([...row.gio_don, ...s.gioDon]));
          row.gia_tham_khao = Array.from(new Set([...row.gia_tham_khao, ...s.gia]));
          row.mua = Array.from(new Set([...row.mua, ...s.mua]));
          row.ten_tour = Array.from(new Set([...row.ten_tour, ...s.tenTour])).slice(0, 20);
          writeFileSync(join(PAGES_DIR, `web-${dv.id}-${row.so_trang_doc}.txt`), s.van_ban, 'utf-8');
        } catch { /* mot trang con hong khong lam hong ca site */ }
      }
    } catch (e) {
      row.loi = `${(e as Error).name}: ${(e as Error).message.split('\n')[0].slice(0, 70)}`;
    }
    rows.push(row);
    const mk = row.loi ? 'LOI' : row.xac_minh ? 'OK ' : '⛔ ';
    console.log(`[${String(i + 1).padStart(2)}/${targets.length}] ${mk} ${row.id} ${row.ten.slice(0, 28).padEnd(30)}`
      + `tr=${row.so_trang_doc} giờ=${row.gio_don.length} lượng=${row.thoi_luong.length}`
      + ` giá=${row.gia_tham_khao.length} mùa=${row.mua.length}${row.loi ? ' ' + row.loi : ''}`);
    if (i < targets.length - 1) await page.waitForTimeout(DELAY_MS);
  }

  await browser.close();
  writeFileSync(OUT, JSON.stringify(rows, null, 1), 'utf-8');

  const ok = rows.filter((r) => r.xac_minh);
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`xác minh được ${ok.length}/${rows.length} · lỗi ${rows.filter((r) => r.loi).length}`);
  const chua = rows.filter((r) => !r.xac_minh && !r.loi);
  if (chua.length) {
    console.log(`\n⛔ KHÔNG xác minh được — đã bỏ toàn bộ giá trị:`);
    for (const r of chua) console.log(`   ${r.id} ${r.ten.slice(0, 32)} → ${r.url}`);
  }
  const f = (k: keyof Row) => ok.filter((r) => (r[k] as string[]).length).length;
  console.log(`\ngiờ đón ${f('gio_don')} · thời lượng ${f('thoi_luong')} · giá ${f('gia_tham_khao')} · mùa ${f('mua')}`);
  console.log(`saved -> ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
