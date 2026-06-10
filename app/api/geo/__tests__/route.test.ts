import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/geo', () => ({
  listProvinces: () => [{ code: '01', name: 'Hà Nội' }],
  listDistricts: (p: string) => (p === '01' ? [{ code: '001', name: 'Ba Đình', provinceCode: '01' }] : []),
  listWards: (d: string) => (d === '001' ? [{ code: '00001', name: 'Phúc Xá', districtCode: '001' }] : []),
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = (q = '') => new NextRequest(`http://localhost/api/geo${q}`);

describe('GET /api/geo', () => {
  it('returns provinces when no params', async () => {
    const res = await GET(req());
    const json = await res.json();
    expect(json.items).toEqual([{ code: '01', name: 'Hà Nội' }]);
    // immutable reference data is cached hard
    expect(res.headers.get('Cache-Control')).toContain('max-age=86400');
  });

  it('returns districts for ?province=', async () => {
    const json = await (await GET(req('?province=01'))).json();
    expect(json.items).toEqual([{ code: '001', name: 'Ba Đình' }]);
  });

  it('returns wards for ?district= (district wins over province)', async () => {
    const json = await (await GET(req('?province=01&district=001'))).json();
    expect(json.items).toEqual([{ code: '00001', name: 'Phúc Xá' }]);
  });

  it('projects items to {code,name} only', async () => {
    const json = await (await GET(req('?district=001'))).json();
    expect(Object.keys(json.items[0]).sort()).toEqual(['code', 'name']);
  });
});
