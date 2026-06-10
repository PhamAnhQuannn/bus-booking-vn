/**
 * GET /api/geo — VN administrative-unit lookup for the cascading AdminUnitPicker.
 *
 *   /api/geo                      → { items: provinces }      (63 rows)
 *   /api/geo?province=<code>      → { items: districts }      (of that province)
 *   /api/geo?district=<code>      → { items: wards }          (of that district)
 *
 * Serves the vendored 3-tier dataset (lib/geo/vnAdmin) from the SERVER so the
 * ~690 KB JSON never enters the operator-console client bundle. Items are
 * {code,name} only. The data is public, immutable reference data — cached hard.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { listProvinces, listDistricts, listWards } from '@/lib/geo';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const province = searchParams.get('province');
  const district = searchParams.get('district');

  const rows = district
    ? listWards(district)
    : province
      ? listDistricts(province)
      : listProvinces();

  const items = rows.map((r) => ({ code: r.code, name: r.name }));

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } }
  );
}

export const GET = withErrorHandler(handler);
