// Fixture KB tổng hợp cho E2E planner: ghi 4 file khớp store.ts/types.ts vào tourism-kb/export/<slug>/.
// tourism-kb/export gitignored (data-never-committed) → sinh lúc setup, không commit. Deterministic.
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'tourism-kb', 'export');

type LL = { lat: number; lon: number };

// KbRecord tối thiểu engine đọc (id/name/category/coordinates/address/contact/source_ids/data_quality/region_id).
function rec(id: string, name: string, ll: LL, region: string, cat: string): unknown {
  return {
    id,
    name,
    region_id: region,
    source_ids: ['osm:1', 'osm:2'], // >=1 -> provenance "nguồn: N"
    coordinates: { latitude: ll.lat, longitude: ll.lon },
    category: { primary: cat, secondary: [] },
    address: { full_address: `Địa chỉ ${id}` },
    contact: { phone: `+8490xxxxxx${id.replace(/\D/g, '') || '0'}` }, // placeholder khớp .gitleaks
    description: { value: `Mô tả ${name}` },
    data_quality: { last_verified_at: '2026-01-15' },
    external_ids: { google_place_id: null },
    ext: {},
  };
}

// Sinh điểm quanh tâm theo cụm region: mỗi region lệch nhỏ (~1.5km), điểm trong cụm sát nhau -> compact.
export function writeExport(slug: string, opts: { n: number; regions: number; tam?: LL }): void {
  const tam = opts.tam ?? { lat: 11.94, lon: 108.44 };
  const dir = path.join(ROOT, slug);
  if (fs.existsSync(path.join(dir, 'meta.json'))) return; // đã có data thật (main tree) -> KHÔNG đè
  fs.mkdirSync(dir, { recursive: true });

  const dd: unknown[] = [];
  for (let i = 0; i < opts.n; i++) {
    const r = i % opts.regions;
    const base: LL = { lat: tam.lat + r * 0.015, lon: tam.lon + r * 0.015 }; // cụm cách nhau ~1.5km
    const ll: LL = { lat: base.lat + (i % 5) * 0.002, lon: base.lon + ((i * 3) % 5) * 0.002 }; // jitter ~0.2km
    dd.push(rec(`d${i}`, `Điểm tham quan ${i}`, ll, `r${r}`, 'Điểm tham quan'));
  }
  // Quán ăn + khách sạn quanh tâm (đủ cho recommendRestaurants + pickHotel).
  const nh: unknown[] = [];
  for (let i = 0; i < Math.max(6, opts.n); i++)
    nh.push(rec(`n${i}`, `Quán ăn ${i}`, { lat: tam.lat + (i % 4) * 0.003, lon: tam.lon + (i % 3) * 0.003 }, 'r0', 'restaurant'));
  const ks: unknown[] = [];
  for (let i = 0; i < 4; i++)
    ks.push(rec(`k${i}`, `Khách sạn ${i}`, { lat: tam.lat + i * 0.002, lon: tam.lon + i * 0.002 }, 'r0', 'hotel'));

  const meta = { generated_at: '15/01/2026', tam, osrm_diem_den: null }; // null -> engine fallback haversine
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
  fs.writeFileSync(path.join(dir, 'diem-den.json'), JSON.stringify(dd));
  fs.writeFileSync(path.join(dir, 'nha-hang.json'), JSON.stringify(nh));
  fs.writeFileSync(path.join(dir, 'khach-san.json'), JSON.stringify(ks));
}
