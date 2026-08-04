/**
 * fb_pages_crawl.mts — doc du lieu DOANH NGHIEP tu trang Facebook cong khai.
 *
 * KHONG dang nhap, khong proxy, khong gia van tay, khong vuot rao ky thuat.
 * Chi mo trang cong khai tuan tu nhu mot nguoi dung binh thuong. Day la phia an
 * toan cua ranh gioi Meta v. Bright Data (1/2024): dieu khoan Meta chi rang buoc
 * nguoi DA dang nhap.
 *
 * Chay:
 *   pnpm tsx tourism-kb/code/fb_pages_crawl.mts <thu-muc-raw>
 *
 * Doc  raw/fb_targets.json  (sinh boi resolve_facebook.py)
 * Ghi  raw/fb_pages.json    + raw/pages/fb-<id>.txt (bang chung)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HAI DIEU KHONG DUOC SUA MA KHONG DOC KY:
 *
 * 1. CAT VUNG BAI DANG TRUOC KHI DOC, khong loc sau khi doc.
 *    Trang "Unofficial Page" (Facebook tu sinh tu luot check-in) hien bai cua
 *    NGUOI DUNG kem ten that: "Uyên Uyên is at Thác Datanla". Ta khong co can
 *    cu phap ly nao de luu du lieu ca nhan do (PDPL 2025 khong co mien tru
 *    "da dang cong khai"). CUT() cat tai marker dau tien va chi doc phan trUOC
 *    do — nen ten nguoi khong bao gio di vao bo nho, khong chi la khong vao file.
 *
 * 2. KHONG dung fetch() de gop nhieu trang trong mot lan.
 *    Da thu: HTML tho la vo JS 334 KB, noi dung render phia client, khong co
 *    du lieu nao trong do. Phai dieu huong that va cho render.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = process.argv[2];
if (!RAW) {
  console.error('thieu tham so: duong dan thu muc raw');
  process.exit(1);
}
const PAGES_DIR = join(RAW, 'pages');
const OUT = join(RAW, 'fb_pages.json');

/** Nghi giua cac trang. Tuan tu + co nghi = hanh vi doc binh thuong. */
const DELAY_MS = 4000;
const NAV_TIMEOUT = 45_000;

interface Target {
  id: string;
  ten: string;
  fb_url: string;
  dien_thoai_overture: string | null;
}

interface Row {
  id: string;
  ten: string;
  fb_url_yeu_cau: string;
  fb_url_cuoi: string | null;
  chuyen_huong_id_khac: boolean;
  tieu_de: string | null;
  loai_trang: 'quan_ly' | 'khong_chinh_thuc' | null;
  danh_muc: string | null;
  dia_chi_fb: string | null;
  dien_thoai_fb: string | null;
  email_fb: string | null;
  website_fb: string | null;
  gio_mo_cua_fb: string | null;
  khoang_gia_fb: string | null;
  ty_le_gioi_thieu: string | null;
  so_luot_danh_gia: string | null;
  so_nguoi_theo_doi: string | null;
  so_luot_checkin: string | null;
  trang_thai_dong_cua: string | null;
  dien_thoai_khop_overture: boolean | null;
  loi: string | null;
}

/** Chi lay chu so, de so sanh dien thoai qua moi cach viet dau cach/dau ngoac. */
const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

interface Extracted {
  urlCuoi: string; tieuDe: string | null; nhiemDuLieuCaNhan: boolean; loaiTrang: string;
  danhMuc: string | null; diaChi: string | null; dienThoai: string | null;
  email: string | null; website: string | null; gio: string | null;
  khoangGia: string | null; tyLeGioiThieu: string | null;
  soLuotDanhGia: string | null; soNguoiTheoDoi: string | null;
  soLuotCheckin: string | null; dongCua: string | null; bangChung: string;
}

