/**
 * GET /api/planner/itinerary — dựng lịch trình deterministic từ KB export.
 *
 * Query: slug, days, pace(relaxed|moderate|packed), adults, children, elders,
 *        wheelchair(0|1), avoidSteep(0|1), interests(csv).
 * Trả itinerary JSON (đã dựng, ~10-15 mục) — KHÔNG bao giờ trả cả kho.
 *
 * Node runtime: engine đọc KB store server-side (dev: đĩa · prod: R2 private + cache RAM
 * qua getStore). Chỉ itinerary đã dựng ra client, không bao giờ cả kho.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { buildItinerary, getStore, requestFromParams, toPlannerDto, CityDataUnavailableError } from '@/trip-planner/lib/planner';

async function handler(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const request = requestFromParams(searchParams);
  let store;
  try {
    store = await getStore(request.slug);
  } catch (e) {
    if (e instanceof CityDataUnavailableError)
      return NextResponse.json({ error: 'city_unavailable', message: 'Thành phố chưa được hỗ trợ' }, { status: 404 });
    throw e;
  }
  const itinerary = buildItinerary(request, store);
  // Trả DTO (client-safe) — KHÔNG gửi raw Itinerary (PlaceRef.phone điểm/nhà hàng = PII).
  return NextResponse.json(
    { dto: toPlannerDto(itinerary), href: `/lich-trinh?${searchParams.toString()}`, days: itinerary.days.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withErrorHandler(handler);
