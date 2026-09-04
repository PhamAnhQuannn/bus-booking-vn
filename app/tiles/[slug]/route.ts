// Same-origin PMTiles proxy cho basemap trip-planner (#528). protomaps-leaflet fetch
// `/tiles/<slug>.pmtiles` bằng HTTP Range → route này forward Range tới R2 (STORAGE_*) và trả
// 206 + Content-Range. Giữ CSP `connect-src 'self'` (không host ngoài) + PDPL (IP khách ở origin
// ta, không chạm R2 trực tiếp). Tile là OSM/Protomaps public — KHÔNG PII, nên proxy bytes ở đây
// là đúng (khác lib/storage signed-URL cho PII). 3 tile cũ (da-lat/da-nang/nha-trang) vẫn là file
// static trong public/tiles/ → static precedence phục vụ chúng; route này chỉ bắt slug chưa có file.
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs'; // aws-sdk cần Node
export const dynamic = 'force-dynamic'; // phụ thuộc header Range — không static-optimize

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3)
    _s3 = new S3Client({
      region: process.env.STORAGE_REGION || 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '',
      },
    });
  return _s3;
}

const KEY_RE = /^[a-z0-9-]+\.pmtiles$/; // slug an toàn + đuôi .pmtiles (chống path traversal)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!KEY_RE.test(slug)) return new Response('bad tile key', { status: 400 });

  const range = req.headers.get('range') ?? undefined;
  try {
    const out = await s3().send(
      new GetObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: `tiles/${slug}`, Range: range }),
    );
    const body = (out.Body as { transformToWebStream(): ReadableStream }).transformToWebStream();
    const partial = !!range && !!out.ContentRange;
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable', // tile immutable → CDN/browser cache lâu
    });
    if (out.ContentLength != null) headers.set('Content-Length', String(out.ContentLength));
    if (partial) headers.set('Content-Range', out.ContentRange!);
    return new Response(body, { status: partial ? 206 : 200, headers });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') return new Response('tile not found', { status: 404 });
    return new Response('tile error', { status: 502 });
  }
}