/**
 * Trich trong TRANG DUYET.
 *
 * Vi sao la CHUOI chu khong phai ham: `tsx`/esbuild chen helper `__name` vao
 * moi ham co ten (keepNames), roi `page.evaluate(fn)` gui MA NGUON ham sang
 * trinh duyet — noi khong co helper do. Ket qua:
 *     ReferenceError: __name is not defined
 * tren ca 35 trang. Chuoi thi esbuild khong dong vao.
 */
const EXTRACT_SRC = `(() => {
  const t = (document.body && document.body.innerText) || '';

  // ── Cat TRUOC khi doc ─────────────────────────────────────────────────
  // MOI marker phai co CA HAI ngon ngu. Lan chay dau tien chung chi co ban
  // tieng Anh trong khi context dat locale vi-VN, nen bo cat khong khop gi ca
  // va ten nguoi binh luan ("Thảo Hà", "Dương Ba Gác") di thang vao file bang
  // chung. Bo cat khong duoc phu thuoc vao ngon ngu trang tra ve.
  const STOP = new RegExp([
    'Bài viết về ', 'Posts about ',
    'Tính minh bạch của Trang', 'Page transparency',
    'Quyền riêng tư', 'Privacy',
    'Xem thêm trên Facebook', 'See more on Facebook',
    'Xem thêm từ ', 'See more from ',
    'Chỉ báo trạng thái online',
    'Tất cả cảm xúc', 'All reactions'
  ].join('|'));
  const cut = t.split(STOP)[0];

  // ── Phep kiem chan ────────────────────────────────────────────────────
  // Neu sau khi cat VAN con dau vet bai dang thi bo cat da hong. Bao len de
  // hang do bi loai, thay vi ghi ra file roi phat hien sau.
  const POISON = /(đang ở |\\bis at |Bình luận|\\bComment\\b|Tác giả|Thích\\n|\\bLike\\n)/;
  const nhiem = POISON.test(cut);

  const g = (re) => { const m = cut.match(re); return m ? (m[1] !== undefined ? m[1] : m[0]).trim() : null; };

  return {
    urlCuoi: location.href,
    tieuDe: document.title || null,
    nhiemDuLieuCaNhan: nhiem,
    loaiTrang: /Unofficial Page|Trang không chính thức/.test(cut) ? 'khong_chinh_thuc' : 'quan_ly',
    danhMuc: g(/(?:Page|Trang|Profile)\\s*·\\s*([^\\n]+)/),
    // Facebook in dia chi thanh MOT dong ket thuc bang ten nuoc.
    diaChi: g(/\\n([^\\n]{10,200},\\s*(?:Vietnam|Việt Nam))\\n/),
    dienThoai: g(/(?:\\+84|0)[\\d\\s().-]{8,14}/),
    email: g(/[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}/),
    website: g(/\\n((?:https?:\\/\\/)?[a-z0-9][a-z0-9.-]*\\.(?:vn|com|net|org)(?:\\/[^\\s\\n]*)?)\\n/i),
    gio: g(/(Always open|Open now[^\\n]*|Closed now[^\\n]*|Opens? at [^\\n]*|Closes? at [^\\n]*|Open 24 hours|Luôn mở cửa|Đang mở cửa[^\\n]*|Đã đóng cửa[^\\n]*|Mở cửa lúc[^\\n]*|Đóng cửa lúc[^\\n]*|Mở cửa 24 giờ)/i),
    khoangGia: g(/(?:Price Range|Khoảng giá)\\s*·\\s*([^\\n]+)/i),
    tyLeGioiThieu: g(/(\\d+)%\\s*(?:recommend|đề xuất|giới thiệu)/i),
    soLuotDanhGia: g(/(?:recommend|đề xuất|giới thiệu)[^\\n(]*\\((\\d[\\d,.]*)\\s*(?:Review|đánh giá)/i),
    soNguoiTheoDoi: g(/([\\d.,]+[KMN]?)\\s+(?:followers|người theo dõi)/),
    soLuotCheckin: g(/([\\d,.]+)\\s+(?:people checked in here|người đã check in tại đây)/),
    dongCua: g(/(Permanently closed|Temporarily closed|Đã đóng cửa vĩnh viễn|Tạm thời đóng cửa)/i),
    // Bang chung — DA CAT. Chi duoc ghi ra dia khi nhiemDuLieuCaNhan === false.
    bangChung: cut
  };
})()`;

