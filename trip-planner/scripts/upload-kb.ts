// Upload KB JSON (4 file/thành phố) lên R2/S3 private cho prod. Chạy TAY sau pipeline export.
// Chỉ push các slug trong CITIES (cities.ts) — data nhỏ (~1-2MB/thành phố), KHÔNG ảnh.
//
//   STORAGE_STUB=false STORAGE_BUCKET=... STORAGE_ENDPOINT=... STORAGE_REGION=... \
//   STORAGE_ACCESS_KEY=... STORAGE_SECRET_KEY=... \
//   pnpm tsx trip-planner/scripts/upload-kb.ts
//
// Key layout khớp store.ts fetchJson: tourism/<slug>/<file>.json (private).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CITIES } from '../lib/planner/cities';

const FILES = ['meta.json', 'diem-den.json', 'nha-hang.json', 'khach-san.json'];
const ROOT = path.resolve(process.cwd(), 'tourism-kb', 'export');
const BUCKET = process.env.STORAGE_BUCKET;

if (!BUCKET) {
  console.error('Thiếu STORAGE_BUCKET (+ ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY). Dừng.');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '',
  },
});

async function main(): Promise<void> {
  let n = 0;
  let bytes = 0;
  for (const c of CITIES) {
    for (const f of FILES) {
      const p = path.join(ROOT, c.slug, f);
      if (!fs.existsSync(p)) {
        console.warn(`  SKIP (thiếu file): ${c.slug}/${f}`);
        continue;
      }
      const body = fs.readFileSync(p);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: `tourism/${c.slug}/${f}`,
          Body: body,
          ContentType: 'application/json',
        }),
      );
      n += 1;
      bytes += body.byteLength;
      console.log(`  PUT tourism/${c.slug}/${f}  (${(body.byteLength / 1024).toFixed(0)} KB)`);
    }
  }
  console.log(`\nĐã upload ${n} file (${(bytes / 1e6).toFixed(1)} MB) cho ${CITIES.length} thành phố.`);
}

main().catch((e) => {
  console.error('Upload lỗi:', e);
  process.exit(1);
});
