/**
 * GET /api/planner/tiles — proxy 1 file PMTiles Việt Nam từ R2 PRIVATE (same-origin, CSP 'self').
 * Hỗ trợ HTTP Range (protomaps-leaflet range-fetch): 206 khi có Range, 200 khi không.
 * Giữ bucket R2 private (KB data nhạy cảm) — KHÔNG public bucket. Thiếu R2/creds -> 404 (map vẫn vẽ pin).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { fetchTile } from '@/trip-planner/lib/planner';

export async function GET(req: Request): Promise<Response> {
  try {
    const { body, status, headers } = await fetchTile(req.headers.get('range'));
    return new Response(body, { status, headers });
  } catch {
    return new Response('tile unavailable', { status: 404 });
  }
}