async function main() {
  mkdirSync(PAGES_DIR, { recursive: true });
  let targets: Target[] = JSON.parse(readFileSync(join(RAW, 'fb_targets.json'), 'utf-8'));
  // FB_LIMIT=1 de thu bo trich trUOC khi nap ca 35 trang. Hai lan chay hong
  // truoc day moi lan deu ton 35 luot tai trang cho mot loi tim thay ngay o
  // trang dau — thu mot trang truoc thi re hon nhieu.
  if (process.env.FB_LIMIT) targets = targets.slice(0, Number(process.env.FB_LIMIT));
  console.log(`${targets.length} trang can mo, nghi ${DELAY_MS / 1000}s giua moi trang\n`);

  const browser: Browser = await chromium.launch({ headless: true });
  // Khong dung storageState, khong cookie dang nhap. Phien trong.
  const ctx = await browser.newContext({ locale: 'vi-VN' });
  const page: Page = await ctx.newPage();

  const rows: Row[] = [];

  for (const [i, tgt] of targets.entries()) {
    const idYeuCau = tgt.fb_url.replace(/\/+$/, '').split('/').pop() || '';
    const row: Row = {
      id: tgt.id, ten: tgt.ten, fb_url_yeu_cau: tgt.fb_url, fb_url_cuoi: null,
      chuyen_huong_id_khac: false, tieu_de: null, loai_trang: null, danh_muc: null,
      dia_chi_fb: null, dien_thoai_fb: null, email_fb: null, website_fb: null,
      gio_mo_cua_fb: null, khoang_gia_fb: null, ty_le_gioi_thieu: null,
      so_luot_danh_gia: null, so_nguoi_theo_doi: null, so_luot_checkin: null,
      trang_thai_dong_cua: null, dien_thoai_khop_overture: null, loi: null,
    };

    try {
      await page.goto(tgt.fb_url, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
      // Khoi Intro render sau. Cho no, nhung khong that bai neu trang khong co
      // (trang khong chinh thuc khong bao gio co Intro).
      await page.waitForTimeout(2500);

      const d = (await page.evaluate(EXTRACT_SRC)) as Extracted;

      // Bo cat hong => KHONG ghi gi ca. Tha mat mot hang con hon ghi ten
      // nguoi binh luan vao dia.
      if (d.nhiemDuLieuCaNhan) {
        row.loi = 'BO CAT HONG — con dau vet bai dang, da bo hang nay';
        row.fb_url_cuoi = d.urlCuoi;
        rows.push(row);
        console.log(`[${String(i + 1).padStart(2)}/${targets.length}] ⛔ ${tgt.id} ${tgt.ten} — ${row.loi}`);
        if (i < targets.length - 1) await page.waitForTimeout(DELAY_MS);
        continue;
      }

      row.fb_url_cuoi = d.urlCuoi;
      row.tieu_de = d.tieuDe;
      row.loai_trang = d.loaiTrang as Row['loai_trang'];
      row.danh_muc = d.danhMuc;
      row.dia_chi_fb = d.diaChi;
      row.dien_thoai_fb = d.dienThoai;
      row.email_fb = d.email;
      row.website_fb = d.website;
      row.gio_mo_cua_fb = d.gio;
      row.khoang_gia_fb = d.khoangGia;
      row.ty_le_gioi_thieu = d.tyLeGioiThieu;
      row.so_luot_danh_gia = d.soLuotDanhGia;
      row.so_nguoi_theo_doi = d.soNguoiTheoDoi;
      row.so_luot_checkin = d.soLuotCheckin;
      row.trang_thai_dong_cua = d.dongCua;

      // Chuyen huong sang ID KHAC = co the khong phai trang chinh chu.
      // DL-10 Thien Vien Truc Lam da dinh dung ca nay: xin 107349855685345,
      // ve /people/100092055947685, 2,6K theo doi, website la trang danh ba.
      const idCuoi = (d.urlCuoi.match(/\/(\d{8,})\/?/) || [])[1];
      row.chuyen_huong_id_khac = Boolean(idCuoi && idYeuCau && idCuoi !== idYeuCau);

      // Doi chieu doc lap: so Facebook co trung so Overture khong.
      if (row.dien_thoai_fb && tgt.dien_thoai_overture) {
        const a = digits(row.dien_thoai_fb).slice(-9);
        const b = digits(tgt.dien_thoai_overture).slice(-9);
        row.dien_thoai_khop_overture = a === b;
      }

      writeFileSync(join(PAGES_DIR, `fb-${tgt.id}.txt`), d.bangChung, 'utf-8');
    } catch (e) {
      row.loi = `${(e as Error).name}: ${(e as Error).message.split('\n')[0]}`;
    }

    rows.push(row);
    const mark = row.loi ? 'LOI' : row.loai_trang === 'quan_ly' ? 'QL ' : 'KCT';
    const bonus = row.so_luot_checkin ? `checkin=${row.so_luot_checkin}`
      : row.so_nguoi_theo_doi ? `theo doi=${row.so_nguoi_theo_doi}` : '';
    console.log(
      `[${String(i + 1).padStart(2)}/${targets.length}] ${mark} ${tgt.id} ${tgt.ten.slice(0, 26).padEnd(28)}` +
      `${row.chuyen_huong_id_khac ? ' ⚠chuyen-huong' : ''} ${bonus}${row.loi ? ' ' + row.loi : ''}`,
    );

    if (i < targets.length - 1) await page.waitForTimeout(DELAY_MS);
  }

  await browser.close();
  writeFileSync(OUT, JSON.stringify(rows, null, 1), 'utf-8');

  // ── Tong ket ────────────────────────────────────────────────────────────
  const n = (f: keyof Row) => rows.filter((r) => r[f]).length;
  const ql = rows.filter((r) => r.loai_trang === 'quan_ly').length;
  const kct = rows.filter((r) => r.loai_trang === 'khong_chinh_thuc').length;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`trang quan ly ${ql} · khong chinh thuc ${kct} · loi ${n('loi')}`);
  console.log(`dien thoai ${n('dien_thoai_fb')} · email ${n('email_fb')} · website ${n('website_fb')}`);
  console.log(`gio mo cua ${n('gio_mo_cua_fb')} · khoang gia ${n('khoang_gia_fb')}`);
  console.log(`ty le gioi thieu ${n('ty_le_gioi_thieu')} · check-in ${n('so_luot_checkin')} · theo doi ${n('so_nguoi_theo_doi')}`);

  const khop = rows.filter((r) => r.dien_thoai_khop_overture === true).length;
  const lech = rows.filter((r) => r.dien_thoai_khop_overture === false);
  console.log(`\ndoi chieu dien thoai voi Overture: ${khop} khop, ${lech.length} lech`);
  for (const r of lech) console.log(`  LECH ${r.id} ${r.ten}: fb=${r.dien_thoai_fb}`);

  const nghi = rows.filter((r) => r.chuyen_huong_id_khac);
  if (nghi.length) {
    console.log(`\n⚠ ${nghi.length} trang chuyen huong sang ID khac — XEM TAY truoc khi dung:`);
    for (const r of nghi) console.log(`  ${r.id} ${r.ten}\n     -> ${r.fb_url_cuoi}`);
  }
  console.log(`\nsaved -> ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
