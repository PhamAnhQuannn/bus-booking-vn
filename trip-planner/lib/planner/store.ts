// Nạp bộ export KB (server-side) vào bộ nhớ + tiện ích khoảng cách.
// Dev: đọc JSON gitignored từ đĩa. Prod: fetch từ R2/S3 private (STORAGE_*), cache RAM (getStore).
// KHÔNG bao giờ gửi cả store ra client — chỉ itinerary đã dựng. Đọc process.env trực tiếp (không
// import lib/ — giữ planner tách khỏi bus-app).

import * as fs from "node:fs";
import * as path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isCitySlug } from "./cities";
import type { KbMeta, KbOpeningSlot, KbRecord, PlaceRef } from "./types";

// Slug lạ hoặc data chưa nạp được (R2 NoSuchKey / đĩa ENOENT). Caller bắt -> thông báo lịch sự (không 500).
export class CityDataUnavailableError extends Error {
  constructor(slug: string, cause?: unknown) {
    super(`Dữ liệu thành phố không khả dụng: ${slug}`);
    this.name = "CityDataUnavailableError";
    if (cause) console.error(`[getStore] nạp '${slug}' lỗi:`, cause); // log gốc — không nuốt mù
  }
}

const EXPORT_ROOT = path.resolve(process.cwd(), "tourism-kb", "export");
const FILES = { meta: "meta.json", dd: "diem-den.json", nh: "nha-hang.json", ks: "khach-san.json" } as const;

interface Matrix {
  ids: string[];
  durations: number[][]; // giây
  distances: number[][]; // mét
}

export interface Store {
  slug: string;
  generatedAt: string;
  tam: { lat: number; lon: number };
  destinations: KbRecord[];
  restaurants: KbRecord[];
  hotels: KbRecord[];
  matrix: Matrix | null;
  matrixIndex: Map<string, number>;
}

function readJson<T>(slug: string, file: string): T {
  // Gate at the fs-read chokepoint: loadStore() is exported (scripts + buildItinerary
  // fallback) and bypasses getStore's isCitySlug check — keep slug on the CITIES allowlist
  // so it can never traverse outside EXPORT_ROOT.
  if (!isCitySlug(slug)) throw new CityDataUnavailableError(slug);
  const p = path.join(EXPORT_ROOT, slug, file);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

// Dựng Store từ 4 payload ĐÃ đọc (fs hoặc blob) — 1 nguồn logic matrix/index, không nhân đôi.
function buildStore(slug: string, meta: KbMeta, destinations: KbRecord[], restaurants: KbRecord[], hotels: KbRecord[]): Store {
  const matrix: Matrix | null = meta.osrm_diem_den?.ids ? meta.osrm_diem_den : null;
  const matrixIndex = new Map<string, number>();
  if (matrix) matrix.ids.forEach((id, i) => matrixIndex.set(id, i));
  return { slug, generatedAt: meta.generated_at, tam: meta.tam, destinations, restaurants, hotels, matrix, matrixIndex };
}

// Đồng bộ, đọc đĩa — dev + scripts (golden-trip). buildItinerary fallback về đây khi không truyền store.
export function loadStore(slug: string): Store {
  return buildStore(
    slug,
    readJson<KbMeta>(slug, FILES.meta),
    readJson<KbRecord[]>(slug, FILES.dd),
    readJson<KbRecord[]>(slug, FILES.nh),
    readJson<KbRecord[]>(slug, FILES.ks),
  );
}

// ── Prod: fetch JSON từ R2/S3 private (STORAGE_*) ───────────────────────────
const blobEnabled = (): boolean => process.env.STORAGE_STUB === "false" && !!process.env.STORAGE_BUCKET;
let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3)
    _s3 = new S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
      },
    });
  return _s3;
}
async function fetchJson<T>(slug: string, file: string): Promise<T> {
  const out = await s3().send(new GetObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: `tourism/${slug}/${file}` }));
  const body = await out.Body!.transformToString("utf-8");
  return JSON.parse(body) as T;
}
async function loadStoreBlob(slug: string): Promise<Store> {
  const [meta, dd, nh, ks] = await Promise.all([
    fetchJson<KbMeta>(slug, FILES.meta),
    fetchJson<KbRecord[]>(slug, FILES.dd),
    fetchJson<KbRecord[]>(slug, FILES.nh),
    fetchJson<KbRecord[]>(slug, FILES.ks),
  ]);
  return buildStore(slug, meta, dd, nh, ks);
}

// Nguồn kép + cache RAM (warm across requests trên Fluid Compute). Caller (route/RSC) await cái này.
const CACHE = new Map<string, Store>();
export async function getStore(slug: string): Promise<Store> {
  const hit = CACHE.get(slug);
  if (hit) return hit;
  if (!isCitySlug(slug)) throw new CityDataUnavailableError(slug); // gate: ngoài CITIES -> không fetch
  let st: Store;
  try {
    st = blobEnabled() ? await loadStoreBlob(slug) : loadStore(slug);
  } catch (e) {
    throw new CityDataUnavailableError(slug, e); // R2/đĩa thiếu -> lịch sự thay vì 500 trần
  }
  CACHE.set(slug, st);
  return st;
}

// Haversine (mét) — fallback khi không có ma trận OSRM (nhà hàng/khách sạn).
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Thời gian lái giữa 2 điểm đến (phút) từ ma trận OSRM; null nếu không có trong ma trận.
export function driveMinutes(store: Store, idA: string, idB: string): number | null {
  if (!store.matrix) return null;
  const i = store.matrixIndex.get(idA);
  const j = store.matrixIndex.get(idB);
  if (i === undefined || j === undefined) return null;
  return Math.round((store.matrix.durations[i][j] / 60) * 10) / 10;
}

// Trích PlaceRef từ 1 record (dùng cho cả 3 loại; đọc field theo schema đã export).
export function toPlaceRef(rec: KbRecord): PlaceRef {
  const oh = rec.ext?.destination?.opening_hours;
  const sched: KbOpeningSlot[] = oh?.regular_schedule ?? [];
  const gio_mo = sched.length ? summariseHours(sched) : oh?.raw ?? null;
  return {
    id: rec.id,
    name: rec.name,
    category: rec.category?.primary ?? null,
    lat: rec.coordinates?.latitude ?? null,
    lon: rec.coordinates?.longitude ?? null,
    address: rec.address?.full_address ?? null,
    phone: rec.contact?.phone ?? null,
    gio_mo,
    goi_truoc: !gio_mo, // không có giờ -> phải gọi trước
    map_url: rec.ext?.destination?.map?.google_maps_url ?? null,
    source_ids: rec.source_ids ?? [],
    ngay_du_lieu: rec.data_quality?.last_verified_at ?? null,
    region_id: rec.region_id ?? null,
    trai_nghiem: rec.ext?.destination?.trai_nghiem ?? null,
    vibes: rec.ext?.destination?.vibes ?? [],
    google_place_id: rec.external_ids?.google_place_id ?? null,
  };
}

function summariseHours(sched: KbOpeningSlot[]): string {
  // Gộp gọn: "07:00-17:30" (lấy khoảng đầu; đủ cho hiển thị V1).
  const first = sched[0];
  if (!first?.open || !first?.close) return "";
  return `${first.open}-${first.close}`;
}
